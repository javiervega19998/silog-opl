const fs = require('fs');
let html = fs.readFileSync('viajes.html', 'utf8');

const prefix = html.substring(0, html.indexOf('// 1) Actualizar el documento en hojas_ruta'));
const suffix = html.substring(html.indexOf('        const despDocs = [];'));

const correctMiddle = `// 1) Actualizar el documento en hojas_ruta
    await db.collection('hojas_ruta').doc(tripId).update({
      patente,
      nombre_distribuidor: distribuidor,
      distribuidor,
      km_inicial: kmI,
      km_final_viaje: kmF,
      km_final: kmF,
      km_recorridos: kmF - kmI,
      total_entregas: entregas,
      total_devoluciones: devoluciones,
      monto_combustible: combustible,
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
      console.warn('No se pudo sincronizar el KM editado del vehiculo', err);
    }

    // 2) Alinear y sincronizar los despachos asociados al turno_id
    if (turnoId) {
      try {
        const dSnap = await db.collection('despachos').where('turno_id', '==', turnoId).get();
`;

fs.writeFileSync('viajes.html', prefix + correctMiddle + suffix);
console.log('viajes.html fixed successfully');
