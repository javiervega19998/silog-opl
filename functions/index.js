// ══════════════════════════════════════════════
// CLOUD FUNCTIONS — SILOG SpA
// Gestión de Custom Claims para roles de usuario
// ══════════════════════════════════════════════
const functions  = require('firebase-functions');
const admin      = require('firebase-admin');
admin.initializeApp();

// ── 1. Trigger automático: cuando se actualiza el rol en Firestore
//       sincroniza el custom claim en el JWT del usuario
// ──────────────────────────────────────────────────────────────────
exports.onUserRoleUpdate = functions
  .region('us-central1')
  .firestore.document('users/{uid}')
  .onWrite(async (change, context) => {
    const uid  = context.params.uid;
    // Si el documento fue eliminado, borra los claims
    if (!change.after.exists) {
      await admin.auth().setCustomUserClaims(uid, {});
      console.log(`[claims] Borrados para UID: ${uid}`);
      return;
    }
    const data    = change.after.data();
    const rolAntes = change.before.exists ? change.before.data().rol : null;
    const rolAhora = data.rol || 'conductor';

    // Solo actúa si el rol cambió
    if (rolAntes === rolAhora) return;

    try {
      await admin.auth().setCustomUserClaims(uid, {
        rol:  rolAhora,
        area: data.area || 'Operaciones',
      });
      console.log(`[claims] UID ${uid} → rol: ${rolAhora}`);
      // Marca en Firestore que los claims están sincronizados
      await change.after.ref.update({ claims_sync: true, claims_updated: admin.firestore.FieldValue.serverTimestamp() });
    } catch (e) {
      console.error('[claims] Error al actualizar claims:', e.message);
    }
  });

// ── 2. Callable manual: el admin puede forzar sincronización de claims
//       Útil para usuarios existentes antes de instalar la function
// ──────────────────────────────────────────────────────────────────
exports.syncAllClaims = functions
  .region('us-central1')
  .https.onCall(async (data, context) => {
    // Solo el admin puede llamar esto
    if (!context.auth || context.auth.token.rol !== 'admin') {
      throw new functions.https.HttpsError('permission-denied', 'Solo el admin puede sincronizar claims.');
    }
    const snap = await admin.firestore().collection('users').get();
    const results = [];
    for (const doc of snap.docs) {
      const u = doc.data();
      if (!u.rol) continue;
      try {
        await admin.auth().setCustomUserClaims(doc.id, {
          rol:  u.rol,
          area: u.area || 'Operaciones',
        });
        await doc.ref.update({ claims_sync: true });
        results.push({ uid: doc.id, rol: u.rol, ok: true });
      } catch (e) {
        results.push({ uid: doc.id, error: e.message });
      }
    }
    console.log(`[syncAllClaims] ${results.length} usuarios procesados`);
    return { updated: results.length, results };
  });
