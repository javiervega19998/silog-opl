// ══════════════════════════════════════════════
// CLOUD FUNCTIONS v2 — SILOG SpA
// ══════════════════════════════════════════════
const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError }  = require('firebase-functions/v2/https');
const { initializeApp }       = require('firebase-admin/app');
const { getAuth }             = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

initializeApp();

// ── Helper: obtiene email desde un documento de usuario ──────────
function getEmailFromDoc(doc) {
  const d = doc.data();
  const emailFromId = doc.id.includes('@') ? doc.id : null;
  return d.correo_electronico || d.email || emailFromId || null;
}

// ── Helper: obtiene el Firebase Auth UID por email ───────────────
async function getUidByEmail(auth, email) {
  try {
    const user = await auth.getUserByEmail(email);
    return user.uid;
  } catch {
    return null;
  }
}

// ── 1. MIGRACIÓN (una sola vez): email-como-ID → UID-como-ID ─────
// Llámala desde Admin → panel → "Migrar Usuarios".
// Después de ejecutar, el código queda normalizado para siempre.
// ─────────────────────────────────────────────────────────────────
exports.migrateUsersToUID = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');
    const db   = getFirestore();
    const auth = getAuth();

    // Solo admin puede migrar
    const adminEmail = request.auth.token.email;
    let adminDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!adminDoc.exists && adminEmail)
      adminDoc = await db.collection('users').doc(adminEmail).get();
    if (!adminDoc.exists || (adminDoc.data().rol || '').toLowerCase() !== 'admin')
      throw new HttpsError('permission-denied', 'Solo el admin puede ejecutar la migración.');

    const snap    = await db.collection('users').get();
    const results = [];

    for (const doc of snap.docs) {
      const email = getEmailFromDoc(doc);
      if (!email) { results.push({ docId: doc.id, skip: 'sin email' }); continue; }

      // Si el docId ya es un UID (no contiene @), no migrar
      if (!doc.id.includes('@')) {
        results.push({ docId: doc.id, skip: 'ya es UID' });
        continue;
      }

      try {
        const uid = await getUidByEmail(auth, email);
        if (!uid) { results.push({ docId: doc.id, email, error: 'No encontrado en Auth' }); continue; }

        const data = doc.data();
        // Crear nuevo documento con UID como ID
        await db.collection('users').doc(uid).set({
          ...data,
          correo_electronico: email,
          auth_uid:           uid,
          migrated_from:      doc.id,
          migrated_at:        FieldValue.serverTimestamp(),
        });
        // Asignar custom claim al UID correcto
        await auth.setCustomUserClaims(uid, {
          rol:  data.rol  || 'conductor',
          area: data.area || 'Operaciones',
        });
        // Eliminar documento viejo (con email como ID)
        await doc.ref.delete();

        results.push({ uid, email, rol: data.rol, ok: true });
        console.log(`[migrate] ${email} → UID: ${uid} ✅`);
      } catch (e) {
        results.push({ docId: doc.id, email, error: e.message });
        console.error(`[migrate] Error en ${doc.id}:`, e.message);
      }
    }

    const ok = results.filter(r => r.ok).length;
    console.log(`[migrate] ${ok}/${snap.size} documentos migrados.`);
    return { migrated: ok, total: snap.size, results };
  }
);

// ── 2. Trigger automático: sincroniza custom claim al editar rol ──
// Después de la migración, el docId = UID → sin getUserByEmail.
// Antes de migrar, hace el fallback por email.
// ─────────────────────────────────────────────────────────────────
exports.onUserRoleUpdate = onDocumentWritten(
  { document: 'users/{docId}', region: 'us-central1' },
  async (event) => {
    const docId = event.params.docId;
    const auth  = getAuth();

    if (!event.data.after.exists) {
      try { await auth.setCustomUserClaims(docId, {}); } catch {}
      return;
    }

    const dataAhora = event.data.after.data();
    const dataAntes = event.data.before.exists ? event.data.before.data() : {};
    const rolAhora  = dataAhora.rol || 'conductor';
    const rolAntes  = dataAntes.rol || null;

    if (rolAntes === rolAhora) return;

    // Si docId es email → buscar UID; si no, asumir que ES el UID
    let uid = docId.includes('@') ? await getUidByEmail(auth, docId) : docId;
    // Fallback adicional por campo correo_electronico
    if (!uid) {
      const email = getEmailFromDoc(event.data.after);
      if (email) uid = await getUidByEmail(auth, email);
    }
    if (!uid) { console.error(`[claims] Sin UID para ${docId}`); return; }

    try {
      await auth.setCustomUserClaims(uid, {
        rol:  rolAhora,
        area: dataAhora.area || 'Operaciones',
      });
      console.log(`[claims] ${docId} → rol: ${rolAhora}`);
      await event.data.after.ref.update({
        claims_sync:    true,
        claims_updated: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      console.error('[claims] Error:', e.message);
    }
  }
);

// ── 3. Callable manual: sincroniza claims de todos los usuarios ───
// Busca el UID real por email (compatible antes y después de migrar).
// ─────────────────────────────────────────────────────────────────
exports.syncAllClaims = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesión primero.');

    const db   = getFirestore();
    const auth = getAuth();

    // Verificar admin en Firestore
    let callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!callerDoc.exists && request.auth.token.email)
      callerDoc = await db.collection('users').doc(request.auth.token.email).get();
    if (!callerDoc.exists && request.auth.token.email) {
      const q = await db.collection('users').where('correo_electronico', '==', request.auth.token.email).limit(1).get();
      if (!q.empty) callerDoc = q.docs[0];
    }

    if (!callerDoc.exists)
      throw new HttpsError('permission-denied', `Usuario no encontrado. Email: ${request.auth.token.email}`);
    if ((callerDoc.data().rol || '').toLowerCase() !== 'admin')
      throw new HttpsError('permission-denied', `Tu rol en Firestore es: "${callerDoc.data().rol}". Se requiere admin.`);

    const snap    = await db.collection('users').get();
    const results = [];

    for (const doc of snap.docs) {
      const u = doc.data();
      if (!u.rol) continue;
      try {
        const email = getEmailFromDoc(doc);
        // Si el docId ya es UID (post-migración), usarlo directamente
        let uid = !doc.id.includes('@') ? doc.id : null;
        // Si no, buscar por email
        if (!uid && email) uid = await getUidByEmail(auth, email);
        if (!uid) { results.push({ docId: doc.id, error: 'Sin UID' }); continue; }

        await auth.setCustomUserClaims(uid, { rol: u.rol, area: u.area || 'Operaciones' });
        await doc.ref.update({ claims_sync: true });
        results.push({ uid, email, rol: u.rol, ok: true });
        console.log(`[sync] ${email || doc.id} → rol: ${u.rol}`);
      } catch (e) {
        results.push({ docId: doc.id, error: e.message });
      }
    }

    const ok = results.filter(r => r.ok).length;
    return { updated: ok, results };
  }
);
