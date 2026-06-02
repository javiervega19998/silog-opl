const admin = require('firebase-admin');
const serviceAccount = require('../silog-opl-681dc-firebase-adminsdk-3qof6-574ab9c34a.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function run() {
  console.log("=== DIAGNOSING JULIO SHIFT INITIATION ===");

  // 1. Get Julio's user doc
  const userEmail = "juliocmartinezt21@gmail.com";
  console.log(`\n1. Fetching user document for ${userEmail}:`);
  const userSnap = await db.collection('users')
    .where('correo_electronico', '==', userEmail)
    .limit(1)
    .get();

  if (userSnap.empty) {
    console.log("❌ No user document found in Firestore 'users' collection!");
  } else {
    const userDoc = userSnap.docs[0];
    console.log(`User Doc ID (UID): ${userDoc.id}`);
    console.log("Data:", JSON.stringify(userDoc.data(), null, 2));
  }

  // 2. Fetch vehicle KZGZ57
  const patente = "KZGZ57";
  console.log(`\n2. Fetching vehicle document for ${patente}:`);
  const vehSnap = await db.collection('vehiculos')
    .where('patente', '==', patente)
    .limit(1)
    .get();

  if (vehSnap.empty) {
    console.log(`❌ No vehicle document found with patente '${patente}'`);
  } else {
    const vehDoc = vehSnap.docs[0];
    console.log(`Vehicle Doc ID: ${vehDoc.id}`);
    console.log("Data:", JSON.stringify(vehDoc.data(), null, 2));
  }

  // 3. Simulate checklist query in iniciarTurno()
  console.log("\n3. Simulating checklist query in iniciarTurno():");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ts = admin.firestore.Timestamp.fromDate(today);
  console.log(`Querying checklists for operator: ${userEmail}, patente: ${patente}, date >= ${today.toISOString()}`);

  const checklistSnap = await db.collection('chequeo_operacional')
    .where('operador', '==', userEmail)
    .where('patente_chequeo', '==', patente.toUpperCase())
    .where('fecha_chequeo', '>=', ts)
    .get();

  if (checklistSnap.empty) {
    console.log("❌ Checklist query returned EMPTY! Conductor cannot start shift.");
  } else {
    console.log(`✅ Checklist query returned ${checklistSnap.size} document(s):`);
    checklistSnap.forEach(doc => {
      const data = doc.data();
      console.log(`  - Doc ID: ${doc.id}`);
      console.log(`    fecha_chequeo: ${data.fecha_chequeo.toDate().toISOString()}`);
      console.log(`    operador: ${data.operador}`);
      console.log(`    patente_chequeo: ${data.patente_chequeo}`);
    });
  }

  // 4. Simulate active turn check
  console.log("\n4. Simulating active turn check:");
  const uid = userSnap.empty ? "hKFwXDoo6AQWQJq0AtzxZxaqaaX2" : userSnap.docs[0].id;
  const turnSnap = await db.collection('turnos')
    .where('conductor_uid', '==', uid)
    .where('estado', '==', 'abierto')
    .get();

  if (turnSnap.empty) {
    console.log("✅ No open turn found for Julio. Ready to start.");
  } else {
    console.log(`❌ Found ${turnSnap.size} open turn(s) for Julio!`);
    turnSnap.forEach(doc => {
      console.log(`  - Doc ID: ${doc.id}, Data:`, JSON.stringify(doc.data(), null, 2));
    });
  }
}

run().catch(console.error);
