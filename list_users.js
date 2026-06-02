const admin = require('firebase-admin');
const serviceAccount = require('./silog-opl-681dc-firebase-adminsdk-3qof6-574ab9c34a.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function run() {
  const users = await db.collection('users').get();
  users.forEach(doc => {
    const data = doc.data();
    console.log(`Email: ${data.correo_electronico || data.email}, Role: ${data.rol || data.role}`);
  });
}
run();
