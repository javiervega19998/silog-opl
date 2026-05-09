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

// ── 1. Trigger automático: cuando se actualiza el rol en Firestore
//       sincroniza el custom claim en el JWT del usuario
// ──────────────────────────────────────────────────────────────────
exports.onUserRoleUpdate = onDocumentWritten(
  { document: 'users/{uid}', region: 'us-central1' },
  async (event) => {
    const uid = event.params.uid;

    // Documento eliminado → borrar claims
    if (!event.data.after.exists) {
      await getAuth().setCustomUserClaims(uid, {});
      console.log(`[claims] Borrados para UID: ${uid}`);
      return;
    }

    const dataAhora = event.data.after.data();
    const dataAntes = event.data.before.exists ? event.data.before.data() : {};
    const rolAhora  = dataAhora.rol || 'conductor';
    const rolAntes  = dataAntes.rol || null;

    // Solo actúa si el rol cambió (o si antes no existía)
    if (rolAntes === rolAhora) {
      console.log(`[claims] Sin cambio de rol para UID ${uid} (${rolAhora}), omitiendo.`);
      return;
    }

    try {
      await getAuth().setCustomUserClaims(uid, {
        rol:  rolAhora,
        area: dataAhora.area || 'Operaciones',
      });
      console.log(`[claims] UID ${uid} → rol: ${rolAhora}`);
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
//    ⚠️  Verifica el rol en FIRESTORE (no en el token) para el bootstrap inicial.
//    Así funciona incluso antes de que el admin tenga su propio custom claim.
// ──────────────────────────────────────────────────────────────────
exports.syncAllClaims = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Debes iniciar sesión primero.');
    }

    const db   = getFirestore();
    const auth = getAuth();

    // Verificar admin en Firestore — busca por UID primero, luego por email
    let callerDoc = await db.collection('users').doc(request.auth.uid).get();
    
    // Fallback: buscar por correo_electronico o email si no existe doc con UID
    if (!callerDoc.exists && request.auth.token.email) {
      const byEmail1 = await db.collection('users')
        .where('correo_electronico', '==', request.auth.token.email).limit(1).get();
      if (!byEmail1.empty) callerDoc = byEmail1.docs[0];
    }
    if (!callerDoc.exists && request.auth.token.email) {
      const byEmail2 = await db.collection('users')
        .where('email', '==', request.auth.token.email).limit(1).get();
      if (!byEmail2.empty) callerDoc = byEmail2.docs[0];
    }

    if (!callerDoc.exists) {
      throw new HttpsError('permission-denied',
        `Usuario no encontrado en la base de datos. UID: ${request.auth.uid}, Email: ${request.auth.token.email}`);
    }
    const callerRol = (callerDoc.data().rol || '').toLowerCase();
    if (callerRol !== 'admin') {
      throw new HttpsError('permission-denied',
        `Solo el admin puede sincronizar claims. Tu rol actual en Firestore es: "${callerRol}".`);
    }

    // Sincronizar todos los usuarios
    const snap    = await db.collection('users').get();
    const results = [];

    for (const doc of snap.docs) {
      const u = doc.data();
      if (!u.rol) continue;
      try {
        await auth.setCustomUserClaims(doc.id, {
          rol:  u.rol,
          area: u.area || 'Operaciones',
        });
        await doc.ref.update({ claims_sync: true });
        results.push({ uid: doc.id, rol: u.rol, ok: true });
        console.log(`[syncAllClaims] UID ${doc.id} → rol: ${u.rol}`);
      } catch (e) {
        results.push({ uid: doc.id, error: e.message });
        console.error(`[syncAllClaims] Error en UID ${doc.id}:`, e.message);
      }
    }

    console.log(`[syncAllClaims] ${results.length} usuarios procesados`);
    return { updated: results.length, results };
  }
);
