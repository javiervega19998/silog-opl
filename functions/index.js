// ══════════════════════════════════════════════
// CLOUD FUNCTIONS v2 — SILOG SpA
// Gestión de Custom Claims para roles de usuario
// ══════════════════════════════════════════════
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError }  = require('firebase-functions/v2/https');
const { initializeApp }       = require('firebase-admin/app');
const { getAuth }             = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

// ── Helper: obtiene el Firebase Auth UID a partir del email ──────
// Necesario porque en este proyecto los docs de Firestore usan el
// email como ID en vez del UID de Firebase Auth.
async function getUidByEmail(auth, email) {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch (e) {
    console.warn(`[getUidByEmail] No se encontró usuario Auth para email: ${email} → ${e.message}`);
    return null;
  }
}

// ── Helper: obtiene el email de un documento de usuario ──────────
function getEmailFromDoc(doc) {
  const d = doc.data();
  // El doc.id puede ser el email (patrón de este proyecto)
  const emailFromId = doc.id.includes('@') ? doc.id : null;
  return d.correo_electronico || d.email || emailFromId || null;
}

// ── 1. Trigger automático: cuando se actualiza el rol en Firestore
//       sincroniza el custom claim en el JWT del usuario
// ──────────────────────────────────────────────────────────────────
exports.onUserRoleUpdate = onDocumentWritten(
  { document: 'users/{docId}', region: 'us-central1' },
  async (event) => {
    const docId = event.params.docId;
    const auth  = getAuth();

    if (!event.data.after.exists) {
      // Documento eliminado: intentar borrar claims si el docId es un UID válido
      try { await auth.setCustomUserClaims(docId, {}); } catch {}
      return;
    }

    const dataAhora = event.data.after.data();
    const dataAntes = event.data.before.exists ? event.data.before.data() : {};
    const rolAhora  = dataAhora.rol || 'conductor';
    const rolAntes  = dataAntes.rol || null;

    if (rolAntes === rolAhora) {
      console.log(`[claims] Sin cambio de rol para ${docId} (${rolAhora}), omitiendo.`);
      return;
    }

    // Obtener el UID real de Firebase Auth (el docId puede ser el email)
    const email = getEmailFromDoc(event.data.after);
    let uid = null;
    if (email) {
      uid = await getUidByEmail(auth, email);
    }
    // Si el docId no es un email, asumimos que ES el UID
    if (!uid && !docId.includes('@')) {
      uid = docId;
    }

    if (!uid) {
      console.error(`[claims] No se pudo obtener UID para doc: ${docId}`);
      return;
    }

    try {
      await auth.setCustomUserClaims(uid, {
        rol:  rolAhora,
        area: dataAhora.area || 'Operaciones',
      });
      console.log(`[claims] UID ${uid} (doc: ${docId}) → rol: ${rolAhora}`);
      await event.data.after.ref.update({
        claims_sync:    true,
        claims_updated: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error('[claims] Error al actualizar claims:', e.message);
    }
  }
);

// ── 2. Callable manual: el admin puede forzar sincronización de claims
//    Verifica el rol en FIRESTORE (no en el token) → resuelve el bootstrap.
//    Busca el UID real de Firebase Auth por email para cada usuario.
// ──────────────────────────────────────────────────────────────────
exports.syncAllClaims = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión primero.');
    }

    const db   = getFirestore();
    const auth = getAuth();

    // Verificar admin en Firestore — múltiples estrategias de búsqueda
    let callerDoc = await db.collection('users').doc(request.auth.uid).get();

    if (!callerDoc.exists && request.auth.token.email) {
      // El doc puede usar el email como ID
      callerDoc = await db.collection('users').doc(request.auth.token.email).get();
    }
    if (!callerDoc.exists && request.auth.token.email) {
      const q = await db.collection('users')
        .where('correo_electronico', '==', request.auth.token.email).limit(1).get();
      if (!q.empty) callerDoc = q.docs[0];
    }
    if (!callerDoc.exists && request.auth.token.email) {
      const q = await db.collection('users')
        .where('email', '==', request.auth.token.email).limit(1).get();
      if (!q.empty) callerDoc = q.docs[0];
    }

    if (!callerDoc.exists) {
      throw new HttpsError('permission-denied',
        `Usuario no encontrado. UID: ${request.auth.uid}, Email: ${request.auth.token.email}`);
    }
    const callerRol = (callerDoc.data().rol || '').toLowerCase();
    if (callerRol !== 'admin') {
      throw new HttpsError('permission-denied',
        `Solo el admin puede sincronizar. Tu rol en Firestore es: "${callerRol}".`);
    }

    // Sincronizar todos los usuarios
    const snap    = await db.collection('users').get();
    const results = [];

    for (const doc of snap.docs) {
      const u = doc.data();
      if (!u.rol) continue;

      try {
        // ⚡ CLAVE: buscar el UID real en Firebase Auth por email
        const email = getEmailFromDoc(doc);
        let uid = null;

        if (email) {
          uid = await getUidByEmail(auth, email);
        }
        // Si el doc.id no es email, puede ser el UID directamente
        if (!uid && !doc.id.includes('@')) {
          uid = doc.id;
        }

        if (!uid) {
          results.push({ docId: doc.id, email, error: 'No se encontró UID en Firebase Auth' });
          continue;
        }

        await auth.setCustomUserClaims(uid, {
          rol:  u.rol,
          area: u.area || 'Operaciones',
        });
        await doc.ref.update({ claims_sync: true, auth_uid: uid });
        results.push({ uid, email, rol: u.rol, ok: true });
        console.log(`[syncAllClaims] ${email} (UID: ${uid}) → rol: ${u.rol}`);
      } catch (e) {
        results.push({ docId: doc.id, error: e.message });
        console.error(`[syncAllClaims] Error en ${doc.id}:`, e.message);
      }
    }

    console.log(`[syncAllClaims] ${results.filter(r=>r.ok).length}/${results.length} usuarios sincronizados`);
    return { updated: results.filter(r => r.ok).length, results };
  }
);
