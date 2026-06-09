// ══════════════════════════════════════════════
// CLOUD FUNCTIONS v2 — SILOG SpA
// ══════════════════════════════════════════════
const { onDocumentWritten, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { onCall, HttpsError }  = require('firebase-functions/v2/https');
const { initializeApp }       = require('firebase-admin/app');
const { getAuth }             = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getStorage }          = require('firebase-admin/storage');

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

// ═══════════════════════════════════════════════════════════════
// 4. ELIMINACIÓN EN CASCADA Y LIMPIEZA DE "DATOS BASURA"
// ═══════════════════════════════════════════════════════════════

// ── 4a. Cuando se elimina un Usuario ──
// Elimina al usuario de Firebase Auth y limpia su foto de perfil.
exports.onUserDeleted = onDocumentDeleted(
  { document: 'users/{docId}', region: 'us-central1' },
  async (event) => {
    const docId = event.params.docId;
    const data = event.data.data();
    
    // Obtener UID
    const auth = getAuth();
    let uid = docId.includes('@') ? await getUidByEmail(auth, docId) : docId;
    if (!uid) {
      const email = getEmailFromDoc(event.data);
      if (email) uid = await getUidByEmail(auth, email);
    }
    
    // 1. Eliminar de Auth
    if (uid) {
      try {
        await auth.deleteUser(uid);
        console.log(`[cleanup] Usuario ${uid} eliminado de Auth exitosamente.`);
      } catch (e) {
        console.error(`[cleanup] Error eliminando ${uid} de Auth:`, e.message);
      }
    }
    
    // 2. Eliminar foto de perfil de Storage (ruta: users/{uid}/foto_perfil)
    if (uid || data.auth_uid) {
      const targetUid = uid || data.auth_uid;
      try {
        const bucket = getStorage().bucket();
        const file = bucket.file(`users/${targetUid}/foto_perfil`);
        const [exists] = await file.exists();
        if (exists) {
          await file.delete();
          console.log(`[cleanup] Foto de perfil de ${targetUid} eliminada.`);
        }
      } catch (e) {
        console.error(`[cleanup] Error eliminando foto de ${targetUid}:`, e.message);
      }
    }
  }
);

// ── 4b. Cuando se elimina un Viaje ──
// Elimina todos los despachos que dependían de este viaje (en cascada).
exports.onViajeDeleted = onDocumentDeleted(
  { document: 'viajes/{viajeId}', region: 'us-central1' },
  async (event) => {
    const viajeId = event.params.viajeId;
    const db = getFirestore();
    
    try {
      const snap = await db.collection('despachos').where('viaje_id', '==', viajeId).get();
      if (snap.empty) return;
      
      const batch = db.batch();
      snap.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log(`[cleanup] ${snap.size} despachos eliminados en cascada del viaje ${viajeId}.`);
    } catch (e) {
      console.error(`[cleanup] Error eliminando despachos del viaje ${viajeId}:`, e.message);
    }
  }
);

// ── 4c. Cuando se elimina un Despacho ──
// Elimina las fotos de entrega (POD) y firmas asociadas de Firebase Storage.
exports.onDespachoDeleted = onDocumentDeleted(
  { document: 'despachos/{despachoId}', region: 'us-central1' },
  async (event) => {
    const data = event.data.data();
    const bucket = getStorage().bucket();
    
    const urlsToDelete = [data.foto_url, data.firma_url].filter(Boolean);
    
    for (const url of urlsToDelete) {
      try {
        // Extraer la ruta del archivo a partir de la URL de Firebase Storage
        // Usualmente las URL son del tipo: https://firebasestorage.googleapis.com/v0/b/bucket-name/o/encoded%2Fpath?alt=media...
        const match = url.match(/\/o\/(.+?)\?/);
        if (match && match[1]) {
          const filePath = decodeURIComponent(match[1]);
          const file = bucket.file(filePath);
          const [exists] = await file.exists();
          if (exists) {
            await file.delete();
            console.log(`[cleanup] Archivo eliminado: ${filePath}`);
          }
        }
      } catch (e) {
        console.error(`[cleanup] Error eliminando archivo de Storage (${url}):`, e.message);
      }
    }
  }
);

// ── 4d. Cuando se elimina un Gasto ──
// Elimina la foto de la boleta asociada de Firebase Storage.
exports.onGastoDeleted = onDocumentDeleted(
  { document: 'gastos_ruta/{gastoId}', region: 'us-central1' },
  async (event) => {
    const data = event.data.data();
    const bucket = getStorage().bucket();
    
    if (data.foto_boleta_url) {
      try {
        const match = data.foto_boleta_url.match(/\/o\/(.+?)\?/);
        if (match && match[1]) {
          const filePath = decodeURIComponent(match[1]);
          const file = bucket.file(filePath);
          const [exists] = await file.exists();
          if (exists) {
            await file.delete();
            console.log(`[cleanup] Foto de boleta eliminada: ${filePath}`);
          }
        }
      } catch (e) {
        console.error(`[cleanup] Error eliminando foto boleta de gasto ${event.params.gastoId}:`, e.message);
      }
    }
  }
);
// -- 5. FIX: Corregir perfil de usuario por email ------------------
// Callable desde el Panel Admin. Arregla rol/area buscando por email.
// -----------------------------------------------------------------
exports.fixUserProfile = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Debes iniciar sesion.');

    const db   = getFirestore();
    const auth = getAuth();

    // Verificar que caller es admin
    let callerDoc = await db.collection('users').doc(request.auth.uid).get();
    if (!callerDoc.exists) {
      const q = await db.collection('users').where('correo_electronico', '==', request.auth.token.email).limit(1).get();
      if (!q.empty) callerDoc = q.docs[0];
    }
    if (!callerDoc.exists) throw new HttpsError('permission-denied', 'Caller no encontrado.');
    if ((callerDoc.data().rol || '').toLowerCase() !== 'admin')
      throw new HttpsError('permission-denied', 'Se requiere rol admin.');

    const { targetEmail, newRol, newArea } = request.data;
    if (!targetEmail) throw new HttpsError('invalid-argument', 'targetEmail requerido.');

    const results = { found: [], updated: [] };

    const q1 = await db.collection('users').where('correo_electronico', '==', targetEmail).get();
    q1.forEach(doc => results.found.push({ id: doc.id, data: doc.data() }));

    const legacyDoc = await db.collection('users').doc(targetEmail).get();
    if (legacyDoc.exists && !results.found.find(f => f.id === targetEmail))
      results.found.push({ id: targetEmail, data: legacyDoc.data() });

    let uid = null;
    try {
      const authUser = await auth.getUserByEmail(targetEmail);
      uid = authUser.uid;
      const uidDoc = await db.collection('users').doc(uid).get();
      if (uidDoc.exists && !results.found.find(f => f.id === uid))
        results.found.push({ id: uid, data: uidDoc.data() });
    } catch(e) { results.authError = e.message; }

    const updateData = {
      rol:  newRol  || 'administrativo',
      role: newRol  || 'administrativo',
      area: newArea || 'Administracion & Finanzas',
      correo_electronico: targetEmail,
    };

    for (const found of results.found) {
      await db.collection('users').doc(found.id).update(updateData);
      results.updated.push(found.id);
    }

    if (uid) {
      const uidRef = db.collection('users').doc(uid);
      const uidSnap = await uidRef.get();
      if (!uidSnap.exists) {
        const src = results.found[0] ? results.found[0].data : {};
        await uidRef.set({ ...src, ...updateData, auth_uid: uid });
        results.updated.push('created:' + uid);
      }
      try {
        await auth.setCustomUserClaims(uid, { rol: updateData.rol, area: updateData.area });
        results.claimsSynced = true;
      } catch(e) { results.claimsError = e.message; }
    }

    return { success: true, email: targetEmail, uid, results };
  }
);

// ═══════════════════════════════════════════════════════════════
// 6. MÓDULOS DE SEGURIDAD (Refactorización Paso 2)
// ═══════════════════════════════════════════════════════════════
const inventoryFuncs = require('./src/inventory');
const distribuidoresFuncs = require('./src/distribuidores');
const notificacionesFuncs = require('./src/notificaciones');

exports.updateInventory = inventoryFuncs.updateInventory;
exports.manageDistribuidores = distribuidoresFuncs.manageDistribuidores;
exports.manageNotificaciones = notificacionesFuncs.manageNotificaciones;
