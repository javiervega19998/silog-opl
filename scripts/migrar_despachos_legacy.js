const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json'); // El usuario deberá proveer esto

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function migrarDespachosLegacy() {
  console.log('Iniciando migración de despachos legacy...');
  const snap = await db.collection('despachos').get();
  
  let count = 0;
  const batch = db.batch();
  
  snap.forEach(doc => {
    const data = doc.data();
    let updated = false;
    let updateData = {};

    // Si el despacho antiguo tiene estado 'pendiente' o algo y no se ha marcado como entregado/rechazado/devuelto,
    // y tiene un turno asignado pero nunca pasó a en_transito.
    if (!data.estado || data.estado === 'pendiente_despacho') {
      updateData.estado = 'en_transito';
      updated = true;
    }

    if (updated) {
      batch.update(doc.ref, updateData);
      count++;
    }
  });

  if (count > 0) {
    await batch.commit();
    console.log(`Migración completada. ${count} despachos actualizados a en_transito.`);
  } else {
    console.log('No se encontraron despachos legacy para migrar.');
  }
}

migrarDespachosLegacy().catch(console.error);
