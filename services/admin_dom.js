/**
 * ui/admin_dom.js
 * Capa de Presentación (Módulo ES6) para el panel de administración de Silog SpA.
 * Contiene únicamente lógica de manipulación del DOM, renderizado e interacciones.
 * No realiza llamadas directas a base de datos (SRP).
 */

/**
 * Sanitiza una cadena de texto para prevenir ataques XSS.
 * @param {string} str - Texto a sanitizar.
 * @returns {string} Texto sanitizado.
 */
export function sanitize(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>'"]/g, match => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  })[match]);
}

/**
 * Muestra una alerta visual crítica en el DOM.
 * @param {string} mensaje - Texto del error.
 */
export function mostrarAlertaError(mensaje) {
  let container = document.getElementById('error-alert-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'error-alert-container';
    container.style.cssText = 'position:fixed;top:20px;right:20px;z-index:99999;display:flex;flex-direction:column;gap:10px;';
    document.body.appendChild(container);
  }
  const alert = document.createElement('div');
  alert.style.cssText = 'background:#EF4444;color:white;padding:12px 16px;border-radius:8px;box-shadow:0 4px 6px rgba(0,0,0,0.1);font-weight:600;font-size:0.85rem;animation:slideIn 0.3s ease;';
  alert.innerHTML = `⚠️ ${sanitize(mensaje)}`;
  container.appendChild(alert);
  setTimeout(() => {
    alert.style.opacity = '0';
    alert.style.transition = 'opacity 0.3s';
    setTimeout(() => alert.remove(), 300);
  }, 5000);
}

/**
 * Formatea una marca de tiempo/fecha de Firebase o JS a texto local de Chile.
 * @param {any} ts - Timestamp de Firestore, Date o string.
 * @returns {string} Fecha formateada.
 */
function formatDate(ts) {
  if (typeof window.formatDate === 'function') {
    return window.formatDate(ts);
  }
  if (!ts) return '—';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return date.toLocaleDateString('es-CL');
  } catch (e) {
    return String(ts);
  }
}

/**
 * Actualiza los contadores de la barra superior del Dashboard.
 * @param {Object} stats - Estadísticas básicas.
 */
export function updateDashboardKPIs(stats) {
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.textContent = v;
  };
  setVal('s-users', stats.usersCount);
  setVal('s-vehicles', stats.vehiclesCount);
  setVal('s-checklists', stats.checklistsCount);
  setVal('s-tasks', stats.tasksCount);
  
  const badge = document.getElementById('notif-badge');
  if (badge) {
    if (stats.notifCount > 0) {
      badge.textContent = stats.notifCount;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  }
}

/**
 * Abre el modal de edición de usuario e inyecta sus datos.
 * @param {Object} user - Datos del usuario.
 */
export function showUserModal(user) {
  const setVal = (id, v) => {
    const el = document.getElementById(id);
    if (el) el.value = v || '';
  };
  setVal('u-docid', user.id);
  setVal('u-nombre', user.nombre);
  setVal('u-apellido', user.apellido);
  setVal('u-rut', user.rut);
  setVal('u-area', user.area);
  setVal('u-rol', (user.rol || user.role || 'conductor').toLowerCase());
  setVal('u-estado', user.estado || 'Activo');
  
  const modal = document.getElementById('modal-user');
  if (modal) modal.classList.add('open');
}

/**
 * Cierra el modal de usuario.
 */
export function closeUserModal() {
  const modal = document.getElementById('modal-user');
  if (modal) modal.classList.remove('open');
}

/**
 * Renderiza la lista de usuarios en formato tabla con sus controles correspondientes.
 * @param {HTMLElement} container - Contenedor HTML.
 * @param {Array} docs - Lista de usuarios.
 * @param {Object} actions - Callbacks de acciones.
 */
export function renderUsersTable(container, docs, { onEdit, onDelete, onSyncRoles, onMigrate }) {
  if (!docs || !docs.length) {
    container.innerHTML = '<div class="empty">Sin usuarios registrados.</div>';
    return;
  }
  
  let rows = '';
  docs.forEach(u => {
    const isViewer = typeof window.isViewerRole === 'function' ? window.isViewerRole(u.rol || u.role) : (u.rol === 'admin' || u.rol === 'administrativo');
    const rolClass = isViewer ? 'p-admin' : 'p-conductor';
    const rolLabel = sanitize(u.rol || u.role || 'conductor');
    const estClass = u.estado === 'Activo' ? 'p-activo' : 'p-inactivo';
    const nombre_completo = u.nombre_completo || ((u.nombre || '') + ' ' + (u.apellido || '')).trim() || u.nombre || u.name || '—';
    
    rows += `<tr>
      <td><strong>${sanitize(nombre_completo)}</strong><br><small style="color:var(--text2)">${sanitize(u.correo_electronico || u.email || '—')}</small></td>
      <td>${sanitize(u.rut || '—')}</td>
      <td>${sanitize(u.area || '—')}</td>
      <td><span class="pill ${rolClass}">${rolLabel}</span></td>
      <td><span class="pill ${estClass}">${sanitize(u.estado || 'Activo')}</span></td>
      <td style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="btn-sm btn-edit-user" data-id="${u.id}">✏️ Editar</button>
        <button class="btn-sm danger btn-delete-user" data-id="${u.id}" data-name="${sanitize(nombre_completo)}">🗑️ Eliminar</button>
      </td>
    </tr>`;
  });
  
  container.innerHTML = `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Nombre / Correo</th>
            <th>RUT</th>
            <th>Área</th>
            <th>Rol</th>
            <th>Estado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    <div style="margin-top:16px;padding:14px 16px;background:var(--surface2);border-radius:10px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:.85rem;font-weight:600;margin-bottom:2px">&#x1F510; Herramientas de Roles</div>
        <div style="font-size:.75rem;color:var(--text2)">Sincroniza o migra los roles a UID para activar seguridad avanzada.</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn-sm btn-sync-roles" style="background:var(--primary);color:#fff;border-color:var(--primary)">&#x1F504; Sincronizar Roles</button>
        <button class="btn-sm btn-migrate-users" style="background:#7C3AED;color:#fff;border-color:#7C3AED">&#x1F501; Migrar a UID</button>
      </div>
    </div>
  `;
  
  // Asociar eventos por DOM
  container.querySelectorAll('.btn-edit-user').forEach(btn => {
    btn.onclick = () => onEdit(btn.dataset.id);
  });
  container.querySelectorAll('.btn-delete-user').forEach(btn => {
    btn.onclick = () => onDelete(btn.dataset.id, btn.dataset.name);
  });
  
  const btnSync = container.querySelector('.btn-sync-roles');
  if (btnSync) btnSync.onclick = onSyncRoles;
  
  const btnMigrate = container.querySelector('.btn-migrate-users');
  if (btnMigrate) btnMigrate.onclick = onMigrate;
}

/**
 * Renderiza la lista de Checklists diarios cargados.
 * @param {HTMLElement} container - Contenedor HTML.
 * @param {Array} docs - Checklists de vehículos.
 * @param {Object} actions - Callbacks.
 */
export function renderChecklists(container, docs, { onDownload, onDelete }) {
  if (!docs || !docs.length) {
    container.innerHTML = '<div class="empty">Sin checklists registrados.</div>';
    return;
  }
  
  let html = '';
  docs.forEach(r => {
    const obs = [
      r.chequeo_frenos && r.chequeo_frenos !== 'Check' ? 'Frenos: ' + r.chequeo_frenos : '',
      !r.condicion_fisica ? 'Cond.fisica' : '',
      !r.descanso_operador ? 'Descanso insuf.' : '',
      r.medicamentos_chequeo ? 'Med: ' + (r.medicamentos_detalle || 'Si') : '',
    ].filter(Boolean).join(' | ') || 'Sin observaciones';
    
    html += `<div class="ck-item">
      <div class="ck-top">
        <div>
          <div class="ck-plate">&#x1F69B; ${sanitize(r.patente_chequeo || '-')}</div>
          <div class="ck-name">&#x1F464; ${sanitize(r.nombre_operador || '-')}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn-sm btn-download-checklist" data-id="${r.id}">&#x2B07; PDF</button>
          <button class="btn-sm danger btn-delete-checklist" data-id="${r.id}">Eliminar</button>
        </div>
      </div>
      <div class="ck-date">Fecha: ${formatDate(r.fecha_chequeo)} | Comb: ${sanitize(r.nivel_combustible || '-')}</div>
      <div style="font-size:.75rem;color:var(--text2);margin-top:4px">${sanitize(obs)}</div>
    </div>`;
  });
  
  container.innerHTML = html;
  
  container.querySelectorAll('.btn-download-checklist').forEach(btn => {
    btn.onclick = () => onDownload(btn.dataset.id);
  });
  container.querySelectorAll('.btn-delete-checklist').forEach(btn => {
    btn.onclick = () => onDelete(btn.dataset.id);
  });
}

/**
 * Renderiza el panel de filtros y la estructura base de Hojas de Ruta/Viajes.
 * @param {HTMLElement} container - Contenedor HTML principal.
 * @param {Object} uniqueConductorsMap - Mapa de email -> Nombre de conductor.
 * @param {string} selectedConductor - Filtro actual de conductor.
 * @param {string} selectedFecha - Filtro actual de fecha.
 * @param {Object} actions - Callbacks.
 */
export function renderViajesFilters(container, uniqueConductorsMap, selectedConductor, selectedFecha, { onFilterChange, onClear }) {
  let condOptions = '';
  Object.keys(uniqueConductorsMap).forEach(email => {
    const isSelected = email === selectedConductor ? 'selected' : '';
    condOptions += `<option value="${sanitize(email)}" ${isSelected}>${sanitize(uniqueConductorsMap[email])} (${sanitize(email)})</option>`;
  });
  
  container.innerHTML = `
    <div id="viajes-filter-bar" style="background:var(--surface);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
      <div style="flex:1;min-width:200px">
        <label style="display:block;font-size:0.7rem;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:600">Filtrar por Conductor</label>
        <select id="viajes-filter-conductor" class="field" style="padding:8px 12px;font-size:0.85rem;">
          <option value="">Todos los conductores</option>
          ${condOptions}
        </select>
      </div>
      <div style="flex:1;min-width:200px">
        <label style="display:block;font-size:0.7rem;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;font-weight:600">Filtrar por Fecha</label>
        <input type="date" id="viajes-filter-fecha" class="field" style="padding:8px 12px;font-size:0.85rem;color:var(--text);background:var(--bg);" value="${selectedFecha || ''}"/>
      </div>
      <div style="display:flex;align-items:flex-end;margin-top:16px;">
        <button class="btn-sm btn-clear-filters" style="padding:8px 16px;border-radius:8px;font-weight:600;background:var(--surface2);border-color:var(--border);">Limpiar Filtros</button>
      </div>
    </div>
    <div id="viajes-table-container"></div>
  `;
  
  const selCond = container.querySelector('#viajes-filter-conductor');
  const inpDate = container.querySelector('#viajes-filter-fecha');
  const btnClear = container.querySelector('.btn-clear-filters');
  
  const handleChange = () => {
    onFilterChange(selCond.value, inpDate.value);
  };
  
  selCond.onchange = handleChange;
  inpDate.onchange = handleChange;
  btnClear.onclick = onClear;
}

/**
 * Renderiza la tabla con el listado de viajes (Hojas de Ruta).
 * @param {HTMLElement} container - Contenedor de la tabla.
 * @param {Array} docs - Hojas de ruta.
 * @param {Object} actions - Callbacks.
 */
export function renderViajesTable(container, docs, { onEditStatus, onDelete }) {
  if (!docs || !docs.length) {
    container.innerHTML = '<div class="empty">Sin viajes coincidentes.</div>';
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
          <button class="btn-sm btn-edit-viaje" data-id="${r.id}" data-status="${statusVal}" style="background:var(--primary);color:#fff;border-color:var(--primary)">✏️</button>
          <button class="btn-sm danger btn-delete-viaje" data-id="${r.id}">🗑️</button>
        </div>
      </td>
    </tr>`;
  });
  
  container.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Conductor / Fecha</th><th>Patente</th><th>Distribuidor</th><th>Km</th><th>Entregas</th><th>Gastos Ruta</th><th>Estado</th><th>Acción</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  
  container.querySelectorAll('.btn-edit-viaje').forEach(btn => {
    btn.onclick = () => onEditStatus(btn.dataset.id, btn.dataset.status);
  });
  container.querySelectorAll('.btn-delete-viaje').forEach(btn => {
    btn.onclick = () => onDelete(btn.dataset.id);
  });
}

/**
 * Renderiza las notificaciones de checklists y eventos críticos.
 * @param {HTMLElement} container - Contenedor HTML.
 * @param {Array} docs - Notificaciones.
 * @param {Object} actions - Callbacks.
 */
export function renderNotificaciones(container, docs, { onMarkRead, onDelete }) {
  if (!docs || !docs.length) {
    container.innerHTML = '<div class="empty">Sin notificaciones.</div>';
    return;
  }
  
  container.innerHTML = '';
  docs.forEach(n => {
    const icon = n.tipo === 'checklist' ? '📋' : '✅';
    const item = document.createElement('div');
    item.className = 'ck-item';
    if (n.leida) item.style.opacity = '0.6';
    
    item.innerHTML = `
      <div class="ck-top">
        <div>
          <div class="ck-plate">${n.leida ? '' : '🔴 '} ${icon} <span class="notif-msg"></span></div>
          <div class="ck-name">👤 ${sanitize(n.nombre_operador || n.operador || '—')}${n.patente ? ` · 🚛 ${sanitize(n.patente)}` : ''}</div>
        </div>
        <div style="display:flex;gap:6px">
          ${!n.leida ? `<button class="btn-sm btn-read-notif" data-id="${n.id}">✅ Leída</button>` : '<span class="pill p-activo" style="font-size:.68rem">Leída</span>'}
          <button class="btn-sm danger btn-delete-notif" data-id="${n.id}">🗑️</button>
        </div>
      </div>
      <div class="ck-date">📅 ${formatDate(n.fecha)}</div>
    `;
    item.querySelector('.notif-msg').textContent = n.mensaje || 'Notificación';
    container.appendChild(item);
  });
  
  container.querySelectorAll('.btn-read-notif').forEach(btn => {
    btn.onclick = () => onMarkRead(btn.dataset.id);
  });
  container.querySelectorAll('.btn-delete-notif').forEach(btn => {
    btn.onclick = () => onDelete(btn.dataset.id);
  });
}

/**
 * Renderiza el listado de discrepancias en el odómetro detectadas por el sistema.
 * @param {HTMLElement} container - Contenedor HTML.
 * @param {Array} docs - Registros de discrepancias.
 * @param {Object} actions - Callbacks.
 */
export function renderDiscrepancias(container, docs, { onResolve, onDelete }) {
  if (!docs || !docs.length) {
    container.innerHTML = '<div class="empty">Sin discrepancias de KM registradas.</div>';
    return;
  }
  
  let html = '';
  docs.forEach(r => {
    const isPend = r.estado === 'pendiente' || r.estado === 'pendiente_revision' || !r.estado;
    const badgeClass = isPend ? 'p-inactivo' : 'p-activo';
    const estadoLabel = isPend ? 'Pendiente' : sanitize(r.estado);
    const diffKm = r.diferencia_km || 0;
    const diffSign = diffKm > 0 ? `+${diffKm}` : `${diffKm}`;
    
    let borderStyle = 'border-left: 5px solid var(--border);';
    let diffColor = 'var(--text)';
    
    if (r.tipo === 'km_regresion' || diffKm < 0) {
      borderStyle = 'border-left: 5px solid #a855f7;';
      diffColor = '#a855f7';
    } else {
      const absDiff = Math.abs(diffKm);
      if (absDiff <= 10) {
        borderStyle = 'border-left: 5px solid var(--success);';
        diffColor = 'var(--success)';
      } else if (absDiff > 10 && absDiff <= 50) {
        borderStyle = 'border-left: 5px solid var(--warning);';
        diffColor = 'var(--warning)';
      } else {
        borderStyle = 'border-left: 5px solid var(--danger);';
        diffColor = 'var(--danger)';
      }
    }
    
    html += `
      <div class="ck-item" style="${borderStyle} ${!isPend ? 'opacity:.8' : ''}">
        <div class="ck-top">
          <div>
            <div class="ck-plate">🚛 ${sanitize(r.patente || '—')} <span class="pill ${badgeClass}" style="margin-left:8px;font-size:0.65rem">${estadoLabel}</span></div>
            <div class="ck-name">👤 Conductor: <strong>${sanitize(r.conductor_nombre || '—')}</strong> (${sanitize(r.conductor_email || '—')})</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${isPend ? `<button class="btn-sm btn-resolve-discrepancia" data-id="${r.id}" data-patente="${sanitize(r.patente || '')}" data-km="${r.km_inicial_nuevo || 0}">⚖️ Resolver</button>` : ''}
            <button class="btn-sm danger btn-delete-discrepancia" data-id="${r.id}">🗑️</button>
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
  
  container.innerHTML = html;
  
  container.querySelectorAll('.btn-resolve-discrepancia').forEach(btn => {
    btn.onclick = () => onResolve(btn.dataset.id, btn.dataset.patente, parseFloat(btn.dataset.km));
  });
  container.querySelectorAll('.btn-delete-discrepancia').forEach(btn => {
    btn.onclick = () => onDelete(btn.dataset.id);
  });
}

/**
 * Renderiza el listado de distribuidores configurados para Logística Inversa.
 * @param {HTMLElement} container - Contenedor HTML.
 * @param {Array} docs - Listado de distribuidores e inversores.
 * @param {Object} actions - Callbacks.
 */
export function renderInversaConfig(container, docs, { onAdd, onToggle, onDelete }) {
  let listRows = '';
  docs.forEach(d => {
    const isDefault = (d.nombre || '').trim().toUpperCase() === 'DISTRIBUIDOR TOTAL';
    const statusLabel = d.activo ? 'Habilitado' : 'Deshabilitado';
    const statusClass = d.activo ? 'p-activo' : 'p-inactivo';
    
    listRows += `
      <tr>
        <td><strong>${sanitize(d.nombre || '')}</strong></td>
        <td><span class="pill ${statusClass}">${statusLabel}</span></td>
        <td>
          ${isDefault ? `<small style="color:var(--text2)">Predefinido (Activo)</small>` : `
            <button class="btn-sm btn-toggle-inversa" data-id="${d.id}" data-active="${!d.activo}">
              ${d.activo ? 'Deshabilitar' : 'Habilitar'}
            </button>
            <button class="btn-sm danger btn-delete-inversa" data-id="${d.id}" style="margin-left:6px">🗑️ Eliminar</button>
          `}
        </td>
      </tr>
    `;
  });
  
  container.innerHTML = `
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:16px">
      <h3 style="font-size:1rem;color:var(--accent);margin-bottom:10px">🔄 Configuración de Logística Inversa</h3>
      <p style="font-size:.82rem;color:var(--text2);margin-bottom:16px">
        Determina qué distribuidores ingresarán mercadería a bodega en caso de devolución. El sistema predefinido habilita <b>Distribuidor TOTAL</b> por defecto.
      </p>
      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
        <input type="text" id="new-dist-inversa" class="field" placeholder="Nombre del Distribuidor (Ej: Falabella)" style="max-width:320px"/>
        <button class="btn-sm btn-add-inversa" style="background:var(--primary);color:#fff;border-color:var(--primary);padding:10px 18px;font-weight:600;border-radius:8px">➕ Asignar Distribuidor</button>
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
            ${listRows}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  const inputEl = container.querySelector('#new-dist-inversa');
  const btnAdd = container.querySelector('.btn-add-inversa');
  
  btnAdd.onclick = () => {
    const val = inputEl.value.trim();
    if (val) {
      onAdd(val);
      inputEl.value = '';
    }
  };
  
  container.querySelectorAll('.btn-toggle-inversa').forEach(btn => {
    btn.onclick = () => onToggle(btn.dataset.id, btn.dataset.active === 'true');
  });
  container.querySelectorAll('.btn-delete-inversa').forEach(btn => {
    btn.onclick = () => onDelete(btn.dataset.id);
  });
}

/**
 * Renderiza la tabla de despachos (Prueba de Entrega POD / Devoluciones).
 * @param {HTMLElement} container - Contenedor HTML.
 * @param {Array} docs - Lista de despachos.
 */
export function renderDespachosTable(container, docs) {
  if (!docs || !docs.length) {
    container.innerHTML = '<div class="empty">Sin despachos registrados.</div>';
    return;
  }
  
  let rows = '';
  docs.forEach(r => {
    const fecha = formatDate(r.fecha);
    const conductor = sanitize(r.conductor_email || '—');
    const distribuidor = sanitize(r.distribuidor || '—');
    const cliente = sanitize(r.cliente_nombre || '—');
    const guia = sanitize(r.guia_numero || '—');
    const estado = r.estado || 'pendiente';
    
    const badgeCls = { 'pendiente': 'p-inactivo', 'entregado': 'p-activo', 'devuelto': 'p-inactivo' }[estado] || 'p-inactivo';
    const badgeTxt = { 'pendiente': '⏳ Pendiente', 'entregado': '🟢 Entregado', 'devuelto': '🔴 Devuelto' }[estado] || estado;
    
    let photoUrl = '';
    if (estado === 'entregado') photoUrl = r.pod_foto_url || '';
    else if (estado === 'devuelto') photoUrl = r.devolucion_foto_url || '';
    
    let action = '—';
    if (photoUrl && photoUrl.startsWith('http')) {
      action = `
        <div style="display:flex;gap:4px">
          <button class="btn-sm btn-view-photo" data-url="${photoUrl}">👁️ Ver</button>
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
  
  container.innerHTML = `<div class="table-wrap"><table><thead><tr><th>Fecha</th><th>Conductor</th><th>Distribuidor</th><th>Cliente</th><th>Documento</th><th>Estado</th><th>Foto (POD / Dev)</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  
  container.querySelectorAll('.btn-view-photo').forEach(btn => {
    btn.onclick = () => window.open(btn.dataset.url, '_blank');
  });
}

/**
 * Renderiza el Dashboard Ejecutivo (Mini gráficos, KPIs e indicadores).
 * @param {HTMLElement} container - Contenedor HTML del Dashboard.
 * @param {Object} stats - Estadísticas consolidadas.
 * @param {number} activePeriod - Días del período actual (7, 15, 30).
 * @param {Object} actions - Callbacks.
 */
export function renderExecutiveDashboard(container, stats, activePeriod, { onPeriodChange }) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px">
      <h3 style="font-size:1.1rem;font-weight:700">📊 Panel de Resumen Ejecutivo</h3>
      <div class="period-bar" style="display:flex;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:3px">
        <button class="period-btn btn-period-7 ${activePeriod === 7 ? 'active' : ''}" data-days="7" style="background:transparent;border:none;color:var(--text2);padding:6px 12px;font-size:.78rem;font-weight:600;border-radius:7px;cursor:pointer">7 Días</button>
        <button class="period-btn btn-period-15 ${activePeriod === 15 ? 'active' : ''}" data-days="15" style="background:transparent;border:none;color:var(--text2);padding:6px 12px;font-size:.78rem;font-weight:600;border-radius:7px;cursor:pointer">15 Días</button>
        <button class="period-btn btn-period-30 ${activePeriod === 30 ? 'active' : ''}" data-days="30" style="background:transparent;border:none;color:var(--text2);padding:6px 12px;font-size:.78rem;font-weight:600;border-radius:7px;cursor:pointer">30 Días</button>
      </div>
    </div>
    
    <div id="exec-kpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:20px"></div>
    
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:16px">
      <div class="ck-item" style="padding:16px">
        <h4 style="font-size:.8rem;color:var(--text2);text-transform:uppercase;margin-bottom:10px">📦 Entregas vs Devoluciones</h4>
        <div id="ex-entregas" style="display:flex;justify-content:space-between;align-items:flex-end;height:120px;padding-bottom:10px"></div>
      </div>
      <div class="ck-item" style="padding:16px">
        <h4 style="font-size:.8rem;color:var(--text2);text-transform:uppercase;margin-bottom:10px">💰 Gastos de Ruta</h4>
        <div id="ex-gastos" style="display:flex;justify-content:space-between;align-items:flex-end;height:120px;padding-bottom:10px"></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin-bottom:16px">
      <div class="ck-item" style="padding:16px">
        <h4 style="font-size:.8rem;color:var(--text2);text-transform:uppercase;margin-bottom:12px">📊 OTIF por Vehículo</h4>
        <div id="ex-otif" style="display:flex;flex-direction:column;gap:8px"></div>
      </div>
      <div class="ck-item" style="padding:16px">
        <h4 style="font-size:.8rem;color:var(--text2);text-transform:uppercase;margin-bottom:12px">📦 Inventario por Estado</h4>
        <div id="ex-inv"></div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">
      <div class="ck-item" style="padding:16px">
        <h4 style="font-size:.8rem;color:var(--text2);text-transform:uppercase;margin-bottom:10px">🚛 Movimientos Bodega</h4>
        <div id="ex-bodega" style="display:flex;justify-content:space-between;align-items:flex-end;height:120px;padding-bottom:10px"></div>
      </div>
      <div class="ck-item" style="padding:16px">
        <h4 style="font-size:.8rem;color:var(--text2);text-transform:uppercase;margin-bottom:12px">👤 Ranking Conductores (Entregas)</h4>
        <div id="ex-ranking" style="display:flex;flex-direction:column;gap:6px"></div>
      </div>
    </div>
  `;
  
  // Registrar clicks en filtros del dashboard ejecutivo
  container.querySelectorAll('.period-btn').forEach(btn => {
    btn.onclick = () => onPeriodChange(parseInt(btn.dataset.days));
  });
  
  // Renderizar KPIs
  const otifValue = stats.otif || 0;
  const otifColor = otifValue >= 80 ? 'color:var(--success)' : otifValue >= 60 ? 'color:var(--warning)' : 'color:var(--danger)';
  
  container.querySelector('#exec-kpis').innerHTML = [
    { icon: '🚛', val: stats.turnosCount, lbl: `Turnos (${activePeriod}d)`, cls: '' },
    { icon: '📦', val: stats.entregasCount, lbl: `Entregas (${activePeriod}d)`, cls: 'color:var(--success)' },
    { icon: '📊', val: otifValue + '%', lbl: `OTIF (${activePeriod}d)`, cls: otifColor },
    { icon: '💰', val: '$' + (stats.totalGastos / 1000).toFixed(0) + 'k', lbl: `Gastos Ruta (${activePeriod}d)`, cls: 'color:var(--danger)' },
    { icon: '📄', val: '$' + (stats.totalFacturado / 1000).toFixed(0) + 'k', lbl: 'Facturado', cls: 'color:var(--success)' }
  ].map(k => `
    <div class="kpi-mini">
      <div style="font-size:1rem">${k.icon}</div>
      <div class="km-val" style="${k.cls}">${k.val}</div>
      <div class="km-lbl">${k.lbl}</div>
    </div>
  `).join('');
  
  // Renderizar mini gráfico de entregas
  renderMiniBarGraph(container.querySelector('#ex-entregas'), stats.entregasBuckets);
  
  // Renderizar mini gráfico de gastos
  renderMiniBarMoneyGraph(container.querySelector('#ex-gastos'), stats.gastosBuckets);
  
  // Renderizar barras de progreso OTIF por patente
  const otifEl = container.querySelector('#ex-otif');
  if (stats.vehResults && stats.vehResults.length) {
    otifEl.innerHTML = stats.vehResults.map(r => {
      const pct = r.pct;
      const color = pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)';
      return `<div class="prog-row">
        <div class="prog-row-top">
          <span><code style="color:var(--accent)">${sanitize(r.vehicle)}</code> <span style="font-size:.7rem;color:var(--text2)">${r.count}/${r.total} viajes</span></span>
          <span style="font-weight:700;color:${color}">${pct}%</span>
        </div>
        <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
    }).join('');
  } else {
    otifEl.innerHTML = '<div class="empty">Sin datos</div>';
  }
  
  // Renderizar inventario
  const invColors = { disponible: '#10B981', en_transito: '#3B82F6', reservado: '#F59E0B', dañado: '#EF4444' };
  const invLabels = { disponible: 'Disponible', en_transito: 'En Tránsito', reservado: 'Reservado', dañado: 'Dañado' };
  const invTotal = stats.invTotal || 1;
  const lowStockHtml = stats.lowStock ? `<div style="margin-top:6px;background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);border-radius:8px;padding:4px 10px;font-size:.72rem;color:#FCA5A5">⚠️ ${stats.lowStock} bajo stock</div>` : '';
  
  container.querySelector('#ex-inv').innerHTML = `
    <div style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
      <div style="flex:1;min-width:180px">${Object.entries(stats.invByStatus).map(([s, c]) => {
        const pct = Math.round(c / invTotal * 100);
        return `<div class="prog-row">
          <div class="prog-row-top"><span>${invLabels[s] || s}</span><span style="font-weight:700">${c} uds (${pct}%)</span></div>
          <div class="prog-track"><div class="prog-fill" style="width:${pct}%;background:${invColors[s] || '#8A9DC0'}"></div></div>
        </div>`;
      }).join('')}</div>
      <div style="text-align:center">
        <div style="font-size:2rem;font-weight:800">${stats.invItemsCount}</div>
        <div style="font-size:.68rem;color:var(--text2)">PRODUCTOS</div>
        ${lowStockHtml}
      </div>
    </div>`;
    
  // Renderizar movimientos de bodega
  const mColors = { ingreso: '#10B981', salida: '#3B82F6', merma: '#EF4444', devolucion: '#F59E0B', ajuste: '#8B5CF6' };
  const mEntries = Object.entries(stats.mByType).sort((a, b) => b[1] - a[1]);
  const mMax = Math.max(...mEntries.map(([, v]) => v), 1);
  const bodegaEl = container.querySelector('#ex-bodega');
  if (mEntries.length) {
    bodegaEl.innerHTML = mEntries.map(([t, c]) => {
      const h = Math.max((c / mMax) * 80, 4);
      return `<div class="mini-bar-col">
        <div class="mini-bar-val">${c}</div>
        <div class="mini-bar" style="height:${h}px;background:${mColors[t] || '#8A9DC0'}"></div>
        <div class="mini-bar-lbl">${sanitize(t)}</div>
      </div>`;
    }).join('');
  } else {
    bodegaEl.innerHTML = '<div class="empty">Sin datos</div>';
  }
  
  // Renderizar ranking de conductores
  const rankingEl = container.querySelector('#ex-ranking');
  if (stats.ranked && stats.ranked.length) {
    const rankColors = ['linear-gradient(135deg,#F59E0B,#D97706)', 'rgba(148,163,184,.3)', 'rgba(180,83,9,.3)', 'var(--surface)', 'var(--surface)'];
    const rankTextColors = ['#fff', '#CBD5E1', '#FBBF24', 'var(--text2)', 'var(--text2)'];
    rankingEl.innerHTML = stats.ranked.map(([name, d], i) => `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;margin-bottom:6px">
        <div style="width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:800;background:${rankColors[i] || 'var(--surface)'};color:${rankTextColors[i] || 'var(--text2)'};flex-shrink:0">${i + 1}</div>
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${sanitize(name.split(' ').slice(0, 2).join(' '))}</div>
          <div style="font-size:.7rem;color:var(--text2)">${d.entregas} entregas · ${d.devoluciones} devol. · ${d.otif}% OTIF (${d.count}/${d.total} viajes)</div>
        </div>
        <div style="font-weight:800;font-size:1rem;color:var(--success)">${d.entregas}</div>
      </div>
    `).join('');
  } else {
    rankingEl.innerHTML = '<div class="empty">Sin datos de entregas</div>';
  }
}

function renderMiniBarGraph(container, buckets) {
  const max = Math.max(...buckets.map(b => b.total), 1);
  container.innerHTML = buckets.map(b => {
    const hOk = Math.max((b.ok / max) * 80, 0);
    const hFail = Math.max((b.fail / max) * 80, 0);
    return `<div class="mini-bar-col">
      <div class="mini-bar-val">${b.total || ''}</div>
      <div style="display:flex;flex-direction:column;width:100%;gap:1px">
        <div class="mini-bar" style="height:${hFail}px;background:#EF4444"></div>
        <div class="mini-bar" style="height:${hOk}px;background:#10B981;border-radius:0"></div>
      </div>
      <div class="mini-bar-lbl">${sanitize(b.label)}</div>
    </div>`;
  }).join('');
}

function renderMiniBarMoneyGraph(container, buckets) {
  const max = Math.max(...buckets.map(b => b.value), 1);
  container.innerHTML = buckets.map(b => {
    const h = Math.max((b.value / max) * 80, b.value ? 2 : 0);
    return `<div class="mini-bar-col">
      <div class="mini-bar-val">${b.value ? '$' + (b.value / 1000).toFixed(0) + 'k' : ''}</div>
      <div class="mini-bar" style="height:${h}px;background:var(--accent)"></div>
      <div class="mini-bar-lbl">${sanitize(b.label)}</div>
    </div>`;
  }).join('');
}

/**
 * Renderiza un panel de KPIs operativos con estilos modernos alineados con el tema oscuro de la plataforma.
 * @param {Array} viajes - Lista de viajes o despachos.
 */
export function renderizarKPIs(viajes) {
  let total = viajes.length;
  let enRuta = 0;
  let entregados = 0;

  viajes.forEach(r => {
    const estado = (r.estado || 'pendiente_revision').toLowerCase().trim();
    if (estado === 'revisada' || estado === 'conforme' || estado === 'entregado') {
      entregados++;
    } else if (estado === 'pendiente' || estado === 'pendiente_revision' || estado === 'observada' || estado === 'en_ruta') {
      enRuta++;
    } else {
      enRuta++;
    }
  });

  // Eliminar panel existente si ya existe
  let kpiContainer = document.getElementById('panel-kpis-silog');
  if (kpiContainer) {
    kpiContainer.remove();
  }

  // Crear contenedor de KPIs
  kpiContainer = document.createElement('div');
  kpiContainer.id = 'panel-kpis-silog';
  kpiContainer.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 14px; margin-bottom: 14px; width: 100%;';

  kpiContainer.innerHTML = `
    <div class="stat-card" style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:10px 12px; display:flex; align-items:center; gap:10px; position:relative; overflow:hidden;">
      <div style="font-size:1.2rem; background:rgba(27,75,155,0.15); color:#3b82f6; width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">📋</div>
      <div>
        <div style="font-size:0.65rem; color:var(--text2); text-transform:uppercase; font-weight:700; letter-spacing:0.5px; line-height:1.1;">Total Despachos</div>
        <div style="font-size:1.15rem; font-weight:700; color:var(--text); margin-top:1px;">${total}</div>
      </div>
    </div>
    <div class="stat-card" style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:10px 12px; display:flex; align-items:center; gap:10px; position:relative; overflow:hidden;">
      <div style="font-size:1.2rem; background:rgba(244,121,32,0.15); color:var(--accent); width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">🚚</div>
      <div>
        <div style="font-size:0.65rem; color:var(--text2); text-transform:uppercase; font-weight:700; letter-spacing:0.5px; line-height:1.1;">En Ruta</div>
        <div style="font-size:1.15rem; font-weight:700; color:var(--accent); margin-top:1px;">${enRuta}</div>
      </div>
    </div>
    <div class="stat-card" style="background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:10px 12px; display:flex; align-items:center; gap:10px; position:relative; overflow:hidden;">
      <div style="font-size:1.2rem; background:rgba(16,185,129,0.15); color:var(--success); width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">🟢</div>
      <div>
        <div style="font-size:0.65rem; color:var(--text2); text-transform:uppercase; font-weight:700; letter-spacing:0.5px; line-height:1.1;">Entregados</div>
        <div style="font-size:1.15rem; font-weight:700; color:var(--success); margin-top:1px;">${entregados}</div>
      </div>
    </div>
  `;

  // Inyección al final de la página (debajo del table container)
  const tableContainer = document.getElementById('viajes-table-container');
  if (tableContainer) {
    tableContainer.after(kpiContainer);
  } else {
    document.body.appendChild(kpiContainer);
  }
}

/**
 * Renderiza e inyecta un panel de alertas de mantenimiento preventivo.
 * Lo coloca debajo del panel de KPIs (#panel-kpis-silog) o, en su defecto,
 * al final del contenedor de la tabla de viajes.
 * @param {Array} vehiculosEnAlerta - Resultado de evaluarMantenimientoFlota().
 */
export function renderizarAlertasMantenimiento(vehiculosEnAlerta) {
  // Eliminar instancia previa si ya existe
  const existente = document.getElementById('panel-alertas-mantenimiento');
  if (existente) existente.remove();

  // Si no hay alertas, no inyectar nada
  if (!vehiculosEnAlerta || vehiculosEnAlerta.length === 0) return;

  // ── Paleta por nivel de urgencia ──────────────────────────────────
  const CONFIG = {
    critico: {
      border : '#7C3AED',        // violeta → sin datos (caso desconocido)
      bg     : 'rgba(124,58,237,0.08)',
      badge  : '#7C3AED',
      icon   : '⚠️',
      label  : 'Sin Datos'
    },
    alta: {
      border : '#EF4444',        // rojo → superó umbral
      bg     : 'rgba(239,68,68,0.08)',
      badge  : '#EF4444',
      icon   : '🔴',
      label  : 'Urgente'
    },
    media: {
      border : '#F59E0B',        // amarillo → preventivo
      bg     : 'rgba(245,158,11,0.08)',
      badge  : '#F59E0B',
      icon   : '🟡',
      label  : 'Preventivo'
    }
  };

  // ── Construir tarjetas ────────────────────────────────────────────
  const tarjetas = vehiculosEnAlerta.map(v => {
    const cfg = CONFIG[v.urgencia] || CONFIG.media;
    const kmActualStr = v.kmActual != null ? v.kmActual.toLocaleString('es-CL') + ' km' : '—';
    const kmServStr   = v.kmUltimaMantencion != null
      ? v.kmUltimaMantencion.toLocaleString('es-CL') + ' km'
      : '—';
    const kmDesdeStr  = v.kmDesdeServicio != null
      ? v.kmDesdeServicio.toLocaleString('es-CL') + ' km recorridos'
      : 'Sin información';

    return `
      <div style="
        background:${cfg.bg};
        border:1px solid ${cfg.border};
        border-left:4px solid ${cfg.border};
        border-radius:10px;
        padding:10px 14px;
        display:flex;
        align-items:flex-start;
        gap:12px;
        min-width:220px;
        flex:1;
      ">
        <div style="
          font-size:1.15rem;
          width:32px;height:32px;
          border-radius:8px;
          display:flex;align-items:center;justify-content:center;flex-shrink:0;
          background:rgba(0,0,0,0.15);
        ">${cfg.icon}</div>
        <div style="flex:1;min-width:0;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap;">
            <code style="font-size:0.85rem;font-weight:800;color:var(--text);">${sanitize(v.patente)}</code>
            <span style="
              font-size:0.6rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;
              padding:1px 7px;border-radius:20px;
              background:${cfg.badge};color:#fff;
            ">${cfg.label}</span>
            <span style="font-size:0.65rem;color:var(--text2);">${sanitize(v.estado)}</span>
          </div>
          <div style="font-size:0.72rem;color:var(--text2);line-height:1.5;">
            <span>KM Actual: <strong style="color:var(--text);">${kmActualStr}</strong></span>
            &nbsp;·&nbsp;
            <span>Último svc: <strong style="color:var(--text);">${kmServStr}</strong></span>
            &nbsp;·&nbsp;
            <span style="color:${cfg.border};">${kmDesdeStr}</span>
          </div>
          <div style="font-size:0.7rem;color:${cfg.border};margin-top:4px;font-style:italic;">${sanitize(v.mensaje)}</div>
        </div>
        <!-- BOTÓN DE ACCIÓN (Registro SVC) -->
        <div style="display:flex;align-items:center;">
          <button class="btn-sm btn-registrar-svc" 
            onclick="registrarMantencionVehiculo('${v.patente}', '${v.id}')"
            style="background:var(--surface2);border:1px solid ${cfg.border};color:var(--text);padding:6px 10px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:6px;font-size:0.75rem;font-weight:600;transition:0.2s;"
            onmouseover="this.style.background='${cfg.border}';this.style.color='#fff';"
            onmouseout="this.style.background='var(--surface2)';this.style.color='var(--text)';">
            🛠️ Registrar SVC
          </button>
        </div>
      </div>`;
  }).join('');

  // ── Panel contenedor ──────────────────────────────────────────────
  const panel = document.createElement('div');
  panel.id = 'panel-alertas-mantenimiento';
  panel.style.cssText = 'margin-top:10px;margin-bottom:10px;width:100%;';
  panel.innerHTML = `
    <div style="
      background:var(--surface2);
      border:1px solid var(--border);
      border-radius:12px;
      padding:12px 14px;
    ">
      <div style="
        display:flex;align-items:center;gap:8px;margin-bottom:10px;
        font-size:0.72rem;color:var(--text2);text-transform:uppercase;
        letter-spacing:0.5px;font-weight:700;
      ">
        🔧 Alertas de Mantenimiento Preventivo
        <span style="
          margin-left:auto;background:${vehiculosEnAlerta.some(v=>v.urgencia==='alta')?'#EF4444':'#F59E0B'};
          color:#fff;font-size:0.6rem;font-weight:800;padding:2px 8px;border-radius:20px;
        ">${vehiculosEnAlerta.length} vehículo${vehiculosEnAlerta.length>1?'s':''}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        ${tarjetas}
      </div>
    </div>`;

  // ── Posicionamiento: debajo del panel de KPIs ─────────────────────
  const kpisPanel = document.getElementById('panel-kpis-silog');
  if (kpisPanel) {
    kpisPanel.after(panel);
  } else {
    const tableContainer = document.getElementById('viajes-table-container');
    if (tableContainer) {
      tableContainer.after(panel);
    } else {
      document.body.appendChild(panel);
    }
  }
}

export function inyectarBarraBusqueda() {
  // Anchor de referencia: panel de alertas de mantenimiento si existe,
  // de lo contrario el panel de KPIs, y como último recurso el table-container.
  const alertasPanel  = document.getElementById('panel-alertas-mantenimiento');
  const kpisBar       = document.getElementById('panel-kpis-silog');
  const tableContainer = document.getElementById('viajes-table-container');
  if (!tableContainer) return;

  // Si ya existe el wrapper, no re-inyectar
  if (document.getElementById('toolbar-busqueda-bi')) return;

  // ── Wrapper horizontal ──────────────────────────────────────────
  const wrapper = document.createElement('div');
  wrapper.id = 'toolbar-busqueda-bi';
  wrapper.style.cssText = [
    'display:flex',
    'align-items:center',
    'gap:8px',
    'flex-wrap:wrap',
    'margin-top:10px',
    'margin-bottom:10px',
    'width:100%',
  ].join(';');

  // ── Input de búsqueda ───────────────────────────────────────────
  const searchInput = document.createElement('input');
  searchInput.type        = 'text';
  searchInput.id          = 'buscador-flota';
  searchInput.placeholder = 'Buscar por Patente o Guía...';
  searchInput.className   = 'field';
  searchInput.style.cssText = [
    'flex:1',
    'min-width:180px',
    'max-width:320px',
    'padding:7px 11px',
    'font-size:0.78rem',
    'border-radius:8px',
    'border:1px solid var(--border)',
    'background:var(--bg)',
    'color:var(--text)',
    'outline:none',
    'transition:border-color 0.2s',
  ].join(';');

  searchInput.onfocus = () => { searchInput.style.borderColor = 'var(--primary)'; };
  searchInput.onblur  = () => { searchInput.style.borderColor = 'var(--border)'; };

  // ── Botón exportar BI ───────────────────────────────────────────
  const btnExport = document.createElement('button');
  btnExport.id        = 'btn-exportar-bi';
  btnExport.className = 'btn-sm';
  btnExport.title     = 'Exportar datos filtrados a CSV para Power BI';
  btnExport.style.cssText = [
    'display:inline-flex',
    'align-items:center',
    'gap:6px',
    'padding:7px 14px',
    'font-size:0.75rem',
    'font-weight:700',
    'border-radius:8px',
    'border:1px solid #059669',
    'background:rgba(5,150,105,0.12)',
    'color:#10B981',
    'cursor:pointer',
    'white-space:nowrap',
    'transition:background 0.2s,color 0.2s',
    'letter-spacing:0.3px',
  ].join(';');
  btnExport.innerHTML = '⬇️ Exportar CSV BI';

  btnExport.onmouseenter = () => {
    btnExport.style.background = '#059669';
    btnExport.style.color      = '#fff';
  };
  btnExport.onmouseleave = () => {
    btnExport.style.background = 'rgba(5,150,105,0.12)';
    btnExport.style.color      = '#10B981';
  };

  wrapper.appendChild(searchInput);
  wrapper.appendChild(btnExport);

  // ── Posicionamiento: debajo del panel de alertas o KPIs ─────────
  const anchor = alertasPanel || kpisBar;
  if (anchor) {
    anchor.after(wrapper);
  } else {
    tableContainer.before(wrapper);
  }
}

