const admin = require('firebase-admin');
const path = require('path');

// Use GOOGLE_APPLICATION_CREDENTIALS env or try .firebaserc
let app;
try {
  app = admin.initializeApp({
    credential: admin.credential.applicationDefault()
  });
} catch(e) {
  console.error('Failed to initialize:', e.message);
  process.exit(1);
}

const db = admin.firestore();

async function run() {
  console.log('Buscando usuario Rossana...');
  
  // Search by name
  const byName = await db.collection('users')
    .where('nombre', '>=', 'Rossana')
    .where('nombre', '<=', 'Rossana\uf8ff')
    .get();
  
  console.log(`Found by nombre: ${byName.size}`);
  byName.forEach(doc => {
    const d = doc.data();
    console.log('DOC:', doc.id);
    console.log('  nombre:', d.nombre, d.apellido);
    console.log('  email:', d.correo_electronico || d.email);
    console.log('  rol:', d.rol || d.role);
    console.log('  area:', d.area);
    console.log('  estado:', d.estado);
  });

  // Search all users
  console.log('\n--- ALL USERS ---');
  const all = await db.collection('users').get();
  all.forEach(doc => {
    const d = doc.data();
    const email = d.correo_electronico || d.email || '';
    const nombre = d.nombre_completo || ((d.nombre||'') + ' ' + (d.apellido||'')).trim();
    if (nombre.toLowerCase().includes('ross') || email.toLowerCase().includes('ross')) {
      console.log('FOUND Rossana:', doc.id);
      console.log('  nombre:', nombre);
      console.log('  email:', email);
      console.log('  rol:', d.rol || d.role);
      console.log('  area:', d.area);
      console.log('  estado:', d.estado);
    }
  });
}
run().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
