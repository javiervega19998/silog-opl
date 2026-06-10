// ============================================================
// auth.js -- SILOG SpA | v5
// auth, db, storage, functions vienen de firebase-config.js
// ============================================================

let currentUser     = null;
let currentUserData = null;

// -- Sanitiza HTML para prevenir XSS -------------------------
function sanitize(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


// -- Normalizar datos del usuario ----------------------------
function normalizeUserData(raw) {
  const nombre_completo = raw.nombre_completo || ((raw.nombre || '') + ' ' + (raw.apellido || '')).trim() || raw.nombre || raw.name || '';
  return {
    name:   nombre_completo,
    email:  raw.correo_electronico  || raw.email || '',
    role:   (raw.rol || raw.role    || 'conductor').toLowerCase().trim(),
    area:   raw.area                || 'Operaciones',
    phone:  raw.telefono            || raw.phone || '',
    rut:    raw.rut                 || '',
    estado: raw.estado              || 'Activo',
    ...raw,
  };
}

// -- Obtiene datos del usuario desde Firestore ---------------
async function getUserData(user) {
  try {
    let snap;
    try {
      snap = await db.collection('users').doc(user.uid).get({ source: 'cache' });
    } catch(e) {
      snap = await db.collection('users').doc(user.uid).get({ source: 'server' });
    }

    if (snap && snap.exists) {
      const data = snap.data();
      data._ts = Date.now();
      return normalizeUserData(data);
    }

    // 2) Por correo_electronico
    let q1;
    try {
      q1 = await db.collection('users').where('correo_electronico', '==', user.email).limit(1).get({ source: 'cache' });
      if (q1.empty) throw new Error('Not in cache');
    } catch(e) {
      q1 = await db.collection('users').where('correo_electronico', '==', user.email).limit(1).get({ source: 'server' });
    }

    if (!q1.empty) {
      const data = q1.docs[0].data();
      
      // Validación de Seguridad: Prevenir escalada de privilegios
      const validRoles = ['admin', 'administrativo', 'administrativo.conductor', 'conductor', 'bodeguero', 'finanzas', 'gestion', 'departamento de operaciones'];
      if (!data.rol || !validRoles.includes(data.rol.toLowerCase())) {
        console.warn(`[auth] Rol inválido o comprometido detectado (${data.rol}). Degradando a 'conductor'.`);
        data.rol = 'conductor';
      }
      
      // SYNC: Si el documento existe bajo email pero no bajo UID, lo copiamos al UID
      try {
        await db.collection('users').doc(user.uid).set(data);
        console.log('[auth] Synced user document to UID:', user.uid);
      } catch(syncErr) {
        console.warn('[auth] Failed to sync user doc to UID:', syncErr.message);
      }

      data._ts = Date.now();
      return normalizeUserData(data);
    }
  } catch (e) {
    console.warn('[auth] getUserData error:', e.message);
  }
  return normalizeUserData({ nombre: user.displayName || 'Usuario', rol: 'conductor', area: 'Operaciones' });
}

async function checkAndAssignDailyChecklistTask(email) {
  try {
    const chileParts = new Intl.DateTimeFormat('es-CL', {
      timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
    }).formatToParts(new Date());
    const year    = chileParts.find(p => p.type === 'year').value;
    const month   = chileParts.find(p => p.type === 'month').value;
    const day     = chileParts.find(p => p.type === 'day').value;
    const weekday = chileParts.find(p => p.type === 'weekday').value.toLowerCase();
    const isWeekend = weekday.includes('s') && (weekday.includes('b') || weekday.includes('dom'));
    const currentDateStr = day + '-' + month + '-' + year;
    const feriadosChile = [
      "01-01-2025","18-04-2025","19-04-2025","01-05-2025","21-05-2025","20-06-2025",
      "29-06-2025","16-07-2025","15-08-2025","18-09-2025","19-09-2025","12-10-2025",
      "31-10-2025","01-11-2025","08-12-2025","25-12-2025",
      "01-01-2026","03-04-2026","04-04-2026","01-05-2026","21-05-2026","29-06-2026",
      "16-07-2026","15-08-2026","18-09-2026","19-09-2026","12-10-2026","31-10-2026"
    ];
    if (isWeekend || feriadosChile.includes(day + '-' + month + '-' + year)) return;
    const cacheKey = 'silog_checklist_task_' + email + '_' + currentDateStr;
    if (sessionStorage.getItem(cacheKey)) return;
    const snap = await db.collection('tareas').where('asignado_a', '==', email).where('tipo', '==', 'checklist').get();
    let yaAsignadaHoy = false;
    snap.forEach(doc => {
      const task = doc.data();
      if (task.tipo === 'checklist' && task.titulo === 'Realizar todos los dias un Checklist Operativo' && task.fecha_creacion) {
        const taskDate = task.fecha_creacion.toDate ? task.fecha_creacion.toDate() : new Date(task.fecha_creacion);
        const taskChileDate = new Intl.DateTimeFormat('es-CL', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).format(taskDate).replace(/\//g, '-');
        if (taskChileDate === currentDateStr) yaAsignadaHoy = true;
      }
    });
    if (!yaAsignadaHoy) {
      await db.collection('tareas').add({
        titulo: 'Realizar todos los dias un Checklist Operativo',
        descripcion: 'Realizar el chequeo diario del vehiculo y reportar el estado operativo para iniciar tu jornada.',
        tipo: 'checklist', prioridad: 'alta', asignado_a: email, asignado_por: 'sistema', estado: 'pendiente',
        fecha_creacion: firebase.firestore.FieldValue.serverTimestamp(),
        fecha_vencimiento: firebase.firestore.Timestamp.fromDate(new Date(new Date().setHours(23, 59, 59, 999))),
      });
      showToast('Nueva tarea diaria: Realizar Checklist Operativo', 'info');
    }
    sessionStorage.setItem(cacheKey, 'true');
  } catch (e) {
    console.warn('[auth] Error en asignacion de tarea diaria:', e.message);
  }
}

  // -- Requiere sesion activa ----------------------------------
  function requireAuth(callback) {
            auth.onAuthStateChanged(async (user) => {
            if (!user) { window.location.href = '/index.html'; return; }
      currentUser     = user;
            try {
        currentUserData = await getUserData(user);
              } catch(e) {
              }
      if (currentUserData && (currentUserData.rol || currentUserData.role || '').toLowerCase() === 'conductor') {
                try {
          await checkAndAssignDailyChecklistTask(currentUserData.email);
        } catch(e) {
                  }
      }
            if (callback) callback(user, currentUserData);
    });
  }

// -- isViewerRole -------------------------------------------
function isViewerRole(role) {
  const r = (role || '').toLowerCase();
  if (['admin', 'administrativo', 'administrativo.conductor'].includes(r)) return true;
  if (r.includes('admin') || r.includes('finanz') || r.includes('gestion')) return true;
  if (r !== 'conductor' && r !== 'bodeguero' && r !== '') return true;
  return false;
}
function isConductorRole(role) {
  return ['conductor', 'administrativo.conductor'].includes((role || '').toLowerCase());
}
function isBodegueroRole(role) {
  return ['bodeguero', 'admin'].includes((role || '').toLowerCase());
}

// -- Panel admin/administrativo ------------------------------
function requireAdmin(callback) {
  requireAuth((user, data) => {
    if (!isViewerRole(data.rol || data.role)) { window.location.href = '/dashboard.html'; return; }
    if (callback) callback(user, data);
  });
}

// -- Registro de nuevo usuario -------------------------------
async function registerUser(email, password, userData) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  const user = cred.user;
  const nombre_completo = ((userData.nombre || '') + ' ' + (userData.apellido || '')).trim();
  await db.collection('users').doc(user.uid).set({
    correo_electronico: email,
    nombre:    userData.nombre    || '',
    apellido:  userData.apellido  || '',
    nombre_completo: nombre_completo,
    rut:       userData.rut       || '',
    telefono:  userData.telefono  || '',
    area:      userData.area      || 'Operaciones',
    rol:       (userData.rol      || 'conductor').toLowerCase(),
    roles:     userData.roles     || [userData.rol || 'conductor'],
    estado:    'Activo',
    Fecha_registro: firebase.firestore.FieldValue.serverTimestamp(),
    auth_uid: user.uid,
  });
  return cred;
}

// -- Actualizar perfil ----------------------------------------
async function updateUserProfile(uid, updates) {
  await db.collection('users').doc(uid).update(updates);
  if (currentUserData && currentUser && currentUser.uid === uid) {
    currentUserData = { ...currentUserData, ...updates };
  }
}

// -- Render navbar de perfil ---------------------------------
function renderNavbar(userData) {
  const nameEl   = document.getElementById('user-name');
  const roleEl   = document.getElementById('user-role');
  const avatarEl = document.getElementById('user-avatar');
  const nombre = userData.nombre || userData.name || (userData.correo_electronico || userData.email || '').split('@')[0];
  if (nameEl) {
    nameEl.textContent = nombre;
  }
  if (avatarEl) {
    const foto = userData.foto_url || userData.photoURL;
    if (foto) {
      avatarEl.style.backgroundImage = `url('${foto}')`;
      avatarEl.style.backgroundSize = 'cover';
      avatarEl.style.backgroundPosition = 'center';
      avatarEl.textContent = '';
    } else {
      avatarEl.style.backgroundImage = 'none';
      avatarEl.textContent = nombre ? nombre.charAt(0).toUpperCase() : '?';
    }
    avatarEl.style.display = 'flex';
  }
  if (roleEl) {
    const rawRole = (userData.rol || userData.role || 'conductor').toLowerCase();
    const roleStr = { 'admin': 'Administrador', 'administrativo': 'Administrativo', 'administrativo.conductor': 'Admin/Conductor', 'conductor': 'Conductor', 'bodeguero': 'Bodeguero' }[rawRole] || 'Operador';
    roleEl.textContent = roleStr + ' - ' + (userData.area || 'Sin area');
  }
}

// -- Cerrar sesion -------------------------------------------
function logout() {
  if (!confirm('Cerrar sesion? Asegurate de haber guardado tu trabajo.')) return;
  localStorage.clear();
  sessionStorage.clear();
  auth.signOut().then(() => { window.location.href = '/index.html'; });
}

// -- Toast ---------------------------------------------------
function showToast(msg, type) {
  type = type || 'info';
  var container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:320px;';
    document.body.appendChild(container);
  }
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() { toast.classList.remove('show'); setTimeout(function() { toast.remove(); }, 300); }, 3500);
}

// -- Exportar a CSV ------------------------------------------
function exportCSV(docs, nombreArchivo) {
  nombreArchivo = nombreArchivo || 'reporte';
  if (!docs || !docs.length) { showToast('Sin datos para exportar', 'info'); return; }
  var exclude = ['id'];
  var flatten = function(obj, prefix) {
    prefix = prefix || '';
    return Object.keys(obj).reduce(function(acc, k) {
      if (exclude.includes(k)) return acc;
      var val = obj[k];
      var key = prefix ? prefix + '_' + k : k;
      if (val && typeof val === 'object' && val.toDate) {
        acc[key] = formatDate(val);
      } else if (Array.isArray(val)) {
        acc[key] = val.join(' | ');
      } else if (val && typeof val === 'object') {
        Object.assign(acc, flatten(val, key));
      } else {
        acc[key] = val != null ? val : '';
      }
      return acc;
    }, {});
  };
  var flat = docs.map(function(d) { return flatten(d); });
  var keys = Array.from(new Set(flat.flatMap(Object.keys)));
  var header = keys.join(';');
  var rows = flat.map(function(r) {
    return keys.map(function(k) {
      var v = String(r[k] != null ? r[k] : '').replace(/;/g, ',').replace(/\n/g, ' ');
      return '"' + v + '"';
    }).join(';');
  });
  var csv = '\uFEFF' + [header].concat(rows).join('\n');
  var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href = url;
  a.download = nombreArchivo + '_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV descargado', 'success');
}

// -- Utilidades de fecha ------------------------------------
function formatDate(ts) {
  if (!ts) return '-';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(ts) {
  if (!ts) return '';
  var d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(ts) {
  if (!ts) return '-';
  return formatDate(ts) + ' ' + formatTime(ts);
}

// -- Badges -------------------------------------------------
function statusBadge(status) {
  var map = {
    pendiente:   ['badge-pending',  'Pendiente'],
    en_progreso: ['badge-active',   'En Progreso'],
    completada:  ['badge-done',     'Completada'],
    cancelada:   ['badge-danger',   'Cancelada'],
  };
  var pair = map[(status || '').toLowerCase()] || ['badge-pending', status];
  return '<span class="badge ' + pair[0] + '">' + pair[1] + '</span>';
}
function priorityBadge(p) {
  var map = { alta: 'badge-danger', media: 'badge-pending', baja: 'badge-active' };
  return '<span class="badge ' + (map[p] || 'badge-active') + '">' + (p || 'media') + '</span>';
}

// -- Navegacion dinamica ------------------------------------
(function initNavigationHistory() {
  var currentPath = window.location.pathname;
  var cleanUrl = function(url) { return url.split('?')[0].split('#')[0]; };
  var pageFilename = cleanUrl(currentPath.split('/').pop() || 'dashboard.html');
  if (pageFilename === 'index.html' || currentPath === '/' || currentPath === '') return;
  var getPageName = function(path) {
    var filename = cleanUrl(path.split('/').pop() || 'dashboard.html');
    var mapping = {
      'dashboard.html':'Dashboard','inventario.html':'Inventario','bodega.html':'WMS Bodega',
      'planillas.html':'Planillas','formularios.html':'Seguridad','correos.html':'Correos',
      'admin.html':'Usuarios','analytics.html':'Analytics','charlas.html':'Charlas',
      'checklist.html':'Checklist','crm.html':'CRM','finanzas.html':'Finanzas',
      'gastos.html':'Gastos','ruta.html':'Ruta','tareas.html':'Tareas',
      'turno.html':'Jornada','vehiculos.html':'Flota','viajes.html':'Viajes'
    };
    return mapping[filename] || 'Dashboard';
  };
  var stack = [];
  try { stack = JSON.parse(sessionStorage.getItem('silog_nav_stack')) || []; } catch(e) {}
  if (pageFilename === 'dashboard.html') {
    stack = [{ url: 'dashboard.html', name: 'Dashboard' }];
    sessionStorage.setItem('silog_nav_stack', JSON.stringify(stack));
    return;
  }
  var index = stack.findIndex(function(p) { return cleanUrl(p.url) === pageFilename; });
  if (index !== -1) {
    stack = stack.slice(0, index + 1);
  } else {
    if (stack.length === 0) stack.push({ url: 'dashboard.html', name: 'Dashboard' });
    stack.push({ url: pageFilename, name: getPageName(pageFilename) });
  }
  sessionStorage.setItem('silog_nav_stack', JSON.stringify(stack));
  var prevPage = stack.length > 1 ? stack[stack.length - 2] : { url: 'dashboard.html', name: 'Dashboard' };
  var configureBackButton = function() {
    var backBtn = document.querySelector('.btn-back');
    if (!backBtn) {
      var navbar = document.querySelector('.navbar');
      if (navbar) {
        backBtn = document.createElement('button');
        backBtn.className = 'btn-back';
        var logo = navbar.querySelector('.navbar-logo');
        if (logo) logo.after(backBtn); else navbar.prepend(backBtn);
      }
    }
    if (backBtn) {
      backBtn.removeAttribute('onclick');
      backBtn.innerHTML = 'Volver a ' + prevPage.name;
      backBtn.onclick = function(e) { e.preventDefault(); window.location.href = prevPage.url; };
    }
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configureBackButton);
  } else {
    configureBackButton();
  }
})();

