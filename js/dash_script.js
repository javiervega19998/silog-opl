// Saludo
const _hora=new Date().getHours();
const _saludo=_hora<12?'Buenos días':_hora<20?'Buenas tardes':'Buenas noches';
document.getElementById('greeting-text').innerHTML=`${_saludo}, <span id="greeting-name" style="color:var(--accent)">…</span> 👋`;
document.getElementById('greeting-date').textContent=new Date().toLocaleDateString('es-CL',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

// Renderizado rápido optimista desde caché local (ejecutado de inmediato para evitar pantallas en blanco)
(function renderOptimisticUI() {
  try {
    const cachedUser = localStorage.getItem('silog_last_user');
    if (cachedUser) {
      const data = JSON.parse(cachedUser);
      if (data) {
        // 1) Renderizar navbar y saludo básico de inmediato
        const displayName = data.nombre || data.name || data.email || 'Usuario';
        const initials = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
        
        const avatarEl = document.getElementById('user-avatar');
        const nameEl   = document.getElementById('user-name');
        const roleEl   = document.getElementById('user-role');
        if (avatarEl) {
          if (data.foto_perfil) {
            avatarEl.innerHTML = `<img src="${data.foto_perfil}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
            avatarEl.style.overflow = 'hidden';
          } else {
            avatarEl.textContent = initials;
            avatarEl.style.overflow = '';
          }
        }
        if (nameEl) nameEl.textContent = displayName;
        if (roleEl) {
          roleEl.textContent = ['admin','administrativo','administrativo.conductor'].includes((data.role||'').toLowerCase())
            ? `Administrador · ${data.area || 'Operaciones'}`
            : `Conductor · ${data.area || 'Operaciones'}`;
        }

        const greetingName = document.getElementById('greeting-name');
        if (greetingName) greetingName.textContent = displayName;

        // Pre-llenar inputs de perfil
        const pNombre = document.getElementById('p-nombre');
        const pApellido = document.getElementById('p-apellido');
        const pRut = document.getElementById('p-rut');
        const pTel = document.getElementById('p-telefono');
        const pArea = document.getElementById('p-area');
        if(pNombre) pNombre.value = data.nombre || '';
        if(pApellido) pApellido.value = data.apellido || '';
        if(pRut) pRut.value = data.rut || '';
        if(pTel) pTel.value = data.telefono || data.phone || '';
        if(pArea && data.area) pArea.value = data.area;

        const btnDelete = document.getElementById('btn-delete-photo');
        if (btnDelete) btnDelete.style.display = data.foto_perfil ? 'inline-block' : 'none';

        const panelAv = document.getElementById('panel-avatar-preview');
        if (panelAv) {
          if (data.foto_perfil) {
            panelAv.innerHTML = `<img src="${data.foto_perfil}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
          } else {
            panelAv.textContent = initials;
          }
        }

        // 2) Mostrar secciones correspondientes por rol y área de inmediato
        const role = (data.role || 'conductor').toLowerCase();
        const area = (data.area || '').toLowerCase();
        const showSec = id => { const el = document.getElementById(id); if (el) el.style.display = 'block'; };
        
        if (role === 'admin') {
          showSec('sec-conductor'); showSec('sec-operaciones'); showSec('sec-gestion'); showSec('sec-finanzas'); showSec('sec-bodega'); showSec('sec-admin-full');
          document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'block');
          const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'block';
        } else if (role === 'conductor' || role === 'administrativo.conductor') {
          showSec('sec-conductor');
          const email = (data.correo_electronico || data.email || '').toLowerCase().trim();
          if (email === 'juliocmartinezt21@gmail.com') {
            const el = document.getElementById('module-charlas-conductor');
            if (el) el.style.display = 'flex';
          }
          if (role === 'administrativo.conductor') {
            showSec('sec-operaciones'); showSec('sec-gestion'); showSec('sec-finanzas');
            document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'block');
            const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'block';
          } else {
            // Conductor estricto: ocultar resumen flota y asegurar que no vea partes administrativas
            const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'none';
          }
        } else if (role === 'administrativo' || role.includes('admin') || role.includes('finanz')) {
          showSec('sec-gestion'); showSec('sec-operaciones'); showSec('sec-finanzas'); showSec('sec-bodega');
          document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'block');
          const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'block';
        } else if (role === 'bodeguero') {
          showSec('sec-bodega');
          const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'none';
        } else {
          // Fallback cache: rol desconocido - FAIL CLOSED (solo conductor)
          console.warn('[SILOG CACHE] Rol no reconocido:', role, '| Acceso restringido a vista conductor');
          showSec('sec-conductor');
          const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'none';
        }
      }
    }

    // 3) Restaurar caché del Dashboard (Contenido general, estadísticas y listas)
    const cachedDashboard = localStorage.getItem('silog_dashboard_cache');
    if (cachedDashboard) {
      const c = JSON.parse(cachedDashboard);
      if (c) {
        const setTxt = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.textContent = v; };
        const setHtml = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.innerHTML = v; };
        const setDisplay = (id, v) => { const el = document.getElementById(id); if (el && v !== undefined) el.style.display = v; };

        // Estadísticas de primera fila
        setTxt('stat-pending', c.stats_pending);
        setTxt('stat-done', c.stats_done);
        setTxt('stat-vehicle', c.stats_vehicle);
        setTxt('stat-checklist', c.stats_checklist);

        // Notificaciones y Badges
        setDisplay('notif-banner', c.notif_banner_display);
        setTxt('notif-count', c.notif_count);
        ['badge-tareas', 'badge-tareas-cond', 'badge-tareas-bod', 'badge-tareas-fin'].forEach(id => {
          setDisplay(id, c.badge_tareas_display);
          setTxt(id, c.badge_tareas_text);
        });
        setDisplay('badge-checklist', c.badge_checklist_display);
        setDisplay('badge-charla', c.badge_charla_display);
        setDisplay('badge-charla-cond', c.badge_charla_cond_display);
        setDisplay('badge-bodega', c.badge_bodega_display);
        setTxt('badge-bodega', c.badge_bodega_text);

        // Turno Banner
        setDisplay('turno-banner', c.turno_banner_display);
        setTxt('turno-plate', c.turno_plate);
        setTxt('turno-km', c.turno_km);
        setTxt('turno-hora', c.turno_hora);
        setTxt('turno-card-name', c.turno_card_name);
        setTxt('turno-card-desc', c.turno_card_desc);
        setDisplay('module-gastos', c.module_gastos_display);

        // Mi Vehículo Asignado
        setDisplay('vehicle-section', c.vehicle_section_display);
        setTxt('v-plate', c.v_plate);
        setTxt('v-model', c.v_model);
        setTxt('v-status', c.v_status);
        // Resumen de la Flota
        setTxt('fleet-total', c.fleet_total);
        setTxt('fleet-ok', c.fleet_ok);
        setTxt('fleet-drivers', c.fleet_drivers);
        setTxt('fleet-tasks', c.fleet_tasks);

        // Listas HTML (Tareas Recientes)
        if (c.task_list_html) setHtml('task-list', c.task_list_html);
      }
    }
  } catch (e) {
    console.warn("Error cargando caché optimista:", e);
  }
})();

// Utilidades para persistencia de la caché de estadísticas y elementos dinámicos
function saveDashboardCache() {
  try {
    const getTxt = id => { const el = document.getElementById(id); return el ? el.textContent : ''; };
    const getHtml = id => { const el = document.getElementById(id); return el ? el.innerHTML : ''; };
    const getDisplay = id => { const el = document.getElementById(id); return el ? el.style.display : 'none'; };
    const getClassName = id => { const el = document.getElementById(id); return el ? el.className : ''; };

    const cache = {
      stats_pending: getTxt('stat-pending'),
      stats_done: getTxt('stat-done'),
      stats_vehicle: getTxt('stat-vehicle'),
      stats_checklist: getTxt('stat-checklist'),
      notif_banner_display: getDisplay('notif-banner'),
      notif_count: getTxt('notif-count'),
      badge_tareas_display: getDisplay('badge-tareas'),
      badge_tareas_text: getTxt('badge-tareas'),
      badge_checklist_display: getDisplay('badge-checklist'),
      badge_charla_display: getDisplay('badge-charla'),
      badge_charla_cond_display: getDisplay('badge-charla-cond'),
      badge_bodega_display: getDisplay('badge-bodega'),
      badge_bodega_text: getTxt('badge-bodega'),
      turno_banner_display: getDisplay('turno-banner'),
      turno_plate: getTxt('turno-plate'),
      turno_km: getTxt('turno-km'),
      turno_hora: getTxt('turno-hora'),
      turno_card_name: getTxt('turno-card-name'),
      turno_card_desc: getTxt('turno-card-desc'),
      module_gastos_display: getDisplay('module-gastos'),
      vehicle_section_display: getDisplay('vehicle-section'),
      v_plate: getTxt('v-plate'),
      v_model: getTxt('v-model'),
      v_status: getTxt('v-status'),
      v_status_class: getClassName('v-status'),
      fleet_total: getTxt('fleet-total'),
      fleet_ok: getTxt('fleet-ok'),
      fleet_drivers: getTxt('fleet-drivers'),
      fleet_tasks: getTxt('fleet-tasks'),
      task_list_html: getHtml('task-list')
    };

    localStorage.setItem('silog_dashboard_cache', JSON.stringify(cache));
  } catch (e) {
    console.warn("Error al guardar la caché del dashboard:", e);
  }
}

let _uid='', _userDocRef=null, _profilePhotoURL='';

// Abre panel de perfil o menú de avatar
function openAvatarMenu(e){
  e.stopPropagation();
  openPanel();
}
function openPanel(){
  document.getElementById('profile-panel').classList.add('open');
  document.getElementById('panel-overlay').classList.add('open');
}
function closePanel(){
  document.getElementById('profile-panel').classList.remove('open');
  document.getElementById('panel-overlay').classList.remove('open');
}

// Carga datos en el panel de perfil
function loadPanelData(data){
  const setVal=(id,v)=>{const el=document.getElementById(id);if(el)el.value=v||'';};
  setVal('p-nombre', data.nombre||'');
  setVal('p-apellido', data.apellido||'');
  setVal('p-rut', data.rut||'');
  setVal('p-telefono', data.telefono||data.phone||'');
  const areaEl=document.getElementById('p-area');
  if(areaEl&&data.area){
    const opt=Array.from(areaEl.options).find(o=>o.value===data.area);
    if(opt)opt.selected=true; else {const no=new Option(data.area,data.area,true,true);areaEl.add(no);}
  }
  // Avatar en panel
  const panelAv=document.getElementById('panel-avatar-preview');
  const btnDelete=document.getElementById('btn-delete-photo');
  if(data.foto_perfil){
    panelAv.innerHTML=`<img src="${data.foto_perfil}" alt="avatar"/>`;
    _profilePhotoURL=data.foto_perfil;
    if(btnDelete) btnDelete.style.display='inline-block';
  } else {
    const name=data.nombre_completo||((data.nombre||'') + ' ' + (data.apellido||'')).trim()||data.nombre||data.name||'U';
    panelAv.textContent=name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
    _profilePhotoURL='';
    if(btnDelete) btnDelete.style.display='none';
  }
}

// Actualiza avatar en navbar
function updateNavAvatar(data){
  const av=document.getElementById('user-avatar');
  if(!av)return;
  if(data.foto_perfil){
    av.innerHTML=`<img src="${data.foto_perfil}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
  } else {
    const name=data.nombre||data.name||'U';
    av.textContent=name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  }
}

// Guardar perfil
async function saveProfile(){
  const btn=document.getElementById('btn-save-profile');
  btn.disabled=true;btn.textContent='Guardando…';
  try{
    const nombre = document.getElementById('p-nombre').value.trim();
    const apellido = document.getElementById('p-apellido').value.trim();
    const nombre_completo = (nombre + ' ' + apellido).trim();
    const updates={
      nombre: nombre,
      apellido: apellido,
      nombre_completo: nombre_completo,
      rut:document.getElementById('p-rut').value.trim(),
      telefono:document.getElementById('p-telefono').value.trim(),
      area:document.getElementById('p-area').value,
    };
    if(_userDocRef) await _userDocRef.update(updates);
    else await db.collection('users').doc(_uid).set(updates,{merge:true});
    // Actualizar caché de localStorage inmediatamente
    const cachedUser = localStorage.getItem('silog_last_user');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        const updated = { ...parsed, ...updates, name: nombre_completo };
        localStorage.setItem('silog_last_user', JSON.stringify(updated));
      } catch(e) {}
    }
    // Limpiar caché de sesión para forzar recarga en otros módulos
    sessionStorage.removeItem('silog_user_' + _uid);
    // Actualizar navbar nombre
    const nameEl=document.getElementById('user-name');
    if(nameEl&&nombre_completo) nameEl.textContent=nombre_completo;
    showToast('✅ Perfil actualizado','success');
    closePanel();
  }catch(e){showToast('Error: '+e.message,'error');}
  finally{btn.disabled=false;btn.textContent='💾 Guardar Perfil';}
}

// Subir foto de perfil
async function uploadPhoto(event){
  const file=event.target.files[0];
  if(!file)return;
  if(file.size>5*1024*1024){showToast('La imagen no debe superar 5MB','error');return;}
  const progress=document.getElementById('upload-progress');
  const bar=document.getElementById('upload-bar');
  progress.classList.add('active');
  bar.style.width='0%';
  try{
    const ref=storage.ref(`users/${_uid}/foto_perfil`);
    const task=ref.put(file);
    task.on('state_changed',snap=>{
      bar.style.width=Math.round(snap.bytesTransferred/snap.totalBytes*100)+'%';
    });
    await task;
    const url=await ref.getDownloadURL();
    // Guardar en Firestore
    if(_userDocRef) await _userDocRef.update({foto_perfil:url});
    else await db.collection('users').doc(_uid).set({foto_perfil:url},{merge:true});
    // Actualizar caché de localStorage inmediatamente
    const cachedUser = localStorage.getItem('silog_last_user');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        const updated = { ...parsed, foto_perfil: url };
        localStorage.setItem('silog_last_user', JSON.stringify(updated));
      } catch(e) {}
    }
    // Limpiar caché de sesión para forzar recarga en otros módulos
    sessionStorage.removeItem('silog_user_' + _uid);
    // Actualizar UI
    _profilePhotoURL=url;
    document.getElementById('panel-avatar-preview').innerHTML=`<img src="${url}" alt="avatar"/>`;
    document.getElementById('user-avatar').innerHTML=`<img src="${url}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
    const btnDelete = document.getElementById('btn-delete-photo');
    if(btnDelete) btnDelete.style.display='inline-block';
    showToast('📷 Foto actualizada','success');
  }catch(e){showToast('Error subiendo foto: '+e.message,'error');}
  finally{progress.classList.remove('active');event.target.value='';}
}

// Eliminar foto de perfil
async function deletePhoto(){
  if(!confirm('¿Eliminar tu foto de perfil?')) return;
  const btn = document.getElementById('btn-delete-photo');
  btn.disabled = true; btn.textContent = 'Eliminando...';
  try {
    // 1) Eliminar de Firebase Storage
    try {
      const ref = storage.ref(`users/${_uid}/foto_perfil`);
      await ref.delete();
    } catch(e) {
      console.warn('No se pudo eliminar el archivo físico de Storage:', e.message);
    }
    // 2) Actualizar Firestore
    const updates = { foto_perfil: firebase.firestore.FieldValue.delete() };
    if(_userDocRef) await _userDocRef.update(updates);
    else await db.collection('users').doc(_uid).set(updates, {merge:true});
    // Actualizar caché de localStorage inmediatamente
    const cachedUser = localStorage.getItem('silog_last_user');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        delete parsed.foto_perfil;
        localStorage.setItem('silog_last_user', JSON.stringify(parsed));
      } catch(e) {}
    }
    // Limpiar caché de sesión
    sessionStorage.removeItem('silog_user_' + _uid);

    // 4) Actualizar UI localmente
    _profilePhotoURL = '';
    
    // Obtener iniciales del saludo/perfil
    const nombre = document.getElementById('p-nombre').value.trim();
    const apellido = document.getElementById('p-apellido').value.trim();
    const nombre_completo = (nombre + ' ' + apellido).trim() || 'Usuario';
    const initials = nombre_completo.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    
    document.getElementById('panel-avatar-preview').textContent = initials;
    
    const navAvatar = document.getElementById('user-avatar');
    if (navAvatar) {
      navAvatar.textContent = initials;
    }
    
    btn.style.display = 'none';
    showToast('📷 Foto de perfil eliminada','success');
  } catch(e) {
    showToast('Error al eliminar foto: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '🗑️ Eliminar foto';
  }
}

requireAuth(async(user,data)=>{
  try {
    _uid=user.uid;
    const email=data.correo_electronico||data.email||user.email;
    const role=((data.rol||data.role)||'conductor').toLowerCase(); const _isViewer = isViewerRole(role);
    const area=(data.area||'').toLowerCase();

    

    // 1) Renderizar navbar y saludo básico de inmediato
    renderNavbar(data);
    const displayName = data.nombre || data.name || user.displayName || 'Usuario';
    const greetingName = document.getElementById('greeting-name');
    if(greetingName) greetingName.textContent = displayName;
    updateNavAvatar(data);
    
    try {
      loadPanelData(data);
    } catch(e) {
      
    }

  // 2) Mostrar secciones correspondientes por rol y área de inmediato
  function showSec(id){const el=document.getElementById(id);if(el)el.style.display='block';}
  if(role==='admin'){
    showSec('sec-conductor');showSec('sec-operaciones');showSec('sec-finanzas');showSec('sec-bodega');showSec('sec-admin-full');
    document.querySelectorAll('.admin-section').forEach(el=>el.style.display='block');
    const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'block';
  } else if(role==='conductor' || role==='administrativo.conductor'){
    showSec('sec-conductor');
    if (email === 'juliocmartinezt21@gmail.com') {
      const el = document.getElementById('module-charlas-conductor');
      if (el) el.style.display = 'flex';
    }
    if(role==='administrativo.conductor'){
      showSec('sec-operaciones'); showSec('sec-gestion'); showSec('sec-finanzas');
      document.querySelectorAll('.admin-section').forEach(el=>el.style.display='block');
      const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'block';
    } else {
      // Conductor estricto: ocultar resumen flota y asegurar que no vea partes administrativas
      const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'none';
    }
  } else if(role==='administrativo' || role.includes('admin') || role.includes('finanz')){
    showSec('sec-gestion'); showSec('sec-operaciones'); showSec('sec-finanzas'); showSec('sec-bodega');
    document.querySelectorAll('.admin-section').forEach(el=>el.style.display='block');
    const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'block';
  } else if(role==='bodeguero'){
    showSec('sec-bodega');
    const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'none';
  } else {
    // Fallback: rol desconocido - FAIL CLOSED (solo conductor)
    console.warn('[SILOG] Rol no reconocido:', role, '| Acceso restringido a vista conductor');
    showSec('sec-conductor');
    const fleetEl = document.getElementById('global-fleet-summary'); if (fleetEl) fleetEl.style.display = 'none';
  }

  // 3) Ejecutar consultas a la base de datos en paralelo
  const promises = [];

  // P1: Referencia de documento de usuario
  const pUserRef = (async () => {
    try {
      const byUid=await db.collection('users').doc(user.uid).get();
      if(byUid.exists) _userDocRef=db.collection('users').doc(user.uid);
      else {
        const q=await db.collection('users').where('correo_electronico','==',user.email).limit(1).get();
        if(!q.empty) _userDocRef=q.docs[0].ref;
      }
    } catch(e) {}
  })();
  promises.push(pUserRef);

  // P2: Checklist semanal automático para conductores
  if (role === 'conductor') {
    const pChecklistSemanal = (async () => {
      try {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(today.setDate(diff));
        const mondayStr = monday.toISOString().split('T')[0];
        const refKey = 'checklist-' + mondayStr;

        const existe = await db.collection('tareas')
          .where('asignado_a', '==', email)
          .where('tipo', '==', 'checklist')
          .where('referencia', '==', refKey)
          .get();

        if (existe.empty) {
          const vencimiento = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate(), 23, 59, 59);
          await db.collection('tareas').add({
            titulo: 'Registrar Checklist Obligatorio - Semana del ' + monday.toLocaleDateString('es-CL'),
            descripcion: 'Registrar el Checklist operacional correspondiente al lunes de esta semana.',
            tipo: 'checklist',
            prioridad: 'alta',
            asignado_a: email,
            asignado_por: 'sistema',
            estado: 'pendiente',
            referencia: refKey,
            fecha_creacion: firebase.firestore.FieldValue.serverTimestamp(),
            fecha_vencimiento: firebase.firestore.Timestamp.fromDate(vencimiento)
          });
        }
      } catch(err) {
        console.warn('Error al asignar checklist automático:', err);
      }
    })();
    promises.push(pChecklistSemanal);
  }

  // P3: Verificación de turno activo
  const pTurno = (async () => {
    try {
      const turnoSnap=await db.collection('turnos').where('conductor_uid','==',user.uid).where('estado','==','abierto').get();
      if(!turnoSnap.empty){
        const t=turnoSnap.docs[0].data();
        document.getElementById('turno-banner').style.display='block';
        document.getElementById('turno-plate').textContent=t.patente||'—';
        document.getElementById('turno-km').textContent=t.km_inicial||'—';
        document.getElementById('turno-hora').textContent=t.hora_apertura?formatTime(t.hora_apertura):'';
        document.getElementById('turno-card-name').textContent='Turno Activo';
        document.getElementById('turno-card-desc').textContent=t.patente+' · '+t.km_inicial+' km';
        const gastosEl=document.getElementById('module-gastos');
        if(gastosEl) gastosEl.style.display='flex';
      } else {
        document.getElementById('turno-banner').style.display='none';
        const gastosEl=document.getElementById('module-gastos');
        if(gastosEl) gastosEl.style.display='none';
      }
    } catch(e) { console.warn('Turno check:', e); }
  })();
  promises.push(pTurno);

  // P4: Tareas (Conteo y renderizado de lista en una sola consulta)
  const pTareas = (async () => {
    try {
      const tSnap=await db.collection('tareas').where('asignado_a','==',email).get();
      let pending=0, doneToday=0;
      const today=new Date();today.setHours(0,0,0,0);
      let docs=[];
      tSnap.forEach(d=>{
        const t=d.data();
        docs.push({id:d.id, ...t});
        if(t.estado==='pendiente') pending++;
        if(t.estado==='completada'&&t.fecha_completado?.toDate?.()>=today) doneToday++;
      });
      document.getElementById('stat-pending').textContent=pending;
      document.getElementById('stat-done').textContent=doneToday;
      if(pending>0){
        document.getElementById('notif-banner').style.display='flex';
        document.getElementById('notif-count').textContent=pending;
        ['badge-tareas', 'badge-tareas-cond', 'badge-tareas-bod', 'badge-tareas-fin'].forEach(id => {
          const el = document.getElementById(id);
          if(el) { el.style.display='block'; el.textContent=pending; }
        });
      } else {
        const notifBanner = document.getElementById('notif-banner');
        if(notifBanner) notifBanner.style.display='none';
        ['badge-tareas', 'badge-tareas-cond', 'badge-tareas-bod', 'badge-tareas-fin'].forEach(id => {
          const el = document.getElementById(id);
          if(el) { el.style.display='none'; }
        });
      }
      
      // Renderizar listado de tareas recientes
      docs.sort((a,b)=>(b.fecha_creacion?.toMillis?.()??0)-(a.fecha_creacion?.toMillis?.()??0));
      const recent = docs.slice(0,8);
      const list=document.getElementById('task-list');
      if(!recent.length){
        list.innerHTML='<div style="color:var(--text2);text-align:center;padding:28px;font-size:.85rem">No hay tareas asignadas.</div>';
      } else {
        const iconMap={checklist:'✅',charla:'📚',viaje:'📋',otro:'📌'};
        list.innerHTML='';
        recent.forEach(t=>{
          const dotCls=t.estado==='completada'?'dot-d':t.estado==='en_progreso'?'dot-i':'dot-p';
          const badgeCls=t.estado==='completada'?'tb-d':t.estado==='en_progreso'?'tb-i':'tb-p';
          const badgeLbl=t.estado==='completada'?'✅ Completada':t.estado==='en_progreso'?'🔵 En Progreso':'⏳ Pendiente';
          const href=t.tipo==='checklist'?'checklist':t.tipo==='charla'?'charlas':t.tipo==='viaje'?'viajes':'tareas';
          // SECURITY: usar DOM API para evitar XSS al inyectar titulo de Firestore
          const item=document.createElement('div');
          item.className='task-item';
          item.onclick=()=>window.location.href=href+'.html';
          item.innerHTML=`<div class="task-dot ${dotCls}"></div><div class="task-info"><div class="task-title"></div><div class="task-meta">${t.fecha_vencimiento?'Vence: '+formatDate(t.fecha_vencimiento):formatDate(t.fecha_creacion)}</div></div><span class="task-badge ${badgeCls}">${badgeLbl}</span>`;
          item.querySelector('.task-title').textContent=(iconMap[t.tipo]||'📌')+' '+(t.titulo||'Sin título');
          list.appendChild(item);
        });
      }
    } catch(e) { console.warn('Tareas check:', e); }
  })();
  promises.push(pTareas);

  // P5: Último Vehículo Utilizado (index-safe in-memory sort)
  const pVehiculo = (async () => {
    try {
      let patente = '';
      try {
        const tSnap = await db.collection('turnos').where('conductor_email', '==', email).get();
        const turnos = [];
        tSnap.forEach(doc => {
          const t = doc.data();
          t._date = t.created_at?.toDate ? t.created_at.toDate() : (t.fecha?.toDate ? t.fecha.toDate() : new Date(0));
          turnos.push(t);
        });
        if (turnos.length > 0) {
          turnos.sort((a, b) => b._date - a._date);
          patente = turnos[0].patente || '';
        }
      } catch (errTurno) {
        console.warn('Error fetching last shift for vehicle:', errTurno);
      }

      let vDoc = null;
      if (patente) {
        vDoc = await db.collection('vehiculos').doc(patente).get();
        if (!vDoc.exists) vDoc = null;
      }

      if(vDoc){
        const v=vDoc.data();
        const emoji = getVehicleEmoji(v.marca, v.modelo);
        document.getElementById('vehicle-section').style.display='block';
        document.getElementById('v-plate').textContent=`${emoji} ${v.patente || '—'}`;
        document.getElementById('v-model').textContent=`${v.marca||''} ${v.modelo||''}`.trim();
        document.getElementById('v-status').textContent=v.estado||'—';
        document.getElementById('v-status').className='v-status '+(v.estado==='Disponible'?'status-ok':'status-warn');
        document.getElementById('stat-vehicle').textContent=v.estado||'—';
      } else {
        document.getElementById('stat-vehicle').textContent='N/A';
        document.getElementById('vehicle-section').style.display='none';
      }
    } catch(e) { console.warn('Vehiculo check:', e); }
  })();
  promises.push(pVehiculo);

  // P6: Checklist operacional diario (Alineado con la regla diaria de hoy)
  const pChecklist = (async () => {
    try{
      const today = new Date();
      today.setHours(0,0,0,0);
      const todayTS = firebase.firestore.Timestamp.fromDate(today);

      const ckSnap=await db.collection('chequeo_operacional')
        .where('operador','==',email)
        .where('fecha_chequeo','>=',todayTS)
        .limit(1)
        .get();

      const b = document.getElementById('badge-checklist');
      if(!ckSnap.empty){
        document.getElementById('stat-checklist').textContent='Realizado';
        if(b) b.style.display='none';
      } else {
        document.getElementById('stat-checklist').textContent='Pendiente';
        if(b) b.style.display='block';
      }
    }catch(e){
      console.warn('Checklist check error:', e);
      document.getElementById('stat-checklist').textContent='Pendiente';
      const b=document.getElementById('badge-checklist');if(b)b.style.display='block';
    }
  })();
  promises.push(pChecklist);

  // P7: Charla de seguridad diaria pendiente
  const pCharla = (async () => {
    try {
      const hoy=new Date();
      const dow=hoy.getDay();
      if(dow>=1&&dow<=5){
        const charlaLeida=await db.collection('charlas_leidas').where('operador','==',email).get();
        const hoyStr=hoy.toISOString().split('T')[0];
        const start=new Date(hoy.getFullYear(),0,1);
        const dayOfYear=Math.floor((hoy-start)/86400000);
        const charlas=['ch1','ch2','ch3','ch4','ch5','ch6'];
        const charlaHoyId=charlas[dayOfYear%charlas.length];
        const yaLeyo=([...charlaLeida.docs]).some(d=>d.data().charla_id===charlaHoyId);
        if(!yaLeyo){
          const b1 = document.getElementById('badge-charla');
          if(b1) b1.style.display='block';
          const b2 = document.getElementById('badge-charla-cond');
          if(b2) b2.style.display='block';
        } else {
          const b1 = document.getElementById('badge-charla');
          if(b1) b1.style.display='none';
          const b2 = document.getElementById('badge-charla-cond');
          if(b2) b2.style.display='none';
        }
      }
    } catch(e) { console.warn('Charla check:', e); }
  })();
  promises.push(pCharla);

  // P8: Bodega: logistica inversa pendiente
  const pBodega = (async () => {
    try{
      const invSnap=await db.collection('logistica_inversa').where('estado','==','recepcion_pendiente').get();
      if(invSnap.size>0){
        const badge=document.getElementById('badge-bodega');
        if(badge){badge.style.display='block';badge.textContent=invSnap.size;}
      }
    }catch(e){}
  })();
  promises.push(pBodega);

  // P-RECORDATORIOS: Tareas pendientes Kanban
  if (_isViewer) {
    const pRecordatorios = (async () => {
      try {
        await cleanupFinalizados();
        const recSnap = await db.collection('recordatorios').where('estado','==','pendientes').get();
        if(recSnap.size > 0) {
          const c = recSnap.size;
          ['badge-recordatorios-ops', 'badge-recordatorios-fin', 'badge-recordatorios-adm'].forEach(id => {
            const b = document.getElementById(id);
            if(b) { b.style.display='block'; b.textContent=c; }
          });
          showToast(`📌 Tienes ${c} recordatorios pendientes en el tablero Kanban.`, 'info');
        }
      } catch(e) {}
    })();
    promises.push(pRecordatorios);
  }

async function cleanupFinalizados() {
  try {
    const limitDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snap = await db.collection('recordatorios')
      .where('estado', '==', 'finalizado')
      .limit(200)
      .get();
      
    const batch = db.batch();
    let count = 0;
    snap.forEach(doc => {
      const data = doc.data();
      const dateToCheck = data.updated_at || data.created_at || null;
      if (!dateToCheck || dateToCheck.toDate() < limitDate) {
        batch.delete(doc.ref);
        count++;
      }
    });
    if(count > 0) {
      await batch.commit();
      console.log(`Auto-eliminados ${count} recordatorios finalizados.`);
    }
  } catch (e) {
    console.error("Cleanup error:", e);
  }
}

  // P9: Estadísticas de administración y Flota (Global para todos)
  promises.push(loadAdminStats());

  // Esperar la resolución de todas las consultas en paralelo
  await Promise.allSettled(promises);
  // Guardar en caché el estado actual y consolidado para cargas instantáneas subsecuentes
  saveDashboardCache();
  } catch (globalErr) {
    
    console.error('requireAuth callback error:', globalErr);
  }
});

function getVehicleEmoji(marca, modelo) {
  const m = ((marca || '') + ' ' + (modelo || '')).toLowerCase();
  if (m.includes('renault') || m.includes('master')) return '🚐';
  if (m.includes('opel') || m.includes('combo')) return '🚙';
  if (m.includes('foton')) return '🚛';
  return '🚛';
}

async function loadAdminStats(){
  try {
    const [vS, uS, tS] = await Promise.allSettled([
      db.collection('vehiculos').get(),
      db.collection('users').get(),
      db.collection('tareas').where('estado','==','pendiente').get()
    ]);
    
    const vSnap = vS.status === 'fulfilled' ? vS.value : { size: 0, forEach: ()=>{} };
    const uSnap = uS.status === 'fulfilled' ? uS.value : { size: 0, forEach: ()=>{} };
    const tSnap = tS.status === 'fulfilled' ? tS.value : { size: 0, forEach: ()=>{} };

    // 1) Contadores de Flota
    const elFleetTotal = document.getElementById('fleet-total');
    if(elFleetTotal) elFleetTotal.textContent = vSnap.size;
    
    let disp=0;
    vSnap.forEach(d=>{if(d.data().estado==='Disponible')disp++;});
    const elFleetOk = document.getElementById('fleet-ok');
    if(elFleetOk) elFleetOk.textContent = disp;
    
    let drivers=0;
    uSnap.forEach(d=>{if((d.data().rol||'').toLowerCase()==='conductor')drivers++;});
    const elFleetDrivers = document.getElementById('fleet-drivers');
    if(elFleetDrivers) elFleetDrivers.textContent = drivers;
    
    const elFleetTasks = document.getElementById('fleet-tasks');
    if(elFleetTasks) elFleetTasks.textContent = tSnap.size;
  } catch(e) {
    console.warn("loadAdminStats error:", e);
  }
}

