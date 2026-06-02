const fs = require('fs');

let js = fs.readFileSync('js/finanzas_script.js', 'utf8');

const regexGastos = /\/\/ Eliminar el documento completo de Firestore y la app\s*await db\.collection\('gastos_ruta'\)\.doc\(d\.id\)\.delete\(\);/g;

js = js.replace(regexGastos, `// Eliminar solo la URL del comprobante, NO el gasto, para no perder los montos en Finanzas
      await db.collection('gastos_ruta').doc(d.id).update({
        foto_boleta_url: firebase.firestore.FieldValue.delete(),
        foto_url: firebase.firestore.FieldValue.delete()
      });`);

// We also need to add logic to clean POD documents (TotalEnergies) from hojas_ruta.
// Right now, cleanOldComprobantes has:
//     // 1. Facturas en Hojas de Ruta
//     const hrSnap = await db.collection('hojas_ruta').where('fecha', '<', thresholdISO).get();
//     for(const d of hrSnap.docs) {

const podCleanLogic = `
      // Clean POD Document
      if(h.pod_doc_url && !h.pod_doc_url.includes('Eliminado') && h.pod_doc_url.startsWith('http')) {
        try {
          const refPod = storage.refFromURL(h.pod_doc_url);
          await refPod.delete();
        } catch(se) {
          console.warn("Storage delete failed for POD:", se.message);
        }
        await db.collection('hojas_ruta').doc(d.id).update({
          pod_doc_url: "",
          pod_doc_name: ""
        });
        count++;
      }
`;

// Inject podCleanLogic after foto_combustible_url is cleaned.
const injectionPoint = `await db.collection('hojas_ruta').doc(d.id).update({
          foto_combustible_url: ""
        });
        count++;
      }`;

js = js.replace(injectionPoint, injectionPoint + '\n' + podCleanLogic);

fs.writeFileSync('js/finanzas_script.js', js);
console.log("Updated cleanOldComprobantes correctly.");
