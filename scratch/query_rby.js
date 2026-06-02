const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');
require('firebase/compat/auth');
const fs = require('fs');

// Read firebase config
const configContent = fs.readFileSync('js/firebase-config.js', 'utf8');
const configMatch = configContent.match(/const firebaseConfig = ({[\s\S]*?});/);
if (!configMatch) {
  console.error("No se pudo leer la configuración de Firebase");
  process.exit(1);
}

const firebaseConfig = eval('(' + configMatch[1] + ')');
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// We need to use the REST API or Admin SDK to bypass security rules if we don't sign in.
// Or we can sign in!
// I'll try to find the orphaned turnos and delete them.
// A turno is orphaned if the user deleted the hojas_ruta from UI, but the turno remained.
// Actually, let's just delete the specific ghost `turno`, `hojas_ruta`, `despachos`, `gastos_ruta` associated with "2026-05-27__bf_JkSx".
// Wait, the true turno_id is not "2026-05-27__bf_JkSx". 
// Let's find all turnos where patente == 'RBYP77' from the last 5 days.

async function main() {
  console.log("Conectado. Buscando turnos para RBYP77...");
  
  const dSnap = await db.collection('turnos').where('patente', '==', 'RBYP77').get();
  console.log(`Encontrados ${dSnap.size} turnos para RBYP77`);
  
  for (const doc of dSnap.docs) {
    const d = doc.data();
    console.log(`Turno: ${doc.id} | Conductor: ${d.conductor_nombre||d.conductor_email} | Fecha: ${d.hora_cierre ? d.hora_cierre.toDate().toISOString() : 'abierto'}`);
    
    // Ver si tiene hoja de ruta asociada
    const hSnap = await db.collection('hojas_ruta').where('turno_id', '==', doc.id).get();
    console.log(`  - Hojas asociadas: ${hSnap.size}`);
    
    // Ver si tiene despachos
    const despSnap = await db.collection('despachos').where('turno_id', '==', doc.id).get();
    console.log(`  - Despachos asociados: ${despSnap.size}`);
  }

  process.exit(0);
}

main().catch(console.error);
