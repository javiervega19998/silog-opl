const firebase = require('firebase/compat/app');
require('firebase/compat/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU",
  authDomain: "silog-opl-681dc.firebaseapp.com",
  projectId: "silog-opl-681dc"
};

firebase.initializeApp(firebaseConfig);

async function run() {
  try {
    console.log("Attempting sign-in with wrong password...");
    await firebase.auth().signInWithEmailAndPassword('javier.vega.g1998@gmail.com', 'wrong_pass_123');
    console.log("Logged in successfully (unexpected!)");
  } catch (e) {
    console.log("Caught Error!");
    console.log("Error properties:", Object.getOwnPropertyNames(e));
    console.log("e.code:", e.code);
    console.log("e.message:", e.message);
    console.log("e.stack:", e.stack);
  }
}

run().catch(console.error);
