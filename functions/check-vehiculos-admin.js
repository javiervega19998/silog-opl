const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp({
  projectId: "silog-opl-681dc"
});
const db = getFirestore();

async function run() {
  const snapshot = await db.collection('vehiculos').get();
  let count = 0;
  snapshot.forEach((doc) => {
    count++;
    console.log(doc.id, "=>", doc.data());
  });
  console.log("Total vehicles:", count);
}
run();
