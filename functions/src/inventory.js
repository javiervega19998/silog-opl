const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

exports.updateInventory = onCall(
  { region: 'us-central1' },
  async (request) => {
    // 1. Validación de Autenticación
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Acceso denegado: Usuario no autenticado.');
    }

    const uid = request.auth.uid;
    const db = getFirestore();

    // 2. Validación de Autorización
    const userRecord = await db.collection('users').doc(uid).get();
    const userRole = userRecord.exists && userRecord.data().rol ? userRecord.data().rol.toLowerCase() : 'conductor';
    
    if (!['bodeguero', 'admin'].includes(userRole)) {
      throw new HttpsError('permission-denied', 'Privilegios insuficientes para modificar el inventario.');
    }

    // 3. Validación de Entrada
    const data = request.data;
    if (!data || typeof data !== 'object') {
      throw new HttpsError('invalid-argument', 'Datos de entrada inválidos.');
    }

    // Identificar si es una creación o actualización
    const isUpdate = !!data.id;
    const itemId = data.id || db.collection('inventory').doc().id;

    const inventoryData = { ...data };
    delete inventoryData.id; // Remover ID del payload

    inventoryData.updatedAt = FieldValue.serverTimestamp();
    inventoryData.updatedBy = uid;

    if (!isUpdate) {
      inventoryData.createdAt = FieldValue.serverTimestamp();
      inventoryData.createdBy = uid;
    }

    try {
      const itemRef = db.collection('inventory').doc(itemId);
      
      if (isUpdate) {
        await itemRef.update(inventoryData);
      } else {
        await itemRef.set(inventoryData);
      }

      return { success: true, message: isUpdate ? 'Ítem actualizado correctamente.' : 'Ítem creado correctamente.', id: itemId };
    } catch (error) {
      console.error(`[Inventory Update Error] UID: ${uid}, Item: ${itemId} -`, error);
      throw new HttpsError('internal', 'Fallo interno al procesar el inventario.');
    }
  }
);
