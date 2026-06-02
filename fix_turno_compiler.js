const fs = require('fs');
let html = fs.readFileSync('turno.html', 'utf8');

const prefix = html.substring(0, html.indexOf('async function cerrarTurno() {'));
const suffix = html.substring(html.indexOf('</script>', html.indexOf('async function cerrarTurno() {')));

const newCerrarTurno = `async function cerrarTurno() {
  if (!_turnoDocId) { showToast('No hay turno activo','error'); return; }
  const kmFin = parseInt(document.getElementById('km-final').value);
  const kmIni = _turnoActivo.km_inicial;
  if (!kmFin || kmFin <= 0) { showToast('Ingresa el kilometraje final','error'); return; }
  if (kmFin <= kmIni) { showToast(\`KM Final (\${kmFin}) debe ser mayor al KM Inicial (\${kmIni})\`,'error'); return; }
  if (!confirm(\`¿Finalizar jornada?\\nKM recorridos: \${kmFin - kmIni} km\`)) return;
  const btn = document.getElementById('btn-cerrar');
  btn.disabled=true; btn.innerHTML='<span class="spinner"></span> Cerrando turno…';
  try {
    const vSnap = await db.collection('vehiculos').where('patente','==',_turnoActivo.patente).limit(1).get();
    if (vSnap.empty) {
      throw new Error(\`Vehículo \${_turnoActivo.patente} no encontrado\`);
    }
    const vehicleDocRef = vSnap.docs[0].ref;
    const turnoDocRef = db.collection('turnos').doc(_turnoDocId);

    // ═══ Compilar Viaje / Hoja de Ruta para Finanzas ═══
    const despSnap = await db.collection('despachos').where('turno_id','==',_turnoDocId).get();
    const entregas = []; let devoluciones = 0, distribuidor = '';
    const clientes_despacho = [];
    despSnap.forEach(d => {
      const dd = d.data();
      if (!distribuidor && dd.distribuidor) distribuidor = dd.distribuidor;
      if (dd.estado === 'devuelto') devoluciones++;
      if (dd.estado === 'entregado' && dd.cliente_nombre) clientes_despacho.push(dd.cliente_nombre);
      entregas.push({
        correlativo: dd.correlativo || 0,
        documento: dd.guia_numero || dd.factura_numero || '',
        cliente: dd.cliente_nombre || '', direccion: dd.cliente_direccion || '',
        comuna: dd.cliente_comuna || '', observaciones: dd.descripcion || '',
        estado: dd.estado || 'pendiente', valor_diario: dd.valor_diario || 0,
        devolucion_motivo: dd.devolucion_motivo || '',
      });
    });
    entregas.sort((a,b) => a.correlativo - b.correlativo);

    // Gastos del turno
    let combustible = 0, peaje = 0, litros_combustible = 0;
    try {
      const gSnap = await db.collection('gastos_ruta').where('turno_id','==',_turnoDocId).get();
      gSnap.forEach(g => {
        const gd = g.data();
        if (gd.tipo === 'combustible') {
          combustible += gd.monto_clp || gd.monto || 0;
          litros_combustible += gd.litros || 0;
        } else if (gd.tipo === 'peaje') {
          peaje += gd.monto_clp || gd.monto || 0;
        }
      });
    } catch(ge) {
      console.warn('Error al obtener gastos del turno:', ge);
    }

    const fecha = new Date().toISOString().split('T')[0];
    const hojaId = \`\${fecha}_\${_name.replace(/\\s+/g,'_')}\`;
    const hojaDocRef = db.collection('hojas_ruta').doc(hojaId);

    await db.runTransaction(async (transaction) => {
      transaction.update(turnoDocRef, {
        km_final: kmFin, estado: 'cerrado',
        hora_cierre: firebase.firestore.FieldValue.serverTimestamp(),
      });
      transaction.update(vehicleDocRef, { km: kmFin, kilometraje: kmFin, estado: 'Disponible', conductor: null });
      transaction.set(hojaDocRef, {
        turno_id: _turnoDocId, conductor_uid: _uid, conductor_email: _email,
        conductor_nombre: _name, distribuidor: distribuidor,
        patente: _turnoActivo.patente, fecha: fecha,
        hora_inicio: _turnoActivo.hora_apertura || null,
        hora_termino: firebase.firestore.FieldValue.serverTimestamp(),
        km_inicial: kmIni, km_final: kmFin, km_recorridos: kmFin - kmIni,
        entregas: entregas, total_entregas: entregas.length,
        total_devoluciones: devoluciones, combustible: combustible, peaje: peaje,
        litros_combustible: litros_combustible, clientes_despacho: clientes_despacho,
        n_guias: '', estado: 'pendiente_revision', revisado_por: null,
        created_at: firebase.firestore.FieldValue.serverTimestamp(),
      });
    });

    showToast('✅ Jornada finalizada. KM recorridos: '+(kmFin - kmIni),'success');
    setTimeout(()=>window.location.href='dashboard.html',1500);
  } catch(e) {
    showToast('Error: '+e.message,'error');
    btn.disabled=false; btn.innerHTML='🔴 Finalizar Jornada';
  }
}
`;

fs.writeFileSync('turno.html', prefix + newCerrarTurno + suffix);
console.log('Fixed cerrarTurno successfully.');
