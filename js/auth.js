// ══════════════════════════════════════════════
// AUTH HELPERS — SILOG SpA v3
// ══════════════════════════════════════════════
let currentUser     = null;
let currentUserData = null;

// ── Sanitización XSS ─────────────────────────────────────────
// Escapa caracteres peligrosos antes de insertar en innerHTML
function sanitize(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&#39;');
}

// ── Loading global ────────────────────────────────────────────
function showLoading(msg = 'Cargando…') {
  let el = document.getElementById('global-loader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'global-loader';
    el.style.cssText = [
      'position:fixed;inset:0;background:rgba(6,13,31,.85)',
      'backdrop-filter:blur(6px);z-index:9998',
      'display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px'
    ].join(';');
    el.innerHTML = `
      <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,.2);border-top-color:#F47920;border-radius:50%;animation:spin .7s linear infinite"></div>
      <span id="loader-msg" style="color:#E8EEF8;font-family:'Inter',sans-serif;font-size:.9rem">${sanitize(msg)}</span>
    `;
    document.body.appendChild(el);
  } else {
    document.getElementById('loader-msg').textContent = msg;
    el.style.display = 'flex';
  }
}
function hideLoading() {
  const el = document.getElementById('global-loader');
  if (el) el.style.display = 'none';
}

// ── Banner offline / online ───────────────────────────────────
(function initOfflineBanner() {
  function createBanner() {
    let b = document.getElementById('offline-banner');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'offline-banner';
    b.style.cssText = [
      'position:fixed;bottom:0;left:0;right:0;z-index:9997',
      'background:#D97706;color:#fff;text-align:center',
      'padding:10px 16px;font-family:Inter,sans-serif;font-size:.83rem',
      'font-weight:600;display:none;align-items:center;justify-content:center;gap:8px'
    ].join(';');
    b.innerHTML = '⚠️ Sin conexión — los datos se guardarán al reconectar';
    document.body.appendChild(b);
    return b;
  }
  function update() {
    const b = createBanner();
    if (!navigator.onLine) {
      b.style.display = 'flex';
    } else {
      if (b.style.display !== 'none') {
        showToast('✅ Conexión restaurada', 'success');
      }
      b.style.display = 'none';
    }
  }
  window.addEventListener('offline', update);
  window.addEventListener('online',  update);
  // Chequeo inicial después de que el DOM esté listo
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update);
  } else {
    update();
  }
})();

// ── Normaliza campos Firestore → formato interno ──────────────
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

// ── Obtiene datos del usuario desde Firestore ─────────────────
async function getUserData(user) {
  try {
    const cacheKey = 'silog_user_' + user.uid;
    let cached = sessionStorage.getItem(cacheKey);
    if (!cached) {
      cached = localStorage.getItem('silog_last_user');
    }
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed && parsed._ts && (Date.now() - parsed._ts) < 300000) { // 5 min cache
          return normalizeUserData(parsed);
        }
      } catch(e) {}
    }
    // 1) Por UID (principal — más rápido)
    let snap = await db.collection('users').doc(user.uid).get();
    if (snap.exists) {
      const data = snap.data();
      data._ts = Date.now();
      const normalized = normalizeUserData(data);
      sessionStorage.setItem(cacheKey, JSON.stringify(normalized));
      localStorage.setItem('silog_last_user', JSON.stringify(normalized));
      return normalized;
    }
    // 2) Por correo_electronico
    const q1 = await db.collection('users')
      .where('correo_electronico', '==', user.email).limit(1).get();
    if (!q1.empty) {
      const data = q1.docs[0].data();
      data._ts = Date.now();
      const normalized = normalizeUserData(data);
      sessionStorage.setItem(cacheKey, JSON.stringify(normalized));
      localStorage.setItem('silog_last_user', JSON.stringify(normalized));
      return normalized;
    }
  } catch (e) {
    console.warn('[auth] getUserData error:', e.message);
  }
  return normalizeUserData({ nombre: user.displayName || 'Usuario', rol: 'conductor', area: 'Operaciones' });
}

// ── Requiere sesión activa ────────────────────────────────────
function requireAuth(callback) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) { window.location.href = '/index.html'; return; }
    currentUser     = user;
    currentUserData = await getUserData(user);
    if (callback) callback(user, currentUserData);
  });
}

// ── Helpers de rol ────────────────────────────────────────────
function isAdminRole(role) {
  return (role || '').toLowerCase() === 'admin';
}
function isViewerRole(role) {
  return ['admin','administrativo','administrativo.conductor'].includes((role||'').toLowerCase());
}
function isConductorRole(role) {
  return ['conductor','administrativo.conductor'].includes((role||'').toLowerCase());
}
function isBodegueroRole(role) {
  return ['bodeguero','admin'].includes((role||'').toLowerCase());
}

// ── Panel admin/administrativo ────────────────────────────────
function requireAdmin(callback) {
  requireAuth((user, data) => {
    if (!isViewerRole(data.role)) { window.location.href = '/dashboard.html'; return; }
    if (callback) callback(user, data);
  });
}

// ── Registro de nuevo usuario ────────────────────────────────
async function registerUser(email, password, userData) {
  const cred = await auth.createUserWithEmailAndPassword(email, password);
  const uid  = cred.user.uid;
  const nombre_completo = ((userData.nombre || '') + ' ' + (userData.apellido || '')).trim();
  await db.collection('users').doc(uid).set({
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
  });
  return cred.user;
}

// ── Contar tareas pendientes del usuario ─────────────────────
async function getPendingTaskCount(email) {
  try {
    const snap = await db.collection('tareas')
      .where('asignado_a', '==', email)
      .where('estado', '==', 'pendiente').get();
    return snap.size;
  } catch { return 0; }
}

// ── Renderiza navbar ──────────────────────────────────────────
function renderNavbar(userData) {
  const avatarEl = document.getElementById('user-avatar');
  const nameEl   = document.getElementById('user-name');
  const roleEl   = document.getElementById('user-role');
  if (!userData) return;
  const displayName = userData.name || userData.email || 'Usuario';
  const initials    = displayName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  if (avatarEl) {
    if (userData.foto_perfil) {
      avatarEl.innerHTML = `<img src="${userData.foto_perfil}" alt="avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%"/>`;
      avatarEl.style.overflow = 'hidden';
    } else {
      avatarEl.textContent = initials;
      avatarEl.style.overflow = '';
    }
  }
  if (nameEl)   nameEl.textContent   = displayName;
  if (roleEl)   roleEl.textContent   = isViewerRole(userData.role)
    ? `Administrador · ${userData.area}`
    : `Conductor · ${userData.area}`;
}

// ── Cerrar sesión (con confirmación) ─────────────────────────
function logout() {
  if (!confirm('¿Cerrar sesión? Asegúrate de haber guardado tu trabajo.')) return;
  // Clear cache
  if (currentUser) sessionStorage.removeItem('silog_user_' + currentUser.uid);
  localStorage.removeItem('silog_last_user');
  localStorage.removeItem('silog_dashboard_cache');
  auth.signOut().then(() => { window.location.href = '/index.html'; });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;max-width:320px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3500);
}

// ── Exportar a CSV ────────────────────────────────────────────
function exportCSV(docs, nombreArchivo = 'reporte') {
  if (!docs || !docs.length) { showToast('Sin datos para exportar', 'info'); return; }
  // Aplana objetos anidados y excluye campos internos de Firestore
  const exclude = ['id'];
  const flatten = (obj, prefix = '') => {
    return Object.keys(obj).reduce((acc, k) => {
      if (exclude.includes(k)) return acc;
      const val = obj[k];
      const key = prefix ? `${prefix}_${k}` : k;
      if (val && typeof val === 'object' && val.toDate) {
        // Timestamp de Firestore
        acc[key] = formatDate(val);
      } else if (Array.isArray(val)) {
        acc[key] = val.join(' | ');
      } else if (val && typeof val === 'object') {
        Object.assign(acc, flatten(val, key));
      } else {
        acc[key] = val ?? '';
      }
      return acc;
    }, {});
  };
  const flat = docs.map(d => flatten(d));
  const keys = [...new Set(flat.flatMap(Object.keys))];
  const header = keys.join(';');
  const rows   = flat.map(r => keys.map(k => {
    const v = String(r[k] ?? '').replace(/;/g, ',').replace(/\n/g, ' ');
    return `"${v}"`;
  }).join(';'));
  const csv = '\uFEFF' + [header, ...rows].join('\n'); // BOM para Excel
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${nombreArchivo}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('📥 CSV descargado', 'success');
}

// ── Utilidades de fecha ───────────────────────────────────────
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
}
function formatDateTime(ts) {
  if (!ts) return '—';
  return `${formatDate(ts)} ${formatTime(ts)}`;
}

// ── Badges ────────────────────────────────────────────────────
function statusBadge(status) {
  const map = {
    pendiente:   ['badge-pending',  '⏳ Pendiente'],
    en_progreso: ['badge-active',   '🔵 En Progreso'],
    completada:  ['badge-done',     '✅ Completada'],
    cancelada:   ['badge-danger',   '❌ Cancelada'],
  };
  const [cls, label] = map[(status||'').toLowerCase()] || ['badge-pending', status];
  return `<span class="badge ${cls}">${label}</span>`;
}
function priorityBadge(p) {
  const map = { alta: 'badge-danger', media: 'badge-pending', baja: 'badge-active' };
  return `<span class="badge ${map[p] || 'badge-active'}">${p || 'media'}</span>`;
}

// ── SISTEMA DE NAVEGACIÓN DINÁMICO (BACK BUTTONS) ─────────────
(function initNavigationHistory() {
  const currentPath = window.location.pathname;
  const cleanUrl = (url) => {
    return url.split('?')[0].split('#')[0];
  };
  const pageFilename = cleanUrl(currentPath.split('/').pop() || 'dashboard.html');

  if (pageFilename === 'index.html' || currentPath === '/' || currentPath === '') return;

  const getPageName = (path) => {
    const filename = cleanUrl(path.split('/').pop() || 'dashboard.html');
    const mapping = {
      'dashboard.html': 'Dashboard',
      'inventario.html': 'Inventario',
      'bodega.html': 'WMS Bodega',
      'planillas.html': 'Planillas',
      'formularios.html': 'Seguridad',
      'correos.html': 'Correos',
      'admin.html': 'Usuarios',
      'analytics.html': 'Analytics',
      'charlas.html': 'Charlas',
      'checklist.html': 'Checklist',
      'crm.html': 'CRM',
      'finanzas.html': 'Finanzas',
      'gastos.html': 'Gastos',
      'ruta.html': 'Ruta',
      'tareas.html': 'Tareas',
      'turno.html': 'Jornada',
      'vehiculos.html': 'Flota',
      'viajes.html': 'Viajes'
    };
    return mapping[filename] || 'Dashboard';
  };

  let stack = [];
  try {
    stack = JSON.parse(sessionStorage.getItem('silog_nav_stack')) || [];
  } catch (e) {}

  if (pageFilename === 'dashboard.html') {
    stack = [{ url: 'dashboard.html', name: 'Dashboard' }];
    sessionStorage.setItem('silog_nav_stack', JSON.stringify(stack));
    return;
  }

  const index = stack.findIndex(p => cleanUrl(p.url) === pageFilename);
  if (index !== -1) {
    stack = stack.slice(0, index + 1);
  } else {
    if (stack.length === 0) {
      stack.push({ url: 'dashboard.html', name: 'Dashboard' });
    }
    stack.push({ url: pageFilename, name: getPageName(pageFilename) });
  }
  sessionStorage.setItem('silog_nav_stack', JSON.stringify(stack));

  let prevPage = { url: 'dashboard.html', name: 'Dashboard' };
  if (stack.length > 1) {
    prevPage = stack[stack.length - 2];
  }

  const configureBackButton = () => {
    let backBtn = document.querySelector('.btn-back');

    if (!backBtn) {
      const navbar = document.querySelector('.navbar');
      if (navbar) {
        backBtn = document.createElement('button');
        backBtn.className = 'btn-back';
        const logo = navbar.querySelector('.navbar-logo');
        if (logo) {
          logo.after(backBtn);
        } else {
          navbar.prepend(backBtn);
        }
      }
    }

    if (backBtn) {
      backBtn.removeAttribute('onclick');
      backBtn.innerHTML = `← Volver a ${prevPage.name}`;
      backBtn.onclick = (e) => {
        e.preventDefault();
        window.location.href = prevPage.url;
      };
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', configureBackButton);
  } else {
    configureBackButton();
  }
})();
