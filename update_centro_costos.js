const fs = require('fs');

let js = fs.readFileSync('js/finanzas_script.js', 'utf8');

// Find loadCentroCostos
const start = js.indexOf('async function loadCentroCostos()');
const end = js.indexOf('// ✕ ✕ ✕  PRE-FACTURAS ✕ ✕ ✕');

const newLoadCentroCostos = `async function loadCentroCostos(){
  const periodo=document.getElementById('cc-periodo').value;
  const vehiculo=document.getElementById('cc-vehiculo').value;
  const conductor=document.getElementById('cc-conductor').value;

  try{
    await Promise.all([loadGastosRaw(), loadMovBodega(), loadGastosContabilidad()]);

    // 1. Load Turnos
    let q=db.collection('turnos');
    if(periodo){
      const year = parseInt(periodo.split('-')[0]);
      const month = parseInt(periodo.split('-')[1]);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      q = q.where('fecha', '>=', firebase.firestore.Timestamp.fromDate(start))
           .where('fecha', '<', firebase.firestore.Timestamp.fromDate(end));
    }
    let tSnap;
    try { tSnap=await q.get(); } 
    catch(err) { tSnap=await db.collection('turnos').get(); }
    
    let turnos=[];
    tSnap.forEach(d=>{
      const t=d.data();
      const fecha=t.fecha?.toDate?t.fecha.toDate():null;
      if(!fecha)return;
      const m=fecha.toISOString().slice(0,7);
      if(periodo&&m!==periodo)return;
      if(vehiculo&&t.patente!==vehiculo)return;
      if(conductor&&t.conductor_email!==conductor)return;
      turnos.push({id:d.id, ...t, _fecha:fecha, _tipo:'turno'});
    });

    // 2. Load Hojas de Ruta ("Nuevo Viaje")
    let hSnap = await db.collection('hojas_ruta').get();
    let hojas = [];
    hSnap.forEach(d=>{
      const h=d.data();
      let fecha = null;
      if (h.fecha && typeof h.fecha === 'string') {
        fecha = new Date(h.fecha + 'T12:00:00');
      } else if (h.created_at?.toDate) {
        fecha = h.created_at.toDate();
      }
      if(!fecha) return;
      const m=fecha.toISOString().slice(0,7);
      if(periodo&&m!==periodo)return;
      if(vehiculo&&h.patente!==vehiculo)return;
      if(conductor&&h.conductor_email!==conductor)return;
      hojas.push({id:d.id, ...h, _fecha:fecha, _tipo:'hoja_ruta'});
    });

    // 3. Load Gastos y Despachos para Turnos
    let qGastos = db.collection('gastos_ruta');
    let qDespachos = db.collection('despachos');
    if(periodo){
      const year = parseInt(periodo.split('-')[0]);
      const month = parseInt(periodo.split('-')[1]);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      const startTS = firebase.firestore.Timestamp.fromDate(start);
      const endTS = firebase.firestore.Timestamp.fromDate(end);
      qGastos = qGastos.where('fecha', '>=', startTS).where('fecha', '<', endTS);
      qDespachos = qDespachos.where('fecha', '>=', startTS).where('fecha', '<', endTS);
    }
    
    let gSnap, dSnap;
    try { gSnap = await qGastos.get(); } catch(err) { gSnap = await db.collection('gastos_ruta').get(); }
    try { dSnap = await qDespachos.get(); } catch(err) { dSnap = await db.collection('despachos').get(); }
    
    const gastosByTurno={};
    gSnap.forEach(d=>{const g=d.data();if(!gastosByTurno[g.turno_id])gastosByTurno[g.turno_id]={combustible:0,peaje:0};if(g.tipo==='combustible')gastosByTurno[g.turno_id].combustible+=g.monto_clp||0;else gastosByTurno[g.turno_id].peaje+=g.monto_clp||0;});

    const despachosByTurno={};
    dSnap.forEach(d=>{const dp=d.data();if(!despachosByTurno[dp.turno_id])despachosByTurno[dp.turno_id]={entregados:0,devueltos:0};if(dp.estado==='entregado')despachosByTurno[dp.turno_id].entregados++;else if(dp.estado==='devuelto')despachosByTurno[dp.turno_id].devueltos++;});

    // 4. Consolidate ALL
    _allCostos = [];
    turnos.forEach(t=>{
      const g=gastosByTurno[t.id]||{combustible:0,peaje:0};
      const d=despachosByTurno[t.id]||{entregados:0,devueltos:0};
      _allCostos.push({
        ...t, combustible:g.combustible, peaje:g.peaje, total_gastos:g.combustible+g.peaje, entregados:d.entregados, devueltos:d.devueltos
      });
    });
    
    hojas.forEach(h=>{
      const comb = parseFloat(h.combustible) || parseFloat(h.monto_combustible) || 0;
      const peaje = parseFloat(h.peaje) || 0;
      const entregados = parseInt(h.total_entregas) || 0;
      const devueltos = parseInt(h.total_devoluciones) || 0;
      _allCostos.push({
        ...h, combustible: comb, peaje: peaje, total_gastos: comb + peaje, entregados: entregados, devueltos: devueltos
      });
    });

    _allCostos.sort((a,b)=>b._fecha-a._fecha);

    let totComb=0,totPeaje=0,totGastos=0;
    const body=document.getElementById('cc-body');
    if(!_allCostos.length){body.innerHTML='<tr><td colspan="8" class="txt-c empty">Sin datos para este periodo</td></tr>';
    }else{
      body.innerHTML=_allCostos.map(r=>{
        totComb+=r.combustible||0; totPeaje+=r.peaje||0; totGastos+=r.total_gastos||0;
        const f=r._fecha?r._fecha.toLocaleDateString('es-CL',{day:'2-digit',month:'short'}):'';
        const tipoBadge = r._tipo === 'hoja_ruta' ? '<span class="badge-sm" style="background:var(--accent);color:#fff;font-size:0.6rem;padding:2px 4px;">VIAJE EXT</span>' : '';
        return\`<tr>
          <td>\${f} \${tipoBadge}</td>
          <td><code style="color:var(--accent)">\${sanitize(r.patente||'')}</code></td>
          <td style="font-size:.78rem">\${sanitize((r.conductor_nombre||'').split(' ').slice(0,2).join(' '))}</td>
          <td class="txt-r">\${r.entregados}</td>
          <td class="txt-r">\${r.devueltos}</td>
          <td class="txt-r money money-red">\${fmt(r.combustible)}</td>
          <td class="txt-r money money-red">\${fmt(r.peaje)}</td>
          <td class="txt-r money money-red">\${fmt(r.total_gastos)}</td>
        </tr>\`;
      }).join('');
    }
    document.getElementById('cc-ingresos').textContent=fmt(totComb);
    document.getElementById('cc-egresos').textContent=fmt(totPeaje);
    document.getElementById('cc-margen').textContent=fmt(totGastos);
    document.getElementById('cc-turnos').textContent=_allCostos.length;
  }catch(e){console.warn(e);showToast('Error: '+e.message,'error');}
}

`;

js = js.substring(0, start) + newLoadCentroCostos + js.substring(end);

fs.writeFileSync('js/finanzas_script.js', js);
console.log("Updated loadCentroCostos successfully.");
