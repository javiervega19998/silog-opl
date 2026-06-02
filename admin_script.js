// ── Utilidades Globales ─────────────────────────────────────────
function sanitize(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>'"]/g, match => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[match]);
}

requireAdmin(async(user,data)=>{loadStats();showTab('ejecutivo');cleanOldDespachoPhotos();});

async function loadStats(){
  const today=new Date();today.setHours(0,0,0,0);
  const ts=firebase.firestore.Timestamp.fromDate(today);
  const setVal=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
  
  const pUsers = db.collection('users').get().then(snap => snap.size).catch(() => '?');
  const pVehicles = db.collection('vehiculos').get().then(snap => snap.size).catch(() => '?');
  const pChecklists = db.collection('chequeo_operacional').where('fecha_chequeo','>=',ts).get().then(snap => snap.size).catch(() => '?');
  const pTasks = db.collection('tareas').where('estado','==','pendiente').get().then(snap => snap.size).catch(() => '?');
  const pNotif = db.collection('notificaciones').where('leida','==',false).get().catch(() => null);

  const [uSize, vSize, ckSize, tSize, notifSnap] = await Promise.all([pUsers, pVehicles, pChecklists, pTasks, pNotif]);
  
  setVal('s-users', uSize);
  setVal('s-vehicles', vSize);
  setVal('s-checklists', ckSize);
  setVal('s-tasks', tSize);
  
  if (notifSnap) {
    const badge=document.getElementById('notif-badge');
    if(badge) {
      if(notifSnap.size>0){badge.textContent=notifSnap.size;badge.style.display='inline';}
      else{badge.style.display='none';}
    }
  }
}

// ── Estado de paginación ────────────────────────────────────────
const PAGE_SIZE = 20;
let _curTab = 'users';
let _allDocs = [];  // todos los docs del tab actual (para paginar en JS)
let _curPage = 0;   // página actual (0-indexed)

function showTab(tab){
  _curTab = tab;
  _curPage = 0;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tb-'+tab).classList.add('active');
  const c = document.getElementById('tab-content');
  const exec = document.getElementById('tab-ejecutivo');
  const toolbar = document.getElementById('tab-toolbar');
  if(tab==='ejecutivo'){
    exec.style.display='block';c.style.display='none';toolbar.style.display='none';
    loadExecDashboard();
    return;
  }
  exec.style.display='none';c.style.display='block';
  if(tab==='inversa'){
    toolbar.style.display='none';
  }else{
    toolbar.style.display='flex';
  }
  c.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
  // Mostrar/ocultar botones de toolbar según el tab
  const hasCsv  = ['checklists','viajes','users','despachos','discrepancias'].includes(tab);
  document.getElementById('btn-csv').style.display  = hasCsv ? 'block' : 'none';
  document.getElementById('page-info').textContent   = '';
  document.getElementById('btn-prev').style.display  = 'none';
  document.getElementById('btn-next').style.display  = 'none';
  if(tab === 'users')       loadUsers();
  else if(tab === 'checklists') loadChecklists();
  else if(tab === 'notif')  loadNotificaciones();
  else if(tab === 'inversa') loadInversaConfig();
  else if(tab === 'despachos') loadDespachosAdmin();
  else if(tab === 'discrepancias') loadDiscrepancias();
  else                      loadViajes();
}

function updatePagination(){
  const total = _allDocs.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const from  = _curPage * PAGE_SIZE + 1;
  const to    = Math.min((_curPage+1) * PAGE_SIZE, total);
  document.getElementById('page-info').textContent = total > 0 ? `${from}-${to} de ${total}` : '';
  document.getElementById('btn-prev').style.display = _curPage > 0 ? 'block' : 'none';
  document.getElementById('btn-next').style.display = (_curPage+1) < pages ? 'block' : 'none';
}

function changePage(dir){
  const pages = Math.ceil(_allDocs.length / PAGE_SIZE);
  _curPage = Math.max(0, Math.min(_curPage + dir, pages - 1));
  renderCurrentPage();
}

function renderCurrentPage(){
  const slice = _allDocs.slice(_curPage * PAGE_SIZE, (_curPage+1) * PAGE_SIZE);
  if(_curTab === 'users')       renderUsersPage(slice);
  else if(_curTab === 'checklists') renderChecklistsPage(slice);
  else if(_curTab === 'viajes')     renderViajesPage(slice);
  else if(_curTab === 'despachos')  renderDespachosPage(slice);
  else if(_curTab === 'discrepancias') renderDiscrepanciasPage(slice);
  updatePagination();
}

function exportCurrentTab(){
  const names = { users:'usuarios', checklists:'checklists', viajes:'viajes', despachos:'despachos', discrepancias:'km_discrepancias' };
  exportCSV(_allDocs, names[_curTab] || _curTab);
}

// ── Sincronizar Custom Claims ──────────────────────────────────
async function syncClaimsAll(){
  if(!confirm('Sincronizar roles de TODOS los usuarios con Firebase Auth. ¿Continuar?')) return;
  try{
    showToast('⏳ Sincronizando roles...', 'info');
    const result = await functions.httpsCallable('syncAllClaims')({});
    showToast(`✅ ${result.data.updated} usuarios sincronizados. Cierra sesión y vuelve a entrar.`, 'success');
  }catch(e){
    showToast('❌ '+(e.details||e.message||String(e)), 'error');
  }
}

// ── Migrar documentos de email-ID a UID-ID (una sola vez) ───────
async function migrateUsers(){
  if(!confirm('⚠️ MIGRACIÓN: Esto crea nuevos documentos con UID como ID y elimina los que usan email como ID.\n\nEsta acción es irreversible. ¿Continuar?')) return;
  try{
    showToast('⏳ Migrando documentos...', 'info');
    const result = await functions.httpsCallable('migrateUsersToUID')({});
    const {migrated, total, results} = result.data;
    const errors = results.filter(r=>r.error);
    showToast(`✅ ${migrated}/${total} usuarios migrados a UID. ${errors.length ? errors.length+' errores.' : 'Sin errores.'} Cierra sesión y vuelve a entrar.`, 'success');
    console.log('[migrate] Resultados:', results);
    if(migrated > 0) setTimeout(()=>loadUsers(), 1500);
  }catch(e){
    showToast('❌ '+(e.details||e.message||String(e)), 'error');
  }
}



async function loadUsers(){
  const c=document.getElementById('tab-content');
  try{
    const snap=await db.collection('users').get();
    if(snap.empty){c.innerHTML='<div class="empty">Sin usuarios registrados.</div>';return;}
    let docs=[];snap.forEach(d=>docs.push({id:d.id,...d.data()}));
    docs.sort((a,b)=>(a.nombre||a.name||'').localeCompare(b.nombre||b.name||'','es'));
    let rows='';
    docs.forEach(d=>{
      const u=d,id=d.id;
      const rolClass=isViewerRole(u.rol||u.role)?'p-admin':'p-conductor';
      const rolLabel=sanitize(u.rol||u.role||'conductor');
      const estClass=u.estado==='Activo'?'p-activo':'p-inactivo';
      const nombre_completo = u.nombre_completo || ((u.nombre||'') + ' ' + (u.apellido||'')).trim() || u.nombre || u.name || '—';
      rows+=`<tr><td><strong>${sanitize(nombre_completo)}</strong><br><small style="color:var(--text2)">${sanitize(u.correo_electronico||u.email||'—')}</small></td><td>${sanitize(u.rut||'—')}</td><td>${sanitize(u.area||'—')}</td><td><span class="pill ${rolClass}">${rolLabel}</span></td><td><span class="pill ${estClass}">${sanitize(u.estado||'Activo')}</span></td><td style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn-sm" onclick="editUser('${id}')">✏️ Editar</button><button class="btn-sm danger" onclick="deleteUser('${id}','${sanitize(nombre_completo)}')">🗑️ Eliminar</button></td></tr>`;
    });
    c.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Nombre / Correo</th><th>RUT</th><th>Área</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>${rows}</tbody></table></div><div style="margin-top:16px;padding:14px 16px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px"><div><div style="font-size:.85rem;font-weight:600;margin-bottom:2px">&#x1F510; Herramientas de Roles</div><div style="font-size:.75rem;color:var(--text2)">Sincroniza o migra los roles a UID para activar seguridad avanzada.</div></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn-sm" onclick="syncClaimsAll()" style="background:var(--primary);color:#fff;border-color:var(--primary)">&#x1F504; Sincronizar Roles</button><button class="btn-sm" onclick="migrateUsers()" style="background:#7C3AED;color:#fff;border-color:#7C3AED">&#x1F501; Migrar a UID</button></div></div>`;
  }catch(e){
    c.innerHTML=`<div class="empty">⚠️ Error: ${e.code==='permission-denied'?'Sin permisos. <a href=index.html style=color:var(--accent)>Cierra sesión y vuelve a entrar</a> para refrescar tu token.':sanitize(e.message)}</div>`;
  }
}

async function editUser(id){
  const d=await db.collection('users').doc(id).get();
  if(!d.exists)return;const u=d.data();
  document.getElementById('u-docid').value=id;
  document.getElementById('u-nombre').value=u.nombre||'';
  document.getElementById('u-apellido').value=u.apellido||'';
  document.getElementById('u-rut').value=u.rut||'';
  document.getElementById('u-area').value=u.area||'';
  document.getElementById('u-rol').value=(u.rol||u.role||'conductor').toLowerCase();
  document.getElementById('u-estado').value=u.estado||'Activo';
  document.getElementById('modal-user').classList.add('open');
}

async function saveUser(){
  const id=document.getElementById('u-docid').value;
  if(!id)return;
  try{
    const nombre = document.getElementById('u-nombre').value.trim();
    const apellido = document.getElementById('u-apellido').value.trim();
    const nombre_completo = (nombre + ' ' + apellido).trim();
    await db.collection('users').doc(id).update({
      nombre: nombre,
      apellido: apellido,
      nombre_completo: nombre_completo,
      rut:document.getElementById('u-rut').value.trim(),
      area:document.getElementById('u-area').value.trim(),
      rol:document.getElementById('u-rol').value,
      estado:document.getElementById('u-estado').value,
    });
    closeModal();showToast('✅ Usuario actualizado','success');loadUsers();
  }catch(e){showToast('Error: '+e.message,'error');}
}

function closeModal(){document.getElementById('modal-user').classList.remove('open');}

async function loadChecklists(){
  const cont = document.getElementById('tab-content');
  try{
    const snap = await db.collection('chequeo_operacional').get();
    if(snap.empty){cont.innerHTML='<div class="empty">Sin checklists registrados.</div>';return;}
    _allDocs = [];
    snap.forEach(d => _allDocs.push({id:d.id,...d.data()}));
    _allDocs.sort((a,b)=>(b.fecha_chequeo?.toMillis?.()??0)-(a.fecha_chequeo?.toMillis?.()??0));
    renderCurrentPage();
  }catch(e){
    cont.innerHTML='<div class="empty">Error: '+sanitize(e.message)+'</div>';
  }
}

function renderChecklistsPage(docs){
  const cont = document.getElementById('tab-content');
  let html = '';
  docs.forEach(r => {
    const obs=[
      r.chequeo_frenos&&r.chequeo_frenos!=='Check'?'Frenos: '+r.chequeo_frenos:'',
      !r.condicion_fisica?'Cond.fisica':'',
      !r.descanso_operador?'Descanso insuf.':'',
      r.medicamentos_chequeo?'Med: '+(r.medicamentos_detalle||'Si'):'',
    ].filter(Boolean).join(' | ')||'Sin observaciones';
    html += `<div class="ck-item">
      <div class="ck-top">
        <div><div class="ck-plate">&#x1F69B; ${sanitize(r.patente_chequeo||'-')}</div>
        <div class="ck-name">&#x1F464; ${sanitize(r.nombre_operador||'-')}</div></div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn-sm" onclick="downloadChecklist('${r.id}')">&#x2B07; PDF</button>
          <button class="btn-sm danger" onclick="deleteChecklist('${r.id}')">Eliminar</button>
        </div>
      </div>
      <div class="ck-date">Fecha: ${formatDate(r.fecha_chequeo)} | Comb: ${sanitize(r.nivel_combustible||'-')}</div>
      <div style="font-size:.75rem;color:var(--text2);margin-top:4px">${sanitize(obs)}</div>
    </div>`;
  });
  cont.innerHTML = html || '<div class="empty">Sin resultados.</div>';
}
let _originalViajesDocs = [];

async function loadViajes(){
  const c = document.getElementById('tab-content');
  c.innerHTML = '<div class="empty"><span class="spinner"></span> Cargando hojas de ruta...</div>';
  try {
    const snap = await db.collection('hojas_ruta').get();
    if(snap.empty){ c.innerHTML='<div class="empty">Sin viajes registrados en el historial de hojas de ruta.</div>'; return; }
    _allDocs = [];
    snap.forEach(d => _allDocs.push({id:d.id,...d.data()}));
    
    // Ordenar de más reciente a más antiguo
    _allDocs.sort((a,b) => {
      const da = a.created_at?.toMillis?.() || (a.fecha ? new Date(a.fecha).getTime() : 0);
      const db = b.created_at?.toMillis?.() || (b.fecha ? new Date(b.fecha).getTime() : 0);
      return db - da;
    });
    
    _originalViajesDocs = [..._allDocs];
    
    // Obtener lista única de conductores
    const condEmails = new Set();
    const condMap = {};
    _originalViajesDocs.forEach(d => {
      const email = d.conductor_email || d.correo_conductor || '';
      const name = d.conductor_nombre || d.nombre_conductor_viaje || email;
      if (email) {
        condEmails.add(email);
        condMap[email] = name;
      }
    });
    
    let condOptions = '';
    condEmails.forEach(email => {
      condOptions += `<option value="${sanitize(email)}">${sanitize(condMap[email])} (${sanitize(email)})</option>`;
    });
    
    c.innerHTML = `
      <div id="viajes-filter-bar" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
        <div style="flex:1;min-width:200px">
          <label style="display:block;font-size:0.7rem;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:600">Filtrar por Conductor</label>
          <select id="viajes-filter-conductor" class="field" style="padding:8px 12px;font-size:0.85rem;" onchange="applyViajesFilters()">
            <option value="">Todos los conductores</option>
            ${condOptions}
          </select>
        </div>
        <div style="flex:1;min-width:200px">
          <label style="display:block;font-size:0.7rem;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:600">Filtrar por Fecha</label>
          <input type="date" id="viajes-filter-fecha" class="field" style="padding:8px 12px;font-size:0.85rem;color:var(--text);background:var(--bg);" onchange="applyViajesFilters()"/>
        </div>
        <div style="display:flex;align-items:flex-end;margin-top:16px;">
          <button class="btn-sm" style="padding:8px 16px;border-radius:8px;font-weight:600;background:var(--surface2);border-color:var(--border);" onclick="clearViajesFilters()">Limpiar Filtros</button>
        </div>
      </div>
      <div id="viajes-table-container"></div>
    `;
    
    renderCurrentPage();
  } catch(e) {
    c.innerHTML='<div class="empty">Error: '+sanitize(e.message)+'</div>';
  }
}

function renderViajesPage(docs){
  const tableContainer = document.getElementById('viajes-table-container');
  if (!tableContainer) return;
  
  if (!docs.length) {
    tableContainer.innerHTML = '<div class="empty">Sin viajes coincidentes.</div>';
    return;
  }
  
  let rows = '';
  docs.forEach(r => {
    const km = r.km_recorridos || (r.km_final || 0) - (r.km_inicial || 0);
    const dateStr = r.fecha || (r.created_at ? formatDate(r.created_at) : '—');
    const entregasVal = r.total_entregas || (r.entregas || []).length || 0;
    const devVal = r.total_devoluciones || 0;
    
    const statusVal = r.estado || 'pendiente_revision';
    const isConf = statusVal === 'revisada' || statusVal === 'Conforme';
    const isPendState = statusVal === 'pendiente' || statusVal === 'pendiente_revision';
    const badgeClass = isConf ? 'p-activo' : (statusVal === 'observada' ? 'p-warn' : 'pill p-inactivo');
    const badgeTxt = isConf ? 'Revisada' : (statusVal === 'observada' ? 'Observada' : 'Pendiente');
    
    const comb = r.combustible || 0;
    const peajeVal = r.peaje || 0;
    const totalGasto = comb + peajeVal;
    
    rows += `<tr>
      <td><strong>${sanitize(r.conductor_nombre || r.conductor_email || '—')}</strong><br><small style="color:var(--text2)">📅 ${dateStr}</small></td>
      <td><strong>${sanitize(r.patente || '—')}</strong></td>
      <td>${sanitize(r.distribuidor || '—')}</td>
      <td>${km} km</td>
      <td>${entregasVal} ent. / ${devVal} dev.</td>
      <td>$${totalGasto.toLocaleString('es-CL')}</td>
      <td><span class="pill ${badgeClass}">${badgeTxt}</span></td>
      <td>
        <div style="display:flex;gap:4px">
          <button class="btn-sm" style="background:var(--primary);color:#fff;border-color:var(--primary)" onclick="editViajeStatusModal('${r.id}', '${statusVal}')">✏️</button>
          <button class="btn-sm danger" onclick="deleteViaje('${r.id}')">🗑️</button>
        </div>
      </td>
    </tr>`;
  });
  tableContainer.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Conductor / Fecha</th><th>Patente</th><th>Distribuidor</th><th>Km</th><th>Entregas</th><th>Gastos Ruta</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function applyViajesFilters() {
  const condVal = document.getElementById('viajes-filter-conductor').value;
  const fechaVal = document.getElementById('viajes-filter-fecha').value;
  
  let filtered = [..._originalViajesDocs];
  
  if (condVal) {
    filtered = filtered.filter(d => (d.conductor_email || d.correo_conductor || '').toLowerCase() === condVal.toLowerCase());
  }
  
  if (fechaVal) {
    filtered = filtered.filter(d => d.fecha === fechaVal);
  }
  
  _allDocs = filtered;
  _curPage = 0;
  renderCurrentPage();
}

function clearViajesFilters() {
  document.getElementById('viajes-filter-conductor').value = '';
  document.getElementById('viajes-filter-fecha').value = '';
  _allDocs = [..._originalViajesDocs];
  _curPage = 0;
  renderCurrentPage();
}

async function editViajeStatusModal(id, currentStatus) {
  const newStatus = prompt("Modificar estado de la hoja de ruta. Ingrese:\\n1 - Para 'revisada' (Conforme)\\n2 - Para 'observada' (Con Observaciones)\\n3 - Para 'pendiente_revision' (Pendiente)", 
    currentStatus === 'revisada' ? '1' : (currentStatus === 'observada' ? '2' : '3')
  );
  if (newStatus === null) return;
  
  let statusStr = '';
  if (newStatus === '1') statusStr = 'revisada';
  else if (newStatus === '2') statusStr = 'observada';
  else if (newStatus === '3') statusStr = 'pendiente_revision';
  else {
    showToast("Opción inválida", "error");
    return;
  }
  
  try {
    await db.collection('hojas_ruta').doc(id).update({ estado: statusStr });
    showToast("✅ Estado de viaje actualizado", "success");
    loadViajes();
  } catch(e) {
    showToast("Error al actualizar: " + e.message, "error");
  }
}

// ── Eliminar registros ──────────────────────────────────────────
async function deleteUser(id, nombre){
  if(!confirm(`¿Eliminar usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try{
    await db.collection('users').doc(id).delete();
    showToast('🗑️ Usuario eliminado','success'); loadUsers();
  }catch(e){showToast('Error: '+e.message,'error');}
}
async function deleteChecklist(id){
  if(!confirm('¿Eliminar este checklist? Esta acción no se puede deshacer.')) return;
  try{
    await db.collection('chequeo_operacional').doc(id).delete();
    showToast('Checklist eliminado','success'); loadChecklists();
  }catch(e){showToast('Error: '+e.message,'error');}
}
async function deleteViaje(id){
  if(!confirm('¿Eliminar este viaje? Esta acción no se puede deshacer.')) return;
  try{
    const batch = db.batch();
    
    // 1. Eliminar de hojas_ruta
    batch.delete(db.collection('hojas_ruta').doc(id));
    
    // 2. Buscar y eliminar despachos asociados por turno_id
    const dSnap = await db.collection('despachos').where('turno_id', '==', id).get();
    dSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 3. Buscar y eliminar gastos_ruta asociados por turno_id
    const gSnap = await db.collection('gastos_ruta').where('turno_id', '==', id).get();
    gSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    showToast('Viaje y todos sus documentos asociados eliminados con éxito','success');
    loadViajes();
  }catch(e){showToast('Error: '+e.message,'error');}
}

// ── Descargar Checklist como PDF ────────────────────────────────
function downloadChecklist(id){
  const r = _allDocs.find(d => d.id === id);
  if(!r){ showToast('Registro no encontrado.','error'); return; }
  generateChecklistPDF(r);
}

// ── Notificaciones de Checklists ────────────────────────────────
async function loadNotificaciones(){
  const c=document.getElementById('tab-content');
  try {
    const snap=await db.collection('notificaciones').get();
    let docs=[];
    snap.forEach(d=>{
      const data = d.data();
      if (data.tipo === 'checklist' || data.tipo === 'tarea_completada') {
        docs.push({id:d.id, ...data});
      }
    });

    if(!docs.length){c.innerHTML='<div class="empty">Sin notificaciones.</div>';return;}
    docs.sort((a,b)=>(b.fecha?.toMillis?.()??0)-(a.fecha?.toMillis?.()??0));
    c.innerHTML='';
    docs.forEach(n=>{
      const icon = n.tipo === 'checklist' ? '📋' : '✅';
      c.innerHTML+=`<div class="ck-item" style="${n.leida?'opacity:.6':''}">
        <div class="ck-top">
          <div>
            <div class="ck-plate">${n.leida?'':'🔴 '} ${icon} ${sanitize(n.mensaje||'Notificación')}</div>
            <div class="ck-name">👤 ${sanitize(n.nombre_operador||n.operador||'—')}${n.patente ? ` · 🚛 ${sanitize(n.patente)}` : ''}</div>
          </div>
          <div style="display:flex;gap:6px">
            ${!n.leida?`<button class="btn-sm" onclick="marcarLeida('${n.id}')">✅ Leída</button>`:'<span class="pill p-activo" style="font-size:.68rem">Leída</span>'}
            <button class="btn-sm danger" onclick="deleteNotif('${n.id}')">🗑️</button>
          </div>
        </div>
        <div class="ck-date">📅 ${formatDate(n.fecha)}</div>
      </div>`;
    });
  } catch(e) {
    c.innerHTML='<div class="empty">Error: '+sanitize(e.message)+'</div>';
  }
}
async function marcarLeida(id){
  await db.collection('notificaciones').doc(id).update({leida:true});
  loadNotificaciones(); loadStats();
}
async function deleteNotif(id){
  await db.collection('notificaciones').doc(id).delete();
  loadNotificaciones(); loadStats();
}

// ── KM Discrepancias ───────────────────────────────────────────
async function loadDiscrepancias() {
  const cont = document.getElementById('tab-content');
  try {
    const snap = await db.collection('km_discrepancias').get();
    if(snap.empty) {
      cont.innerHTML = '<div class="empty">Sin discrepancias de KM registradas.</div>';
      _allDocs = [];
      updatePagination();
      return;
    }
    _allDocs = [];
    snap.forEach(d => _allDocs.push({id: d.id, ...d.data()}));
    _allDocs.sort((a,b) => (b.fecha?.toMillis?.()??0)-(a.fecha?.toMillis?.()??0));
    renderCurrentPage();
  } catch(e) {
    cont.innerHTML = '<div class="empty">Error: ' + sanitize(e.message) + '</div>';
  }
}

function renderDiscrepanciasPage(docs) {
  const cont = document.getElementById('tab-content');
  let html = '';
  docs.forEach(r => {
    // Normalizar ambas variantes del estado pendiente
    const isPend = r.estado === 'pendiente' || r.estado === 'pendiente_revision' || !r.estado;
    const badgeClass = isPend ? 'p-inactivo' : 'p-activo';
    const estadoLabel = isPend ? 'Pendiente' : sanitize(r.estado);
    const diffKm = r.diferencia_km || 0;
    const diffSign = diffKm > 0 ? `+${diffKm}` : `${diffKm}`;
    const diffColor = diffKm > 0 ? 'var(--warning)' : 'var(--danger)';
    
    html += `
      <div class="ck-item" style="${!isPend ? 'opacity:.8' : ''}">
        <div class="ck-top">
          <div>
            <div class="ck-plate">🚛 ${sanitize(r.patente || '—')} <span class="pill ${badgeClass}" style="margin-left:8px;font-size:0.65rem">${estadoLabel}</span></div>
            <div class="ck-name">👤 Conductor: <strong>${sanitize(r.conductor_nombre || '—')}</strong> (${sanitize(r.conductor_email || '—')})</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${isPend ? `<button class="btn-sm" style="background:var(--primary);color:#fff;border-color:var(--primary)" onclick="resolverDiscrepanciaModal('${r.id}')">⚖️ Resolver</button>` : ''}
            <button class="btn-sm danger" onclick="deleteDiscrepancia('${r.id}')">🗑️</button>
          </div>
        </div>
        <div style="font-size: 0.8rem; margin: 8px 0; background: var(--bg); border: 1px solid var(--border); border-radius: 8px; padding: 10px;">
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <span>KM Inicial Nuevo: <strong>${(r.km_inicial_nuevo || 0).toLocaleString('es-CL')} km</strong></span>
            <span>KM Final Anterior: <strong>${(r.km_final_anterior || 0).toLocaleString('es-CL')} km</strong></span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text2);">
            <span>Turno Nuevo: <small>${sanitize(r.turno_nuevo_id || '—')}</small></span>
            <span>Cerrado por: <small>${sanitize(r.conductor_anterior || '—')}</small></span>
          </div>
          <div style="margin-top:8px; border-top:1px dashed var(--border); padding-top:6px; font-weight:600; display:flex; justify-content:space-between;">
            <span>Diferencia Detectada:</span>
            <span style="color:${diffColor}">${diffSign} km (${sanitize(r.tipo || 'exceso')})</span>
          </div>
        </div>
        <div class="ck-date">Fecha Detección: ${formatDate(r.fecha)}</div>
        ${r.justificacion ? `<div style="font-size:.75rem;color:var(--success);margin-top:6px;background:rgba(16,185,129,0.05);padding:6px;border-radius:4px;border:1px solid rgba(16,185,129,0.1)">💬 <strong>Justificación:</strong> ${sanitize(r.justificacion)} <small style="color:var(--text2)">(${sanitize(r.revisado_por || 'admin')})</small></div>` : ''}
      </div>`;
  });
  cont.innerHTML = html || '<div class="empty">Sin resultados.</div>';
}

async function resolverDiscrepanciaModal(id) {
  const justificacion = prompt("Ingrese la justificación o comentario para resolver esta discrepancia:");
  if (justificacion === null) return; // cancelado
  if (!justificacion.trim()) {
    showToast("Debe ingresar una justificación", "error");
    return;
  }
  
  try {
    await db.collection('km_discrepancias').doc(id).update({
      estado: 'revisada',
      justificacion: justificacion.trim(),
      revisado_por: _email || 'admin'
    });
    showToast("✅ Discrepancia resuelta", "success");
    loadDiscrepancias();
    loadStats();
  } catch(e) {
    showToast("Error al resolver: " + e.message, "error");
  }
}

async function deleteDiscrepancia(id) {
  if (!confirm("¿Desea eliminar este registro de discrepancia?")) return;
  try {
    await db.collection('km_discrepancias').doc(id).delete();
    showToast("🗑️ Registro eliminado", "success");
    loadDiscrepancias();
    loadStats();
  } catch(e) {
    showToast("Error al eliminar: " + e.message, "error");
  }
}

// ── Configuración de Logística Inversa por Distribuidor ─────────
async function loadInversaConfig() {
  const c = document.getElementById('tab-content');
  c.innerHTML = '<div class="empty"><span class="spinner"></span> Cargando configuración...</div>';
  try {
    const snap = await db.collection('config_inversa').get();
    let docs = [];
    snap.forEach(d => docs.push({id:d.id, ...d.data()}));
    
    // Seed default if empty
    if (docs.length === 0) {
      await db.collection('config_inversa').add({
        nombre: 'Distribuidor TOTAL',
        activo: true,
        creado_por: _uid || '',
        fecha: firebase.firestore.FieldValue.serverTimestamp()
      });
      const snap2 = await db.collection('config_inversa').get();
      docs = [];
      snap2.forEach(d => docs.push({id:d.id, ...d.data()}));
    }
    
    let listHtml = `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px">
        <h3 style="font-size:1rem;color:var(--accent);margin-bottom:10px">🔄 Configuración de Logística Inversa</h3>
        <p style="font-size:.82rem;color:var(--text2);margin-bottom:16px">
          Determina qué distribuidores ingresarán mercadería a bodega en caso de devolución. El sistema predefinido habilita <b>Distribuidor TOTAL</b> por defecto.
        </p>
        <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
          <input type="text" id="new-dist-inversa" class="field" placeholder="Nombre del Distribuidor (Ej: Falabella)" style="max-width:320px"/>
          <button class="btn-sm" style="background:var(--primary);color:#fff;border-color:var(--primary);padding:10px 18px;font-weight:600;border-radius:8px" onclick="agregarDistribuidorInversa()">➕ Asignar Distribuidor</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Distribuidor</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
    `;
    
    docs.sort((a,b) => (a.nombre||'').localeCompare(b.nombre||'','es'));
    docs.forEach(d => {
      const isDefault = (d.nombre || '').trim().toUpperCase() === 'DISTRIBUIDOR TOTAL';
      const statusLabel = d.activo ? 'Habilitado' : 'Deshabilitado';
      const statusClass = d.activo ? 'p-activo' : 'p-inactivo';
      
      listHtml += `
        <tr>
          <td><strong>${sanitize(d.nombre || '')}</strong></td>
          <td><span class="pill ${statusClass}">${statusLabel}</span></td>
          <td>
            ${isDefault ? `<small style="color:var(--text2)">Predefinido por el sistema (Activo)</small>` : `
              <button class="btn-sm" onclick="toggleDistribuidorInversa('${d.id}', ${!d.activo})">
                ${d.activo ? 'Deshabilitar' : 'Habilitar'}
              </button>
              <button class="btn-sm danger" onclick="eliminarDistribuidorInversa('${d.id}')" style="margin-left:6px">🗑️ Eliminar</button>
            `}
          </td>
        </tr>
      `;
    });
    
    listHtml += `
            </tbody>
          </table>
        </div>
      </div>
    `;
    c.innerHTML = listHtml;
  } catch (e) {
    c.innerHTML = `<div class="empty">⚠️ Error: ${sanitize(e.message)}</div>`;
  }
}

async function agregarDistribuidorInversa() {
  const input = document.getElementById('new-dist-inversa');
  const nombre = input.value.trim();
  if (!nombre) { showToast('Ingresa el nombre del distribuidor', 'error'); return; }
  try {
    // Case-insensitive check
    const query = await db.collection('config_inversa').get();
    let exists = false;
    query.forEach(d => {
      if ((d.data().nombre || '').trim().toUpperCase() === nombre.toUpperCase()) exists = true;
    });
    if (exists) { showToast('Este distribuidor ya está configurado', 'error'); return; }
    
    await db.collection('config_inversa').add({
      nombre: nombre,
      activo: true,
      creado_por: _uid || '',
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('✅ Distribuidor asignado a logística inversa', 'success');
    input.value = '';
    loadInversaConfig();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function toggleDistribuidorInversa(id, active) {
  try {
    await db.collection('config_inversa').doc(id).update({ activo: active });
    showToast('✅ Estado del distribuidor actualizado', 'success');
    loadInversaConfig();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function eliminarDistribuidorInversa(id) {
  if (!confirm('¿Eliminar este distribuidor de la configuración de logística inversa?')) return;
  try {
    await db.collection('config_inversa').doc(id).delete();
    showToast('🗑️ Distribuidor eliminado de la configuración', 'success');
    loadInversaConfig();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════════════
// DASHBOARD EJECUTIVO
// ═══════════════════════════════════════════════════════════════
let _execDays = 7;

function setExecPeriod(days, el) {
  _execDays = days;
  document.querySelectorAll('.period-bar .period-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  loadExecDashboard();
}

async function loadExecDashboard(){
  try{
    const now = new Date();
    const cutoff = new Date();
    cutoff.setDate(now.getDate() - 30);
    const cutoffTS = firebase.firestore.Timestamp.fromDate(cutoff);

    const [tS,dS,gS,iS,mS,fS] = await Promise.all([
      db.collection('turnos').where('fecha', '>=', cutoffTS).get(),
      db.collection('despachos').where('fecha', '>=', cutoffTS).get(),
      db.collection('gastos_ruta').where('fecha', '>=', cutoffTS).get(),
      db.collection('inventory').get(),
      db.collection('movimientos_bodega').where('fecha', '>=', cutoffTS).get(),
      db.collection('prefacturas').get()
    ]);
    const turnos=[],despachos=[],gastos=[],invItems=[],movBodega=[],facturas=[];
    // now and cutoff already declared above
    tS.forEach(d=>{const t=d.data();t._id=d.id;t._date=t.fecha?.toDate?t.fecha.toDate():null;turnos.push(t);});
    dS.forEach(d=>{
      const dp=d.data();
      dp._date=dp.pod_timestamp?.toDate?dp.pod_timestamp.toDate():(dp.fecha?.toDate?dp.fecha.toDate():null);
      const t = turnos.find(x => x._id === dp.turno_id);
      if(t){
        dp.patente=t.patente||'N/A';
        dp.conductor_nombre=t.conductor_nombre||t.conductor_email||'—';
      } else {
        dp.patente=dp.patente||'N/A';
        dp.conductor_nombre=dp.conductor_nombre||dp.conductor_email||'—';
      }
      despachos.push(dp);
    });
    gS.forEach(d=>{const g=d.data();g._date=g.fecha?.toDate?g.fecha.toDate():null;gastos.push(g);});
    iS.forEach(d=>invItems.push(d.data()));
    mS.forEach(d=>{const m=d.data();m._date=m.fecha?.toDate?m.fecha.toDate():null;movBodega.push(m);});
    fS.forEach(d=>facturas.push(d.data()));

    // Filter dynamic selected period using cutoffPeriod
    const cutoffPeriod = new Date();
    cutoffPeriod.setDate(now.getDate() - _execDays);

    const t30=turnos.filter(t=>t._date&&t._date>=cutoffPeriod);
    const d30=despachos.filter(d=>d._date&&d._date>=cutoffPeriod);
    const g30=gastos.filter(g=>g._date&&g._date>=cutoffPeriod);
    const m30=movBodega.filter(m=>m._date&&m._date>=cutoffPeriod);
    const entregados=d30.filter(d=>d.estado==='entregado');
    const devueltos=d30.filter(d=>d.estado==='devuelto');
    const totalGastos=g30.reduce((s,g)=>s+(g.monto_clp||0),0);
    const otifRes=calculateOTIF(t30,d30);
    const otif=otifRes.pct;
    const totFact=facturas.reduce((s,f)=>s+(f.total||0),0);

    // ── KPIs ──
    document.getElementById('exec-kpis').innerHTML=[
      {icon:'🚛',val:t30.length,lbl:`Turnos (${_execDays}d)`,cls:''},
      {icon:'📦',val:entregados.length,lbl:`Entregas (${_execDays}d)`,cls:'color:var(--success)'},
      {icon:'📊',val:otif+'%',lbl:`OTIF (${_execDays}d)`,cls:otif>=80?'color:var(--success)':otif>=60?'color:var(--warning)':'color:var(--danger)'},
      {icon:'💰',val:'$'+(totalGastos/1000).toFixed(0)+'k',lbl:`Gastos Ruta (${_execDays}d)`,cls:'color:var(--danger)'},
      {icon:'📄',val:'$'+(totFact/1000).toFixed(0)+'k',lbl:'Facturado',cls:'color:var(--success)'}
    ].map(k=>`<div class="kpi-mini"><div style="font-size:1rem">${k.icon}</div><div class="km-val" style="${k.cls}">${k.val}</div><div class="km-lbl">${k.lbl}</div></div>`).join('');

    // ── Entregas vs Devoluciones por día ──
    renderMiniBar('ex-entregas',d30,_execDays,d=>d.estado==='entregado'?'#10B981':'#EF4444');

    // ── Gastos por día ──
    renderMiniBarMoney('ex-gastos',g30,_execDays);

    // ── OTIF por vehículo ──
    const turnosByVeh={};
    t30.forEach(t=>{
      const v=t.patente||'N/A';
      if(!turnosByVeh[v])turnosByVeh[v]=[];
      turnosByVeh[v].push(t);
    });
    const despachosByVeh={};
    d30.forEach(d=>{
      const v=d.patente||'N/A';
      if(!despachosByVeh[v])despachosByVeh[v]=[];
      despachosByVeh[v].push(d);
    });
    const vehiclesList=Array.from(new Set([...Object.keys(turnosByVeh),...Object.keys(despachosByVeh)]));
    const vehResults=[];
    vehiclesList.forEach(v=>{
      const vTurnos=turnosByVeh[v]||[];
      const vDespachos=despachosByVeh[v]||[];
      const otifResVeh=calculateOTIF(vTurnos,vDespachos);
      if(otifResVeh.total>0){
        vehResults.push({vehicle:v,...otifResVeh});
      }
    });
    vehResults.sort((a,b)=>b.total-a.total).slice(0,6);
    document.getElementById('ex-otif').innerHTML=vehResults.length?vehResults.map(r=>{
      const pct=r.pct;
      const color=pct>=90?'var(--success)':pct>=70?'var(--warning)':'var(--danger)';
      return`<div class="prog-row"><div class="prog-row-top"><span><code style="color:var(--accent)">${sanitize(r.vehicle)}</code> <span style="font-size:.7rem;color:var(--text2)">${r.count}/${r.total} viajes</span></span><span style="font-weight:700;color:${color}">${pct}%</span></div><div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div></div>`;
    }).join(''):'<div class="empty">Sin datos</div>';

    // ── Inventario por estado ──
    const invByStatus={};
    invItems.forEach(i=>{const s=i.status||'disponible';invByStatus[s]=(invByStatus[s]||0)+(i.qty||i.cantidad||0);});
    const invColors={disponible:'#10B981',en_transito:'#3B82F6',reservado:'#F59E0B',dañado:'#EF4444'};
    const invLabels={disponible:'Disponible',en_transito:'En Tránsito',reservado:'Reservado',dañado:'Dañado'};
    const invTotal=Object.values(invByStatus).reduce((s,v)=>s+v,0)||1;
    const lowStock=invItems.filter(i=>(i.stock_minimo||0)>0&&(i.qty||i.cantidad||0)<=(i.stock_minimo||0)).length;
    document.getElementById('ex-inv').innerHTML=`
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">${Object.entries(invByStatus).map(([s,c])=>{
          const pct=Math.round(c/invTotal*100);
          return`<div class="prog-row"><div class="prog-row-top"><span>${invLabels[s]||s}</span><span style="font-weight:700">${c} uds (${pct}%)</span></div><div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${invColors[s]||'#8A9DC0'}"></div></div></div>`;
        }).join('')}</div>
        <div style="text-align:center">
          <div style="font-size:2rem;font-weight:800">${invItems.length}</div>
          <div style="font-size:.68rem;color:var(--text2)">PRODUCTOS</div>
          ${lowStock?`<div style="margin-top:6px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:8px;padding:4px 10px;font-size:.72rem;color:#FCA5A5">⚠️ ${lowStock} bajo stock</div>`:''}
        </div>
      </div>`;

    // ── Bodega movimientos ──
    const mByType={};
    movBodega.forEach(m=>{const t=(m.tipo_movimiento||m.tipo||'otro');mByType[t]=(mByType[t]||0)+(m.cantidad||1);});
    const mColors={ingreso:'#10B981',salida:'#3B82F6',merma:'#EF4444',devolucion:'#F59E0B',ajuste:'#8B5CF6'};
    const mEntries=Object.entries(mByType).sort((a,b)=>b[1]-a[1]);
    const mMax=Math.max(...mEntries.map(([,v])=>v),1);
    document.getElementById('ex-bodega').innerHTML=mEntries.length?mEntries.map(([t,c])=>{
      const h=Math.max((c/mMax)*80,4);
      return`<div class="mini-bar-col"><div class="mini-bar-val">${c}</div><div class="mini-bar" style="height:${h}px;background:${mColors[t]||'#8A9DC0'}"></div><div class="mini-bar-lbl">${sanitize(t)}</div></div>`;
    }).join(''):'<div class="empty">Sin datos</div>';

    // ── Finanzas ──
    const fPagado=facturas.filter(f=>f.estado==='pagada').reduce((s,f)=>s+(f.total||0),0);
    const fPendiente=facturas.filter(f=>f.estado!=='pagada').reduce((s,f)=>s+(f.total||0),0);
    const fBorrador=facturas.filter(f=>f.estado==='borrador').length;
    const fEnviada=facturas.filter(f=>f.estado==='enviada').length;
    const fPaga=facturas.filter(f=>f.estado==='pagada').length;
    document.getElementById('ex-finanzas').innerHTML=`
      <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
        <div style="flex:1;min-width:180px">
          <div class="prog-row"><div class="prog-row-top"><span style="color:var(--success)">✅ Pagado</span><span class="money" style="color:var(--success)">$${(fPagado/1000).toFixed(0)}k</span></div><div class="prog-track"><div class="prog-fill" style="width:${totFact?Math.round(fPagado/totFact*100):0}%;background:var(--success)"></div></div></div>
          <div class="prog-row"><div class="prog-row-top"><span style="color:var(--warning)">⏳ Pendiente</span><span class="money" style="color:var(--warning)">$${(fPendiente/1000).toFixed(0)}k</span></div><div class="prog-track"><div class="prog-fill" style="width:${totFact?Math.round(fPendiente/totFact*100):0}%;background:var(--warning)"></div></div></div>
        </div>
        <div style="text-align:center">
          <div style="display:flex;gap:10px">
            <div><span style="font-size:1.2rem;font-weight:800;color:var(--text2)">${fBorrador}</span><div style="font-size:.6rem;color:var(--text2)">Borrador</div></div>
            <div><span style="font-size:1.2rem;font-weight:800;color:#60A5FA">${fEnviada}</span><div style="font-size:.6rem;color:var(--text2)">Enviada</div></div>
            <div><span style="font-size:1.2rem;font-weight:800;color:var(--success)">${fPaga}</span><div style="font-size:.6rem;color:var(--text2)">Pagada</div></div>
          </div>
        </div>
      </div>`;

    // ── Ranking conductores ──
    const turnosByDriver={};
    t30.forEach(t=>{
      const name=t.conductor_nombre||t.conductor_email||'—';
      if(!turnosByDriver[name])turnosByDriver[name]=[];
      turnosByDriver[name].push(t);
    });
    const despachosByDriver={};
    d30.forEach(d=>{
      const name=d.conductor_nombre||d.conductor_email||'—';
      if(!despachosByDriver[name])despachosByDriver[name]=[];
      despachosByDriver[name].push(d);
    });
    const byDriver={};
    d30.filter(d=>d.estado==='entregado').forEach(d=>{const n=d.conductor_nombre||d.conductor_email||'—';if(!byDriver[n])byDriver[n]={entregas:0,devoluciones:0};byDriver[n].entregas++;});
    d30.filter(d=>d.estado==='devuelto').forEach(d=>{const n=d.conductor_nombre||d.conductor_email||'—';if(!byDriver[n])byDriver[n]={entregas:0,devoluciones:0};byDriver[n].devoluciones++;});
    const ranked=Object.entries(byDriver).sort((a,b)=>b[1].entregas-a[1].entregas).slice(0,5);
    const rankColors=['linear-gradient(135deg,#F59E0B,#D97706)','rgba(148,163,184,.3)','rgba(180,83,9,.3)','var(--surface)','var(--surface)'];
    const rankTextColors=['#fff','#CBD5E1','#FBBF24','var(--text2)','var(--text2)'];
    document.getElementById('ex-ranking').innerHTML=ranked.length?ranked.map(([name,d],i)=>{
      const driverTurnos=turnosByDriver[name]||[];
      const driverDespachos=despachosByDriver[name]||[];
      const otifResDriver=calculateOTIF(driverTurnos,driverDespachos);
      const pct=otifResDriver.pct;
      return`<div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:6px">
        <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:800;background:${rankColors[i]};color:${rankTextColors[i]};flex-shrink:0">${i+1}</div>
        <div style="flex:1;min-width:0"><div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sanitize(name.split(' ').slice(0,2).join(' '))}</div><div style="font-size:.7rem;color:var(--text2)">${d.entregas} entregas · ${d.devoluciones} devol. · ${pct}% OTIF (${otifResDriver.count}/${otifResDriver.total} viajes)</div></div>
        <div style="font-weight:800;font-size:1rem;color:var(--success)">${d.entregas}</div>
      </div>`;
    }).join(''):'<div class="empty">Sin datos de entregas</div>';

  }catch(e){console.warn('Exec dashboard error:',e);}
}

function renderMiniBar(containerId,items,days,colorFn){
  const c=document.getElementById(containerId);
  const buckets=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);d.setHours(0,0,0,0);
    const next=new Date(d);next.setDate(next.getDate()+1);
    const dayItems=items.filter(x=>x._date&&x._date>=d&&x._date<next);
    const ok=dayItems.filter(x=>x.estado==='entregado').length;
    const fail=dayItems.filter(x=>x.estado==='devuelto').length;
    buckets.push({label:d.toLocaleDateString('es-CL',{day:'2-digit',month:'short'}),ok,fail,total:ok+fail});
  }
  const max=Math.max(...buckets.map(b=>b.total),1);
  c.innerHTML=buckets.map(b=>{
    const hOk=Math.max((b.ok/max)*80,0);
    const hFail=Math.max((b.fail/max)*80,0);
    return`<div class="mini-bar-col"><div class="mini-bar-val">${b.total||''}</div><div style="display:flex;flex-direction:column;width:100%;gap:1px"><div class="mini-bar" style="height:${hFail}px;background:#EF4444"></div><div class="mini-bar" style="height:${hOk}px;background:#10B981;border-radius:0 0 0 0"></div></div><div class="mini-bar-lbl">${b.label}</div></div>`;
  }).join('');
}

function renderMiniBarMoney(containerId,items,days){
  const c=document.getElementById(containerId);
  const buckets=[];
  for(let i=days-1;i>=0;i--){
    const d=new Date();d.setDate(d.getDate()-i);d.setHours(0,0,0,0);
    const next=new Date(d);next.setDate(next.getDate()+1);
    const total=items.filter(x=>x._date&&x._date>=d&&x._date<next).reduce((s,g)=>s+(g.monto_clp||0),0);
    buckets.push({label:d.toLocaleDateString('es-CL',{day:'2-digit',month:'short'}),value:total});
  }
  const max=Math.max(...buckets.map(b=>b.value),1);
  c.innerHTML=buckets.map(b=>{
    const h=Math.max((b.value/max)*80,b.value?2:0);
    return`<div class="mini-bar-col"><div class="mini-bar-val">${b.value?'$'+(b.value/1000).toFixed(0)+'k':''}</div><div class="mini-bar" style="height:${h}px;background:var(--accent)"></div><div class="mini-bar-lbl">${b.label}</div></div>`;
  }).join('');
}

async function loadDespachosAdmin(){
  const c = document.getElementById('tab-content');
  try {
    const snap = await db.collection('despachos').get();
    if(snap.empty){ c.innerHTML='<div class="empty">Sin despachos registrados.</div>'; return; }
    _allDocs = [];
    snap.forEach(d => _allDocs.push({id:d.id,...d.data()}));
    
    // Sort by date (descending)
    _allDocs.sort((a,b) => {
      const da = a.fecha?.toMillis?.() || (a.fecha ? new Date(a.fecha).getTime() : 0);
      const db = b.fecha?.toMillis?.() || (b.fecha ? new Date(b.fecha).getTime() : 0);
      return db - da;
    });
    
    renderCurrentPage();
  } catch(e) {
    c.innerHTML='<div class="empty">Error: '+sanitize(e.message)+'</div>';
  }
}

function renderDespachosPage(docs) {
  const c = document.getElementById('tab-content');
  let rows = '';
  docs.forEach(r => {
    const fecha = formatDate(r.fecha);
    const conductor = sanitize(r.conductor_email || '—');
    const distribuidor = sanitize(r.distribuidor || '—');
    const cliente = sanitize(r.cliente_nombre || '—');
    const guia = sanitize(r.guia_numero || '—');
    const estado = r.estado || 'pendiente';
    
    const badgeCls = {'pendiente':'p-inactivo','entregado':'p-activo','devuelto':'p-inactivo'}[estado]||'p-inactivo';
    const badgeTxt = {'pendiente':'⏳ Pendiente','entregado':'🟢 Entregado','devuelto':'🔴 Devuelto'}[estado]||estado;
    
    let photoUrl = '';
    if(estado === 'entregado') photoUrl = r.pod_foto_url || '';
    else if(estado === 'devuelto') photoUrl = r.devolucion_foto_url || '';
    
    let action = '—';
    if(photoUrl && photoUrl.startsWith('http')) {
      action = `
        <div style="display:flex;gap:4px">
          <button class="btn-sm" onclick="window.open('${photoUrl}', '_blank')">👁️ Ver</button>
          <a class="btn-sm" style="text-decoration:none;background:var(--accent);color:#fff;border-color:var(--accent);padding:4px 8px;border-radius:4px" href="${photoUrl}" target="_blank" download="foto_${r.id}.jpg">⬇️ Descargar</a>
        </div>
      `;
    } else if (photoUrl) {
      action = `<span style="font-size:.7rem;color:var(--text2)">${sanitize(photoUrl)}</span>`;
    }
    
    rows += `<tr>
      <td>${fecha}</td>
      <td>${conductor}</td>
      <td>${distribuidor}</td>
      <td>${cliente}</td>
      <td>${guia}</td>
      <td><span class="pill ${badgeCls}">${badgeTxt}</span></td>
      <td>${action}</td>
    </tr>`;
  });
  
  c.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Conductor</th><th>Distribuidor</th><th>Cliente</th><th>Documento</th><th>Estado</th><th>Foto (POD / Dev)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

async function cleanOldDespachoPhotos() {
  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cutoffTS = firebase.firestore.Timestamp.fromDate(cutoff);
    
    const snap = await db.collection('despachos').where('fecha', '<', cutoffTS).get();
    let count = 0;
    
    for (const doc of snap.docs) {
      const d = doc.data();
      let updated = false;
      const updateData = {};
      
      if (d.pod_foto_url && d.pod_foto_url.startsWith('http') && !d.pod_foto_url.includes('Eliminado')) {
        try {
          const ref = storage.refFromURL(d.pod_foto_url);
          await ref.delete();
        } catch(se) {
          console.warn("Storage delete failed for POD photo:", se.message);
        }
        updateData.pod_foto_url = "Eliminado por antigüedad (+24 horas)";
        updated = true;
      }
      
      if (d.devolucion_foto_url && d.devolucion_foto_url.startsWith('http') && !d.devolucion_foto_url.includes('Eliminado')) {
        try {
          const ref = storage.refFromURL(d.devolucion_foto_url);
          await ref.delete();
        } catch(se) {
          console.warn("Storage delete failed for Dev photo:", se.message);
        }
        updateData.devolucion_foto_url = "Eliminado por antigüedad (+24 horas)";
        updated = true;
      }
      
      if (updated) {
        await db.collection('despachos').doc(doc.id).update(updateData);
        count++;
      }
    }
    
    if (count > 0) {
      console.log(`🧹 Purgado de despachos: se eliminaron físicamente ${count} fotos de más de 24 horas.`);
    }
  } catch(e) {
    console.warn("Error running cleanOldDespachoPhotos:", e);
  }
}

function calculateOTIF(turnosList, despachosList) {
  const despachosByTurno = {};
  despachosList.forEach(d => {
    if (!despachosByTurno[d.turno_id]) despachosByTurno[d.turno_id] = [];
    despachosByTurno[d.turno_id].push(d);
  });
  
  let totalClosed = 0;
  let otifCount = 0;
  
  turnosList.forEach(t => {
    const tDespachos = despachosByTurno[t._id] || [];
    if (tDespachos.length === 0) return;
    
    totalClosed++;
    
    // Check On-Time: todos los despachos entregados completados antes de la hora de cierre del turno
    const tClose = t.hora_cierre?.toDate ? t.hora_cierre.toDate() : (t.hora_cierre ? new Date(t.hora_cierre) : null);
    let onTime = true;
    if (tClose) {
      tDespachos.forEach(d => {
        if (d.estado === 'entregado' && d.pod_timestamp) {
          const dTime = d.pod_timestamp.toDate ? d.pod_timestamp.toDate() : new Date(d.pod_timestamp);
          if (dTime > tClose) {
            onTime = false;
          }
        }
      });
    }
    
    // Check In-Full: cero devoluciones (ningún despacho con estado === 'devuelto')
    let inFull = true;
    tDespachos.forEach(d => {
      if (d.estado === 'devuelto') {
        inFull = false;
      }
    });
    
    if (onTime && inFull) {
      otifCount++;
    }
  });
  
  const pct = totalClosed > 0 ? Math.round((otifCount / totalClosed) * 100) : 100;
  return { pct, count: otifCount, total: totalClosed };
}
