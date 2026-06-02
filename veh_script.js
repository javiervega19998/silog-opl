
let _isAdmin=false;
requireAuth(async(user,data)=>{
  _isAdmin=isViewerRole((data.rol||data.role));
  if(_isAdmin) document.getElementById('btn-add-v').style.display='block';
  loadVehicles();
});
function getVehicleEmoji(marca, modelo) {
  const m = ((marca || '') + ' ' + (modelo || '')).toLowerCase();
  if (m.includes('renault') || m.includes('master')) return '🚐';
  if (m.includes('opel') || m.includes('combo')) return '🚙';
  if (m.includes('foton')) return '🚛';
  return '🚛';
}

async function loadVehicles(){
  const snap=await db.collection('vehiculos').get();
  const grid=document.getElementById('fleet-grid');
  if(snap.empty){grid.innerHTML='<div class="empty">No hay vehículos registrados.</div>';return;}
  grid.innerHTML='';
  snap.forEach(d=>{
    const v=d.data(); const id=d.id;
    const sc=v.estado==='Disponible'?'s-disponible':v.estado==='Mantención'?'s-mantencion':'s-otros';
    const emoji=getVehicleEmoji(v.marca, v.modelo);
    grid.innerHTML+=ScCard(v, id, sc, emoji);
  });
}

function ScCard(v, id, sc, emoji) {
  return `
    <div class="v-card">
      <div class="v-top">
        <div><div class="v-plate">${emoji} ${v.patente||'—'}</div><div class="v-model-name">${v.marca||''} ${v.modelo||''}</div></div>
        <span class="status-pill ${sc}">${v.estado||'—'}</span>
      </div>
      <div class="v-stats">
        <div class="v-stat"><div class="val">${(v.kilometraje||0).toLocaleString('es-CL')}</div><div class="lbl">km actual</div></div>
        <div class="v-stat"><div class="val">${v.capacidad_kg||0}</div><div class="lbl">cap. kg</div></div>
        <div class="v-stat"><div class="val">${v.capacidad_m_3||0}</div><div class="lbl">cap. m³</div></div>
      </div>
      <div class="v-conductor">👤 ${v.conductor||'Sin asignar'}</div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <button class="btn-detail" style="flex:1" onclick="showHistory('${id}','${v.patente||''}')">📋 Historial</button>
        ${_isAdmin?`<button class="btn-detail" style="flex:1;border-color:var(--accent);color:var(--accent)" onclick="editVehicle('${id}')">✏️ Editar</button><button class="btn-detail" style="flex:1;border-color:var(--danger);color:#FCA5A5" onclick="deleteVehicle('${id}','${v.patente||''}')"> 🗑️ Eliminar</button>`:''}
      </div>
    </div>`;
}

function openModal(reset=true){
  if(reset){document.getElementById('modal-title').textContent='➕ Nuevo Vehículo';document.getElementById('doc-id').value='';['m-patente','m-marca','m-modelo'].forEach(i=>document.getElementById(i).value='');['m-km','m-rev','m-kg','m-m3'].forEach(i=>document.getElementById(i).value='');document.getElementById('m-estado').value='Disponible';}
  document.getElementById('modal-vehicle').classList.add('open');
}
function closeModal(){document.getElementById('modal-vehicle').classList.remove('open');}
async function editVehicle(id){
  const d=await db.collection('vehiculos').doc(id).get();
  if(!d.exists) return;
  const v=d.data();
  document.getElementById('doc-id').value=id;
  document.getElementById('modal-title').textContent='✏️ Editar Vehículo';
  document.getElementById('m-patente').value=v.patente||'';
  document.getElementById('m-marca').value=v.marca||'';
  document.getElementById('m-modelo').value=v.modelo||'';
  document.getElementById('m-km').value=v.kilometraje||'';
  document.getElementById('m-rev').value=v.proxima_revision||'';
  document.getElementById('m-kg').value=v.capacidad_kg||'';
  document.getElementById('m-m3').value=v.capacidad_m_3||'';
  document.getElementById('m-estado').value=v.estado||'Disponible';
  openModal(false);
}
async function saveVehicle(){
  const patente=document.getElementById('m-patente').value.trim().toUpperCase();
  if(!patente){showToast('Ingresa la patente','error');return;}
  const docId=document.getElementById('doc-id').value;
  const data={
    patente,marca:document.getElementById('m-marca').value.trim(),
    modelo:document.getElementById('m-modelo').value.trim(),
    kilometraje:parseFloat(document.getElementById('m-km').value)||0,
    km:parseFloat(document.getElementById('m-km').value)||0,
    proxima_revision:parseFloat(document.getElementById('m-rev').value)||0,
    capacidad_kg:parseFloat(document.getElementById('m-kg').value)||0,
    capacidad_m_3:parseFloat(document.getElementById('m-m3').value)||0,
    estado:document.getElementById('m-estado').value,
  };
  if(!docId) data.conductor = '';
  try{
    if(docId) await db.collection('vehiculos').doc(docId).update(data);
    else await db.collection('vehiculos').add(data);
    closeModal();showToast('✅ Vehículo guardado','success');loadVehicles();
  }catch(e){showToast('Error: '+e.message,'error');}
}
async function showHistory(id,plate){
  document.getElementById('hist-title').textContent='📋 Historial · '+plate;
  const snap=await db.collection('vehiculos').doc(id).get();
  const hist=snap.data()?.historial_vehiculo||[];
  const div=document.getElementById('hist-content');
  if(!hist.length){div.innerHTML='<div style="color:var(--text2);text-align:center;padding:20px">Sin historial registrado.</div>';}
  else{div.innerHTML=hist.map(e=>`<div class="hist-item"><div class="ev">🔧 ${e.evento_historial||'—'}</div><div class="dt">📅 ${e.fecha_evento_historial?formatDate(e.fecha_evento_historial):'—'} · 👤 ${e.nombre_evento_historial||'—'} · ${e.kilometraje_evento_historial?.toLocaleString('es-CL')||'—'} km</div></div>`).join('');}
  document.getElementById('modal-hist').classList.add('open');
}
async function deleteVehicle(id, patente){
  if(!confirm(`¿Eliminar el vehículo ${patente}? Esta acción no se puede deshacer.`)) return;
  try{
    await db.collection('vehiculos').doc(id).delete();
    showToast('🗑️ Vehículo eliminado','success'); loadVehicles();
  }catch(e){showToast('Error: '+e.message,'error');}
}
