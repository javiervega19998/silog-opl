#!/usr/bin/env python3
# fix_loadchecklists.py - safe version (pure ASCII emojis via codepoints)
import sys

with open('admin.html', 'r', encoding='utf-8', errors='replace') as f:
    c = f.read()

idx = c.find('async function loadChecklists(){')
end = c.find('\nasync function loadViajes(){', idx)
old = c[idx:end].rstrip()

# Build new code using only safe strings (no emoji literals)
truck  = '\U0001f69b'  # 🚛
person = '\U0001f464'  # 👤
cal    = '\U0001f4c5'  # 📅
fuel   = '\u26fd'       # ⛽
dl     = '\u2b07\ufe0f' # ⬇️
trash  = '\U0001f5d1\ufe0f' # 🗑️
warn   = '\u26a0\ufe0f'     # ⚠️
pill   = '\U0001f48a'  # 💊
dot    = '\u00b7'      # ·
dash   = '\u2014'      # —

new_code = f"""async function loadChecklists(){{
  const cont = document.getElementById('tab-content');
  try{{
    const snap = await db.collection('chequeo_operacional').get();
    if(snap.empty){{cont.innerHTML='<div class="empty">Sin checklists registrados.</div>';return;}}
    _allDocs = [];
    snap.forEach(d => _allDocs.push({{id:d.id,...d.data()}}));
    _allDocs.sort((a,b)=>(b.fecha_chequeo?.toMillis?.()??0)-(a.fecha_chequeo?.toMillis?.()??0));
    renderCurrentPage();
  }}catch(e){{
    cont.innerHTML='<div class="empty">{warn} Error: '+sanitize(e.message)+'</div>';
  }}
}}

function renderChecklistsPage(docs){{
  const cont = document.getElementById('tab-content');
  let html = '';
  docs.forEach(r => {{
    const obs=[
      r.chequeo_frenos&&r.chequeo_frenos!=='Check'?'Frenos: '+r.chequeo_frenos:'',
      !r.condicion_fisica?'{warn} Cond. fisica':'',
      !r.descanso_operador?'{warn} Descanso insuf.':'',
      r.medicamentos_chequeo?'{pill} Med: '+(r.medicamentos_detalle||'Si'):'',
    ].filter(Boolean).join(' {dot} ')||'Sin observaciones criticas';
    html += `<div class="ck-item">
      <div class="ck-top">
        <div><div class="ck-plate">{truck} ${{sanitize(r.patente_chequeo||'{dash}')}}</div><div class="ck-name">{person} ${{sanitize(r.nombre_operador||'{dash}')}}</div></div>
        <div style="display:flex;gap:6px;align-items:center">
          <button class="btn-sm" onclick="downloadChecklist('${{r.id}}')">{dl} PDF</button>
          <button class="btn-sm danger" onclick="deleteChecklist('${{r.id}}')">{trash}</button>
        </div>
      </div>
      <div class="ck-date">{cal} ${{formatDate(r.fecha_chequeo)}} {dot} {fuel} ${{sanitize(r.nivel_combustible||'{dash}')}}</div>
      <div style="font-size:.75rem;color:var(--text2);margin-top:4px">${{sanitize(obs)}}</div>
    </div>`;
  }});
  cont.innerHTML = html || '<div class="empty">Sin resultados en esta pagina.</div>';
}}"""

c2 = c.replace(old, new_code)
if c2 == c:
    print('ERROR: replace failed')
    print('Looking for:', repr(old[:80]))
else:
    with open('admin.html', 'w', encoding='utf-8', errors='replace') as f:
        f.write(c2)
    print('OK: admin.html updated')
    print('Size:', len(c2))
