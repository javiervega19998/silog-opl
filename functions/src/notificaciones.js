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

exports.manageNotificaciones = onCall(
  { region: 'us-central1' },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Acceso denegado: Usuario no autenticado.');
    
    const uid = request.auth.uid;
    const db = getFirestore();
    const { action, id, data } = request.data;
    
    const notifRef = id ? db.collection('notificaciones').doc(id) : db.collection('notificaciones').doc();

    try {
      if (action === 'create') {
        // Anyone authenticated can create
        const payload = { 
          ...data, 
          createdAt: FieldValue.serverTimestamp(), 
          createdBy: uid,
          usuario_id: uid
        };
        await notifRef.set(payload);
        return { success: true, id: notifRef.id };
      } else if (action === 'update' || action === 'delete') {
        // Only viewers can update or delete
        await checkViewerRole(db, uid);
        
        if (!id) throw new HttpsError('invalid-argument', 'ID requerido.');
        
        if (action === 'update') {
          const payload = { ...data, updatedAt: FieldValue.serverTimestamp(), updatedBy: uid };
          await notifRef.update(payload);
        } else {
          await notifRef.delete();
        }
        return { success: true };
      } else {
        throw new HttpsError('invalid-argument', 'Acción no válida.');
      }
    } catch (error) {
      console.error(`[Notificaciones Error] UID: ${uid}, Action: ${action} -`, error);
      throw new HttpsError('internal', 'Error al procesar notificación.');
    }
  }
);
