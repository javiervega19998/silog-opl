// Usa firebase-admin con Application Default Credentials (gcloud auth)
// o con el proyecto ya logueado via firebase CLI
const { initializeApp, applicationDefault } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  credential: applicationDefault(),
  projectId: 'silog-opl-681dc'
});

const db = getFirestore();
const TRIP_ID = '2026-05-28__bf_0JXd';

async function main() {
  console.log(`\n=== Investigando viaje: ${TRIP_ID} ===\n`);
  
  // 1. hojas_ruta doc
  const hrDoc = await db.collection('hojas_ruta').doc(TRIP_ID).get();
  if (hrDoc.exists) {
    const d = hrDoc.data();
    console.log('📄 hojas_ruta ENCONTRADO:');
    console.log('   patente:', d.patente);
    console.log('   conductor:', d.conductor_nombre || d.conductor_email);
    console.log('   entregas:', d.total_entregas, '| devoluciones:', d.total_devoluciones);
    console.log('   fecha:', d.fecha);
    console.log('   turno_id:', d.turno_id);
    console.log('   estado:', d.estado);
  } else {
    console.log('ℹ️  hojas_ruta doc: NO EXISTE');
  }

  // 2. despachos
  const dSnap = await db.collection('despachos').where('turno_id', '==', TRIP_ID).get();
  console.log(`\n📦 despachos (turno_id=${TRIP_ID}): ${dSnap.size}`);
  dSnap.forEach(d => {
    const dd = d.data();
    console.log(`   ${d.id}: cliente="${dd.cliente_nombre||'(vacío)'}" estado=${dd.estado}`);
  });

  // 3. gastos_ruta
  const gSnap = await db.collection('gastos_ruta').where('turno_id', '==', TRIP_ID).get();
  console.log(`\n💰 gastos_ruta (turno_id=${TRIP_ID}): ${gSnap.size}`);

  // 4. turnos
  const tDoc = await db.collection('turnos').doc(TRIP_ID).get();
  console.log(`\n🔄 turno doc: ${tDoc.exists ? 'EXISTE' : 'NO EXISTE'}`);

  // 5. hojas_ruta by turno_id
  const hrByTurno = await db.collection('hojas_ruta').where('turno_id', '==', TRIP_ID).get();
  console.log(`📋 hojas_ruta por turno_id: ${hrByTurno.size}`);
  hrByTurno.forEach(d => console.log(`   doc ${d.id}`));

  // ELIMINAR
  const batch = db.batch();
  let count = 0;
  if (hrDoc.exists) { batch.delete(hrDoc.ref); count++; }
  dSnap.forEach(d => { batch.delete(d.ref); count++; });
  gSnap.forEach(g => { batch.delete(g.ref); count++; });
  if (tDoc.exists) { batch.delete(tDoc.ref); count++; }
  hrByTurno.forEach(d => { if(d.id !== TRIP_ID) { batch.delete(d.ref); count++; } });

  if (count === 0) {
    console.log('\n✅ No hay documentos — ya está limpio.');
  } else {
    await batch.commit();
    console.log(`\n🗑️ ELIMINADOS: ${count} documentos`);
  }
  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
