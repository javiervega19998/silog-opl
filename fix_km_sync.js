const fs = require('fs');

// 1. Fix turno.html
let turnoHtml = fs.readFileSync('turno.html', 'utf8');
const targetTurno = `_lastVehicleKmRef = _lastTurnoCerrado.km_final || _lastVehicleKmRef;`;
const newTurno = `// _lastVehicleKmRef ya se inicializó con el KM de la colección 'vehiculos' (vData.km). 
      // Se elimina la sobreescritura con el turno anterior para que Gestión de Flota sea siempre la fuente de la verdad.`;
if (turnoHtml.includes(targetTurno)) {
  turnoHtml = turnoHtml.replace(targetTurno, newTurno);
  
  // Update the informative message to reflect this
  const targetMsg1 = 'kmInfoMsg.innerHTML = `ℹ️ Último KM registrado en jornada anterior: <strong>${_lastVehicleKmRef.toLocaleString(\'es-CL\')} km</strong>.`;';
  const newMsg1 = 'kmInfoMsg.innerHTML = `ℹ️ Último KM registrado (Gestión de Flota): <strong>${_lastVehicleKmRef.toLocaleString(\'es-CL\')} km</strong>.`;';
  turnoHtml = turnoHtml.replace(targetMsg1, newMsg1);
  
  fs.writeFileSync('turno.html', turnoHtml);
  console.log('turno.html updated successfully.');
}

// 2. Fix viajes.html to update vehicle collection when submitting a new trip
let viajesHtml = fs.readFileSync('viajes.html', 'utf8');

// In submitViaje()
const targetSubmit = `const hrRef=db.collection('hojas_ruta').doc();`;
const newSubmit = `// Sincronizar KM con Gestionar Flota (Vehiculos)
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

if (viajesHtml.includes(targetSubmit)) {
  viajesHtml = viajesHtml.replace(targetSubmit, newSubmit);
  console.log('viajes.html submitViaje updated.');
}

// In saveEditedTrip() (admin modal)
const targetEdit = `estado
    });`;
const newEdit = `estado
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

if (viajesHtml.includes(targetEdit)) {
  viajesHtml = viajesHtml.replace(targetEdit, newEdit);
  console.log('viajes.html saveEditedTrip updated.');
}

fs.writeFileSync('viajes.html', viajesHtml);
console.log('viajes.html written successfully.');
