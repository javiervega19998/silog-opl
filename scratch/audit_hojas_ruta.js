const firebase = require('firebase/compat/app');
require('firebase/compat/firestore');
const fs = require('fs');

const configContent = fs.readFileSync('js/firebase-config.js', 'utf8');
const configMatch = configContent.match(/const firebaseConfig = ({[\s\S]*?});/);
const firebaseConfig = eval('(' + configMatch[1] + ')');
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

async function main() {
  console.log("=== AUDITORIA DE ESTRUCTURA HOJAS_RUTA ===\n");
  const snap = await db.collection('hojas_ruta').get();
  
  let fieldsCount = {};
  let totalDocs = snap.size;
  let anomalies = [];
  
  snap.forEach(doc => {
    const data = doc.data();
    const id = doc.id;
    const keys = Object.keys(data);
    
    // Contabilizar frecuencia de campos
    keys.forEach(k => {
      fieldsCount[k] = (fieldsCount[k] || 0) + 1;
    });
    
    // Detectar anomalías comunes
    if (!data.turno_id) anomalies.push(`[${id}] Falta 'turno_id'`);
    if (data.km_inicial === undefined && data.km_final === undefined) anomalies.push(`[${id}] Falta información de KM`);
    if (data.fecha && typeof data.fecha !== 'string') anomalies.push(`[${id}] 'fecha' no es string (${typeof data.fecha})`);
    if (data.created_at && !data.created_at.toDate) anomalies.push(`[${id}] 'created_at' no es Timestamp`);
    if (data.estado === undefined) anomalies.push(`[${id}] Falta 'estado'`);
    if (data.patente === undefined) anomalies.push(`[${id}] Falta 'patente'`);
    if (data.distribuidor === undefined && data.nombre_distribuidor === undefined) anomalies.push(`[${id}] Falta distribuidor`);
  });
  
  console.log(`Total Documentos analizados: ${totalDocs}`);
  console.log("\nFrecuencia de Campos:");
  
  // Ordenar campos por frecuencia
  const sortedFields = Object.entries(fieldsCount).sort((a,b) => b[1] - a[1]);
  sortedFields.forEach(([k, v]) => {
    const percent = Math.round((v / totalDocs) * 100);
    console.log(`  - ${k}: ${v} doc(s) (${percent}%)`);
  });
  
  console.log("\nAnomalías Detectadas:");
  if (anomalies.length === 0) {
    console.log("  ✅ Ninguna anomalía crítica detectada.");
  } else {
    anomalies.slice(0, 30).forEach(a => console.log("  ⚠️ " + a));
    if (anomalies.length > 30) console.log(`  ... y ${anomalies.length - 30} más.`);
  }
  
  // Imprimir un documento de muestra (el más reciente)
  console.log("\nEstructura de un documento representativo (más reciente):");
  if (snap.size > 0) {
    const docsArr = [];
    snap.forEach(d => docsArr.push({id: d.id, ...d.data()}));
    docsArr.sort((a,b) => (b.created_at?.toDate?.() || 0) - (a.created_at?.toDate?.() || 0));
    console.log(JSON.stringify(docsArr[0], null, 2).substring(0, 500) + "\n  ...");
  }

  process.exit(0);
}

main().catch(e => {
  console.error("Error:", e);
  process.exit(1);
});
