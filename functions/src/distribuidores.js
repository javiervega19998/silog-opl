const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const checkViewerRole = async (db, uid) => {
  const userRecord = await db.collection('users').doc(uid).get();
  const userRole = userRecord.exists && userRecord.data().rol ? userRecord.data().rol.toLowerCase() : 'conductor';
  const validRoles = ['admin', 'administrativo', 'administrativo.conductor', 'bodeguero', 'finanzas', 'gestion'];
  
  if (!validRoles.includes(userRole)) {
    throw new HttpsError('permission-denied', 'Privilegios insuficientes para esta operación.');
  }
};

exports.manageDistribuidores = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Acceso denegado: Usuario no autenticado.');
    
    const uid = request.auth.uid;
    const db = getFirestore();
    
    await checkViewerRole(db, uid);

    const { action, id, data } = request.data;
    const distRef = id ? db.collection('distribuidores').doc(id) : db.collection('distribuidores').doc();

    try {
      if (action === 'create' || action === 'update') {
        const payload = { ...data, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid };
        if (action === 'create') {
          payload.createdAt = FieldValue.serverTimestamp();
          payload.createdBy = uid;
          await distRef.set(payload);
        } else {
          await distRef.update(payload);
        }
        return { success: true, id: distRef.id };
      } else if (action === 'delete') {
        if (!id) throw new HttpsError('invalid-argument', 'ID requerido para eliminar.');
        await distRef.delete();
        return { success: true };
      } else {
        throw new HttpsError('invalid-argument', 'Acción no válida.');
      }
    } catch (error) {
      console.error(`[Distribuidores Error] UID: ${uid}, Action: ${action} -`, error);
      throw new HttpsError('internal', 'Error al procesar distribuidores.');
    }
  }
);
