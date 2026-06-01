
let _uid='', _email='', _name='', _isViewer=false, _activeTab='form';

requireAuth(async(user,data)=>{
  _uid=user.uid;
  _email=data.correo_electronico||data.email||user.email;
  _name=data.name||data.nombre||'';
  _isViewer=isViewerRole((data.rol||data.role));
  document.getElementById('user-name').textContent=_name;
  
  const condSelect = document.getElementById('nombre_conductor_viaje');
  if (condSelect) {
    if (_isViewer) {
      try {
        const usersSnap = await db.collection('users').get();
        condSelect.innerHTML = '<option value="" disabled selected>Seleccione Conductor...</option>';
        usersSnap.forEach(d => {
          const u = d.data();
          const email = u.correo_electronico || u.email || '';
          const name = u.nombre_completo || u.nombre || u.name || '';
          const role = (u.rol || u.role || '').toLowerCase();
          if ((role.includes('conductor') || role === 'admin') && email) {
            const o = document.createElement('option');
            o.value = email;
            o.textContent = `${name} (${email})`;
            o.dataset.uid = d.id;
            o.dataset.name = name;
            condSelect.appendChild(o);
          }
        });
      } catch(err) {
        console.warn("Error cargando lista de conductores:", err);
      }
    } else {
      condSelect.innerHTML = '';
      const o = document.createElement('option');
      o.value = _email;
      o.textContent = `${_name} (${_email})`;
      o.dataset.uid = user.uid;
      o.dataset.name = _name;
      condSelect.appendChild(o);
      condSelect.value = _email;
      condSelect.disabled = true;
    }
  }
  const now=new Date();
  document.getElementById('id_viaje').value=String(now.getDate()).padStart(2,'0')+String(now.getMonth()+1).padStart(2,'0')+now.getFullYear();
  
  const patenteSelect = document.getElementById('patente');
  const vList = new Set();

  try {
    const allVs = await db.collection('vehiculos').get();
    let assignedPatente = '';
    
    allVs.forEach(d => {
      const v = d.data();
      if(v.conductor === _email && v.patente) {
        assignedPatente = v.patente.toUpperCase();
        vList.add(assignedPatente);
      }
      if(v.estado === 'Disponible' || v.estado === 'Disponible ') {
        if(v.patente) vList.add(v.patente.toUpperCase());
      }
    });

    patenteSelect.innerHTML = '<option value="">Seleccione Vehículo...</option>';
    vList.forEach(p => {
      const o = document.createElement('option');
      o.value = p; o.textContent = p;
      patenteSelect.appendChild(o);
    });
    
    if(assignedPatente) patenteSelect.value = assignedPatente;
  } catch(e) { console.warn("Error cargando vehiculos:", e); }
  
  if(_isViewer){
    document.getElementById('tbtn-admin').style.display='block';
    const usersSnap=await db.collection('users').get();
    const sel=document.getElementById('filter-conductor');
    usersSnap.forEach(d=>{
      const u=d.data(), em=u.correo_electronico||u.email||'';
      if(em){const o=document.createElement('option');o.value=em;o.textContent=u.nombre||u.name||em;sel.appendChild(o);}
    });
  } else {
    // Conductor: Hide 'Nuevo Viaje' and default to 'Mis Viajes'
    document.getElementById('tbtn-form').style.display='none';
    showTab('history');
  }
});

function showTab(t){
  _activeTab=t;
  ['form','history','admin'].forEach(id=>{
    const el=document.getElementById('tab-'+id);if(el)el.style.display=t===id?'block':'none';
  });
  ['form','history','admin'].forEach(id=>{
    const b=document.getElementById('tbtn-'+id);if(b)b.classList.toggle('active',t===id);
  });
  if(t==='history') loadHistory();
  if(t==='admin') loadAdminViajes();
}

function addClient(){
  const li=document.getElementById('client-list');
  const d=document.createElement('div');d.className='client-item';
  d.innerHTML='<input placeholder="Nombre del cliente" class="client-input"/><button class="btn-remove" onclick="removeClient(this)">✕</button>';
  li.appendChild(d);
}
function removeClient(btn){btn.parentElement.remove();}
function toggleFuel(on){document.getElementById('fuel-fields').style.display=on?'block':'none';}
function previewImg(inp){const img=document.getElementById('img-preview');if(inp.files[0]){img.src=URL.createObjectURL(inp.files[0]);img.style.display='block';}}

async function submitViaje(){
  const patente=document.getElementById('patente').value.trim().toUpperCase();
  const dist=document.getElementById('nombre_distribuidor').value.trim();
  const kmI=parseFloat(document.getElementById('km_inicial').value);
  const kmF=parseFloat(document.getElementById('km_final_viaje').value);
  const fechaDespacho=document.getElementById('fecha_despacho').value;
  const idViaje=document.getElementById('id_viaje').value.trim();
  
  const condSelect = document.getElementById('nombre_conductor_viaje');
  let conductorEmail = _email;
  let conductorNombre = _name;
  let conductorUid = _uid;

  if (condSelect && _isViewer) {
    const selectedOpt = condSelect.options[condSelect.selectedIndex];
    if (selectedOpt && selectedOpt.value) {
      conductorEmail = selectedOpt.value;
      conductorNombre = selectedOpt.dataset.name || selectedOpt.textContent;
      conductorUid = selectedOpt.dataset.uid || '';
    }
  }
  
  if(!patente||!dist||!kmI||!kmF||!fechaDespacho||!idViaje||!conductorNombre){
    showToast('Completa los campos obligatorios del viaje','error');
    return;
  }
  
  const btn=document.getElementById('btn-submit');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span>Guardando…';
  
  try{
    const clients=[...document.querySelectorAll('.client-input')].map(i=>i.value.trim()).filter(Boolean);
    const hasFuel=document.getElementById('carga_combustible_viaje').checked;
    let fotoUrl='';
    const fotoFile=document.getElementById('foto_combustible').files[0];
    if(hasFuel&&fotoFile){
      const ref=storage.ref(`facturas/${Date.now()}_${fotoFile.name}`);
      await ref.put(fotoFile);fotoUrl=await ref.getDownloadURL();
    }
    
    // Mapear estado
    const estadoViaje=document.getElementById('estado_viaje').value;
    const mappedEstado=estadoViaje==='Conforme'?'revisada':(estadoViaje==='Con Observaciones'?'observada':'pendiente');
    
    // Crear nueva referencia de hojas_ruta para obtener ID consistente
    const hrRef=db.collection('hojas_ruta').doc();
    const tripId=hrRef.id;
    
    // Entregas array
    const entregasArray=clients.map((cName, idx) => ({
      correlativo: idx + 1,
      documento: `${idViaje}-${idx + 1}`,
      cliente: cName,
      direccion: '',
      comuna: '',
      observaciones: '',
      estado: estadoViaje === 'Conforme' ? 'entregado' : 'devuelto',
      devolucion_motivo: estadoViaje !== 'Conforme' ? document.getElementById('detalle_devoluciones').value || 'Incidente en Ruta' : '',
    }));
    
    const batch=db.batch();
    
    // 1. Escribir Hoja de Ruta
    batch.set(hrRef, {
      turno_id: tripId,
      id_viaje: idViaje,
      conductor_uid: conductorUid,
      conductor_email: conductorEmail,
      conductor_nombre: conductorNombre,
      distribuidor: dist,
      nombre_distribuidor: dist,
      patente: patente,
      fecha: fechaDespacho,
      fecha_despacho: fechaDespacho,
      hora_inicio: firebase.firestore.FieldValue.serverTimestamp(),
      hora_termino: firebase.firestore.FieldValue.serverTimestamp(),
      km_inicial: kmI,
      km_final: kmF,
      km_final_viaje: kmF,
      km_recorridos: kmF - kmI,
      total_entregas: clients.length,
      total_devoluciones: estadoViaje === 'Conforme' ? 0 : clients.length,
      entregas: entregasArray,
      clientes_despacho: clients,
      carga_combustible_viaje: hasFuel,
      combustible: hasFuel ? parseFloat(document.getElementById('monto_combustible').value)||0 : 0,
      monto_combustible: hasFuel ? parseFloat(document.getElementById('monto_combustible').value)||0 : 0,
      litros_combustible: hasFuel ? parseFloat(document.getElementById('litros_combustible').value)||0 : 0,
      factura_combustible: hasFuel ? document.getElementById('factura_combustible').value : '',
      foto_combustible_url: fotoUrl,
      peaje: 0,
      n_guias: clients.length,
      cant_guias: parseInt(document.getElementById('cant_guias').value) || clients.length,
      detalle_devoluciones: document.getElementById('detalle_devoluciones').value,
      estado: mappedEstado,
      estado_viaje: estadoViaje,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    // 2. Escribir Despachos
    clients.forEach((cName, idx) => {
      const dRef = db.collection('despachos').doc();
      batch.set(dRef, {
        turno_id: tripId,
        cliente_nombre: cName,
        cliente_direccion: '',
        cliente_comuna: '',
        guia_numero: `${idViaje}-${idx + 1}`,
        n_documento: `${idViaje}-${idx + 1}`,
        referencia: `${idViaje}-${idx + 1}`,
        distribuidor: dist,
        nombre_distribuidor: dist,
        estado: estadoViaje === 'Conforme' ? 'entregado' : 'devuelto',
        devolucion_motivo: estadoViaje !== 'Conforme' ? document.getElementById('detalle_devoluciones').value || 'Incidente en Ruta' : '',
        fecha: firebase.firestore.Timestamp.fromDate(new Date(fechaDespacho + 'T12:00:00')),
        pod_timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        // ASIGNACIÓN AL CONDUCTOR
        conductor_uid: conductorUid,
        conductor_email: conductorEmail,
        conductor_nombre: conductorNombre,
        patente: patente
      });
    });
    
    await batch.commit();
    showToast('✅ Hoja de ruta guardada con éxito', 'success');
    setTimeout(()=>window.location.href='dashboard.html', 1500);
  }catch(e){
    btn.disabled=false;
    btn.innerHTML='📋 Registrar Hoja de Ruta';
    showToast('Error: '+e.message, 'error');
  }
}
function tripCard(r){
  const km = r.km_recorridos || (r.km_final && r.km_inicial ? r.km_final - r.km_inicial : 0);
  const badgeCls = r.estado === 'revisada' ? 'badge-conf' : r.estado === 'observada' ? 'badge-inc' : 'badge-obs';
  const badgeTxt = r.estado === 'revisada' ? 'Revisada' : r.estado === 'observada' ? 'Observada' : 'Pendiente';
  const dateStr = r.fecha || (r.created_at ? formatDate(r.created_at) : '—');
  return `<div class="trip-card">
    <div style="display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div class="trip-id">🚛 ${sanitize(r.patente)||'—'} · ${sanitize(r.conductor_nombre||r.conductor_email)||''}</div>
        <div class="trip-dist">${sanitize(r.distribuidor)||'—'}</div>
        <div class="trip-meta">📅 ${dateStr} · ${km} km · ${r.total_entregas||0} entregas · ${r.total_devoluciones||0} devoluciones</div>
        ${r.combustible || r.peaje ? `<div class="trip-meta" style="margin-top:4px">⛽ $${(r.combustible||0).toLocaleString('es-CL')} · 🛣️ $${(r.peaje||0).toLocaleString('es-CL')}</div>` : ''}
        ${_isViewer && r.id ? `<button class="btn-delete-trip" onclick="deleteTrip('${r.id}', this)">🗑️ Eliminar Viaje</button>` : ''}
      </div>
      <span class="${badgeCls}">${badgeTxt}</span>
    </div>
  </div>`;
}

async function deleteTrip(tripId, btn){
  if(!confirm('¿Estás seguro de que deseas eliminar este viaje? Esta acción no se puede deshacer.')) return;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>Eliminando…';
  try{
    await db.collection('hojas_ruta').doc(tripId).delete();
    showToast('✅ Viaje eliminado correctamente','success');
    if(_activeTab === 'history') await loadHistory();
    else if(_activeTab === 'admin') await loadAdminViajes();
  }catch(e){
    btn.disabled = false;
    btn.innerHTML = '🗑️ Eliminar Viaje';
    showToast('Error al eliminar viaje: ' + e.message, 'error');
  }
}

async function loadHistory(){
  const list=document.getElementById('history-list');
  list.innerHTML='<div style="color:var(--text2);text-align:center;padding:32px">Cargando…</div>';
  const filterDate = document.getElementById('filter-date-history').value;
  try{
    let snap;
    if(filterDate) {
      snap = await db.collection('hojas_ruta').where('fecha','==',filterDate).get();
    } else {
      snap = await db.collection('hojas_ruta').where('conductor_email','==',_email).get();
    }
    
    if(snap.empty){list.innerHTML='<div style="color:var(--text2);text-align:center;padding:32px">Sin viajes registrados.</div>';return;}
    let docs=[];
    snap.forEach(d=>{
      const data = d.data();
      if(filterDate && data.conductor_email !== _email) return;
      docs.push({id: d.id, ...data});
    });
    
    if(!docs.length){list.innerHTML='<div style="color:var(--text2);text-align:center;padding:32px">Sin viajes registrados.</div>';return;}
    
    docs.sort((a,b)=>{
      const da = a.created_at?.toMillis?.() || (a.fecha ? new Date(a.fecha).getTime() : 0);
      const db = b.created_at?.toMillis?.() || (b.fecha ? new Date(b.fecha).getTime() : 0);
      return db - da;
    });

    let displayDocs = docs;
    if(!filterDate) {
      displayDocs = docs.slice(0, 7);
    }
    
    list.innerHTML=displayDocs.map(tripCard).join('');
  }catch(e){list.innerHTML=`<div style="color:var(--text2);text-align:center;padding:32px">Error: ${e.message}</div>`;}
}

async function loadAdminViajes(){
  const list=document.getElementById('admin-viajes-list');
  list.innerHTML='<div style="color:var(--text2);text-align:center;padding:32px">Cargando…</div>';
  const filtro=document.getElementById('filter-conductor').value;
  const filterDate = document.getElementById('filter-date-admin').value;
  try{
    let snap;
    if(filterDate) {
      snap = await db.collection('hojas_ruta').where('fecha','==',filterDate).get();
    } else if(filtro) {
      snap = await db.collection('hojas_ruta').where('conductor_email','==',filtro).get();
    } else {
      snap = await db.collection('hojas_ruta').orderBy('created_at','desc').limit(7).get();
    }
    
    if(snap.empty){list.innerHTML='<div style="color:var(--text2);text-align:center;padding:32px">Sin viajes.</div>';return;}
    let docs=[];
    snap.forEach(d=>{
      const data = d.data();
      if(filterDate && filtro && data.conductor_email !== filtro) return;
      docs.push({id: d.id, ...data});
    });
    
    if(!docs.length){list.innerHTML='<div style="color:var(--text2);text-align:center;padding:32px">Sin viajes.</div>';return;}
    
    if(filterDate || filtro) {
      docs.sort((a,b)=>{
        const da = a.created_at?.toMillis?.() || (a.fecha ? new Date(a.fecha).getTime() : 0);
        const db = b.created_at?.toMillis?.() || (b.fecha ? new Date(b.fecha).getTime() : 0);
        return db - da;
      });
    }
    
    let displayDocs = docs;
    if(!filterDate) {
      displayDocs = docs.slice(0, 7);
    }
    
    list.innerHTML=displayDocs.map(tripCard).join('');
  }catch(e){list.innerHTML=`<div style="color:var(--text2);text-align:center;padding:32px">Error: ${e.message}</div>`;}
}

function clearFilterDate(type) {
  document.getElementById('filter-date-' + type).value = '';
  if(type === 'history') loadHistory();
  else if(type === 'admin') loadAdminViajes();
}
