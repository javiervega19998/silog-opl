const fs = require('fs');
let html = fs.readFileSync('viajes.html', 'utf8');

const submitTarget = `const hrRef=db.collection('hojas_ruta').doc();`;
const submitPatch = `// Sincronizar KM con Gestionar Flota (Vehiculos)
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

html = html.replace(submitTarget, submitPatch);

const editTarget = `monto_combustible: combustible,
      combustible,
      peaje,
      estado
    });`;
const editPatch = `monto_combustible: combustible,
      combustible,
      litros_combustible: litrosCombustible,
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

html = html.replace(editTarget, editPatch);

fs.writeFileSync('viajes.html', html);
console.log("viajes.html patched successfully");
