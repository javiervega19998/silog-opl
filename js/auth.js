// ══════════════════════════════════════════════
// AUTH HELPERS — SILOG SpA v2
// ══════════════════════════════════════════════
let currentUser     = null;
let currentUserData = null;

// ── Normaliza campos Firestore → formato interno ──────────────
function normalizeUserData(raw) {
  return {
    name:   raw.nombre              || raw.name  || '',
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
  // 1) Por UID
  let snap = await db.collection('users').doc(user.uid).get();
  if (snap.exists) return normalizeUserData(snap.data());

  // 2) Por correo_electronico
  const q1 = await db.collection('users')
    .where('correo_electronico', '==', user.email).limit(1).get();
  if (!q1.empty) return normalizeUserData(q1.docs[0].data());

  // 3) Por email (campo inglés)
  const q2 = await db.collection('users')
    .where('email', '==', user.email).limit(1).get();
  if (!q2.empty) return normalizeUserData(q2.docs[0].data());

  // 4) Perfil mínimo si no existe documento
  return normalizeUserData({ nombre: user.displayName || user.email, rol: 'conductor', area: 'Operaciones' });
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
  return role === 'admin';
}
function isViewerRole(role) {
  // admin, administrativo y administrativo.conductor tienen acceso a reportes
  return ['admin','administrativo','administrativo.conductor'].includes((role||'').toLowerCase());
}
function isConductorRole(role) {
  // conductor y administrativo.conductor pueden registrar viajes/checklists
  return ['conductor','administrativo.conductor'].includes((role||'').toLowerCase());
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
  await db.collection('users').doc(uid).set({
    correo_electronico: email,
    nombre:    userData.nombre    || '',
    rut:       userData.rut       || '',
    telefono:  userData.telefono  || '',
    area:      userData.area      || 'Operaciones',
    rol:       'conductor',
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
  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl)   nameEl.textContent   = displayName;
  if (roleEl)   roleEl.textContent   = userData.role === 'admin'
    ? `Administrador · ${userData.area}`
    : `Conductor · ${userData.area}`;
}

// ── Cerrar sesión ─────────────────────────────────────────────
function logout() {
  auth.signOut().then(() => { window.location.href = '/index.html'; });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 3200);
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
