const admin = require('firebase-admin');
const fs = require('fs');
const key = require('./silog-ops-sa.json');

admin.initializeApp({
  credential: admin.credential.cert(key)
});

const db = admin.firestore();

async function cleanUsers() {
  const usersRef = db.collection('users');
  const snap = await usersRef.get();
  const byEmail = {};
  
  for (const doc of snap.docs) {
    const data = doc.data();
    const email = data.correo_electronico || data.email;
    if (!email) continue;
    
    if (!byEmail[email]) {
      byEmail[email] = [doc];
    } else {
      byEmail[email].push(doc);
    }
  }
  
  for (const email in byEmail) {
    const docs = byEmail[email];
    if (docs.length > 1) {
      console.log(`Found ${docs.length} duplicates for ${email}`);
      // Sort by creation time if possible, or just keep the one that matches an Auth user
      // For now, keep the first one and delete the rest
      for (let i = 1; i < docs.length; i++) {
        const d = docs[i];
        console.log(`Deleting duplicate doc: ${d.id}`);
        await usersRef.doc(d.id).delete();
      }
    }
  }
  console.log("Done user cleanup");
}

cleanUsers().catch(console.error);
