
let _uid='',_email='',_allCostos=[],_allFacturas=[],_clientes=[],_allGastosRaw=[],_allMovBodega=[],_allGastosContabilidad=[];
let _lastHRDoc=null,_hasMoreHR=true,_loadingMoreHR=false;

requireAdmin(async(user,data)=>{
  _uid=user.uid;
  _email=data.correo_electronico||data.email||user.email;
  document.getElementById('cc-periodo').value=new Date().toISOString().slice(0,7);
  document.getElementById('f-fecha').value=new Date().toISOString().split('T')[0];
  document.getElementById('gc-fecha').value=new Date().toISOString().split('T')[0];
  document.getElementById('te-periodo').value=new Date().toISOString().slice(0,7);
  await Promise.all([
    loadFilters(),
    loadClientes(),
    loadCentroCostos(),
    loadFacturas(),
    loadGastosRaw(),
    loadMovBodega(),
    loadGastosContabilidad(),
    loadTotalEnergiesLiquidation()
  ]);
});

function showTab(t){
  ['costos','facturas','hojas-ruta','bodega-fin','contabilidad','comprobantes'].forEach(id=>{
    const el = document.getElementById('tab-'+id);
    if(el) el.style.display=id===t?'block':'none';
  });
  document.querySelectorAll('.tab-btn').forEach((b)=>{
    const onclickVal = b.getAttribute('onclick') || '';
    b.classList.toggle('active', onclickVal.startsWith("showTab(") && onclickVal.includes(t));
  });
  if(t==='contabilidad')updateContabilidad();
  if(t==='bodega-fin')loadIngresosBodega();
  if(t==='hojas-ruta')loadHojasRuta();
  if(t==='comprobantes')loadComprobantes();
}

function fmt(n){return'$'+(n||0).toLocaleString('es-CL')}

// â• â• â•  FILTERS â• â• â• 
async function loadFilters(){
  try{
    const [vSnap,uSnap]=await Promise.all([db.collection('vehiculos').get(),db.collection('users').get()]);
    const vSel=document.getElementById('cc-vehiculo');
    const uSel=document.getElementById('cc-conductor');
    
    const modalConductorSel=document.getElementById('hoja-conductor-select');
    const modalPatenteSel=document.getElementById('hoja-patente-select');
    const modalDistribuidorSel=document.getElementById('hoja-distribuidor-select');
    
    if(vSel) vSel.innerHTML = '<option value="">Todos</option>';
    if(uSel) uSel.innerHTML = '<option value="">Todos</option>';
    if(modalConductorSel) modalConductorSel.innerHTML = '<option value="">Selecciona Conductor</option>';
    if(modalPatenteSel) modalPatenteSel.innerHTML = '<option value="">Selecciona Vehículo</option>';
    if(modalDistribuidorSel) modalDistribuidorSel.innerHTML = '<option value="">Selecciona Distribuidor</option>';

    vSnap.forEach(d=>{
      const v=d.data();
      const patente = v.patente || d.id;
      if(vSel){
        const o=document.createElement('option');o.value=patente;o.textContent=patente;vSel.appendChild(o);
      }
      if(modalPatenteSel){
        const o=document.createElement('option');o.value=patente;o.textContent=patente;modalPatenteSel.appendChild(o);
      }
    });

    uSnap.forEach(d=>{
      const u=d.data();
      const email = u.correo_electronico || u.email || '';
      const nombre = u.nombre || u.name || email;
      if((u.rol||'').toLowerCase().includes('conductor')){
        if(uSel){
          const o=document.createElement('option');o.value=email;o.textContent=nombre;uSel.appendChild(o);
        }
      }
      if(modalConductorSel){
        const o=document.createElement('option');o.value=email;o.textContent=`${nombre} (${email})`;modalConductorSel.appendChild(o);
      }
    });

    let dists = ['CINTEC', 'TotalEnergies'];
    try {
      const distSnap = await db.collection('distribuidores').get();
      distSnap.forEach(d => {
        const name = d.data().nombre || d.data().name || d.id;
        if (name && !dists.includes(name)) {
          dists.push(name);
        }
      });
    } catch(err) {
      console.warn("Could not load distributors collection:", err);
    }
    
    if (modalDistribuidorSel) {
      dists.forEach(d => {
        const o = document.createElement('option');
        o.value = d;
        o.textContent = d;
        modalDistribuidorSel.appendChild(o);
      });
      const oNone = document.createElement('option');
      oNone.value = 'SIN DISTRIBUIDOR';
      oNone.textContent = 'SIN DISTRIBUIDOR';
      modalDistribuidorSel.appendChild(oNone);
    }
  }catch(e){console.warn(e);}
}

async function loadClientes(){
  try{
    const s=await db.collection('clientes').get();
    _clientes=[];s.forEach(d=>{_clientes.push({id:d.id,...d.data()});});
    const sel=document.getElementById('f-cliente');
    _clientes.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.nombre||c.id;sel.appendChild(o);});
  }catch(e){}
}

function onClienteSelect(){
  const id=document.getElementById('f-cliente').value;
  const c=_clientes.find(x=>x.id===id);
  if(c){
    document.getElementById('f-rut').value=c.rut||'';
    document.getElementById('f-dir').value=c.direccion||'';
    document.getElementById('f-giro').value=c.giro||'';
  }
}

// â• â• â•  CENTRO DE COSTOS â• â• â• 
async function loadCentroCostos(){
  const periodo=document.getElementById('cc-periodo').value;
  const vehiculo=document.getElementById('cc-vehiculo').value;
  const conductor=document.getElementById('cc-conductor').value;

  try{
    // Reload raw loaders to match the period for export files
    await Promise.all([loadGastosRaw(), loadMovBodega(), loadGastosContabilidad()]);

    // Load turnos for the period
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
    try {
      tSnap=await q.get();
    } catch(err) {
      console.warn("Native turnos range query failed, falling back to full query:", err);
      tSnap=await db.collection('turnos').get();
    }
    let turnos=[];
    tSnap.forEach(d=>{
      const t=d.data();
      const fecha=t.fecha?.toDate?t.fecha.toDate():null;
      if(!fecha)return;
      const m=fecha.toISOString().slice(0,7);
      if(periodo&&m!==periodo)return;
      if(vehiculo&&t.patente!==vehiculo)return;
      if(conductor&&t.conductor_email!==conductor)return;
      turnos.push({id:d.id,...t,_fecha:fecha});
    });
    turnos.sort((a,b)=>b._fecha-a._fecha);

    // Load gastos for these turnos (optimized by period)
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
    
    let gSnap;
    try {
      gSnap = await qGastos.get();
    } catch(err) {
      console.warn("Monthly query failed for gastos_ruta in CC, using fallback:", err);
      gSnap = await db.collection('gastos_ruta').get();
    }
    
    const gastosByTurno={};
    gSnap.forEach(d=>{const g=d.data();if(!gastosByTurno[g.turno_id])gastosByTurno[g.turno_id]={combustible:0,peaje:0};if(g.tipo==='combustible')gastosByTurno[g.turno_id].combustible+=g.monto_clp||0;else gastosByTurno[g.turno_id].peaje+=g.monto_clp||0;});

    // Load despachos (optimized by period)
    let dSnap;
    try {
      dSnap = await qDespachos.get();
    } catch(err) {
      console.warn("Monthly query failed for despachos in CC, using fallback:", err);
      dSnap = await db.collection('despachos').get();
    }
    
    const despachosByTurno={};
    dSnap.forEach(d=>{const dp=d.data();if(!despachosByTurno[dp.turno_id])despachosByTurno[dp.turno_id]={entregados:0,devueltos:0};if(dp.estado==='entregado')despachosByTurno[dp.turno_id].entregados++;else if(dp.estado==='devuelto')despachosByTurno[dp.turno_id].devueltos++;});

    // Build cost rows
    _allCostos=turnos.map(t=>{
      const g=gastosByTurno[t.id]||{combustible:0,peaje:0};
      const d=despachosByTurno[t.id]||{entregados:0,devueltos:0};
      return{...t,combustible:g.combustible,peaje:g.peaje,total_gastos:g.combustible+g.peaje,entregados:d.entregados,devueltos:d.devueltos};
    });

    let totComb=0,totPeaje=0,totGastos=0;
    const body=document.getElementById('cc-body');
    if(!_allCostos.length){body.innerHTML='<tr><td colspan="9" class="txt-c empty">Sin datos para este periodo</td></tr>';
    }else{
      body.innerHTML=_allCostos.map(r=>{
        totComb+=r.combustible||0; totPeaje+=r.peaje||0; totGastos+=r.total_gastos||0;
        const f=r._fecha?r._fecha.toLocaleDateString('es-CL',{day:'2-digit',month:'short'}):'—';
        return`<tr>
          <td>${f}</td>
          <td><code style="color:var(--accent)">${sanitize(r.patente||'—')}</code></td>
          <td style="font-size:.78rem">${sanitize(r.conductor_nombre || r.conductor_email || '—')}</td>
          <td>${sanitize(r.nombre_distribuidor || r.distribuidor || 'SIN DISTRIBUIDOR')}</td>
          <td class="txt-r">${r.entregados}</td>
          <td class="txt-r">${r.devueltos}</td>
          <td class="txt-r money money-red">${fmt(r.combustible)}</td>
          <td class="txt-r money money-red">${fmt(r.peaje)}</td>
          <td class="txt-r money money-red">${fmt(r.total_gastos)}</td>
        </tr>`;
      }).join('');
    }
    document.getElementById('cc-ingresos').textContent=fmt(totComb);
    document.getElementById('cc-egresos').textContent=fmt(totPeaje);
    document.getElementById('cc-margen').textContent=fmt(totGastos);
    document.getElementById('cc-turnos').textContent=_allCostos.length;
  }catch(e){console.warn(e);showToast('Error: '+e.message,'error');}
}

// â• â• â•  PRE-FACTURAS â• â• â• 
async function loadFacturas(){
  try{
    const s=await db.collection('prefacturas').get();
    _allFacturas=[];s.forEach(d=>{_allFacturas.push({id:d.id,...d.data()});});
    _allFacturas.sort((a,b)=>(b.fecha_emision?.toDate?b.fecha_emision.toDate():new Date(0))-(a.fecha_emision?.toDate?a.fecha_emision.toDate():new Date(0)));
    renderFacturas();
  }catch(e){console.warn(e);}
}

function renderFacturas(){
  const body=document.getElementById('fact-body');
  if(!_allFacturas.length){body.innerHTML='<tr><td colspan="9" class="txt-c empty">Sin pre-facturas</td></tr>';return;}
  body.innerHTML=_allFacturas.map(f=>{
    const badgeCls={borrador:'b-borrador',enviada:'b-enviada',pagada:'b-pagada'}[f.estado]||'b-borrador';
    const badgeTxt={borrador:'Borrador',enviada:'Enviada',pagada:'Pagada'}[f.estado]||f.estado;
    const fecha=f.fecha_emision?formatDate(f.fecha_emision):'â€”';
    return`<tr>
      <td><code style="color:var(--accent)">${sanitize(f.numero||'â€”')}</code></td>
      <td>${sanitize(f.cliente_nombre||'â€”')}</td>
      <td style="font-size:.78rem">${sanitize(f.cliente_rut||'â€”')}</td>
      <td>${fecha}</td>
      <td class="txt-r money">${fmt(f.neto||0)}</td>
      <td class="txt-r money">${fmt(f.iva||0)}</td>
      <td class="txt-r money money-green">${fmt(f.total||0)}</td>
      <td class="txt-c"><span class="badge-sm ${badgeCls}">${badgeTxt}</span></td>
      <td class="txt-c">
        <button class="btn-sm" onclick="cambiarEstado('${f.id}','enviada')" title="Marcar enviada">ðŸ“§</button>
        <button class="btn-sm" onclick="cambiarEstado('${f.id}','pagada')" title="Marcar pagada">âœ…</button>
        <button class="btn-sm" onclick="imprimirFactura('${f.id}')" title="Imprimir">ðŸ–¨ï¸ </button>
      </td>
    </tr>`;
  }).join('');
}

let _teLoadedTrips = [];
let _teArriendoBodega = 0;
let _teM2Extras = 0;

async function loadTotalEnergiesLiquidation() {
  const period = document.getElementById('te-periodo').value;
  const tbody = document.getElementById('te-trips-body');
  if (!period) return;
  tbody.innerHTML = '<tr><td colspan="5" class="txt-c"><span class="spinner"></span> Cargando viajes...</td></tr>';
  
  try {
    // 1. Obtener Hojas de Ruta
    const hrSnap = await db.collection('hojas_ruta').get();
    _teLoadedTrips = [];
    hrSnap.forEach(d => {
      const r = d.data();
      const dist = (r.nombre_distribuidor || r.distribuidor || '').trim().toLowerCase();
      if (dist.includes('total') && r.fecha && r.fecha.startsWith(period)) {
        _teLoadedTrips.push({ id: d.id, ...r });
      }
    });

    // Ordenar descendente por fecha
    _teLoadedTrips.sort((a,b) => (b.fecha || '').localeCompare(a.fecha || ''));

    // 2. Obtener Movimientos de Bodega (Ingresos)
    const bgSnap = await db.collection('ingresos_bodega').get();
    _teArriendoBodega = 0;
    _teM2Extras = 0;
    
    bgSnap.forEach(d => {
      const m = d.data();
      const cliName = (m.cliente || '').trim().toLowerCase();
      if (cliName.includes('total') && m.fecha && m.fecha.startsWith(period)) {
        if (m.concepto === 'ingreso_bodega') {
          _teArriendoBodega += m.monto || 0;
        } else if (m.concepto === 'ingreso_m2') {
          _teM2Extras += m.monto || 0;
        }
      }
    });

    // 3. Renderizar filas de viajes
    if (_teLoadedTrips.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="txt-c" style="color:var(--text2);padding:15px">Sin viajes de TotalEnergies registrados en este periodo.</td></tr>';
    } else {
      tbody.innerHTML = _teLoadedTrips.map(trip => {
        const clientsStr = (trip.clientes_despacho || []).join(', ') || 'â€”';
        return `<tr>
          <td>${sanitize(trip.fecha || 'â€”')}</td>
          <td>${sanitize(trip.conductor_nombre || trip.conductor_email || 'â€”')}</td>
          <td><code>${sanitize(trip.patente || 'â€”')}</code></td>
          <td style="font-size:.78rem; max-width: 230px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sanitize(clientsStr)}">${sanitize(clientsStr)}</td>
          <td class="txt-r">
            <div style="display:flex; align-items:center; justify-content:flex-end; gap:6px;">
              <span>$</span>
              <input type="number" class="te-servicio-cost field" style="width:110px; text-align:right; padding:4px 8px; font-size:.82rem; margin:0;" data-id="${trip.id}" value="${trip.valor_servicio || 0}" onchange="updateTotalEnergiesTripCost('${trip.id}', this.value)"/>
            </div>
          </td>
        </tr>`;
      }).join('');
    }

    recalculateTotalEnergiesLiquidation();

  } catch(e) {
    console.error("Error loadTotalEnergiesLiquidation:", e);
    tbody.innerHTML = `<tr><td colspan="5" class="txt-c" style="color:var(--danger);padding:15px">Error: ${e.message}</td></tr>`;
  }
}

async function updateTotalEnergiesTripCost(tripId, val) {
  const cost = parseFloat(val) || 0;
  try {
    await db.collection('hojas_ruta').doc(tripId).update({
      valor_servicio: cost
    });
    const idx = _teLoadedTrips.findIndex(t => t.id === tripId);
    if (idx !== -1) {
      _teLoadedTrips[idx].valor_servicio = cost;
    }
    showToast('ðŸ’° Valor de servicio actualizado', 'success');
    recalculateTotalEnergiesLiquidation();
  } catch(e) {
    showToast('Error al actualizar costo: ' + e.message, 'error');
  }
}

function recalculateTotalEnergiesLiquidation() {
  let totalServicios = 0;
  document.querySelectorAll('.te-servicio-cost').forEach(input => {
    totalServicios += parseFloat(input.value) || 0;
  });

  const neto = totalServicios + _teArriendoBodega + _teM2Extras;
  const iva = Math.round(neto * 0.19);
  const total = neto + iva;

  document.getElementById('te-summary-trips-count').textContent = _teLoadedTrips.length;
  document.getElementById('te-summary-trips-cost').textContent = fmt(totalServicios);
  document.getElementById('te-summary-arriendo').textContent = fmt(_teArriendoBodega);
  document.getElementById('te-summary-m2').textContent = fmt(_teM2Extras);
  document.getElementById('te-summary-neto').textContent = fmt(neto);
  document.getElementById('te-summary-total').textContent = fmt(total);
}

function generarPreFacturaTotalEnergies() {
  let totalServicios = 0;
  document.querySelectorAll('.te-servicio-cost').forEach(input => {
    totalServicios += parseFloat(input.value) || 0;
  });

  if (totalServicios === 0 && _teArriendoBodega === 0 && _teM2Extras === 0) {
    showToast('âš ï¸  No hay montos cargados para pre-facturar', 'error');
    return;
  }

  // 1. Abrir modal de Factura
  document.getElementById('modal-factura').classList.add('open');
  document.getElementById('f-numero').value = 'PF-' + (String(_allFacturas.length + 1).padStart(4, '0'));
  document.getElementById('f-fecha').value = new Date().toISOString().split('T')[0];

  // 2. Pre-seleccionar TotalEnergies
  const sel = document.getElementById('f-cliente');
  let matchedValue = '';
  for (let i = 0; i < sel.options.length; i++) {
    const text = sel.options[i].text.toLowerCase();
    if (text.includes('total')) {
      matchedValue = sel.options[i].value;
      break;
    }
  }

  if (matchedValue) {
    sel.value = matchedValue;
    onClienteSelect();
  }

  // 3. Limpiar Ã­tems y cargar los calculados
  const tbody = document.getElementById('f-items');
  tbody.innerHTML = '';

  const period = document.getElementById('te-periodo').value;

  if (totalServicios > 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="fi-desc" value="Servicios de Transporte TotalEnergies (${_teLoadedTrips.length} viajes) - ${period}"/></td>
      <td><input type="number" class="fi-cant" value="1" min="1" oninput="calcTotals()"/></td>
      <td><input type="number" class="fi-precio" value="${totalServicios}" oninput="calcTotals()"/></td>
      <td class="txt-r money fi-sub">${fmt(totalServicios)}</td>
      <td><button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.9rem" onclick="this.closest('tr').remove();calcTotals()">âœ•</button></td>`;
    tbody.appendChild(tr);
  }

  if (_teArriendoBodega > 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="fi-desc" value="Cobros por Arriendo de Bodega TotalEnergies - ${period}"/></td>
      <td><input type="number" class="fi-cant" value="1" min="1" oninput="calcTotals()"/></td>
      <td><input type="number" class="fi-precio" value="${_teArriendoBodega}" oninput="calcTotals()"/></td>
      <td class="txt-r money fi-sub">${fmt(_teArriendoBodega)}</td>
      <td><button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.9rem" onclick="this.closest('tr').remove();calcTotals()">âœ•</button></td>`;
    tbody.appendChild(tr);
  }

  if (_teM2Extras > 0) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" class="fi-desc" value="Cobros por M2 Extras Bodega TotalEnergies - ${period}"/></td>
      <td><input type="number" class="fi-cant" value="1" min="1" oninput="calcTotals()"/></td>
      <td><input type="number" class="fi-precio" value="${_teM2Extras}" oninput="calcTotals()"/></td>
      <td class="txt-r money fi-sub">${fmt(_teM2Extras)}</td>
      <td><button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.9rem" onclick="this.closest('tr').remove();calcTotals()">âœ•</button></td>`;
    tbody.appendChild(tr);
  }

  calcTotals();
  showToast('ðŸ“‹ LiquidaciÃ³n TotalEnergies cargada en Pre-Factura', 'success');
}

function openFacturaModal(){
  document.getElementById('modal-factura').classList.add('open');
  document.getElementById('f-numero').value='PF-'+(String(_allFacturas.length+1).padStart(4,'0'));
  addItemRow();
}
function closeFacturaModal(){document.getElementById('modal-factura').classList.remove('open');document.getElementById('f-items').innerHTML='';}

function addItemRow(){
  const tbody=document.getElementById('f-items');
  const tr=document.createElement('tr');
  tr.innerHTML=`
    <td><input type="text" class="fi-desc" placeholder="Servicio transporteâ€¦"/></td>
    <td><input type="number" class="fi-cant" value="1" min="1" oninput="calcTotals()"/></td>
    <td><input type="number" class="fi-precio" value="0" oninput="calcTotals()"/></td>
    <td class="txt-r money fi-sub">$0</td>
    <td><button style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:.9rem" onclick="this.closest('tr').remove();calcTotals()">âœ•</button></td>`;
  tbody.appendChild(tr);
}

function calcTotals(){
  let neto=0;
  document.querySelectorAll('#f-items tr').forEach(tr=>{
    const cant=parseInt(tr.querySelector('.fi-cant')?.value)||0;
    const precio=parseInt(tr.querySelector('.fi-precio')?.value)||0;
    const sub=cant*precio;
    tr.querySelector('.fi-sub').textContent=fmt(sub);
    neto+=sub;
  });
  const iva=Math.round(neto*0.19);
  document.getElementById('f-neto').textContent=fmt(neto);
  document.getElementById('f-iva').textContent=fmt(iva);
  document.getElementById('f-total').textContent=fmt(neto+iva);
}

async function guardarFactura(){
  const numero=document.getElementById('f-numero').value.trim();
  const clienteId=document.getElementById('f-cliente').value;
  const cli=_clientes.find(c=>c.id===clienteId);
  
  if(!numero){showToast('Ingresa NÂ° documento','error');return;}
  if(!clienteId){showToast('Selecciona un cliente','error');return;}

  const items=[];
  document.querySelectorAll('#f-items tr').forEach(tr=>{
    const desc=tr.querySelector('.fi-desc')?.value||'';
    const cant=parseInt(tr.querySelector('.fi-cant')?.value)||0;
    const precio=parseInt(tr.querySelector('.fi-precio')?.value)||0;
    if(desc&&cant>0)items.push({descripcion:desc,cantidad:cant,precio_unitario:precio,subtotal:cant*precio});
  });
  if(!items.length){showToast('Agrega al menos un Ã­tem','error');return;}

  const neto=items.reduce((s,i)=>s+i.subtotal,0);
  const iva=Math.round(neto*0.19);

  try{
    await db.collection('prefacturas').add({
      numero,
      cliente_id:clienteId,cliente_nombre:cli?.nombre||'',cliente_rut:document.getElementById('f-rut').value.trim(),
      cliente_giro:document.getElementById('f-giro').value.trim(),cliente_direccion:document.getElementById('f-dir').value.trim(),
      items,neto,iva,total:neto+iva,
      estado:'borrador',
      observaciones:document.getElementById('f-obs').value.trim(),
      fecha_emision:firebase.firestore.FieldValue.serverTimestamp(),
      creado_por:_uid
    });
    showToast('âœ… Pre-factura guardada','success');
    closeFacturaModal();await loadFacturas();
  }catch(e){showToast('Error: '+e.message,'error');}
}

async function cambiarEstado(id,estado){
  if(!confirm(`Â¿Cambiar estado a "${estado}"?`))return;
  await db.collection('prefacturas').doc(id).update({estado});
  showToast('âœ… Estado actualizado','success');
  await loadFacturas();
}

function imprimirFactura(id){
  const f=_allFacturas.find(x=>x.id===id);if(!f)return;
  const itemsHtml=f.items?.map(i=>`<tr><td>${i.descripcion}</td><td class="r">${i.cantidad}</td><td class="r">${fmt(i.precio_unitario)}</td><td class="r">${fmt(i.subtotal)}</td></tr>`).join('')||'';
  const w=window.open('','_blank');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Pre-Factura ${f.numero}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,sans-serif;padding:30px;font-size:12px;color:#333}
.header{display:flex;justify-content:space-between;border-bottom:3px solid #1B4B9B;padding-bottom:16px;margin-bottom:20px}
.header h1{font-size:18px;color:#1B4B9B}.header .doc{text-align:right}
.parties{display:flex;gap:30px;margin-bottom:20px}.party{flex:1;border:1px solid #ddd;border-radius:6px;padding:12px}
.party h3{font-size:11px;text-transform:uppercase;color:#666;margin-bottom:6px}
table{width:100%;border-collapse:collapse;margin:16px 0}th{background:#1B4B9B;color:#fff;padding:8px;text-align:left;font-size:11px}
td{padding:8px;border-bottom:1px solid #eee}.r{text-align:right}
.totals{width:250px;margin-left:auto}.totals td{padding:4px 8px;font-size:12px}.totals .total{font-size:14px;font-weight:700;border-top:2px solid #333}
.footer{margin-top:30px;text-align:center;font-size:10px;color:#999;border-top:1px solid #eee;padding-top:12px}
@media print{body{padding:15px}}</style></head><body>
<div class="header"><div><h1>SILOG SpA</h1><p>RUT: 77.XXX.XXX-X Â· Giro: Transporte y LogÃ­stica</p></div>
<div class="doc"><h2 style="color:#F47920">PRE-FACTURA</h2><p><b>NÂ°:</b> ${f.numero}</p><p><b>Fecha:</b> ${f.fecha_emision?formatDate(f.fecha_emision):new Date().toLocaleDateString('es-CL')}</p></div></div>
<div class="parties"><div class="party"><h3>Emisor</h3><p><b>SILOG SpA</b></p><p>Giro: Transporte y LogÃ­stica</p></div>
<div class="party"><h3>Receptor</h3><p><b>${f.cliente_nombre||'â€”'}</b></p><p>RUT: ${f.cliente_rut||'â€”'}</p><p>Giro: ${f.cliente_giro||'â€”'}</p><p>Dir: ${f.cliente_direccion||'â€”'}</p></div></div>
<table><thead><tr><th>DescripciÃ³n</th><th class="r">Cant.</th><th class="r">P. Unitario</th><th class="r">Subtotal</th></tr></thead><tbody>${itemsHtml}</tbody></table>
<table class="totals"><tr><td>Neto</td><td class="r">${fmt(f.neto)}</td></tr><tr><td>IVA 19%</td><td class="r">${fmt(f.iva)}</td></tr><tr class="total"><td><b>TOTAL</b></td><td class="r"><b>${fmt(f.total)}</b></td></tr></table>
${f.observaciones?`<p style="margin-top:16px;font-size:11px"><b>Observaciones:</b> ${f.observaciones}</p>`:''}
<div class="footer">Documento generado por SILOG SpA Â· Este documento no es un DTE vÃ¡lido ante el SII</div>
</body></html>`);
  w.document.close();
  setTimeout(()=>w.print(),300);
}

async function loadGastosContabilidad(){
  const periodo=document.getElementById('cc-periodo').value;
  try{
    let q=db.collection('gastos_contabilidad');
    const snap=await q.get();
    _allGastosContabilidad=[];
    snap.forEach(d=>{
      const g=d.data();
      if(!periodo || (g.fecha && g.fecha.startsWith(periodo))) {
        _allGastosContabilidad.push({id:d.id,...g});
      }
    });
    _allGastosContabilidad.sort((a,b)=>b.fecha.localeCompare(a.fecha));
  }catch(e){
    console.warn("loadGastosContabilidad failed:",e);
  }
}

async function updateContabilidad(){
  await Promise.all([loadFacturas(), loadIngresosBodega(), loadGastosContabilidad()]);
  renderContabilidad();
}

function renderContabilidad(){
  const periodo=document.getElementById('cc-periodo').value;

  // 1. Ingresos
  let totalFacturas=0;
  _allFacturas.forEach(f=>{
    const date=f.fecha_emision?.toDate?f.fecha_emision.toDate():null;
    if(date){
      const m=date.toISOString().slice(0,7);
      if(!periodo||m===periodo) totalFacturas+=f.neto||0;
    }
  });

  let totalBodegaIngresos=0;
  let totalBodegaM2=0;
  let totalBodegaArriendo=0;
  _ingresosBodega.forEach(m=>{
    if(!periodo||(m.fecha&&m.fecha.startsWith(periodo))){
      if(m.concepto==='ingreso_bodega') totalBodegaIngresos+=m.monto||0;
      else if(m.concepto==='ingreso_m2') totalBodegaM2+=m.monto||0;
      else if(m.concepto==='costo_arriendo') totalBodegaArriendo+=m.monto||0;
    }
  });

  let totalIngresosVarios=0;
  let totalSueldosBruto=0;
  let totalSueldosLiquido=0;
  let totalServicios=0;
  
  _allGastosContabilidad.forEach(g=>{
    if(g.tipo==='sueldo'){
      totalSueldosBruto+=g.monto_bruto||0;
      totalSueldosLiquido+=g.monto_liquido||0;
    }else if(g.tipo==='servicio'){
      totalServicios+=g.monto_neto||g.monto||0;
    }else if(g.tipo==='ingreso'){
      totalIngresosVarios+=g.monto||0;
    }
  });

  const totalIngresos=totalFacturas+totalBodegaIngresos+totalBodegaM2+totalIngresosVarios;

  // 2. Egresos
  let totalRutaCombustible=0;
  let totalRutaPeajes=0;
  _allGastosRaw.forEach(g=>{
    if(g._date){
      const m=g._date.toISOString().slice(0,7);
      if(!periodo||m===periodo){
        if(g.tipo==='combustible') totalRutaCombustible+=g.monto_clp||0;
        else totalRutaPeajes+=g.monto_clp||0;
      }
    }
  });

  const totalEgresos=totalRutaCombustible+totalRutaPeajes+totalBodegaArriendo+totalSueldosBruto+totalServicios;
  const margen=totalIngresos-totalEgresos;
  const totalManuales=totalSueldosBruto+totalServicios;

  // Render KPIs
  document.getElementById('cont-ingresos').textContent=fmt(totalIngresos);
  document.getElementById('cont-egresos').textContent=fmt(totalEgresos);
  
  const contMargen=document.getElementById('cont-margen');
  contMargen.textContent=fmt(margen);
  const mCard=document.getElementById('stat-margen-card');
  if(mCard){
    mCard.className='stat '+(margen>=0?'stat-green':'stat-red');
  }
  document.getElementById('cont-manuales').textContent=fmt(totalIngresosVarios);
  const mExpensesSub = document.getElementById('cont-manuales-gastos-sub');
  if (mExpensesSub) {
    mExpensesSub.textContent = "Gastos manuales: " + fmt(totalSueldosBruto + totalServicios);
  }

  // Render Breakdown Table
  document.getElementById('det-ing-facturas').textContent=fmt(totalFacturas);
  document.getElementById('det-ing-bodega').textContent=fmt(totalBodegaIngresos);
  document.getElementById('det-ing-m2').textContent=fmt(totalBodegaM2);
  document.getElementById('det-ing-varios').textContent=fmt(totalIngresosVarios);
  document.getElementById('det-ing-total').textContent=fmt(totalIngresos);

  document.getElementById('det-egr-combustible').textContent=fmt(totalRutaCombustible);
  document.getElementById('det-egr-peajes').textContent=fmt(totalRutaPeajes);
  document.getElementById('det-egr-arriendo').textContent=fmt(totalBodegaArriendo);
  document.getElementById('det-egr-sueldos').textContent=fmt(totalSueldosBruto);
  document.getElementById('det-egr-servicios').textContent=fmt(totalServicios);
  document.getElementById('det-egr-total').textContent=fmt(totalEgresos);

  // Render Manual Expenses/Incomes List Table
  const tbody=document.getElementById('cont-body');
  if(!_allGastosContabilidad.length){
    tbody.innerHTML='<tr><td colspan="7" class="txt-c empty">Sin movimientos registrados</td></tr>';
  }else{
    tbody.innerHTML=_allGastosContabilidad.map(g=>{
      const isSueldo=g.tipo==='sueldo';
      const isIngreso=g.tipo==='ingreso';
      
      let badgeCls = 'b-borrador';
      let badgeTxt = 'Servicio';
      let colLabel = '';
      let montoBruto = '';
      
      if(isSueldo){
        badgeCls = 'b-pagada';
        badgeTxt = 'Sueldo';
        colLabel = `ðŸ‘¤ ${sanitize(g.personal_nombre)}`;
        montoBruto = fmt(g.monto_bruto);
      } else if (isIngreso) {
        badgeCls = 'b-enviada';
        badgeTxt = 'Ingreso';
        colLabel = sanitize(g.subtipo === 'facturacion_varias' ? 'ðŸ“„ FacturaciÃ³n Varia' : 'ðŸ’µ Otro Ingreso');
        montoBruto = fmt(g.monto_neto || g.monto);
      } else {
        colLabel = sanitize(getServicioLabel(g.subtipo));
        montoBruto = fmt(g.monto_neto || g.monto);
      }
      
      const montoLiquido = isSueldo ? fmt(g.monto_liquido) : (isIngreso && g.monto_total ? fmt(g.monto_total) : (g.monto_total ? fmt(g.monto_total) : 'â€”'));
      const glosa=sanitize(g.descripcion||'â€”');
      return `<tr>
        <td>${sanitize(g.fecha||'â€”')}</td>
        <td><span class="badge-sm ${badgeCls}">${badgeTxt}</span></td>
        <td style="font-weight:600; color:${isIngreso?'var(--success)':'var(--text)'}">${colLabel}</td>
        <td class="txt-r money ${isIngreso?'money-green':'money-red'}">${isIngreso?'+':'-'}${montoBruto}</td>
        <td class="txt-r money" style="color:var(--text2)">${montoLiquido}</td>
        <td style="font-size:.78rem">${glosa}</td>
        <td class="txt-c">
          <button class="btn-sm" style="border-color:var(--danger);color:#FCA5A5;padding:4px 8px" onclick="deleteGastoContabilidad('${sanitize(g.id)}')">ðŸ—‘ï¸ </button>
        </td>
      </tr>`;
    }).join('');
  }
}

function getServicioLabel(sub){
  const m={
    'luz':'ðŸ’¡ Luz',
    'agua':'ðŸš° Agua',
    'electricidad':'âš¡ Electricidad',
    'telefonia_internet':'ðŸ“ž TelefonÃ­a e Internet',
    'arriendo_inmobiliario':'ðŸ   Arriendo Inmobiliario'
  };
  return m[sub]||sub;
}

function onMovTipoChange() {
  const movTipo = document.getElementById('gc-mov-tipo').value;
  const secGastoTipo = document.getElementById('gc-gasto-tipo-group');
  const btnSubmit = document.getElementById('btn-gc-submit');
  const cardTitle = document.getElementById('gc-card-title');
  
  if (movTipo === 'gasto') {
    if (secGastoTipo) secGastoTipo.style.display = 'block';
    document.getElementById('gc-sec-ingreso').style.display = 'none';
    if (cardTitle) cardTitle.textContent = 'âž• Registrar Gasto Administrativo / Servicio';
    if (btnSubmit) {
      btnSubmit.textContent = 'ðŸ’¾ Registrar Gasto';
      btnSubmit.style.background = 'var(--accent)';
      btnSubmit.style.borderColor = 'var(--accent)';
    }
    onTipoGastoChange();
  } else {
    if (secGastoTipo) secGastoTipo.style.display = 'none';
    document.getElementById('gc-sec-sueldo').style.display = 'none';
    document.getElementById('gc-sec-servicio').style.display = 'none';
    document.getElementById('gc-sec-ingreso').style.display = 'grid';
    if (cardTitle) cardTitle.textContent = 'âž• Registrar Ingreso Manual (FacturaciÃ³n Varia)';
    if (btnSubmit) {
      btnSubmit.textContent = 'ðŸ’¾ Registrar Ingreso';
      btnSubmit.style.background = 'linear-gradient(135deg,var(--success),#059669)';
      btnSubmit.style.borderColor = 'var(--success)';
    }
  }
}

function onTipoGastoChange(){
  const tipo=document.getElementById('gc-tipo').value;
  document.getElementById('gc-sec-sueldo').style.display=tipo==='sueldo'?'grid':'none';
  document.getElementById('gc-sec-servicio').style.display=tipo==='servicio'?'grid':'none';
}

function calcSueldoLiquidoAutomatico(){
  const bruto=parseInt(document.getElementById('gc-bruto').value)||0;
  document.getElementById('gc-liquido').value=Math.round(bruto*0.8);
}

function calcIngresoIvaAutomatico() {
    const neto = parseInt(document.getElementById('gc-ingreso-monto').value) || 0;
    if (neto > 0) {
      const iva = Math.round(neto * 0.19);
      document.getElementById('gc-ingreso-iva').value = '$ ' + iva.toLocaleString('es-CL');
      document.getElementById('gc-ingreso-total').value = '$ ' + (neto + iva).toLocaleString('es-CL');
    } else {
      document.getElementById('gc-ingreso-iva').value = '';
      document.getElementById('gc-ingreso-total').value = '';
    }
  }

  function calcServicioIvaAutomatico() {
    const neto = parseInt(document.getElementById('gc-monto').value) || 0;
    if (neto > 0) {
      const iva = Math.round(neto * 0.19);
      document.getElementById('gc-servicio-iva').value = '$ ' + iva.toLocaleString('es-CL');
      document.getElementById('gc-servicio-total').value = '$ ' + (neto + iva).toLocaleString('es-CL');
    } else {
      document.getElementById('gc-servicio-iva').value = '';
      document.getElementById('gc-servicio-total').value = '';
    }
  }

async function guardarGastoContabilidad(){
  const movTipo=document.getElementById('gc-mov-tipo').value;
  const fecha=document.getElementById('gc-fecha').value||new Date().toISOString().split('T')[0];
  const descripcion=document.getElementById('gc-desc').value.trim();

  let data={
    fecha,
    descripcion,
    creado_por:_email,
    created_at:firebase.firestore.FieldValue.serverTimestamp()
  };

  if(movTipo==='ingreso'){
    const subtipo=document.getElementById('gc-ingreso-subtipo').value;
    const neto=parseInt(document.getElementById('gc-ingreso-monto').value)||0;
    if(neto<=0){showToast('Ingresa un monto neto válido para el ingreso','error');return;}
    const iva=Math.round(neto*0.19);
    const total=neto+iva;
    data.tipo='ingreso';
    data.subtipo=subtipo;
    data.monto=neto;
    data.monto_neto=neto;
    data.iva=iva;
    data.monto_total=total;
  }else{
    const tipo=document.getElementById('gc-tipo').value;
    data.tipo=tipo;
    if(tipo==='sueldo'){
      const personal_nombre=document.getElementById('gc-personal').value.trim();
      const bruto=parseInt(document.getElementById('gc-bruto').value)||0;
      const liquido=parseInt(document.getElementById('gc-liquido').value)||0;
      if(!personal_nombre){showToast('Ingresa el nombre o cargo del personal','error');return;}
      if(bruto<=0){showToast('Ingresa un sueldo bruto válido','error');return;}
      data.personal_nombre=personal_nombre;
      data.monto_bruto=bruto;
      data.monto_liquido=liquido;
    }else{
      const subtipo=document.getElementById('gc-subtipo').value;
      const monto=parseInt(document.getElementById('gc-monto').value)||0;
      if(monto<=0){showToast('Ingresa un monto válido para el servicio','error');return;}
      data.subtipo=subtipo;
      data.monto=monto;
      data.monto_neto=monto;
      data.iva=Math.round(monto * 0.19);
      data.monto_total=monto + Math.round(monto * 0.19);
    }
  }

  try{
    await db.collection('gastos_contabilidad').add(data);
    showToast('â Movimiento registrado exitosamente','success');
    document.getElementById('gc-personal').value='';
    document.getElementById('gc-bruto').value='';
    document.getElementById('gc-liquido').value='';
    document.getElementById('gc-monto').value='';
    document.getElementById('gc-ingreso-monto').value='';
    document.getElementById('gc-ingreso-iva').value='';
    document.getElementById('gc-ingreso-total').value='';
    document.getElementById('gc-desc').value='';
    await loadGastosContabilidad();
    renderContabilidad();
  }catch(e){showToast('Error registrando movimiento: '+e.message,'error');}
}

async function deleteGastoContabilidad(id){
  if(!confirm('Â¿EstÃ¡s seguro de que deseas eliminar este gasto de contabilidad?'))return;
  try{
    await db.collection('gastos_contabilidad').doc(id).delete();
    showToast('ðï¸ Registro eliminado','success');
    await loadGastosContabilidad();
    renderContabilidad();
  }catch(e){showToast('Error al eliminar: '+e.message,'error');}
}

// âââ RAW DATA LOADERS âââ
async function loadGastosRaw(){
  const periodo=document.getElementById('cc-periodo').value;
  try{
    let q=db.collection('gastos_ruta');
    if(periodo){
      const year = parseInt(periodo.split('-')[0]);
      const month = parseInt(periodo.split('-')[1]);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      q = q.where('fecha', '>=', firebase.firestore.Timestamp.fromDate(start))
           .where('fecha', '<', firebase.firestore.Timestamp.fromDate(end));
    }
    let s;
    try {
      s=await q.get();
    } catch(err) {
      console.warn("Native query failed for gastos_ruta, falling back:", err);
      s=await db.collection('gastos_ruta').get();
    }
    _allGastosRaw=[];
    s.forEach(d=>{
      const g=d.data();
      g._date=g.fecha?.toDate?g.fecha.toDate():(g.created_at?.toDate?g.created_at.toDate():null);
      _allGastosRaw.push(g);
    });
    _allGastosRaw.sort((a,b)=>(a._date||0)-(b._date||0));
  }catch(e){console.warn(e);}
}

async function loadMovBodega(){
  const periodo=document.getElementById('cc-periodo').value;
  try{
    let q=db.collection('movimientos_bodega');
    if(periodo){
      const year = parseInt(periodo.split('-')[0]);
      const month = parseInt(periodo.split('-')[1]);
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      q = q.where('fecha', '>=', firebase.firestore.Timestamp.fromDate(start))
           .where('fecha', '<', firebase.firestore.Timestamp.fromDate(end));
    }
    let s;
    try {
      s=await q.get();
    } catch(err) {
      console.warn("Native query failed for movimientos_bodega, falling back:", err);
      s=await db.collection('movimientos_bodega').get();
    }
    _allMovBodega=[];
    s.forEach(d=>{
      const m=d.data();
      m._date=m.fecha?.toDate?m.fecha.toDate():(m.created_at?.toDate?m.created_at.toDate():null);
      _allMovBodega.push(m);
    });
    _allMovBodega.sort((a,b)=>(a._date||0)-(b._date||0));
  }catch(e){console.warn(e);}
}

function fmtDate(d){return d?d.toLocaleDateString('es-CL',{year:'numeric',month:'2-digit',day:'2-digit'}):''}
function fmtDateFull(d){return d?d.toLocaleDateString('es-CL',{year:'numeric',month:'2-digit',day:'2-digit'})+' '+d.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):''}

// âââ EXPORT: Reporte Consolidado âââ
function exportConsolidado(){
  const rows=[['Fecha','Tipo','Ãrea','DescripciÃ³n','Monto CLP','VehÃ­culo','Conductor']];
  
  // Gastos operacionales en ruta (Egresos)
  _allGastosRaw.forEach(g=>{
    rows.push([
      fmtDate(g._date),
      'EGRESO',
      g.tipo==='combustible'?'Combustible':'Peaje',
      g.tipo==='combustible'?`Combustible - ${g.litros||''}L`:`Peaje - ${g.autopista||''}`,
      -(g.monto_clp||0),
      g.patente||'',
      g.conductor_nombre||g.conductor_email||''
    ]);
  });
  
  // Pre-facturas (Ingresos)
  _allFacturas.forEach(f=>{
    const fecha=f.fecha_emision?.toDate?f.fecha_emision.toDate():null;
    (f.items||[]).forEach(item=>{
      rows.push([
        fmtDate(fecha),
        'INGRESO',
        'Servicios',
        `${f.numero} - ${item.descripcion} (${f.cliente_nombre||''})`,
        item.subtotal||0,
        '',
        ''
      ]);
    });
  });
  
  // Ingresos/Costos Bodega (Ingresos & Egresos)
  _ingresosBodega.forEach(m=>{
    const periodo = document.getElementById('cc-periodo').value;
    if(!periodo || (m.fecha && m.fecha.startsWith(periodo))) {
      const esGasto = m.concepto === 'costo_arriendo';
      const labelConcepto = m.concepto === 'ingreso_bodega' ? 'Ingreso Bodega' : (m.concepto === 'ingreso_m2' ? 'Ingreso MÂ²' : 'Arriendo Bodega');
      rows.push([
        m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-CL') : 'â',
        esGasto ? 'EGRESO' : 'INGRESO',
        'Bodega',
        `${labelConcepto} - ${m.cliente||''} (${m.descripcion||''})`,
        esGasto ? -(m.monto||0) : (m.monto||0),
        '',
        m.creado_por||''
      ]);
    }
  });

  // Gastos manuales Contabilidad (Sueldos, Servicios e Ingresos)
  _allGastosContabilidad.forEach(g=>{
    const isSueldo = g.tipo === 'sueldo';
    const isIngreso = g.tipo === 'ingreso';
    if (isIngreso) {
      rows.push([
        g.fecha ? new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-CL') : 'â',
        'INGRESO',
        'Contabilidad Manual',
        `${g.subtipo === 'facturacion_varias' ? 'FacturaciÃ³n Varia' : 'Otro Ingreso'} - ${g.descripcion || ''}`,
        g.monto_neto || g.monto || 0,
        '',
        g.creado_por||''
      ]);
    } else {
      rows.push([
        g.fecha ? new Date(g.fecha + 'T12:00:00').toLocaleDateString('es-CL') : 'â',
        'EGRESO',
        isSueldo ? 'Sueldo' : 'Servicio BÃ¡sico',
        isSueldo ? `Sueldo Personal - ${g.personal_nombre} (${g.descripcion||''})` : `Servicio - ${getServicioLabel(g.subtipo)} (${g.descripcion||''})`,
        isSueldo ? -(g.monto_bruto||0) : -(g.monto||0),
        '',
        g.creado_por||''
      ]);
    }
  });
  
  // Sort by date (ascending)
  const header=rows.shift();
  rows.sort((a,b)=>{
    const parseDate = (dStr) => {
      if(!dStr || dStr === 'â') return new Date(0);
      const parts = dStr.split('/');
      return new Date(parts[2], parts[1] - 1, parts[0]);
    };
    return parseDate(a[0]) - parseDate(b[0]);
  });
  
  // Calculate running Utilidad Acumulada
  let utilityAcc = 0;
  rows.forEach(r => {
    const val = r[4] || 0;
    utilityAcc += val;
    r.push(utilityAcc); // Push utilityAcc to Col index 7 (new 8th column)
  });
  
  // Add summary
  const totalIng=rows.filter(r=>r[1]==='INGRESO').reduce((s,r)=>s+(r[4]||0),0);
  const totalEgr=rows.filter(r=>r[1]==='EGRESO').reduce((s,r)=>s+Math.abs(r[4]||0),0);
  
  const finalRows = [
    ['Fecha','Tipo','Ãrea','DescripciÃ³n','Monto CLP','VehÃ­culo','Conductor','Utilidad Acumulada']
  ];
  
  rows.forEach(r => finalRows.push(r));
  finalRows.push([]); // blank row
  finalRows.push(['','','','TOTAL INGRESOS',totalIng,'','','']);
  finalRows.push(['','','','TOTAL EGRESOS',-totalEgr,'','','']);
  finalRows.push(['','','','UTILIDAD TOTAL',totalIng-totalEgr,'','',totalIng-totalEgr]);
  
  // Convert standard primitive values to styled cell objects
  const styledRows = finalRows.map((row, idx) => {
    if (idx === 0) return row; // Header row
    if (row.length === 0) return []; // Blank separator row
    
    const label = row[3];
    if (label && (label.startsWith('TOTAL') || label.startsWith('UTILIDAD'))) {
      const hasAcc = row[7] !== '';
      return [
        row[0], row[1], row[2], 
        makeStyledCell(row[3], null, true, false), // Bold label
        makeStyledCell(row[4], row[4] >= 0 ? '10B981' : 'EF4444', true, true), // Bold money
        row[5], row[6],
        hasAcc ? makeStyledCell(row[7], row[7] >= 0 ? '10B981' : 'EF4444', true, true) : ''
      ];
    }
    
    const isIncome = row[1] === 'INGRESO';
    const color = isIncome ? '10B981' : 'EF4444';
    const accVal = row[7];
    const accColor = accVal >= 0 ? '10B981' : 'EF4444';
    return [
      row[0],
      makeStyledCell(row[1], color, false, false), // Col 1: Tipo (color font)
      row[2],
      row[3],
      makeStyledCell(row[4], color, false, true),  // Col 4: Monto CLP (color font & CLP format)
      row[5],
      row[6],
      makeStyledCell(accVal, accColor, false, true) // Col 7: Utilidad Acumulada (color font & CLP format)
    ];
  });
  
  downloadXLSX([{name:'Consolidado',data:styledRows}],'SILOG_Consolidado');
}

// âââ EXPORT: Gastos Operacionales Detalle âââ
function exportGastosDetalle(){
  const rows=[['Fecha','Hora','Tipo Gasto','DescripciÃ³n','Monto CLP','VehÃ­culo (Patente)','Conductor','Turno ID','Boleta/Referencia']];
  _allGastosRaw.forEach(g=>{
    rows.push([
      fmtDate(g._date),
      g._date?g._date.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):'',
      g.tipo==='combustible'?'Combustible':'Peaje',
      g.tipo==='combustible'?`${g.litros||0} litros`:(g.autopista||'Peaje'),
      g.monto_clp||0,
      g.patente||'',
      g.conductor_nombre||g.conductor_email||'',
      g.turno_id||'',
      g.boleta_url?'SÃ­':'No'
    ]);
  });
  
  // Totals
  const totComb=_allGastosRaw.filter(g=>g.tipo==='combustible').reduce((s,g)=>s+(g.monto_clp||0),0);
  const totPeaje=_allGastosRaw.filter(g=>g.tipo!=='combustible').reduce((s,g)=>s+(g.monto_clp||0),0);
  rows.push([]);
  rows.push(['','','Total Combustible','',totComb,'','','','']);
  rows.push(['','','Total Peajes','',totPeaje,'','','','']);
  rows.push(['','','TOTAL GASTOS','',totComb+totPeaje,'','','','']);
  
  downloadXLSX([{name:'Gastos Operacionales',data:rows}],'SILOG_Gastos_Operacionales');
}

// âââ EXPORT: Gastos de Bodega âââ
function exportGastosBodega(){
  const rows=[['Fecha','Concepto','Cliente/Proveedor','MÂ² Extras','Monto CLP','DescripciÃ³n','Creado Por']];
  _ingresosBodega.forEach(m=>{
    const periodo = document.getElementById('cc-periodo').value;
    if(!periodo || (m.fecha && m.fecha.startsWith(periodo))) {
      const labels={'ingreso_bodega':'Ingreso Bodega','ingreso_m2':'Ingreso MÂ² Extras','costo_arriendo':'Costo Arriendo'};
      rows.push([
        m.fecha ? new Date(m.fecha + 'T12:00:00').toLocaleDateString('es-CL') : 'â',
        labels[m.concepto]||m.concepto,
        m.cliente||'â',
        m.m2||'â',
        m.monto||0,
        m.descripcion||'',
        m.creado_por||''
      ]);
    }
  });
  
  // Totals
  const totalIng = _ingresosBodega.filter(m => m.concepto !== 'costo_arriendo').reduce((s, m) => s + (m.monto || 0), 0);
  const totalEgr = _ingresosBodega.filter(m => m.concepto === 'costo_arriendo').reduce((s, m) => s + (m.monto || 0), 0);
  rows.push([]);
  rows.push(['','','','Total Ingresos Bodega:',totalIng,'','']);
  rows.push(['','','','Total Costo Arriendo:',totalEgr,'','']);
  rows.push(['','','','MARGEN BODEGA:',totalIng-totalEgr,'','']);
  
  downloadXLSX([{name:'Gastos y Flujos Bodega',data:rows}],'SILOG_Gastos_Bodega');
}

// âââ EXPORT: Movimientos Bodega âââ
function exportMovimientosBodega(){
  const rows=[['Fecha','Hora','Tipo Movimiento','Subtipo','Producto','Cantidad','UbicaciÃ³n','Operario','Referencia']];
  _allMovBodega.forEach(m=>{
    rows.push([
      fmtDate(m._date),
      m._date?m._date.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):'',
      (m.tipo_movimiento||m.tipo||'').toUpperCase(),
      m.subtipo||'',
      m.producto_nombre||m.nombre||'',
      m.cantidad||0,
      m.ubicacion||'',
      m.operario_nombre||m.operario_email||'',
      m.referencia||''
    ]);
  });
  
  // Summary by type
  const byType={};
  _allMovBodega.forEach(m=>{const t=m.tipo_movimiento||m.tipo||'otro';byType[t]=(byType[t]||0)+(m.cantidad||0);});
  rows.push([]);
  Object.entries(byType).forEach(([t,c])=>rows.push(['','',t.toUpperCase(),'','Total:',c,'','','']));
  
  downloadXLSX([{name:'Movimientos Bodega',data:rows}],'SILOG_Movimientos_Bodega');
}

// âââ EXPORT: Pre-Facturas âââ
function exportPreFacturas(){
  const rows=[['Fecha','NÂ° Documento','Cliente','RUT','Giro','DirecciÃ³n','DescripciÃ³n Servicio','Cantidad','Precio Unitario','Subtotal','Neto','IVA 19%','Total','Estado']];
  _allFacturas.forEach(f=>{
    const fecha=f.fecha_emision?.toDate?f.fecha_emision.toDate():null;
    (f.items||[{descripcion:'Sin detalle',cantidad:1,precio_unitario:f.neto||0,subtotal:f.neto||0}]).forEach((item,i)=>{
      rows.push([
        fmtDate(fecha),
        f.numero||'',
        f.cliente_nombre||'',
        i===0?(f.cliente_rut||''):'',
        i===0?(f.cliente_giro||''):'',
        i===0?(f.cliente_direccion||''):'',
        item.descripcion||'',
        item.cantidad||0,
        item.precio_unitario||0,
        item.subtotal||0,
        i===0?(f.neto||0):'',
        i===0?(f.iva||0):'',
        i===0?(f.total||0):'',
        i===0?(f.estado||''):''
      ]);
    });
  });
  
  // Totals
  const totNeto=_allFacturas.reduce((s,f)=>s+(f.neto||0),0);
  const totIva=_allFacturas.reduce((s,f)=>s+(f.iva||0),0);
  const totTotal=_allFacturas.reduce((s,f)=>s+(f.total||0),0);
  rows.push([]);
  rows.push(['','','','','','','TOTALES','','','',totNeto,totIva,totTotal,'']);
  
  downloadXLSX([{name:'Pre-Facturas',data:rows}],'SILOG_PreFacturas');
}

// âââ EXPORT: Todo en un Excel âââ
function exportTodoExcel(){
  const sheets=[];
  
  // 1. Consolidado General
  const consRows=[['Fecha','Tipo','Ãrea','DescripciÃ³n','Monto CLP','VehÃ­culo','Conductor']];
  _allGastosRaw.forEach(g=>consRows.push([fmtDate(g._date),'EGRESO',g.tipo==='combustible'?'Combustible':'Peaje',g.tipo==='combustible'?`Combustible ${g.litros||''}L`:`Peaje ${g.autopista||''}`,-(g.monto_clp||0),g.patente||'',g.conductor_nombre||'']));
  _allFacturas.forEach(f=>{const d=f.fecha_emision?.toDate?f.fecha_emision.toDate():null;(f.items||[]).forEach(i=>consRows.push([fmtDate(d),'INGRESO','Servicios',`${f.numero} ${i.descripcion} (${f.cliente_nombre||''})`,i.subtotal||0,'','']));});
  
  _ingresosBodega.forEach(m=>{
    const periodo = document.getElementById('cc-periodo').value;
    if(!periodo || (m.fecha && m.fecha.startsWith(periodo))) {
      const esGasto=m.concepto==='costo_arriendo';
      consRows.push([m.fecha?new Date(m.fecha+'T12:00:00').toLocaleDateString('es-CL'):'â',esGasto?'EGRESO':'INGRESO','Bodega',`${m.concepto==='costo_arriendo'?'Arriendo Bodega':'Ingreso Bodega'} ${m.cliente||''}`,esGasto?-(m.monto||0):(m.monto||0),'','']);
    }
  });

  _allGastosContabilidad.forEach(g=>{
    const isSueldo=g.tipo==='sueldo';
    const isIngreso=g.tipo==='ingreso';
    if (isIngreso) {
      consRows.push([
        g.fecha ? new Date(g.fecha+'T12:00:00').toLocaleDateString('es-CL') : 'â',
        'INGRESO',
        'Contabilidad Manual',
        `${g.subtipo === 'facturacion_varias' ? 'FacturaciÃ³n Varia' : 'Otro Ingreso'} - ${g.descripcion || ''}`,
        g.monto_neto || g.monto || 0,
        '',
        ''
      ]);
    } else {
      consRows.push([
        g.fecha ? new Date(g.fecha+'T12:00:00').toLocaleDateString('es-CL') : 'â',
        'EGRESO',
        isSueldo ? 'Sueldos' : 'Servicios',
        isSueldo ? `Sueldo ${g.personal_nombre}` : `Servicio ${getServicioLabel(g.subtipo)}`,
        isSueldo ? -(g.monto_bruto||0) : -(g.monto||0),
        '',
        ''
      ]);
    }
  });

  const cHeader=consRows.shift();
  consRows.sort((a,b)=>{
    const parseDate=(dStr)=>{
      if(!dStr||dStr==='â')return new Date(0);
      const parts=dStr.split('/');
      return new Date(parts[2],parts[1]-1,parts[0]);
    };
    return parseDate(a[0]) - parseDate(b[0]);
  });
  
  // Calculate running Utilidad Acumulada for Sheet 1
  let cRunningUtil = 0;
  consRows.forEach(row => {
    const rowMonto = row[4] || 0;
    cRunningUtil += rowMonto;
    row.push(cRunningUtil); // Push running utility to index 7 (8th column)
  });
  
  // Add Sheet 1 final totals row
  const sheet1TotalIng = consRows.filter(r=>r[1]==='INGRESO').reduce((s,r)=>s+(r[4]||0),0);
  const sheet1TotalEgr = consRows.filter(r=>r[1]==='EGRESO').reduce((s,r)=>s+Math.abs(r[4]||0),0);
  const sheet1FinalUtil = sheet1TotalIng - sheet1TotalEgr;
  
  const finalConsRows = [
    ['Fecha','Tipo','Ãrea','DescripciÃ³n','Monto CLP','VehÃ­culo','Conductor','Utilidad Acumulada']
  ];
  consRows.forEach(row => finalConsRows.push(row));
  finalConsRows.push([]); // blank row
  finalConsRows.push(['','','','TOTAL INGRESOS',sheet1TotalIng,'','','']);
  finalConsRows.push(['','','','TOTAL EGRESOS',-sheet1TotalEgr,'','','']);
  finalConsRows.push(['','','','UTILIDAD TOTAL',sheet1FinalUtil,'','',sheet1FinalUtil]);
  
  // Apply formatting/styles to Sheet 1
  const styledConsRows = finalConsRows.map((row, idx) => {
    if (idx === 0) return row; // Header row
    if (row.length === 0) return []; // Blank separator row
    
    const label = row[3];
    if (label && (label.startsWith('TOTAL') || label.startsWith('UTILIDAD'))) {
      const hasAcc = row[7] !== '';
      return [
        row[0], row[1], row[2], 
        makeStyledCell(row[3], null, true, false), // Bold label
        makeStyledCell(row[4], row[4] >= 0 ? '10B981' : 'EF4444', true, true), // Bold money
        row[5], row[6],
        hasAcc ? makeStyledCell(row[7], row[7] >= 0 ? '10B981' : 'EF4444', true, true) : ''
      ];
    }
    
    const isIncome = row[1] === 'INGRESO';
    const color = isIncome ? '10B981' : 'EF4444';
    const accVal = row[7];
    const accColor = accVal >= 0 ? '10B981' : 'EF4444';
    return [
      row[0],
      makeStyledCell(row[1], color, false, false), // Col 1: Tipo (color font)
      row[2],
      row[3],
      makeStyledCell(row[4], color, false, true),  // Col 4: Monto CLP (color font & CLP format)
      row[5],
      row[6],
      makeStyledCell(accVal, accColor, false, true) // Col 7: Utilidad Acumulada (color font & CLP format)
    ];
  });
  sheets.push({name:'Consolidado General',data:styledConsRows});
  
  // 2. Gastos
  const gRows=[['Fecha','Hora','Tipo','DescripciÃ³n','Monto CLP','Patente','Conductor','Turno']];
  _allGastosRaw.forEach(g=>gRows.push([fmtDate(g._date),g._date?g._date.toLocaleTimeString('es-CL',{hour:'2-digit',minute:'2-digit'}):'',g.tipo||'',g.tipo==='combustible'?`${g.litros||0}L`:(g.autopista||''),g.monto_clp||0,g.patente||'',g.conductor_nombre||'',g.turno_id||'']));
  sheets.push({name:'Gastos Operacionales',data:gRows});
  
  // 3. Bodega Movimientos
  const bRows=[['Fecha','Tipo','Subtipo','Producto','Cantidad','UbicaciÃ³n','Operario','Referencia']];
  _allMovBodega.forEach(m=>bRows.push([fmtDate(m._date),(m.tipo_movimiento||m.tipo||'').toUpperCase(),m.subtipo||'',m.producto_nombre||m.nombre||'',m.cantidad||0,m.ubicacion||'',m.operario_nombre||'',m.referencia||'']));
  sheets.push({name:'Movimientos Stock Bodega',data:bRows});

  // 4. Bodega Gastos/Ingresos Financieros
  const bgRows=[['Fecha','Concepto','Cliente/Proveedor','MÂ²','Monto CLP','DescripciÃ³n','Creado Por']];
  _ingresosBodega.forEach(m=>{
    const periodo = document.getElementById('cc-periodo').value;
    if(!periodo || (m.fecha && m.fecha.startsWith(periodo))) {
      bgRows.push([m.fecha?new Date(m.fecha+'T12:00:00').toLocaleDateString('es-CL'):'â',m.concepto,m.cliente||'',m.m2||'',m.monto||0,m.descripcion||'',m.creado_por||'']);
    }
  });
  sheets.push({name:'Finanzas Bodega',data:bgRows});
  
  // 5. Facturas
  const fRows=[['Fecha','NÂ°','Cliente','RUT','Servicio','Cant.','P.Unit.','Subtotal','Neto','IVA','Total','Estado']];
  _allFacturas.forEach(f=>{const d=f.fecha_emision?.toDate?f.fecha_emision.toDate():null;(f.items||[]).forEach((i,idx)=>fRows.push([fmtDate(d),f.numero||'',idx===0?(f.cliente_nombre||''):'',idx===0?(f.cliente_rut||''):'',i.descripcion||'',i.cantidad||0,i.precio_unitario||0,i.subtotal||0,idx===0?(f.neto||0):'',idx===0?(f.iva||0):'',idx===0?(f.total||0):'',idx===0?(f.estado||''):'']));});
  sheets.push({name:'Pre-Facturas',data:fRows});

  // 6. Contabilidad Manual (Sueldos, Servicios e Ingresos)
  const mHeaders = ['Fecha', 'Tipo Movimiento', 'Colaborador / Concepto', 'Monto Neto / Costo', 'Monto Total con IVA / LÃ­quido', 'DescripciÃ³n / Glosa', 'Creado Por', 'Utilidad Acumulada'];
  
  // Sort ascending chronological order
  const sortedManual = [..._allGastosContabilidad].sort((a,b)=>a.fecha.localeCompare(b.fecha));
  
  let mRunningUtil = 0;
  const mRowsList = [];
  sortedManual.forEach(g => {
    const isSueldo = g.tipo === 'sueldo';
    const isIngreso = g.tipo === 'ingreso';
    
    let tipoMov = '';
    let concepto = '';
    let neto = 0;
    let totalOrLiq = 0;
    
    if (isIngreso) {
      tipoMov = 'Ingreso';
      concepto = g.subtipo === 'facturacion_varias' ? 'FacturaciÃ³n Varia' : 'Otro Ingreso';
      neto = g.monto_neto || g.monto || 0;
      totalOrLiq = g.monto_total || g.monto || 0;
    } else if (isSueldo) {
      tipoMov = 'Sueldo';
      concepto = g.personal_nombre;
      neto = -(g.monto_bruto || 0);
      totalOrLiq = -(g.monto_liquido || 0);
    } else {
      tipoMov = 'Servicio';
      concepto = getServicioLabel(g.subtipo);
      neto = -(g.monto || 0);
      totalOrLiq = -(g.monto || 0);
    }
    
    mRunningUtil += neto;
    mRowsList.push([
      g.fecha ? new Date(g.fecha+'T12:00:00').toLocaleDateString('es-CL') : 'â',
      tipoMov,
      concepto,
      neto,
      totalOrLiq,
      g.descripcion || '',
      g.creado_por || '',
      mRunningUtil
    ]);
  });
  
  // Total sum rows
  const sheet6TotalNet = mRowsList.reduce((s, r) => s + r[3], 0);
  const sheet6TotalLiq = mRowsList.reduce((s, r) => s + r[4], 0);
  
  mRowsList.push([]); // blank separator row
  mRowsList.push([
    'TOTALES',
    '',
    '',
    sheet6TotalNet,
    sheet6TotalLiq,
    '',
    '',
    sheet6TotalNet
  ]);
  
  // Style and color all cells in Sheet 6
  const styledManualRows = [mHeaders].concat(mRowsList.map(row => {
    if (row.length === 0) return [];
    
    const isTotal = row[0] === 'TOTALES';
    if (isTotal) {
      return [
        makeStyledCell(row[0], null, true, false), // Bold 'TOTALES'
        '',
        '',
        makeStyledCell(row[3], row[3] >= 0 ? '10B981' : 'EF4444', true, true), // Bold Net
        makeStyledCell(row[4], row[4] >= 0 ? '10B981' : 'EF4444', true, true), // Bold Total
        '',
        '',
        makeStyledCell(row[7], row[7] >= 0 ? '10B981' : 'EF4444', true, true)  // Bold Utility
      ];
    }
    
    const isInc = row[1] === 'Ingreso';
    const color = isInc ? '10B981' : 'EF4444';
    const accVal = row[7];
    const accColor = accVal >= 0 ? '10B981' : 'EF4444';
    
    return [
      row[0],
      makeStyledCell(row[1], color, false, false), // Tipo
      row[2],
      makeStyledCell(row[3], color, false, true),  // Neto / Costo
      makeStyledCell(row[4], color, false, true),  // Total con IVA / LÃ­quido
      row[5],
      row[6],
      makeStyledCell(accVal, accColor, false, true) // Utilidad Acumulada
    ];
  }));
  sheets.push({name:'Contabilidad Manual',data:styledManualRows});
  
  downloadXLSX(sheets,'SILOG_Reporte_Completo');
}

function makeStyledCell(value, colorHex = null, isBold = false, isNumeric = true) {
  const cellObj = {
    v: value,
    t: isNumeric ? 'n' : 's',
    s: {}
  };
  if (isNumeric) {
    cellObj.z = '$#,##0;($#,##0);"-"';
  }
  if (colorHex) {
    cellObj.s.font = { color: { rgb: colorHex } };
  }
  if (isBold) {
    cellObj.s.font = cellObj.s.font || {};
    cellObj.s.font.bold = true;
  }
  return cellObj;
}

// âââ XLSX DOWNLOAD HELPER âââ
function downloadXLSX(sheets,filename){
  try{
    const wb=XLSX.utils.book_new();
    sheets.forEach(s=>{
      const ws=XLSX.utils.aoa_to_sheet(s.data);
      // Auto-width columns
      const colWidths=s.data[0].map((_,ci)=>{
        let max=10;
        s.data.forEach(row=>{
          const cell=row[ci];
          if(cell!==undefined&&cell!==null){
            const cellVal = (cell && typeof cell === 'object' && cell.v !== undefined) ? cell.v : cell;
            const len=String(cellVal !== null && cellVal !== undefined ? cellVal : '').length;
            if(len>max)max=len;
          }
        });
        return{wch:Math.min(max+2,40)};
      });
      ws['!cols']=colWidths;
      
      // Style headers (first row: bold & centered)
      if (s.data && s.data.length > 0 && s.data[0]) {
        const getColLetter = (colIdx) => {
          let temp, letter = '';
          while (colIdx >= 0) {
            temp = colIdx % 26;
            letter = String.fromCharCode(temp + 65) + letter;
            colIdx = Math.floor(colIdx / 26) - 1;
          }
          return letter;
        };
        for (let c = 0; c < s.data[0].length; c++) {
          const cellRef = getColLetter(c) + '1';
          if (ws[cellRef]) {
            ws[cellRef].s = {
              font: { bold: true },
              alignment: { horizontal: 'center', vertical: 'center' }
            };
          }
        }
      }
      
      XLSX.utils.book_append_sheet(wb,ws,s.name.slice(0,31));
    });
    const periodo=document.getElementById('cc-periodo').value||new Date().toISOString().slice(0,7);
    XLSX.writeFile(wb,`${filename}_${periodo}.xlsx`);
    showToast('ð¥ Excel descargado exitosamente','success');
  }catch(e){
    showToast('Error generando Excel: '+e.message,'error');
    console.error(e);
  }
}

async function populateExpensesForHojasRuta(hojas) {
  const turnoIds = hojas.map(h => h.turno_id).filter(Boolean);
  if (turnoIds.length === 0) return;
  
  const chunks = [];
  for (let i = 0; i < turnoIds.length; i += 10) {
    chunks.push(turnoIds.slice(i, i + 10));
  }
  
  const gastosByTurno = {};
  for (const chunk of chunks) {
    try {
      const gSnap = await db.collection('gastos_ruta').where('turno_id', 'in', chunk).get();
      gSnap.forEach(doc => {
        const g = doc.data();
        if (!gastosByTurno[g.turno_id]) {
          gastosByTurno[g.turno_id] = { combustible: 0, peaje: 0 };
        }
        const amt = g.monto_clp || g.monto || 0;
        if (g.tipo === 'combustible') {
          gastosByTurno[g.turno_id].combustible += amt;
        } else {
          gastosByTurno[g.turno_id].peaje += amt;
        }
      });
    } catch (e) {
      console.warn("Failed to fetch expenses chunk:", e);
    }
  }
  
  hojas.forEach(h => {
    if (h.turno_id && gastosByTurno[h.turno_id]) {
      h.combustible = gastosByTurno[h.turno_id].combustible;
      h.peaje = gastosByTurno[h.turno_id].peaje;
    } else {
      h.combustible = h.combustible || 0;
      h.peaje = h.peaje || 0;
    }
  });
}

// âââ HOJAS DE RUTA âââ
let _hojasRuta=[],_hojaActual=null;
async function loadHojasRuta(isMore = false){
  if(_loadingMoreHR) return;
  if(isMore && !_hasMoreHR) return;
  
  if(!isMore) {
    _lastHRDoc = null;
    _hasMoreHR = true;
    document.getElementById('hr-body').innerHTML = '<tr><td colspan="11" class="txt-c" style="color:var(--text2);padding:20px">Cargandoâ¦</td></tr>';
  } else {
    _loadingMoreHR = true;
    const loadBtn = document.getElementById('btn-load-more-hr');
    if(loadBtn) loadBtn.innerHTML = '<span class="spinner"></span> Cargando mÃ¡s...';
  }

  // Populate conductor filter from existing users
  const hrSel=document.getElementById('hr-conductor');
  if(hrSel.options.length<=1){
    try{const uSnap=await db.collection('users').get();
    uSnap.forEach(d=>{const u=d.data();if((u.rol||'').toLowerCase().includes('conductor')){const o=document.createElement('option');o.value=u.correo_electronico||u.email||'';o.textContent=u.nombre||u.name||'';hrSel.appendChild(o);}});}catch(e){}
  }
  try{
    let query=db.collection('hojas_ruta').orderBy('fecha','desc');
    const conductorF=document.getElementById('hr-conductor').value;
    const fechaF=document.getElementById('hr-fecha').value;
    if(conductorF)query=query.where('conductor_email','==',conductorF);
    if(fechaF)query=query.where('fecha','==',fechaF);
    
    if(isMore && _lastHRDoc) {
      query = query.startAfter(_lastHRDoc);
    }
    query = query.limit(15);
    
    const snap=await query.get();
    if(snap.empty) {
      _hasMoreHR = false;
      if(!isMore) {
        document.getElementById('hr-body').innerHTML = '<tr><td colspan="9" class="txt-c" style="color:var(--text2);padding:20px">Sin hojas de ruta</td></tr>';
      }
      updateLoadMoreBtnVisibility();
      return;
    }
    
    _lastHRDoc = snap.docs[snap.docs.length - 1];
    if(snap.size < 15) _hasMoreHR = false;
    
    let newDocs=[];
    snap.forEach(d=>newDocs.push({id:d.id,...d.data()}));
    await populateExpensesForHojasRuta(newDocs);
    
    // Client-side empresa filter
    const empF=(document.getElementById('hr-empresa').value||'').toLowerCase();
    if(empF) newDocs=newDocs.filter(h=>(h.entregas||[]).some(e=>(e.cliente||'').toLowerCase().includes(empF)));
    
    if(isMore) {
      _hojasRuta = _hojasRuta.concat(newDocs);
    } else {
      _hojasRuta = newDocs;
    }
  }catch(e){
    console.warn("Ordered native query failed, falling back to index-safe query:", e.message);
    try {
      let queryFallback=db.collection('hojas_ruta');
      const conductorF=document.getElementById('hr-conductor').value;
      const fechaF=document.getElementById('hr-fecha').value;
      if(conductorF)queryFallback=queryFallback.where('conductor_email','==',conductorF);
      if(fechaF)queryFallback=queryFallback.where('fecha','==',fechaF);
      
      if(isMore && _lastHRDoc) {
        queryFallback = queryFallback.startAfter(_lastHRDoc);
      }
      queryFallback = queryFallback.limit(15);
      
      const snap=await queryFallback.get();
      if(snap.empty) {
        _hasMoreHR = false;
        updateLoadMoreBtnVisibility();
        return;
      }
      _lastHRDoc = snap.docs[snap.docs.length - 1];
      if(snap.size < 15) _hasMoreHR = false;
      
      let newDocs=[];
      snap.forEach(d=>newDocs.push({id:d.id,...d.data()}));
      await populateExpensesForHojasRuta(newDocs);
      newDocs.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
      
      if(isMore) {
        _hojasRuta = _hojasRuta.concat(newDocs);
      } else {
        _hojasRuta = newDocs;
      }
    } catch(err2) {
      document.getElementById('hr-body').innerHTML = `<tr><td colspan="9" class="txt-c">Error: ${err2.message}</td></tr>`;
    }
  } finally {
    _loadingMoreHR = false;
    const loadBtn = document.getElementById('btn-load-more-hr');
    if(loadBtn) loadBtn.innerHTML = '➕ Cargar más hojas de ruta';
    updateLoadMoreBtnVisibility();
  }
  renderHojasRuta();
}
function renderHojasRuta(){
  const body=document.getElementById('hr-body');
  if(!_hojasRuta.length){body.innerHTML='<tr><td colspan="9" class="txt-c" style="color:var(--text2);padding:20px">Sin hojas de ruta</td></tr>';return;}
  const estadoBadge={'pendiente_revision':'<span class="badge-sm b-borrador">🟡 Pendiente</span>','revisada':'<span class="badge-sm b-pagada">🟢 Revisada</span>','observada':'<span class="badge-sm b-enviada">🔴 Observada</span>'};
  body.innerHTML=_hojasRuta.map(h=>`<tr>
    <td>${sanitize(h.fecha||'—')}</td>
    <td>${sanitize(h.conductor_nombre||h.conductor_email||'—')}</td>
    <td>${sanitize(h.distribuidor||'—')}</td>
    <td style="font-weight:700;color:var(--accent)">${sanitize(h.patente||'—')}</td>
    <td class="txt-c">${h.total_entregas||0}</td>
    <td class="txt-c" style="color:var(--danger)">${h.total_devoluciones||0}</td>
    <td class="txt-c">${h.km_recorridos||'—'} km</td>
    <td class="txt-c">${estadoBadge[h.estado]||sanitize(h.estado)}</td>
    <td class="txt-c"><button class="btn-sm" onclick="openHoja('${sanitize(h.id)}')">👁️ Ver</button> <button class="btn-sm" style="background:var(--success);border-color:var(--success);color:#fff" onclick="exportHojaExcelById('${sanitize(h.id)}')">📥</button></td>
  </tr>`).join('');
}
function openHoja(id){
  _hojaActual=_hojasRuta.find(h=>h.id===id);if(!_hojaActual)return;
  document.getElementById('hoja-id').value=id;
  
  if(document.getElementById('hoja-conductor-select')) document.getElementById('hoja-conductor-select').value = _hojaActual.conductor_email || '';
  if(document.getElementById('hoja-patente-select')) document.getElementById('hoja-patente-select').value = _hojaActual.patente || '';
  if(document.getElementById('hoja-distribuidor-select')) document.getElementById('hoja-distribuidor-select').value = _hojaActual.distribuidor || _hojaActual.nombre_distribuidor || 'SIN DISTRIBUIDOR';
  if(document.getElementById('hoja-fecha-input')) document.getElementById('hoja-fecha-input').value = _hojaActual.fecha || '';
  if(document.getElementById('hoja-hora-inicio-input')) document.getElementById('hoja-hora-inicio-input').value = _hojaActual.hora_inicio || '';
  if(document.getElementById('hoja-hora-termino-input')) document.getElementById('hoja-hora-termino-input').value = _hojaActual.hora_termino || '';
  if(document.getElementById('hoja-km-inicial-input')) document.getElementById('hoja-km-inicial-input').value = _hojaActual.km_inicial || 0;
  if(document.getElementById('hoja-km-final-input')) document.getElementById('hoja-km-final-input').value = _hojaActual.km_final_viaje || _hojaActual.km_final || 0;
  
  if(document.getElementById('hoja-estado')) document.getElementById('hoja-estado').value=_hojaActual.estado||'pendiente_revision';
  
  // Render editable entregas
  const tbody=document.getElementById('hoja-entregas');
  const entregas=_hojaActual.entregas||[];
  tbody.innerHTML=entregas.map((e,i)=>`<tr>
    <td class="he-corr">${e.correlativo||i+1}</td>
    <td><input class="field he-doc" value="${sanitize(e.documento||'')}" style="width:100px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
    <td><input class="field he-lugar" value="${sanitize(e.cliente||e.direccion||'')}" data-direccion="${sanitize(e.direccion||'')}" style="width:140px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
    <td>
      <select class="field he-estado" style="width:125px; padding:6px 10px; font-size:0.8rem; border-radius:6px; font-weight:600; cursor:pointer; outline:none; transition:0.2s; color:${e.estado === 'entregado' || e.estado === 'Conforme' ? 'var(--success)' : 'var(--danger)'}; border-color:${e.estado === 'entregado' || e.estado === 'Conforme' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}; background:var(--surface2);" onchange="this.style.color = this.value === 'entregado' ? 'var(--success)' : 'var(--danger)'; this.style.borderColor = this.value === 'entregado' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';">
        <option value="entregado" ${e.estado === 'entregado' || e.estado === 'Conforme' ? 'selected' : ''} style="color:var(--text);background:var(--bg);">🟢 Entregado</option>
        <option value="devuelto" ${e.estado === 'devuelto' || e.estado === 'rechazado' || (e.estado !== 'entregado' && e.estado !== 'Conforme' && e.estado) ? 'selected' : ''} style="color:var(--text);background:var(--bg);">🔴 Rechazado</option>
      </select>
    </td>
    <td><input class="field he-obs" value="${sanitize(e.observaciones||e.devolucion_motivo||'')}" style="width:120px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
    <td><input class="field he-comuna" value="${sanitize(e.comuna||'')}" style="width:90px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
    <td><input class="field he-valor" type="number" value="${e.valor_diario||0}" style="width:80px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
  </tr>`).join('');
  document.getElementById('modal-hoja').classList.add('open');
}
function closeHojaModal(){document.getElementById('modal-hoja').classList.remove('open');_hojaActual=null;}

function agregarClienteHoja(){
  const tbody=document.getElementById('hoja-entregas');
  const corr = tbody.children.length + 1;
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td class="he-corr">${corr}</td>
    <td><input class="field he-doc" placeholder="N° Doc" style="width:100px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
    <td><input class="field he-lugar" placeholder="Cliente/Dir" style="width:140px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
    <td>
      <select class="field he-estado" style="width:125px; padding:6px 10px; font-size:0.8rem; border-radius:6px; font-weight:600; cursor:pointer; outline:none; transition:0.2s; color:var(--success); border-color:rgba(16, 185, 129, 0.4); background:var(--surface2);" onchange="this.style.color = this.value === 'entregado' ? 'var(--success)' : 'var(--danger)'; this.style.borderColor = this.value === 'entregado' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';">
        <option value="entregado" selected style="color:var(--text);background:var(--bg);">🟢 Entregado</option>
        <option value="devuelto" style="color:var(--text);background:var(--bg);">🔴 Rechazado</option>
      </select>
    </td>async function guardarHoja(){
  const id=document.getElementById('hoja-id').value;if(!id)return;
  
  const btn = document.querySelector('#modal-hoja .btn-save');
  const prevHtml = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Guardando...';

  // Extract edited general values
  const condSelect = document.getElementById('hoja-conductor-select');
  const condEmail = condSelect ? condSelect.value : '';
  let condNombre = '';
  if (condSelect && condSelect.selectedIndex >= 0) {
    const text = condSelect.options[condSelect.selectedIndex].textContent;
    const match = text.match(/^(.*?)\s*\(/);
    condNombre = match ? match[1].trim() : text;
  }

  const patenteEditada = document.getElementById('hoja-patente-select')?.value || '';
  const distribuidorEditado = document.getElementById('hoja-distribuidor-select')?.value || '';
  const fechaEditada = document.getElementById('hoja-fecha-input')?.value || '';
  const horaInicioEditada = document.getElementById('hoja-hora-inicio-input')?.value || '';
  const horaTerminoEditada = document.getElementById('hoja-hora-termino-input')?.value || '';
  const kmInicialEditado = parseFloat(document.getElementById('hoja-km-inicial-input')?.value) || 0;
  const kmFinalEditado = parseFloat(document.getElementById('hoja-km-final-input')?.value) || 0;
  const kmRecorridosCalculados = Math.max(0, kmFinalEditado - kmInicialEditado);

  const entregas=[];
  let devueltasCount = 0;
  
  document.querySelectorAll('#hoja-entregas tr').forEach((tr,i)=>{
    const lugarInput = tr.querySelector('.he-lugar');
    const valorVal = parseInt(tr.querySelector('.he-valor')?.value)||0;
    const estadoDoc = tr.querySelector('.he-estado')?.value || 'entregado';
    if(estadoDoc === 'devuelto' || estadoDoc === 'rechazado') devueltasCount++;
    
    entregas.push({
      correlativo: i+1,
      documento: tr.querySelector('.he-doc')?.value||'',
      direccion: lugarInput?.dataset.direccion||lugarInput?.value||'',
      cliente: lugarInput?.value||'',
      estado: estadoDoc,
      observaciones: tr.querySelector('.he-obs')?.value||'',
      devolucion_motivo: estadoDoc === 'devuelto' || estadoDoc === 'rechazado' ? (tr.querySelector('.he-obs')?.value||'') : '',
      comuna: tr.querySelector('.he-comuna')?.value||'',
      valor_diario: valorVal,
    });
  });

  const totalGuias = entregas.reduce((max, e) => Math.max(max, e.correlativo || 0), 0) || entregas.length;
  
  const combustibleEditado = _hojaActual ? (_hojaActual.combustible || 0) : 0;
  const peajeEditado = _hojaActual ? (_hojaActual.peaje || 0) : 0;
  
  try{
    const originalKmFinal = _hojaActual ? (_hojaActual.km_final_viaje || _hojaActual.km_final || 0) : 0;
    const originalPatente = _hojaActual ? _hojaActual.patente : '';
    let shouldUpdateFleet = false;

    if (kmFinalEditado !== originalKmFinal || patenteEditada !== originalPatente) {
      const latestHrSnap = await db.collection('hojas_ruta')
        .where('patente', '==', patenteEditada)
        .orderBy('fecha', 'desc')
        .limit(1)
        .get();
      
      if (latestHrSnap.empty || latestHrSnap.docs[0].id === id) {
        shouldUpdateFleet = true;
      } else {
        const latestDate = latestHrSnap.docs[0].data().fecha || '';
        if (fechaEditada >= latestDate) {
          shouldUpdateFleet = true;
        }
      }
    }

    const batch = db.batch();
    const hrRef = db.collection('hojas_ruta').doc(id);
    
    batch.update(hrRef, {
      entregas,
      n_guias: totalGuias,
      total_entregas: entregas.length,
      total_devoluciones: devueltasCount,
      conductor_email: condEmail,
      conductor_nombre: condNombre,
      patente: patenteEditada,
      distribuidor: distribuidorEditado,
      nombre_distribuidor: distribuidorEditado,
      fecha: fechaEditada,
      hora_inicio: horaInicioEditada,
      hora_termino: horaTerminoEditada,
      km_inicial: kmInicialEditado,
      km_final: kmFinalEditado,
      km_final_viaje: kmFinalEditado,
      km_recorridos: kmRecorridosCalculados,
      estado: document.getElementById('hoja-estado').value,
      revisado_por: _email,
      revisado_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    if(_hojaActual && _hojaActual.turno_id) {
      const gSnap = await db.collection('gastos_ruta').where('turno_id', '==', _hojaActual.turno_id).get();
      gSnap.forEach(d => {
        batch.update(d.ref, {
          conductor_uid: condEmail,
          conductor_email: condEmail,
          patente: patenteEditada,
          fecha: fechaEditada ? firebase.firestore.Timestamp.fromDate(new Date(fechaEditada + 'T12:00:00')) : firebase.firestore.FieldValue.serverTimestamp()
        });
      });
    }

    if(_hojaActual && _hojaActual.turno_id) {
      const dSnap = await db.collection('despachos').where('turno_id', '==', _hojaActual.turno_id).get();
      const existingDespachos = {};
      dSnap.forEach(d => { existingDespachos[d.data().guia_numero || d.data().n_documento || d.id] = d; });
      
      entregas.forEach((e) => {
        const docName = e.documento || `${_hojaActual.id_viaje}-${e.correlativo}`;
        const dMatchKey = Object.keys(existingDespachos).find(k => k === docName || (existingDespachos[k].data().cliente_nombre === e.cliente));
        
        const updateData = {
          cliente_nombre: e.cliente,
          guia_numero: docName,
          n_documento: docName,
          referencia: docName,
          estado: e.estado,
          devolucion_motivo: e.devolucion_motivo,
          distribuidor: distribuidorEditado,
          nombre_distribuidor: distribuidorEditado,
          patente: patenteEditada,
          conductor_email: condEmail,
          conductor_nombre: condNombre
        };
        
        if (dMatchKey) {
          batch.update(existingDespachos[dMatchKey].ref, updateData);
          delete existingDespachos[dMatchKey];
        } else {
          const newD = db.collection('despachos').doc();
          batch.set(newD, {
            ...updateData,
            turno_id: _hojaActual.turno_id,
            fecha: fechaEditada ? firebase.firestore.Timestamp.fromDate(new Date(fechaEditada + 'T12:00:00')) : firebase.firestore.FieldValue.serverTimestamp(),
            pod_timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      });
    }

    await batch.commit();

    if (shouldUpdateFleet) {
      const vehQuery = await db.collection('vehiculos').where('patente', '==', patenteEditada).limit(1).get();
      if (!vehQuery.empty) {
        const vehRef = vehQuery.docs[0].ref;
        await db.runTransaction(async (transaction) => {
          const vehDoc = await transaction.get(vehRef);
          if (vehDoc.exists) {
            transaction.update(vehRef, {
              kilometraje: kmFinalEditado,
              km: kmFinalEditado
            });
          }
        });
      }
    }

    showToast('✅ Hoja de ruta actualizada','success');
    closeHojaModal();
    loadHojasRuta();
  }catch(e){
    showToast('Error al guardar: '+e.message,'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = prevHtml; }
  }
      });
    }

    await batch.commit();
    showToast('â Hoja de ruta actualizada','success');
    closeHojaModal();
    loadHojasRuta();
  }catch(e){
    showToast('Error al guardar: '+e.message,'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = prevHtml; }
  }
}
function exportHojaExcelById(id){
  const h=_hojasRuta.find(x=>x.id===id);if(!h)return;
  _hojaActual=h;exportHojaExcel();
}
function exportHojaExcel(){
  if(!_hojaActual){showToast('Abre una hoja de ruta primero','error');return;}
  const h=_hojaActual;
  const hi=h.hora_inicio?formatTime(h.hora_inicio):'â';
  const ht=h.hora_termino?formatTime(h.hora_termino):'â';
  const entregas=h.entregas||[];
  const data=[];
  data.push(['','','','','','','']); // Row 1: blank
  data.push(['',`HOJA DE RUTA ${h.fecha||''} SILOG SpA`,'','','','','']); // Row 2: title
  data.push(['','','','','','','']); // Row 3: completely empty
  data.push(['','','','INICIO:',hi,'TERMINO:',ht]); // Row 4: B4/C4 empty
  data.push(['','KM INICIAL:',h.km_inicial||'','KM FINAL:',h.km_final||'','KM RECORRIDOS:',h.km_recorridos||'']); // Row 5
  data.push(['','','','','','','']); // Row 6: blank
  data.push(['','NÂ°','DOCUMENTO','LUGAR','ESTADO','OBSERVACIONES','COMUNA','VALOR DIARIO']); // Row 7: headers
  let totalValor=0;
  entregas.forEach(e=>{
    totalValor+=e.valor_diario||0;
    const estadoStr = e.estado === 'entregado' || e.estado === 'Conforme' ? 'Entregado' : (e.estado === 'devuelto' || e.estado === 'rechazado' ? 'Rechazado' : e.estado||'');
    data.push(['',(e.correlativo||''),e.documento||'',e.cliente||e.direccion||'',estadoStr,e.observaciones||e.devolucion_motivo||'',e.comuna||'',e.valor_diario||0]);
  });
  data.push(['','','','','','','TOTAL',totalValor]);
  data.push(['','','','','','','','']);
  data.push(['','COMBUSTIBLE:',h.combustible||0,'PEAJE:',h.peaje||0,'DEVOLUCIONES:',h.total_devoluciones||0,'']);
  const totalGuias = entregas.reduce((max, e) => Math.max(max, e.correlativo || 0), 0) || entregas.length;
  data.push(['','NÂ° GUÃAS:',totalGuias,'','','','','']);
  const ws=XLSX.utils.aoa_to_sheet(data);

  // Format Column G cells (Valor Diario) and totals as CLP currency
  for (let r = 8; r <= 8 + entregas.length; r++) {
    const cellRef = 'G' + r;
    if (ws[cellRef]) {
      ws[cellRef].t = 'n';
      ws[cellRef].z = '$#,##0';
    }
  }

  // Format Peaje & Combustible cells as CLP currency
  const extraRow = 8 + entregas.length + 2;
  const cellCombustible = 'C' + extraRow;
  const cellPeaje = 'E' + extraRow;
  if (ws[cellCombustible]) {
    ws[cellCombustible].t = 'n';
    ws[cellCombustible].z = '$#,##0';
  }
  if (ws[cellPeaje]) {
    ws[cellPeaje].t = 'n';
    ws[cellPeaje].z = '$#,##0';
  }
  // Merge title row (B2:G2) centered
  ws['!merges']=[{s:{r:1,c:1},e:{r:1,c:6}}];
  // Style title cell alignment
  if(ws['B2']) ws['B2'].s={alignment:{horizontal:'center'},font:{bold:true,sz:14}};
  
  // Style table headers (Row 7: B7 to G7) as bold and centered
  const headers = ['B7', 'C7', 'D7', 'E7', 'F7', 'G7'];
  headers.forEach(ref => {
    if (ws[ref]) {
      ws[ref].s = {
        font: { bold: true },
        alignment: { horizontal: 'center', vertical: 'center' }
      };
    }
  });

  ws['!cols']=[{wch:3},{wch:16},{wch:16},{wch:30},{wch:25},{wch:16},{wch:14}];
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,ws,'Hoja de Ruta');
  XLSX.writeFile(wb,`Hoja_Ruta_${h.fecha||'sin_fecha'}_${(h.conductor_nombre||'conductor').replace(/\s+/g,'_')}.xlsx`);
  showToast('ð¥ Excel descargado','success');
}

// âââ INGRESOS BODEGA âââ
let _ingresosBodega=[];
async function loadIngresosBodega(){
  try{
    const snap=await db.collection('ingresos_bodega').orderBy('fecha','desc').get();
    _ingresosBodega=[];snap.forEach(d=>_ingresosBodega.push({id:d.id,...d.data()}));
  }catch(e){
    // Fallback sin index
    const snap=await db.collection('ingresos_bodega').get();
    _ingresosBodega=[];snap.forEach(d=>_ingresosBodega.push({id:d.id,...d.data()}));
    _ingresosBodega.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
  }
  renderIngresosBodega();
}
function renderIngresosBodega(){
  const body=document.getElementById('bg-body');
  if(!_ingresosBodega.length){body.innerHTML='<tr><td colspan="7" class="txt-c" style="color:var(--text2);padding:20px">Sin movimientos registrados</td></tr>';updateBodegaStats();return;}
  const labels={'ingreso_bodega':'Ingreso Bodega','ingreso_m2':'Ingreso MÂ² Extras','costo_arriendo':'Costo Arriendo'};
  body.innerHTML=_ingresosBodega.map(m=>{
    const isGasto=m.concepto==='costo_arriendo';
    return `<tr>
      <td>${sanitize(m.fecha||'â')}</td>
      <td>${sanitize(labels[m.concepto]||m.concepto)}</td>
      <td>${sanitize(m.cliente||'â')}</td>
      <td class="txt-c">${sanitize(m.m2||'â')}</td>
      <td class="txt-r money ${isGasto?'money-red':'money-green'}">${isGasto?'-':''}${fmt(m.monto)}</td>
      <td>${sanitize(m.descripcion||'')}</td>
      <td class="txt-c"><button class="btn-sm" style="border-color:var(--danger);color:#FCA5A5;padding:4px 8px" onclick="deleteMovBodega('${sanitize(m.id)}')">ðï¸</button></td>
    </tr>`;
  }).join('');
  updateBodegaStats();
}
function updateBodegaStats(){
  let ingBod=0,ingM2=0,cosArr=0;
  _ingresosBodega.forEach(m=>{
    if(m.concepto==='ingreso_bodega')ingBod+=m.monto||0;
    else if(m.concepto==='ingreso_m2')ingM2+=m.monto||0;
    else if(m.concepto==='costo_arriendo')cosArr+=m.monto||0;
  });
  document.getElementById('bg-ingresos').textContent=fmt(ingBod);
  document.getElementById('bg-m2').textContent=fmt(ingM2);
  document.getElementById('bg-arriendo').textContent=fmt(cosArr);
  document.getElementById('bg-margen').textContent=fmt(ingBod+ingM2-cosArr);
}
async function guardarMovBodega(){
  const monto=parseInt(document.getElementById('bg-monto').value);
  if(!monto||monto<=0){showToast('Ingresa un monto vÃ¡lido','error');return;}
  const data={
    concepto:document.getElementById('bg-concepto').value,
    monto,
    fecha:document.getElementById('bg-fecha').value||new Date().toISOString().split('T')[0],
    cliente:document.getElementById('bg-cliente').value.trim(),
    m2:parseFloat(document.getElementById('bg-m2-val').value)||null,
    descripcion:document.getElementById('bg-desc').value.trim(),
    creado_por:_email,
    created_at:firebase.firestore.FieldValue.serverTimestamp()
  };
  try{
    await db.collection('ingresos_bodega').add(data);
    showToast('â Movimiento registrado','success');
    document.getElementById('bg-monto').value='';
    document.getElementById('bg-cliente').value='';
    document.getElementById('bg-m2-val').value='';
    document.getElementById('bg-desc').value='';
    loadIngresosBodega();
  }catch(e){showToast('Error: '+e.message,'error');}
}
async function deleteMovBodega(id){
  if(!confirm('Â¿Eliminar este movimiento?'))return;
  try{await db.collection('ingresos_bodega').doc(id).delete();showToast('ðï¸ Eliminado','success');loadIngresosBodega();}
  catch(e){showToast('Error: '+e.message,'error');}
}
// Set default date for bodega form
document.getElementById('bg-fecha').value=new Date().toISOString().split('T')[0];

function updateLoadMoreBtnVisibility() {
  const btn = document.getElementById('btn-load-more-hr');
  if(btn) {
    btn.style.display = _hasMoreHR ? 'inline-block' : 'none';
  }
}

function showComprobantesSubTab(sub) {
  const targetG = document.getElementById('comp-subtab-gastos');
  const targetT = document.getElementById('comp-subtab-total');
  const btnG = document.getElementById('comp-tbtn-gastos');
  const btnT = document.getElementById('comp-tbtn-total');
  if(targetG) targetG.style.display = sub === 'gastos' ? 'block' : 'none';
  if(targetT) targetT.style.display = sub === 'total' ? 'block' : 'none';
  if(btnG) btnG.classList.toggle('active', sub === 'gastos');
  if(btnT) btnT.classList.toggle('active', sub === 'total');
}

async function loadComprobantes() {
  const list = document.getElementById('comprobantes-list');
  list.innerHTML = '<div style="color:var(--text2);text-align:center;padding:32px">Cargando comprobantesâ¦</div>';
  
  try {
    cleanOldComprobantes();
    const snap = await db.collection('hojas_ruta').orderBy('fecha', 'desc').limit(15).get();
    if(snap.empty) {
      list.innerHTML = '<div class="empty">No hay viajes registrados en el sistema.</div>';
      return;
    }
    
    let html = '';
    for(const d of snap.docs) {
      const h = d.data();
      let gastosHTML = '';
      if(h.turno_id) {
        const gSnap = await db.collection('gastos_ruta').where('turno_id', '==', h.turno_id).get();
        gSnap.forEach(gdDoc => {
          const gd = gdDoc.data();
          const imgUrl = gd.foto_boleta_url || gd.foto_url || '';
          const hasImg = imgUrl && !imgUrl.includes('Eliminado');
          gastosHTML += `
            <div style="background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:10px;display:flex;align-items:center;gap:10px;margin-bottom:6px">
              <div style="width:40px;height:40px;background:var(--bg);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;overflow:hidden">
                ${hasImg ? `<img src="${imgUrl}" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="window.open('${imgUrl}','_blank')"/>` : 'â½'}
              </div>
              <div style="flex:1">
                <div style="font-weight:600;font-size:.8rem">${gd.tipo === 'combustible' ? 'Combustible' : 'Peaje'}</div>
                <div style="font-size:.7rem;color:var(--text2)">Monto: ${fmt(gd.monto_clp || gd.monto)}</div>
              </div>
              ${hasImg ? `<a href="${imgUrl}" target="_blank" download class="btn-sm" style="text-decoration:none;font-size:.7rem;background:var(--primary);color:#fff">Descargar</a>
                           <button onclick="deleteComprobanteManual('gasto', '${gdDoc.id}', '${imgUrl}')" class="btn-sm danger" style="padding:4px 8px;font-size:.7rem;margin-left:4px">Eliminar</button>` : `<span style="font-size:.7rem;color:var(--text2)">${imgUrl || 'Sin imagen'}</span>`}
            </div>
          `;
        });
      }
      
      if(!gastosHTML) {
        gastosHTML = '<div style="color:var(--text2);font-size:.75rem">Sin comprobantes de peaje/combustible registrados en ruta.</div>';
      }
      
      const hasFactura = h.foto_combustible_url && !h.foto_combustible_url.includes('Eliminado');
      html += `
        <div class="card" style="border-left: 3px solid var(--primary);margin-bottom:14px;padding:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
            <h4 style="font-size:.85rem;font-weight:700">ð Viaje: ${sanitize(h.patente)} Â· ${sanitize(h.conductor_nombre)}</h4>
            <span style="font-size:.75rem;color:var(--text2)">ð ${h.fecha}</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr;gap:14px">
            <div style="background:rgba(27,75,155,.1);border:1px solid rgba(27,75,155,.2);border-radius:12px;padding:12px">
              <h5 style="font-size:.75rem;color:var(--accent);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">ð Factura Combustible (Hoja de Ruta)</h5>
              <div style="display:flex;align-items:center;gap:10px">
                <div style="width:40px;height:40px;background:var(--bg);border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;overflow:hidden">
                  ${hasFactura ? `<img src="${h.foto_combustible_url}" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="window.open('${h.foto_combustible_url}','_blank')"/>` : 'ð'}
                </div>
                <div style="flex:1">
                  <div style="font-weight:600;font-size:.8rem">${h.nombre_distribuidor || 'Carga combustible'}</div>
                  <div style="font-size:.7rem;color:var(--text2)">KM Cierre: ${h.km_final || 'â'} Â· Peaje: ${fmt(h.peaje || 0)}</div>
                </div>
                ${hasFactura ? `<a href="${h.foto_combustible_url}" target="_blank" download class="btn-sm" style="text-decoration:none;font-size:.7rem;background:var(--accent);color:#fff">Descargar</a>
                                 <button onclick="deleteComprobanteManual('factura', '${d.id}', '${h.foto_combustible_url}')" class="btn-sm danger" style="padding:4px 8px;font-size:.7rem;margin-left:4px">Eliminar</button>` : `<span style="font-size:.7rem;color:var(--text2)">${h.foto_combustible_url || 'Sin factura'}</span>`}
              </div>
            </div>
            
            <div>
              <h5 style="font-size:.75rem;color:var(--success);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">â½ Comprobantes de Gastos (Mi Jornada)</h5>
              <div style="display:flex;flex-direction:column;gap:4px">
                ${gastosHTML}
              </div>
            </div>
          </div>
        </div>
      `;
    }
    list.innerHTML = html;

    // Cargar Comprobantes de Entrega de TotalEnergies
    const totalList = document.getElementById('te-comprobantes-total-list');
    if (totalList) {
      totalList.innerHTML = '<div style="color:var(--text2);text-align:center;padding:32px">Cargando comprobantes de entregaâ¦</div>';
      
      const teHrs = [];
      snap.forEach(doc => {
        const h = doc.data();
        const dist = (h.nombre_distribuidor || h.distribuidor || '').trim().toLowerCase();
        if (dist.includes('total')) {
          teHrs.push({ id: doc.id, ...h });
        }
      });
      
      if (teHrs.length === 0) {
        totalList.innerHTML = '<div class="empty">No hay comprobantes de entrega TotalEnergies registrados en el sistema.</div>';
      } else {
        totalList.innerHTML = teHrs.map(h => {
          const hasPod = h.pod_doc_url && !h.pod_doc_url.includes('Eliminado');
          const clientsStr = (h.clientes_despacho || []).join(', ') || 'â';
          return `
            <div class="card" style="border-left: 3px solid var(--accent); margin-bottom:14px; padding:16px;">
              <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
                <h4 style="font-size:.85rem; font-weight:700; color:var(--accent);">â½ Viaje Total: ${sanitize(h.patente)} Â· ${sanitize(h.conductor_nombre)}</h4>
                <span style="font-size:.75rem; color:var(--text2);">ð ${sanitize(h.fecha)}</span>
              </div>
              <div style="background:var(--surface2); border:1px solid var(--border); border-radius:12px; padding:12px; display:flex; align-items:center; gap:12px;">
                <div style="width:45px; height:45px; background:var(--bg); border-radius:8px; display:flex; align-items:center; justify-content:center; font-size:1.4rem; overflow:hidden;">
                  ${hasPod ? `<div style="cursor:pointer;" onclick="window.open('${h.pod_doc_url}','_blank')">ð</div>` : 'â'}
                </div>
                <div style="flex:1;">
                  <div style="font-weight:600; font-size:.82rem;">Clientes: ${sanitize(clientsStr)}</div>
                  <div style="font-size:.72rem; color:var(--text2);">Valor del Servicio: ${fmt(h.valor_servicio || 0)} ${h.pod_doc_name ? `Â· Archivo: ${sanitize(h.pod_doc_name)}` : ''}</div>
                </div>
                ${hasPod ? `
                  <div style="display:flex; gap:6px;">
                    <a href="${h.pod_doc_url}" target="_blank" class="btn-sm" style="text-decoration:none; font-size:.75rem; background:var(--primary); color:#fff; border-radius:6px; padding:6px 12px;">Ver Documento</a>
                    <button onclick="deleteComprobanteManual('pod', '${h.id}', '${h.pod_doc_url}')" class="btn-sm danger" style="padding:6px 12px; font-size:.75rem; border-radius:6px;">Eliminar</button>
                  </div>
                ` : `<span style="font-size:.75rem; color:var(--text2); font-weight:500;">Sin documento adjunto</span>`}
              </div>
            </div>
          `;
        }).join('');
      }
    }
  } catch(e) {
    list.innerHTML = `<div class="empty">Error al cargar comprobantes: ${e.message}</div>`;
  }
}

async function deleteComprobanteManual(type, id, url) {
  if(!confirm('Â¿EstÃ¡s seguro de que deseas eliminar este comprobante? Esta acciÃ³n no se puede deshacer.')) return;
  try {
    if(url && url.startsWith('http') && !url.includes('Eliminado')) {
      try {
        const ref = storage.refFromURL(url);
        await ref.delete();
      } catch(se) {
        console.warn("Storage delete failed:", se.message);
      }
    }
    if(type === 'gasto') {
      await db.collection('gastos_ruta').doc(id).delete();
    } else if(type === 'factura') {
      await db.collection('hojas_ruta').doc(id).update({
        foto_combustible_url: ""
      });
    } else if(type === 'pod') {
      await db.collection('hojas_ruta').doc(id).update({
        pod_doc_url: "",
        pod_doc_name: ""
      });
    }
    showToast('â Comprobante eliminado permanentemente', 'success');
    loadComprobantes();
  } catch(e) {
    showToast('Error al eliminar: ' + e.message, 'error');
  }
}

async function cleanOldComprobantes(forceShowToast = false) {
  const thresholdDate = new Date();
  thresholdDate.setDate(thresholdDate.getDate() - 1); // 24 Horas
  const thresholdISO = thresholdDate.toISOString().split('T')[0];
  const thresholdTS = firebase.firestore.Timestamp.fromDate(thresholdDate);
  
  let count = 0;
  try {
    // 1. Facturas en Hojas de Ruta
    const hrSnap = await db.collection('hojas_ruta').where('fecha', '<', thresholdISO).get();
    for(const d of hrSnap.docs) {
      const h = d.data();
      if(h.foto_combustible_url && !h.foto_combustible_url.includes('Eliminado') && h.foto_combustible_url.startsWith('http')) {
        try {
          const ref = storage.refFromURL(h.foto_combustible_url);
          await ref.delete();
        } catch(se) {
          console.warn("Storage delete failed for hoja_ruta:", se.message);
        }
        await db.collection('hojas_ruta').doc(d.id).update({
          foto_combustible_url: ""
        });
        count++;
      }
    }
    
    // 2. Comprobantes de Gastos de Ruta
    const gSnap = await db.collection('gastos_ruta').where('fecha', '<', thresholdTS).get();
    for(const d of gSnap.docs) {
      const g = d.data();
      const imgUrl = g.foto_boleta_url || g.foto_url || '';
      if(imgUrl && !imgUrl.includes('Eliminado') && imgUrl.startsWith('http')) {
        try {
          const ref = storage.refFromURL(imgUrl);
          await ref.delete();
        } catch(se) {
          console.warn("Storage delete failed for gasto:", se.message);
        }
      }
      // Eliminar el documento completo de Firestore y la app
      await db.collection('gastos_ruta').doc(d.id).delete();
      count++;
    }
    
    if(count > 0) {
      console.log(`ð§¹ Purgado automÃ¡tico: se eliminaron fÃ­sicamente ${count} comprobantes de mÃ¡s de 24 horas.`);
      if(forceShowToast) showToast(`ð§¹ Se purgaron fÃ­sicamente ${count} comprobantes antiguos (+24h)`, 'success');
    } else {
      if(forceShowToast) showToast('â No se encontraron comprobantes de mÃ¡s de 24 horas para purgar.', 'info');
    }
  } catch(e) {
    console.warn("Error running cleanOldComprobantes:", e);
  }
}
