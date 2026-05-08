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

    const dataAhora  = event.data.after.data();
    const dataAntes  = event.data.before.exists ? event.data.before.data() : {};
    const rolAhora   = dataAhora.rol || 'conductor';
    const rolAntes   = dataAntes.rol || null;

    // Solo actúa si el rol cambió
    if (rolAntes === rolAhora) return;

    try {
      await getAuth().setCustomUserClaims(uid, {
        rol:  rolAhora,
        area: dataAhora.area || 'Operaciones',
      });
      console.log(`[claims] UID ${uid} → rol: ${rolAhora}`);
      // Marca en Firestore que los claims están sincronizados
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
//       Útil para usuarios existentes antes de instalar la function
// ──────────────────────────────────────────────────────────────────
exports.syncAllClaims = onCall(
  { region: 'us-central1' },
  async (request) => {
    // Solo el admin puede llamar esto
    if (!request.auth || request.auth.token.rol !== 'admin') {
      throw new HttpsError('permission-denied', 'Solo el admin puede sincronizar claims.');
    }

    const db   = getFirestore();
    const auth = getAuth();
    const snap = await db.collection('users').get();
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
      } catch (e) {
        results.push({ uid: doc.id, error: e.message });
      }
    }

    console.log(`[syncAllClaims] ${results.length} usuarios procesados`);
    return { updated: results.length, results };
  }
);
