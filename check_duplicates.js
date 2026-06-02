const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccount = JSON.parse(fs.readFileSync('C:\\Users\\ASUS\\.gemini\\antigravity\\scratch\\silog-ops\\keys\\silog-opl-681dc-serviceAccountKey.json', 'utf8'));
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function checkEmails() {
    console.log("Checking duplicates...");
    const snap = await db.collection('users').where('correo_electronico', '==', 'finanzas@silogspa.cl').get();
    snap.forEach(doc => {
        console.log("Doc ID (correo_electronico):", doc.id);
    });
    
    const snap2 = await db.collection('users').where('email', '==', 'finanzas@silogspa.cl').get();
    snap2.forEach(doc => {
        if(snap.docs.find(d => d.id === doc.id)) return;
        console.log("Doc ID (email field):", doc.id);
    });
}
checkEmails();
