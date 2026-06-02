const admin = require('firebase-admin');
const serviceAccount = require('./service-account.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function run() {
  console.log("Authenticated. Fetching last 10 clients from 'clientes' collection...");
  const snap = await db.collection('clientes').limit(10).get();
  snap.forEach(d => {
    console.log(`ID: ${d.id} | Name: ${d.data().nombre} | fields:`, Object.keys(d.data()));
    console.log("Data:", JSON.stringify(d.data(), null, 2));
  });
}

run().catch(console.error);
