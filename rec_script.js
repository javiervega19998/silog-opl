
let _recordatorios = [];
let _draggedId = null;
let _unsubscribe = null;
let _uid = null;
let _name = null;
let _email = null;

function showToast(msg, type='success'){
  const t=document.createElement('div');
  t.className=`toast toast-${type}`;
  t.textContent=msg;
  document.getElementById('toast-container').appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{t.classList.remove('show');setTimeout(()=>t.remove(),300)},3000);
}

function formatDate(ts){
  if(!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('es-CL', {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
}

document.addEventListener('DOMContentLoaded', () => {
  requireAuth(async (user, data) => {
    try {
      const role = (data.rol || data.role || 'conductor').toLowerCase();
      const isViewer = isViewerRole(role);
      
      if(!isViewer) {
         window.location.href = 'dashboard.html';
         return;
      }
      
      _uid = user.uid;
      _email = user.email;
      _name = data.nombre ? (data.nombre + ' ' + (data.apellido || '')) : '';
      
      // Auto-cleanup cards in "finalizado" > 24h
      await cleanupFinalizados();
      
      // Listen for changes
      listenRecordatorios();
    } catch(e) {
      console.warn("Error en recordatorios", e);
    }
  });
});

async function cleanupFinalizados() {
  try {
    const limitDate = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const snap = await db.collection('recordatorios')
      .where('estado', '==', 'finalizado')
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

function listenRecordatorios() {
  _unsubscribe = db.collection('recordatorios').onSnapshot(snap => {
    _recordatorios = [];
    snap.forEach(doc => {
      _recordatorios.push({ id: doc.id, ...doc.data() });
    });
    renderBoard();
  }, err => {
    console.error("Listen err:", err);
    showToast('Error al cargar datos', 'error');
  });
}

function renderBoard() {
  const cols = {
    pendientes: [],
    progreso: [],
    revision: [],
    finalizado: []
  };
  
  // Sort and group
  _recordatorios.sort((a,b) => {
    const ta = a.updated_at ? a.updated_at.toDate().getTime() : 0;
    const tb = b.updated_at ? b.updated_at.toDate().getTime() : 0;
    return tb - ta; // Descendente por fecha
  });
  
  _recordatorios.forEach(r => {
    if(cols[r.estado]) cols[r.estado].push(r);
    else cols['pendientes'].push(r);
  });
  
  Object.keys(cols).forEach(state => {
    const el = document.getElementById(`col-${state}`);
    const cnt = document.getElementById(`count-${state}`);
    el.innerHTML = '';
    cnt.textContent = cols[state].length;
    
    cols[state].forEach(r => {
      el.appendChild(createCard(r));
    });
  });
}

function createCard(r) {
  const div = document.createElement('div');
  div.className = `kanban-card priority-${r.prioridad}`;
  div.draggable = true;
  div.id = `card-${r.id}`;
  
  div.addEventListener('dragstart', (e) => {
    _draggedId = r.id;
    e.dataTransfer.setData('text/plain', r.id);
    div.style.opacity = '0.5';
  });
  div.addEventListener('dragend', () => {
    div.style.opacity = '1';
    _draggedId = null;
  });
  
  const creator = r.creador_nombre || r.creador_email || 'Usuario';
  const updater = r.updated_by_name || creator;
  
  div.innerHTML = `
    <div class="k-title">${r.titulo}</div>
    <div class="k-desc">${r.descripcion}</div>
    <div class="k-meta">
      <span>🕒 ${formatDate(r.created_at)}</span>
      <span class="k-user" title="Última acción por">👤 ${updater}</span>
    </div>
    <div class="k-actions">
      <button class="k-btn" onclick="openModal('${r.id}')" title="Editar">✏️ Editar</button>
      <button class="k-btn k-btn-del" onclick="deleteCard('${r.id}')" title="Eliminar">🗑️</button>
      <div style="flex:1"></div>
      ${renderMoveButtons(r.id, r.estado)}
    </div>
  `;
  return div;
}

function renderMoveButtons(id, estado) {
  const states = ['pendientes', 'progreso', 'revision', 'finalizado'];
  const idx = states.indexOf(estado);
  let html = '';
  if(idx > 0) {
    html += `<button class="k-btn" onclick="moveCard('${id}', '${states[idx-1]}')" title="Atrás">◀</button>`;
  }
  if(idx < states.length - 1) {
    html += `<button class="k-btn" onclick="moveCard('${id}', '${states[idx+1]}')" title="Adelante">▶</button>`;
  }
  return html;
}

async function moveCard(id, newState) {
  try {
    await db.collection('recordatorios').doc(id).update({
      estado: newState,
      updated_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_by_uid: _uid,
      updated_by_name: _name || _email
    });
  } catch (e) {
    showToast('Error al mover tarjeta: ' + e.message, 'error');
  }
}

async function deleteCard(id) {
  if(!confirm('¿Eliminar esta tarea permanentemente?')) return;
  try {
    await db.collection('recordatorios').doc(id).delete();
    showToast('🗑️ Tarjeta eliminada', 'success');
  } catch(e) {
    showToast('Error al eliminar: ' + e.message, 'error');
  }
}

// Drag & Drop
function allowDrop(ev) {
  ev.preventDefault();
  ev.currentTarget.classList.add('drag-over');
}
function dragLeave(ev) {
  ev.currentTarget.classList.remove('drag-over');
}
async function drop(ev, newState) {
  ev.preventDefault();
  ev.currentTarget.classList.remove('drag-over');
  const id = _draggedId || ev.dataTransfer.getData('text/plain');
  if(!id) return;
  const card = _recordatorios.find(r => r.id === id);
  if(card && card.estado !== newState) {
    await moveCard(id, newState);
  }
}

// Modal
function openModal(id = null) {
  const form = document.getElementById('modal-form');
  const title = document.getElementById('modal-title');
  document.getElementById('r-id').value = '';
  document.getElementById('r-titulo').value = '';
  document.getElementById('r-desc').value = '';
  document.getElementById('r-prio').value = 'media';
  
  if(id) {
    const r = _recordatorios.find(x => x.id === id);
    if(r) {
      document.getElementById('r-id').value = r.id;
      document.getElementById('r-titulo').value = r.titulo;
      document.getElementById('r-desc').value = r.descripcion;
      document.getElementById('r-prio').value = r.prioridad || 'media';
      title.textContent = 'Editar Recordatorio';
    }
  } else {
    title.textContent = 'Nuevo Recordatorio';
  }
  
  form.classList.add('open');
}

function closeModal() {
  document.getElementById('modal-form').classList.remove('open');
}

async function saveRecordatorio() {
  const id = document.getElementById('r-id').value;
  const titulo = document.getElementById('r-titulo').value.trim();
  const desc = document.getElementById('r-desc').value.trim();
  const prio = document.getElementById('r-prio').value;
  
  if(!titulo) { showToast('Ingresa un título', 'error'); return; }
  
  const btn = document.getElementById('btn-save');
  btn.disabled = true;
  btn.textContent = 'Guardando...';
  
  const data = {
    titulo: titulo,
    descripcion: desc,
    prioridad: prio,
    updated_at: firebase.firestore.FieldValue.serverTimestamp(),
    updated_by_uid: _uid,
    updated_by_name: _name || _email
  };
  
  try {
    if(id) {
      await db.collection('recordatorios').doc(id).update(data);
      showToast('Recordatorio actualizado', 'success');
    } else {
      data.estado = 'pendientes';
      data.created_at = firebase.firestore.FieldValue.serverTimestamp();
      data.creador_uid = _uid;
      data.creador_nombre = _name || _email;
      await db.collection('recordatorios').add(data);
      showToast('Recordatorio creado', 'success');
    }
    closeModal();
  } catch(e) {
    showToast('Error al guardar: ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar';
  }
}
