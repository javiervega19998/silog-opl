const firebase = require('firebase/compat/app');
require('firebase/compat/auth');
require('firebase/compat/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU",
  authDomain: "silog-opl-681dc.firebaseapp.com",
  projectId: "silog-opl-681dc"
};
firebase.initializeApp(firebaseConfig);

async function run() {
  try {
    const cred = await firebase.auth().signInWithEmailAndPassword('javier.vega.g1998@gmail.com', 'Silog2026!');
    console.log("Logged in as:", cred.user.uid);
    
    const db = firebase.firestore();
    
    // Test 1: Read all users
    try {
      const snap = await db.collection('users').get();
      console.log("Read users OK:", snap.size);
    } catch(e) {
      console.error("Read users FAILED:", e.message);
    }
    
    // Test 2: Read vehiculos
    try {
      const snap2 = await db.collection('vehiculos').get();
      console.log("Read vehiculos OK:", snap2.size);
    } catch(e) {
      console.error("Read vehiculos FAILED:", e.message);
    }
    
    // Test 3: Update a user (admin privilege)
    try {
      await db.collection('users').doc('some-fake-id').update({ test: 1 });
    } catch(e) {
      console.error("Update users FAILED:", e.message);
    }
    
  } catch(e) {
    console.error("Login failed:", e.message);
  }
  process.exit(0);
}
run();
