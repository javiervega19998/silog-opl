const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../js/finanzas_script.js');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Replace loadFilters() using regex
const filterRegex = /(async function loadFilters\(\)\{[\s\S]*?)(async function loadClientes\(\))/;
const newFilters = `async function loadFilters(){
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
        const o=document.createElement('option');o.value=email;o.textContent=\`\${nombre} (\${email})\`;modalConductorSel.appendChild(o);
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

`;

if (!filterRegex.test(content)) {
  console.error("Filters regex mismatch!");
  process.exit(1);
}
content = content.replace(filterRegex, `$1 = 0; // dummy placeholder to prevent syntax error\n}\n\n${newFilters}$2`);
// Clean up the dummy placeholder
content = content.replace(/async function loadFilters\(\)\{[\s\S]*?async function loadFilters\(\)\{/, 'async function loadFilters(){');

// 2. Replace loadCentroCostos() rendering part
const ccRegex = /(let totComb=0,totPeaje=0,totGastos=0;[\s\S]*?)(document\.getElementById\('cc-ingresos'\)\.textContent)/;
const newCC = `let totComb=0,totPeaje=0,totGastos=0;
    const body=document.getElementById('cc-body');
    if(!_allCostos.length){body.innerHTML='<tr><td colspan="9" class="txt-c empty">Sin datos para este periodo</td></tr>';
    }else{
      body.innerHTML=_allCostos.map(r=>{
        totComb+=r.combustible||0; totPeaje+=r.peaje||0; totGastos+=r.total_gastos||0;
        const f=r._fecha?r._fecha.toLocaleDateString('es-CL',{day:'2-digit',month:'short'}):'—';
        return\`<tr>
          <td>\${f}</td>
          <td><code style="color:var(--accent)">\${sanitize(r.patente||'—')}</code></td>
          <td style="font-size:.78rem">\${sanitize(r.conductor_nombre || r.conductor_email || '—')}</td>
          <td>\${sanitize(r.nombre_distribuidor || r.distribuidor || 'SIN DISTRIBUIDOR')}</td>
          <td class="txt-r">\${r.entregados}</td>
          <td class="txt-r">\${r.devueltos}</td>
          <td class="txt-r money money-red">\${fmt(r.combustible)}</td>
          <td class="txt-r money money-red">\${fmt(r.peaje)}</td>
          <td class="txt-r money money-red">\${fmt(r.total_gastos)}</td>
        </tr>\`;
      }).join('');
    }
    `;

if (!ccRegex.test(content)) {
  console.error("CC regex mismatch!");
  process.exit(1);
}
content = content.replace(ccRegex, `${newCC}$2`);

// 3. Replace loadHojasRuta empty state and error state
const hrEmptyRegex = /document\.getElementById\('hr-body'\)\.innerHTML\s*=\s*'<tr><td colspan="11"/g;
const hrErrorRegex = /document\.getElementById\('hr-body'\)\.innerHTML\s*=\s*`<tr><td colspan="11"/g;

content = content.replace(hrEmptyRegex, "document.getElementById('hr-body').innerHTML = '<tr><td colspan=\"9\"");
content = content.replace(hrErrorRegex, "document.getElementById('hr-body').innerHTML = `<tr><td colspan=\"9\"");

// 4. Replace renderHojasRuta and openHoja
const renderOpenRegex = /(function renderHojasRuta\(\)\{[\s\S]*?)(function closeHojaModal\(\))/;
const newRenderOpen = `function renderHojasRuta(){
  const body=document.getElementById('hr-body');
  if(!_hojasRuta.length){body.innerHTML='<tr><td colspan="9" class="txt-c" style="color:var(--text2);padding:20px">Sin hojas de ruta</td></tr>';return;}
  const estadoBadge={'pendiente_revision':'<span class="badge-sm b-borrador">🟡 Pendiente</span>','revisada':'<span class="badge-sm b-pagada">🟢 Revisada</span>','observada':'<span class="badge-sm b-enviada">🔴 Observada</span>'};
  body.innerHTML=_hojasRuta.map(h=>\`<tr>
    <td>\${sanitize(h.fecha||'—')}</td>
    <td>\${sanitize(h.conductor_nombre||h.conductor_email||'—')}</td>
    <td>\${sanitize(h.distribuidor||'—')}</td>
    <td style="font-weight:700;color:var(--accent)">\${sanitize(h.patente||'—')}</td>
    <td class="txt-c">\${h.total_entregas||0}</td>
    <td class="txt-c" style="color:var(--danger)">\${h.total_devoluciones||0}</td>
    <td class="txt-c">\${h.km_recorridos||'—'} km</td>
    <td class="txt-c">\${estadoBadge[h.estado]||sanitize(h.estado)}</td>
    <td class="txt-c"><button class="btn-sm" onclick="openHoja('\${sanitize(h.id)}')">👁️ Ver</button> <button class="btn-sm" style="background:var(--success);border-color:var(--success);color:#fff" onclick="exportHojaExcelById('\${sanitize(h.id)}')">📥</button></td>
  </tr>\`).join('');
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
  tbody.innerHTML=entregas.map((e,i)=>\`<tr>
    <td class="he-corr">\${e.correlativo||i+1}</td>
    <td><input class="field he-doc" value="\${sanitize(e.documento||'')}" style="width:100px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
    <td><input class="field he-lugar" value="\${sanitize(e.cliente||e.direccion||'')}" data-direccion="\${sanitize(e.direccion||'')}" style="width:140px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
    <td>
      <select class="field he-estado" style="width:125px; padding:6px 10px; font-size:0.8rem; border-radius:6px; font-weight:600; cursor:pointer; outline:none; transition:0.2s; color:\${e.estado === 'entregado' || e.estado === 'Conforme' ? 'var(--success)' : 'var(--danger)'}; border-color:\${e.estado === 'entregado' || e.estado === 'Conforme' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)'}; background:var(--surface2);" onchange="this.style.color = this.value === 'entregado' ? 'var(--success)' : 'var(--danger)'; this.style.borderColor = this.value === 'entregado' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(239, 68, 68, 0.4)';">
        <option value="entregado" \${e.estado === 'entregado' || e.estado === 'Conforme' ? 'selected' : ''} style="color:var(--text);background:var(--bg);">🟢 Entregado</option>
        <option value="devuelto" \${e.estado === 'devuelto' || e.estado === 'rechazado' || (e.estado !== 'entregado' && e.estado !== 'Conforme' && e.estado) ? 'selected' : ''} style="color:var(--text);background:var(--bg);">🔴 Rechazado</option>
      </select>
    </td>
    <td><input class="field he-obs" value="\${sanitize(e.observaciones||e.devolucion_motivo||'')}" style="width:120px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
    <td><input class="field he-comuna" value="\${sanitize(e.comuna||'')}" style="width:90px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
    <td><input class="field he-valor" type="number" value="\${e.valor_diario||0}" style="width:80px; padding:6px 10px; font-size:0.8rem; border-radius:6px;"/></td>
  </tr>\`).join('');
  document.getElementById('modal-hoja').classList.add('open');
}

`;

if (!renderOpenRegex.test(content)) {
  console.error("Render/Open regex mismatch!");
  process.exit(1);
}
content = content.replace(renderOpenRegex, `${newRenderOpen}$2`);

// 5. Replace guardarHoja
const guardarRegex = /(async function guardarHoja\(\)\{[\s\S]*?)(function exportHojaExcelById\(id\))/;
const newGuardar = `async function guardarHoja(){
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
    const match = text.match(/^(.*?)\\s*\\(/);
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
        const docName = e.documento || \`\${_hojaActual.id_viaje}-\${e.correlativo}\`;
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
}

`;

if (!guardarRegex.test(content)) {
  console.error("Guardar regex mismatch!");
  process.exit(1);
}
content = content.replace(guardarRegex, `${newGuardar}$2`);

// Write back to file
fs.writeFileSync(targetPath, content, 'utf8');
console.log("Successfully applied all changes to js/finanzas_script.js!");
