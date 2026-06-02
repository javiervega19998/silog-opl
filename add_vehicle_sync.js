const fs = require('fs');
let html = fs.readFileSync('viajes.html', 'utf8');

// 1. In submitViaje()
const targetSubmitTrip = `const hrRef=db.collection('hojas_ruta').doc();`;
const newSubmitTrip = `// Sincronizar KM con Gestionar Flota (Vehiculos)
    try {
      const vSnap = await db.collection('vehiculos').where('patente', '==', patente).limit(1).get();
      if (!vSnap.empty) {
        batch.update(vSnap.docs[0].ref, {
          km: kmF,
          kilometraje: kmF
        });
      }
    } catch(err) {
      console.warn("No se pudo sincronizar el KM del vehículo", err);
    }
    
    const hrRef=db.collection('hojas_ruta').doc();`;
if(html.includes(targetSubmitTrip)) {
  html = html.replace(targetSubmitTrip, newSubmitTrip);
  console.log("submitViaje vehicle update added.");
}

// 2. In saveEditedTrip()
const targetSavePayload = `litros_combustible: litrosCombustible,
      peaje,
      estado
    });`;
const newSavePayload = `litros_combustible: litrosCombustible,
      peaje,
      estado
    });

    // Sincronizar KM editado con Gestionar Flota (Vehiculos)
    try {
      const vSnap = await db.collection('vehiculos').where('patente', '==', patente).limit(1).get();
      if (!vSnap.empty) {
        await vSnap.docs[0].ref.update({
          km: kmF,
          kilometraje: kmF
        });
      }
    } catch(err) {
      console.warn("No se pudo sincronizar el KM editado del vehículo", err);
    }`;
if(html.includes(targetSavePayload)) {
  html = html.replace(targetSavePayload, newSavePayload);
  console.log("Modal save payload updated.");
}

fs.writeFileSync('viajes.html', html);
console.log('viajes.html sync logic successfully added.');
