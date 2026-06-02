const admin = require('firebase-admin');
const serviceAccount = require('C:\\Users\\ASUS\\\.gemini\\antigravity\\scratch\\silog-ops\\silog-opl-681dc-firebase-adminsdk-3qof6-574ab9c34a.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

async function run() {
  console.log("Checking hojas_ruta collection...");
  const snap = await db.collection('hojas_ruta').get();
  console.log(`Total Hojas de Ruta: ${snap.size}`);
  
  let matchCount = 0;
  let undefinedConductorCount = 0;
  
  snap.forEach(doc => {
    const data = doc.data();
    const email = data.conductor_email;
    const name = data.conductor_nombre;
    const entregas = data.entregas || [];
    const entregadosCount = data.total_entregas || entregas.filter(e => e.estado === 'Entregado').length;
    
    // Check for email javier.vega.g1998@gmail.com
    if (email === 'javier.vega.g1998@gmail.com') {
      console.log(`[Javier Vega] ID: ${doc.id}, Fecha: ${data.fecha}, Nombre: "${name}", Entregas: ${entregadosCount}`);
      matchCount++;
    }
    
    // Check for "indefinido", "-", or empty name
    if (!name || name === '-' || name.toLowerCase().includes('indefinido')) {
      console.log(`[Indefinido] ID: ${doc.id}, Fecha: ${data.fecha}, Email: "${email}", Nombre: "${name}", Entregas: ${entregadosCount}`);
      undefinedConductorCount++;
    }
  });
  
  console.log(`\nJavier Vega docs: ${matchCount}`);
  console.log(`Undefined/empty conductor docs: ${undefinedConductorCount}`);
}

run().catch(console.error);
