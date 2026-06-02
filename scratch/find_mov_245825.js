const admin = require('firebase-admin');
const serviceAccount = require('../accounts.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function run() {
  try {
    const snap = await db.collection('movimientos_bodega').get();
    let found = [];
    snap.forEach(doc => {
      const data = doc.data();
      if (data.referencia && data.referencia.includes('245825')) {
        found.push({ id: doc.id, ...data });
      }
    });
    console.log(`Encontrados ${found.length} movimientos con '245825' en la referencia:`);
    console.log(JSON.stringify(found, null, 2));

    // Si encontramos y el usuario quiere eliminarlos y devolver el stock:
    if (found.length > 0) {
      console.log('Procediendo a revertir stock y eliminar movimientos...');
      const batch = db.batch();
      for (let m of found) {
        if (m.tipo === 'salida' || m.tipo === 'despacho') {
          // Revertir stock
          const prodRef = db.collection('inventory').doc(m.producto_id);
          batch.update(prodRef, {
            qty: admin.firestore.FieldValue.increment(m.cantidad),
            cantidad: admin.firestore.FieldValue.increment(m.cantidad),
            status: 'disponible' // asumiendo que al sumar stock quedará disponible
          });
        }
        // Eliminar el movimiento
        batch.delete(db.collection('movimientos_bodega').doc(m.id));
      }
      await batch.commit();
      console.log('Reversión completada.');
    } else {
      console.log('No se encontraron movimientos para revertir.');
    }
  } catch (e) {
    console.error(e);
  }
}

run();
