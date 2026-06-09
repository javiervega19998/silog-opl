import { renderizarKPIs, inyectarBarraBusqueda, renderizarAlertasMantenimiento, mostrarAlertaError } from '../services/admin_dom.js';
import { generarDatasetBI } from '../services/export_pipeline.js';
/**
 * admin_main.js
 * Controlador principal (Orquestador) para el panel de administración de Silog SpA.
 * Conecta la lógica de negocio (Servicios) con la interfaz de usuario (DOM).
 * No contiene lógica de base de datos directa ni manipulaciones crudas del DOM.
 */

import { 
  getAllUsers, 
  getUserById, 
  updateUser, 
  deleteUser, 
  syncAllClaims, 
  migrateUsersToUID 
} from '../services/admin_users.js';

import { 
  getAllVehicles, 
  getVehicleById, 
  saveVehicle, 
  deleteVehicle, 
  assignDriverToVehicle, 
  getVehicleHistory,
  getAllChecklists, 
  deleteChecklist,
  getAllViajes, 
  updateViajeStatus, 
  deleteViaje,
  getAllNotificaciones, 
  markNotificacionLeida, 
  deleteNotificacion,
  getAllDiscrepancias, 
  resolverDiscrepancia, 
  resolverDiscrepanciaConOdometro, 
  deleteDiscrepancia,
  getInversaConfig, 
  agregarDistribuidorInversa, 
  toggleDistribuidorInversa, 
  eliminarDistribuidorInversa,
  getAllDespachos, 
  cleanOldDespachoPhotos, 
  getExecutiveStats,
  getDashboardKPIs,
  evaluarMantenimientoFlota
} from '../services/admin_fleet.js';

import { 
  sanitize,
  updateDashboardKPIs, 
  showUserModal, 
  closeUserModal,
  renderUsersTable, 
  renderChecklists, 
  renderViajesFilters, 
  renderViajesTable,
  renderNotificaciones, 
  renderDiscrepancias, 
  renderInversaConfig, 
  renderDespachosTable,
  renderExecutiveDashboard
} from '../services/admin_dom.js';

import { logError } from '../services/logger.js';

// Estado global local de la vista administrativa
const state = {
  curTab: 'ejecutivo',
  allDocs: [],
  curPage: 0,
  originalViajesDocs: [],
  execDays: 7,
  email: '',
  uid: '',
  viajesFilterConductor: '',
  viajesFilterFecha: ''
};

const PAGE_SIZE = 20;

// ── Inicialización de la Aplicación ──────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  // Suscribirse al evento de autenticación global (definido en auth.js)
  if (typeof requireAdmin === 'function') {
    requireAdmin(async (user, data) => {
      try {
        state.email = data.correo_electronico || data.email || user.email;
        state.uid = user.uid;
        
        await loadStats();
        await showTab('ejecutivo');
        
        // Limpiar fotos de despachos antiguas (>24h) en segundo plano
        cleanOldDespachoPhotos().catch(err => {
          logError(err, 'AdminMain');
          console.warn("Error running cleanOldDespachoPhotos:", err);
        });
      } catch (err) {
        logError(err, 'AdminMain');
        console.error("Error al inicializar sesión administrativa:", err);
      }
    });
  } else {
    console.error("requireAdmin global helper is not loaded.");
  }
}

// Registrar funciones en el objeto window para interactuar con admin.html
window.saveUser = handleSaveUser;
window.closeModal = closeUserModal;
window.changePage = changePage;
window.exportCurrentTab = exportCurrentTab;
window.showTab = showTab;
window.setExecPeriod = setExecPeriod;

function setExecPeriod(days, el) {
  state.execDays = days;
  document.querySelectorAll('.period-bar .period-btn').forEach(b => b.classList.remove('active'));
  if (el) el.classList.add('active');
  loadExecDashboard();
}

// ── Carga y Navegación de Pestañas (Tabs) ─────────────────────────

async function showTab(tab) {
  state.curTab = tab;
  state.curPage = 0;
  
  // Actualizar clases activas en botones de pestañas
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('tb-' + tab);
  if (btn) btn.classList.add('active');
  
  const c = document.getElementById('tab-content');
  const exec = document.getElementById('tab-ejecutivo');
  const toolbar = document.getElementById('tab-toolbar');
  
  if (tab === 'ejecutivo') {
    if (exec) exec.style.display = 'block';
    if (c) c.style.display = 'none';
    if (toolbar) toolbar.style.display = 'none';
    await loadExecDashboard();
    return;
  }
  
  if (exec) exec.style.display = 'none';
  if (c) {
    c.style.display = 'block';
    c.innerHTML = '<div class="empty"><span class="spinner"></span></div>';
  }
  
  if (toolbar) {
    toolbar.style.display = tab === 'inversa' ? 'none' : 'flex';
  }
  
  const hasCsv = ['checklists', 'viajes', 'users', 'despachos', 'discrepancias'].includes(tab);
  const csvBtn = document.getElementById('btn-csv');
  if (csvBtn) csvBtn.style.display = hasCsv ? 'block' : 'none';
  
  const pageInfo = document.getElementById('page-info');
  if (pageInfo) pageInfo.textContent = '';
  
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  if (prevBtn) prevBtn.style.display = 'none';
  if (nextBtn) nextBtn.style.display = 'none';
  
  // Carga específica según la sección activa
  if (tab === 'users') await loadUsers();
  else if (tab === 'checklists') await loadChecklists();
  else if (tab === 'notif') await loadNotificaciones();
  else if (tab === 'inversa') await loadInversaConfig();
  else if (tab === 'despachos') await loadDespachosAdmin();
  else if (tab === 'discrepancias') await loadDiscrepancias();
  else if (tab === 'viajes') await loadViajesAdmin();
}

// Registrar eventos de tabulación dinámicamente
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tabId = btn.id.replace('tb-', '');
    showTab(tabId);
  });
});

// ── Paginación y Exportaciones ────────────────────────────────────

function updatePagination() {
  const total = state.allDocs.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const from = state.curPage * PAGE_SIZE + 1;
  const to = Math.min((state.curPage + 1) * PAGE_SIZE, total);
  
  const pageInfo = document.getElementById('page-info');
  if (pageInfo) pageInfo.textContent = total > 0 ? `${from}-${to} de ${total}` : '';
  
  const prevBtn = document.getElementById('btn-prev');
  const nextBtn = document.getElementById('btn-next');
  if (prevBtn) prevBtn.style.display = state.curPage > 0 ? 'block' : 'none';
  if (nextBtn) nextBtn.style.display = (state.curPage + 1) < pages ? 'block' : 'none';
}

function changePage(dir) {
  const pages = Math.ceil(state.allDocs.length / PAGE_SIZE);
  state.curPage = Math.max(0, Math.min(state.curPage + dir, pages - 1));
  renderCurrentPage();
}

function renderCurrentPage() {
  const slice = state.allDocs.slice(state.curPage * PAGE_SIZE, (state.curPage + 1) * PAGE_SIZE);
  const container = document.getElementById('tab-content');
  if (!container) return;
  
  if (state.curTab === 'users') {
    renderUsersTable(container, slice, {
      onEdit: handleEditUser,
      onDelete: handleDeleteUser,
      onSyncRoles: handleSyncClaimsAll,
      onMigrate: handleMigrateUsers
    });
  } else if (state.curTab === 'checklists') {
    renderChecklists(container, slice, {
      onDownload: handleDownloadChecklist,
      onDelete: handleDeleteChecklist
    });
  } else if (state.curTab === 'viajes') {
    const tableContainer = document.getElementById('viajes-table-container');
    if (tableContainer) {
      renderViajesTable(tableContainer, slice, {
        onEditStatus: handleEditViajeStatusModal,
        onDelete: handleDeleteViaje
      });
    }
  } else if (state.curTab === 'despachos') {
    renderDespachosTable(container, slice);
  } else if (state.curTab === 'discrepancias') {
    renderDiscrepancias(container, slice, {
      onResolve: handleResolverDiscrepanciaModal,
      onDelete: handleDeleteDiscrepancia
    });
  }
  updatePagination();
}

function exportCurrentTab() {
  const names = { 
    users: 'usuarios', 
    checklists: 'checklists', 
    viajes: 'viajes', 
    despachos: 'despachos', 
    discrepancias: 'km_discrepancias' 
  };
  
  if (typeof exportCSV === 'function') {
    exportCSV(state.allDocs, names[state.curTab] || state.curTab);
  } else {
    console.error("exportCSV global helper is not loaded.");
  }
}

// ── Orquestación de Usuarios (Tab: 'users') ───────────────────────

async function loadUsers() {
  try {
    state.allDocs = await getAllUsers();
    renderCurrentPage();
  } catch (error) {
    const container = document.getElementById('tab-content');
    if (container) {
      container.innerHTML = `<div class="empty">⚠️ Error: ${
        error.code === 'permission-denied' 
          ? 'Sin permisos. <a href="index.html" style="color:var(--accent)">Cierra sesión y vuelve a entrar</a> para refrescar tu token.' 
          : sanitize(error.message)
      }</div>`;
    }
  }
}

async function handleEditUser(id) {
  try {
    const user = await getUserById(id);
    showUserModal(user);
  } catch (error) {
    if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
  }
}

async function handleSaveUser() {
  const id = document.getElementById('u-docid').value;
  if (!id) return;
  try {
    const userData = {
      nombre: document.getElementById('u-nombre').value,
      apellido: document.getElementById('u-apellido').value,
      rut: document.getElementById('u-rut').value,
      area: document.getElementById('u-area').value,
      rol: document.getElementById('u-rol').value,
      estado: document.getElementById('u-estado').value
    };
    
    await updateUser(id, userData);
    closeUserModal();
    if (typeof showToast === 'function') showToast('✅ Usuario actualizado', 'success');
    await loadUsers();
  } catch (error) {
    if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
  }
}

async function handleDeleteUser(id, nombre) {
  if (!confirm(`¿Eliminar usuario "${nombre}"? Esta acción no se puede deshacer.`)) return;
  try {
    await deleteUser(id);
    if (typeof showToast === 'function') showToast('🗑️ Usuario eliminado', 'success');
    await loadUsers();
  } catch (error) {
    if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
  }
}

async function handleSyncClaimsAll() {
  if (!confirm('Sincronizar roles de TODOS los usuarios con Firebase Auth. ¿Continuar?')) return;
  try {
    if (typeof showToast === 'function') showToast('⏳ Sincronizando roles...', 'info');
    const result = await syncAllClaims();
    if (typeof showToast === 'function') showToast(`✅ ${result.updated} usuarios sincronizados. Cierra sesión y vuelve a entrar.`, 'success');
  } catch (error) {
    if (typeof showToast === 'function') showToast('❌ ' + (error.details || error.message || String(error)), 'error');
  }
}

async function handleMigrateUsers() {
  if (!confirm('⚠️ MIGRACIÓN: Esto crea nuevos documentos con UID como ID y elimina los que usan email como ID.\n\nEsta acción es irreversible. ¿Continuar?')) return;
  try {
    if (typeof showToast === 'function') showToast('⏳ Migrando documentos...', 'info');
    const result = await migrateUsersToUID();
    const { migrated, total, results } = result;
    const errors = results.filter(r => r.error);
    if (typeof showToast === 'function') {
      showToast(`✅ ${migrated}/${total} usuarios migrados a UID. ${errors.length ? errors.length + ' errores.' : 'Sin errores.'} Cierra sesión y vuelve a entrar.`, 'success');
    }
    if (migrated > 0) setTimeout(() => loadUsers(), 1500);
  } catch (error) {
    if (typeof showToast === 'function') showToast('❌ ' + (error.details || error.message || String(error)), 'error');
  }
}

// ── Orquestación de Checklists (Tab: 'checklists') ────────────────

async function loadChecklists() {
  try {
    state.allDocs = await getAllChecklists();
    state.allDocs.sort((a, b) => (b.fecha_chequeo?.toMillis?.() || 0) - (a.fecha_chequeo?.toMillis?.() || 0));
    renderCurrentPage();
  } catch (error) {
    const container = document.getElementById('tab-content');
    if (container) {
      container.innerHTML = '<div class="empty">Error: ' + sanitize(error.message) + '</div>';
    }
  }
}

function handleDownloadChecklist(id) {
  const r = state.allDocs.find(d => d.id === id);
  if (!r) {
    if (typeof showToast === 'function') showToast('Registro no encontrado.', 'error');
    return;
  }
  if (typeof generateChecklistPDF === 'function') {
    generateChecklistPDF(r);
  } else {
    if (typeof showToast === 'function') showToast('Error: Generador de PDF no disponible.', 'error');
  }
}

async function handleDeleteChecklist(id) {
  if (!confirm('¿Eliminar este checklist? Esta acción no se puede deshacer.')) return;
  try {
    await deleteChecklist(id);
    if (typeof showToast === 'function') showToast('Checklist eliminado', 'success');
    await loadChecklists();
  } catch (error) {
    if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
  }
}

// ── Orquestación de Viajes (Tab: 'viajes') ────────────────────────

async function loadViajes() {
  const container = document.getElementById('tab-content');
  if (container) {
    container.innerHTML = '<div class="empty"><span class="spinner"></span> Cargando hojas de ruta...</div>';
  }
  try {
    const viajes = await getAllViajes();
    viajes.sort((a, b) => {
      const da = a.created_at?.toMillis?.() || (a.fecha ? new Date(a.fecha).getTime() : 0);
      const db = b.created_at?.toMillis?.() || (b.fecha ? new Date(b.fecha).getTime() : 0);
      return db - da;
    });
    
    state.originalViajesDocs = [...viajes];
    state.allDocs = [...viajes];
    
    const condMap = {};
    state.originalViajesDocs.forEach(d => {
      const email = d.conductor_email || d.correo_conductor || '';
      const name = d.conductor_nombre || d.nombre_conductor_viaje || email;
      if (email) {
        condMap[email] = name;
      }
    });
    
    if (container) {
      renderViajesFilters(container, condMap, state.viajesFilterConductor, state.viajesFilterFecha, {
        onFilterChange: handleViajesFilterChange,
        onClear: handleClearViajesFilters
      });
      renderizarKPIs(viajes);
      // ── Módulo de Mantenimiento Preventivo (Fase 4) ──────────────
      try {
        const todosVehiculos = await getAllVehicles();
        const enAlerta = evaluarMantenimientoFlota(todosVehiculos);
        renderizarAlertasMantenimiento(enAlerta);
      } catch (mErr) {
        console.warn('⚠️ Error al evaluar mantenimiento de flota:', mErr);
      }
      // ────────────────────────────────────────────────────────────
      inyectarBarraBusqueda();

      // ── Botón exportar BI — Sábana Maestra Unificada (silog_master_bi.csv) ──
      const btnExportarBI = document.getElementById('btn-exportar-bi');
      if (btnExportarBI) {
        btnExportarBI.onclick = async () => {
          const textoOriginal = btnExportarBI.innerHTML;
          try {
            btnExportarBI.disabled = true;
            btnExportarBI.innerHTML = '⏳ Exportando...';
            btnExportarBI.style.opacity = '0.7';
            await generarDatasetBI(state.allDocs);
          } catch (exportErr) {
            console.error('[AdminMain] Error crítico en pipeline BI:', exportErr);
            if (typeof showToast === 'function') {
              showToast('❌ Error al exportar: ' + exportErr.message, 'error');
            }
          } finally {
            btnExportarBI.disabled = false;
            btnExportarBI.innerHTML = textoOriginal;
            btnExportarBI.style.opacity = '1';
          }
        };
      }
      // ──────────────────────────────────────────────────────────────────────

      const buscador = document.getElementById('buscador-flota');
      if (buscador) {
        buscador.oninput = (e) => {
          const val = e.target.value.toLowerCase().trim();
          let filtered = [...state.originalViajesDocs];
          if (state.viajesFilterConductor) {
            filtered = filtered.filter(d => (d.conductor_email || d.correo_conductor || '').toLowerCase() === state.viajesFilterConductor.toLowerCase());
          }
          if (state.viajesFilterFecha) {
            filtered = filtered.filter(d => d.fecha === state.viajesFilterFecha);
          }
          if (val) {
            filtered = filtered.filter(r => {
              const patente = (r.patente || '').toLowerCase();
              let matchesGuia = false;
              if (r.guia_numero && String(r.guia_numero).toLowerCase().includes(val)) matchesGuia = true;
              if (r.numeroGuia && String(r.numeroGuia).toLowerCase().includes(val)) matchesGuia = true;
              if (r.entregas && Array.isArray(r.entregas)) {
                r.entregas.forEach(e => {
                  if (e.guia_numero && String(e.guia_numero).toLowerCase().includes(val)) matchesGuia = true;
                  if (e.numero_guia && String(e.numero_guia).toLowerCase().includes(val)) matchesGuia = true;
                });
              }
              return patente.includes(val) || matchesGuia;
            });
          }
          state.allDocs = filtered;
          state.curPage = 0;
          renderCurrentPage();
        };
      }
    }
    
    renderCurrentPage();
  } catch (error) {
    if (container) {
      container.innerHTML = '<div class="empty">Error: ' + sanitize(error.message) + '</div>';
    }
    mostrarAlertaError("Se detectó un problema de conexión. Algunos datos podrían no estar actualizados.");
  }
}

function handleViajesFilterChange(conductor, fecha) {
  state.viajesFilterConductor = conductor;
  state.viajesFilterFecha = fecha;
  applyViajesFilters();
}

function handleClearViajesFilters() {
  state.viajesFilterConductor = '';
  state.viajesFilterFecha = '';
  
  const selCond = document.getElementById('viajes-filter-conductor');
  const inpDate = document.getElementById('viajes-filter-fecha');
  if (selCond) selCond.value = '';
  if (inpDate) inpDate.value = '';
  
  applyViajesFilters();
}

function applyViajesFilters() {
  let filtered = [...state.originalViajesDocs];
  if (state.viajesFilterConductor) {
    filtered = filtered.filter(d => (d.conductor_email || d.correo_conductor || '').toLowerCase() === state.viajesFilterConductor.toLowerCase());
  }
  if (state.viajesFilterFecha) {
    filtered = filtered.filter(d => d.fecha === state.viajesFilterFecha);
  }
  const buscador = document.getElementById('buscador-flota');
  const val = buscador ? buscador.value.toLowerCase().trim() : '';
  if (val) {
    filtered = filtered.filter(r => {
      const patente = (r.patente || '').toLowerCase();
      let matchesGuia = false;
      if (r.guia_numero && String(r.guia_numero).toLowerCase().includes(val)) matchesGuia = true;
      if (r.numeroGuia && String(r.numeroGuia).toLowerCase().includes(val)) matchesGuia = true;
      if (r.entregas && Array.isArray(r.entregas)) {
        r.entregas.forEach(e => {
          if (e.guia_numero && String(e.guia_numero).toLowerCase().includes(val)) matchesGuia = true;
          if (e.numero_guia && String(e.numero_guia).toLowerCase().includes(val)) matchesGuia = true;
        });
      }
      return patente.includes(val) || matchesGuia;
    });
  }
  state.allDocs = filtered;
  state.curPage = 0;
  renderizarKPIs(filtered);
  renderCurrentPage();
}

async function handleEditViajeStatusModal(id, currentStatus) {
  const newStatus = prompt("Modificar estado de la hoja de ruta. Ingrese:\n1 - Para 'revisada' (Conforme)\n2 - Para 'observada' (Con Observaciones)\n3 - Para 'pendiente_revision' (Pendiente)", 
    currentStatus === 'revisada' ? '1' : (currentStatus === 'observada' ? '2' : '3')
  );
  if (newStatus === null) return;
  
  let statusStr = '';
  if (newStatus === '1') statusStr = 'revisada';
  else if (newStatus === '2') statusStr = 'observada';
  else if (newStatus === '3') statusStr = 'pendiente_revision';
  else {
    if (typeof showToast === 'function') showToast("Opción inválida", "error");
    return;
  }
  
  try {
    await updateViajeStatus(id, statusStr);
    if (typeof showToast === 'function') showToast("✅ Estado de viaje actualizado", "success");
    await loadViajes();
  } catch (error) {
    if (typeof showToast === 'function') showToast("Error al actualizar: " + error.message, "error");
  }
}

async function handleDeleteViaje(id) {
  if (!confirm('¿Eliminar este viaje? Esta acción no se puede deshacer.')) return;
  try {
    await deleteViaje(id);
    if (typeof showToast === 'function') showToast('Viaje y todos sus documentos asociados eliminados con éxito', 'success');
    await loadViajes();
  } catch (error) {
    if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
  }
}

// ── Orquestación de Notificaciones (Tab: 'notif') ─────────────────

async function loadNotificaciones() {
  const container = document.getElementById('tab-content');
  try {
    const notifs = await getAllNotificaciones();
    notifs.sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
    renderNotificaciones(container, notifs, {
      onMarkRead: handleMarkNotifRead,
      onDelete: handleDeleteNotif
    });
  } catch (error) {
    if (container) {
      container.innerHTML = '<div class="empty">Error: ' + sanitize(error.message) + '</div>';
    }
  }
}

async function handleMarkNotifRead(id) {
  try {
    await markNotificacionLeida(id);
    await loadNotificaciones();
    
    // Sincronización explícita del estado del contador de notificaciones
    const dbNotifs = await getAllNotificaciones();
    const unreadCount = dbNotifs.filter(n => !n.leida).length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }
    localStorage.removeItem('silog_dashboard_cache');
    localStorage.removeItem('unreadCount'); // Por si acaso existiera en otro lugar

    await loadStats();
  } catch (error) {
    if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
  }
}

async function handleDeleteNotif(id) {
  try {
    await deleteNotificacion(id);
    await loadNotificaciones();
    
    // Sincronización explícita del estado del contador de notificaciones
    const dbNotifs = await getAllNotificaciones();
    const unreadCount = dbNotifs.filter(n => !n.leida).length;
    const badge = document.getElementById('notif-badge');
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'inline';
      } else {
        badge.style.display = 'none';
      }
    }
    localStorage.removeItem('silog_dashboard_cache');
    localStorage.removeItem('unreadCount'); // Por si acaso existiera en otro lugar

    await loadStats();
  } catch (error) {
    if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
  }
}

// ── Orquestación de Discrepancias (Tab: 'discrepancias') ───────────

async function loadDiscrepancias() {
  const container = document.getElementById('tab-content');
  try {
    const disc = await getAllDiscrepancias();
    disc.sort((a, b) => (b.fecha?.toMillis?.() || 0) - (a.fecha?.toMillis?.() || 0));
    state.allDocs = disc;
    renderCurrentPage();
  } catch (error) {
    if (container) {
      container.innerHTML = '<div class="empty">Error: ' + sanitize(error.message) + '</div>';
    }
  }
}

async function handleResolverDiscrepanciaModal(id, patente, kmCorregir) {
  const justificacion = prompt("Ingrese la justificación o comentario para resolver esta discrepancia:");
  if (justificacion === null) return;
  if (!justificacion.trim()) {
    if (typeof showToast === 'function') showToast("Debe ingresar una justificación", "error");
    return;
  }
  
  try {
    let flagOdometro = false;
    if (patente && kmCorregir > 0) {
      try {
        const v = await getVehicleById(patente);
        const odoActual = v.kilometraje || v.km || 0;
        flagOdometro = confirm(`¿Deseas actualizar también el odómetro en flota del vehículo ${patente}?\nValor actual: ${odoActual} km\nNuevo valor: ${kmCorregir} km`);
      } catch (e) {
        console.warn('Vehicle lookup failed for discrepancy resolver:', e);
      }
    }
    
    if (flagOdometro) {
      await resolverDiscrepanciaConOdometro(id, justificacion, state.email, patente, kmCorregir);
      if (typeof showToast === 'function') showToast("✅ Discrepancia resuelta y odómetro de flota corregido", "success");
    } else {
      await resolverDiscrepancia(id, justificacion, state.email);
      if (typeof showToast === 'function') showToast("✅ Discrepancia resuelta", "success");
    }
    await loadDiscrepancias();
    await loadStats();
  } catch (error) {
    if (typeof showToast === 'function') showToast("Error al resolver: " + error.message, "error");
  }
}

async function handleDeleteDiscrepancia(id) {
  if (!confirm("¿Desea eliminar este registro de discrepancia?")) return;
  try {
    await deleteDiscrepancia(id);
    if (typeof showToast === 'function') showToast("🗑️ Registro eliminado", "success");
    await loadDiscrepancias();
    await loadStats();
  } catch (error) {
    if (typeof showToast === 'function') showToast("Error al eliminar: " + error.message, "error");
  }
}

// ── Orquestación de Logística Inversa (Tab: 'inversa') ─────────────

async function loadInversaConfig() {
  const container = document.getElementById('tab-content');
  try {
    const list = await getInversaConfig();
    renderInversaConfig(container, list, {
      onAdd: handleAgregarDistribuidorInversa,
      onToggle: handleToggleDistribuidorInversa,
      onDelete: handleEliminarDistribuidorInversa
    });
  } catch (error) {
    if (container) {
      container.innerHTML = `<div class="empty">⚠️ Error: ${sanitize(error.message)}</div>`;
    }
  }
}

async function handleAgregarDistribuidorInversa(nombre) {
  try {
    await agregarDistribuidorInversa(nombre, state.uid);
    if (typeof showToast === 'function') showToast('✅ Distribuidor asignado a logística inversa', 'success');
    await loadInversaConfig();
  } catch (error) {
    if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
  }
}

async function handleToggleDistribuidorInversa(id, active) {
  try {
    await toggleDistribuidorInversa(id, active);
    if (typeof showToast === 'function') showToast('✅ Estado del distribuidor actualizado', 'success');
    await loadInversaConfig();
  } catch (error) {
    if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
  }
}

async function handleEliminarDistribuidorInversa(id) {
  if (!confirm('¿Eliminar este distribuidor de la configuración de logística inversa?')) return;
  try {
    await eliminarDistribuidorInversa(id);
    if (typeof showToast === 'function') showToast('🗑️ Distribuidor eliminado de la configuración', 'success');
    await loadInversaConfig();
  } catch (error) {
    if (typeof showToast === 'function') showToast('Error: ' + error.message, 'error');
  }
}

// ── Orquestación de Despachos (Tab: 'despachos') ───────────────────

async function loadDespachosAdmin() {
  const container = document.getElementById('tab-content');
  try {
    const list = await getAllDespachos();
    list.sort((a, b) => {
      const da = a.fecha?.toMillis?.() || (a.fecha ? new Date(a.fecha).getTime() : 0);
      const db = b.fecha?.toMillis?.() || (b.fecha ? new Date(b.fecha).getTime() : 0);
      return db - da;
    });
    state.allDocs = list;
    renderCurrentPage();
  } catch (error) {
    if (container) {
      container.innerHTML = '<div class="empty">Error: ' + sanitize(error.message) + '</div>';
    }
  }
}

// ── Estadísticas y Resumen Ejecutivo (Dashboard) ─────────────────

async function loadStats() {
  try {
    const stats = await getDashboardKPIs();
    updateDashboardKPIs(stats);
  } catch (error) {
    console.warn("loadStats error:", error);
    mostrarAlertaError("Se detectó un problema de conexión. Algunos datos podrían no estar actualizados.");
  }
}

async function loadExecDashboard() {
  const container = document.getElementById('tab-ejecutivo');
  if (!container) return;
  try {
    const stats = await getExecutiveStats(state.execDays);
    renderExecutiveDashboard(container, stats, state.execDays, {
      onPeriodChange: handlePeriodChange
    });
  } catch (error) {
    console.warn('Exec dashboard loading error:', error);
    mostrarAlertaError("Se detectó un problema de conexión. Algunos datos podrían no estar actualizados.");
  }
}

function handlePeriodChange(days) {
  state.execDays = days;
  loadExecDashboard();
}

// ── Mantenimiento de Flota (Fase 4) ──────────────────────────────────
window.registrarMantencionVehiculo = async (patente, vehiculoId) => {
  const kmStr = prompt(`Ingrese el kilometraje exacto de la última mantención para la patente ${patente}:`);
  if (kmStr === null) return; // cancelado
  
  const km = parseInt(kmStr.replace(/\D/g, ''));
  if (isNaN(km) || km <= 0) {
    if (typeof showToast === 'function') showToast('❌ Kilometraje inválido. Debe ser un número mayor a cero.', 'error');
    else alert('Kilometraje inválido. Debe ser un número mayor a cero.');
    return;
  }
  
  if (!confirm(`¿Confirmas que el vehículo ${patente} tuvo su última mantención a los ${km.toLocaleString('es-CL')} km?`)) return;
  
  try {
    await firebase.firestore().collection('vehiculos').doc(vehiculoId).update({
      ultima_mantencion_km: km,
      ultima_mantencion_fecha: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    if (typeof showToast === 'function') showToast(`✅ Mantención de ${patente} registrada correctamente.`, 'success');
    
    // Recargar vista para recalcular las alertas (Fase 4)
    if (typeof loadViajesAdmin === 'function') {
      await loadViajesAdmin();
    }
  } catch (error) {
    console.error('Error al registrar mantención:', error);
    if (typeof showToast === 'function') showToast('❌ Error al actualizar: ' + error.message, 'error');
    else alert('Error al actualizar: ' + error.message);
  }
};
