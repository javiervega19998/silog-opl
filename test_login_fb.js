const firebase = require('firebase/compat/app');
require('firebase/compat/auth');

const firebaseConfig = {
  apiKey: "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU",
  authDomain: "silog-opl-681dc.firebaseapp.com",
  projectId: "silog-opl-681dc"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();

async function testPassword(email, password) {
  try {
    console.log(`Testing password '${password}' for ${email}...`);
    const cred = await auth.signInWithEmailAndPassword(email, password);
    console.log(`  -> SUCCESS! UID: ${cred.user.uid}`);
    await auth.signOut();
    return true;
  } catch (e) {
    console.log(`  -> FAILED: ${e.code} - ${e.message}`);
    return false;
  }
}

async function run() {
  const email = 'javier.vega.g1998@gmail.com';
  await testPassword(email, 'v2g17773');
  await testPassword(email, 'Silog2026!');
  await testPassword(email, 'silog2026!');
}

run().catch(console.error);
