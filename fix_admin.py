#!/usr/bin/env python3
# fix_admin.py — Aplica todas las correcciones a admin.html
import re, sys

with open('admin.html', 'r', encoding='utf-8') as f:
    c = f.read()

original = c  # backup para verificar cambios

# ════════════════════════════════════════════════════════════════
# FIX 1: loadChecklists → usa _allDocs + renderChecklistsPage
# ════════════════════════════════════════════════════════════════
old_loadCK = r"""async function loadChecklists(){
  const snap=await db.collection('chequeo_operacional').get();
  const c=document.getElementById('tab-content');
  if(snap.empty){c.innerHTML='<div class="empty">Sin checklists registrados.</div>';return;}
  let docs=[];snap.forEach(d=>docs.push({id:d.id,...d.data()}));
  docs.sort((a,b)=>(b.fecha_chequeo?.toMillis?.()??0)-(a.fecha_chequeo?.toMillis?.()??0));
  c.innerHTML='';
  docs.forEach(r=>{
    const obs=[
      r.chequeo_frenos&&r.chequeo_frenos!=='Check'?'Frenos: '+r.chequeo_frenos:'',
      !r.condicion_fisica?'⚠️ Condición física':'',
      !r.descanso_operador?'⚠️ Descanso insuficiente':'',
      r.medicamentos_chequeo?'💊 Medicamentos: '+(r.medicamentos_detalle||'Sí'):'',
    ].filter(Boolean).join(' · ')||'Sin observaciones críticas';
    c.innerHTML+=`<div class="ck-item">
      <div class="ck-top">
        <div><div class="ck-plate">🚛 ${r.patente_chequeo||'—'}</div><div class="ck-name">👤 ${r.nombre_operador||'—'}</div></div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn-sm" onclick="downloadChecklist('${r.id}',${JSON.stringify(r).replace(/'/g,'&#39;')})">>⬇️ PDF</button>
          <button class="btn-sm danger" onclick="deleteChecklist('${r.id}')">🗑️</button>
        </div>
      </div>
      <div class="ck-date">📅 ${formatDate(r.fecha_chequeo)} · ⛽ ${r.nivel_combustible||'—'}</div>
      <div style="font-size:.75rem;color:var(--text2);margin-top:4px">${obs}</div>
    </div>`;
  });
}"""

new_loadCK = """async function loadChecklists(){
  const snap = await db.collection('chequeo_operacional').get().catch(()=>null);
  const c = document.getElementById('tab-content');
  if(!snap || snap.empty){c.innerHTML='<div class="empty">Sin checklists registrados.</div>';return;}
  _allDocs = [];
  snap.forEach(d => _allDocs.push({id:d.id,...d.data()}));
  _allDocs.sort((a,b)=>(b.fecha_chequeo?.toMillis?.()??0)-(a.fecha_chequeo?.toMillis?.()??0));
  renderChecklistsPage(_allDocs.slice(0, PAGE_SIZE));
  updatePagination();
}

function renderChecklistsPage(docs){
  const c = document.getElementById('tab-content');
  let html = '';
  docs.forEach(r => {
    const obs=[
      r.chequeo_frenos&&r.chequeo_frenos!=='Check'?'Frenos: '+r.chequeo_frenos:'',
      !r.condicion_fisica?'⚠️ Cond. física':'',
      !r.descanso_operador?'⚠️ Descanso insuf.':'',
      r.medicamentos_chequeo?'💊 Medicamentos: '+(r.medicamentos_detalle||'Sí'):'',
    ].filter(Boolean).join(' · ')||'Sin observaciones críticas';
    html += `<div class="ck-item">
      <div class="ck-top">
        <div><div class="ck-plate">🚛 ${sanitize(r.patente_chequeo||'—')}</div><div class="ck-name">👤 ${sanitize(r.nombre_operador||'—')}</div></div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn-sm" onclick="downloadChecklist('${r.id}')">⬇️ PDF</button>
          <button class="btn-sm danger" onclick="deleteChecklist('${r.id}')">🗑️</button>
        </div>
      </div>
      <div class="ck-date">📅 ${formatDate(r.fecha_chequeo)} · ⛽ ${sanitize(r.nivel_combustible||'—')}</div>
      <div style="font-size:.75rem;color:var(--text2);margin-top:4px">${sanitize(obs)}</div>
    </div>`;
  });
  c.innerHTML = html || '<div class="empty">Sin resultados.</div>';
}"""

if old_loadCK in c:
    c = c.replace(old_loadCK, new_loadCK)
    print("✅ FIX 1: loadChecklists reemplazado")
else:
    print("⚠️  FIX 1: old_loadCK NO encontrado — buscando variante...")
    # Try to find it
    idx = c.find('async function loadChecklists(){')
    if idx >= 0:
        print(f"   Función encontrada en pos {idx}")
        print(f"   Contexto: {repr(c[idx:idx+200])}")

# ════════════════════════════════════════════════════════════════
# FIX 2: downloadChecklist — recibir solo id, buscar en _allDocs
# ════════════════════════════════════════════════════════════════
old_dl = """// ── Descargar Checklist como PDF ────────────────────────────────
function downloadChecklist(id, r){
  const win=window.open('','_blank');"""

new_dl = """// ── Descargar Checklist como PDF ────────────────────────────────
function downloadChecklist(id){
  const r = _allDocs.find(d => d.id === id);
  if(!r){ showToast('Checklist no encontrado en memoria. Recarga la página.','error'); return; }
  const win=window.open('','_blank');"""

if old_dl in c:
    c = c.replace(old_dl, new_dl)
    print("✅ FIX 2: downloadChecklist firma corregida")
else:
    print("⚠️  FIX 2: No encontrado")

# ════════════════════════════════════════════════════════════════
# FIX 3: loadUsers → asignar _allDocs antes del render
# Buscar el lugar donde se hace la asignación y verificar
# ════════════════════════════════════════════════════════════════
# Check if _allDocs is already assigned in loadUsers
idx_lu = c.find('async function loadUsers(){')
if idx_lu >= 0:
    end_lu = c.find('\nasync function ', idx_lu+1)
    lu_body = c[idx_lu:end_lu]
    if '_allDocs' in lu_body:
        print("✅ FIX 3: loadUsers ya asigna _allDocs")
    else:
        print("⚠️  FIX 3: loadUsers NO asigna _allDocs — verificar manualmente")
        print(f"   Body preview: {lu_body[:300]}")

with open('admin.html', 'w', encoding='utf-8') as f:
    f.write(c)

changed = sum(1 for a, b in zip(original, c) if a != b)
print(f"\n✅ admin.html guardado ({len(c)} bytes, ~{changed} chars cambiados)")
