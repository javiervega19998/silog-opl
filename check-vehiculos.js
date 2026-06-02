const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  projectId: "silog-opl-681dc"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function run() {
  const querySnapshot = await getDocs(collection(db, "vehiculos"));
  let count = 0;
  querySnapshot.forEach((doc) => {
    count++;
    console.log(doc.id, " => ", doc.data());
  });
  console.log("Total vehicles:", count);
  process.exit(0);
}
run();
