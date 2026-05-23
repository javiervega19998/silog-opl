// ══════════════════════════════════════════════
// FIREBASE CONFIG — SILOG SpA
// Proyecto Firebase: silog-opl
// ══════════════════════════════════════════════
// PASO: Ve a Firebase Console → silog-opl
//   ⚙️ Configuración → Tus apps → </> Web
//   Copia el objeto firebaseConfig y pégalo abajo
// ══════════════════════════════════════════════

const firebaseConfig = {
  apiKey: "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU",
  authDomain: "silog-opl-681dc.firebaseapp.com",
  projectId: "silog-opl-681dc",
  storageBucket: "silog-opl-681dc.firebasestorage.app",
  messagingSenderId: "261681796756",
  appId: "1:261681796756:web:5004531f244f4b3d780681"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Referencias globales
const auth     = firebase.auth();
const db       = firebase.firestore();
const storage  = firebase.storage();
// Functions apuntando a la región donde están desplegadas las Cloud Functions
const functions = firebase.app().functions('us-central1');

// Configuración regional (Chile)
firebase.firestore().settings({ ignoreUndefinedProperties: true });

// Habilitar Persistencia Offline en Firestore para Operaciones en Terreno
db.enablePersistence({ synchronizeTabs: true })
  .catch(function(err) {
    if (err.code == 'failed-precondition') {
      console.warn("Firestore offline persistence failed: multiple tabs open.");
    } else if (err.code == 'unimplemented') {
      console.warn("Firestore offline persistence unimplemented in browser.");
    }
  });
