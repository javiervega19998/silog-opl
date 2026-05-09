// patch_admin.js — Patches admin.html (no template literals in the patch strings)
const fs = require('fs');
let c = fs.readFileSync('admin.html', 'utf8');

// ── FIX 1: Replace loadChecklists + add renderChecklistsPage ──────
const startMarker = 'async function loadChecklists(){';
const endMarker   = '\nasync function loadViajes(){';
const startIdx = c.indexOf(startMarker);
const endIdx   = c.indexOf(endMarker, startIdx);
if (startIdx < 0 || endIdx < 0) {
  console.error('FAIL: loadChecklists markers not found');
  process.exit(1);
}
const oldCK = c.slice(startIdx, endIdx);

// Build new code without template literals that would be evaluated
const newCK = [
  'async function loadChecklists(){',
  "  const cont = document.getElementById('tab-content');",
  '  try{',
  "    const snap = await db.collection('chequeo_operacional').get();",
  "    if(snap.empty){cont.innerHTML='<div class=\"empty\">Sin checklists registrados.</div>';return;}",
  '    _allDocs = [];',
  '    snap.forEach(d => _allDocs.push({id:d.id,...d.data()}));',
  '    _allDocs.sort((a,b)=>(b.fecha_chequeo?.toMillis?.()??0)-(a.fecha_chequeo?.toMillis?.()??0));',
  '    renderCurrentPage();',
  '  }catch(e){',
  "    cont.innerHTML='<div class=\"empty\">Error: '+sanitize(e.message)+'</div>';",
  '  }',
  '}',
  '',
  'function renderChecklistsPage(docs){',
  "  const cont = document.getElementById('tab-content');",
  "  let html = '';",
  '  docs.forEach(r => {',
  '    const obs=[',
  "      r.chequeo_frenos&&r.chequeo_frenos!=='Check'?'Frenos: '+r.chequeo_frenos:'',",
  "      !r.condicion_fisica?'Cond.fisica':'',",
  "      !r.descanso_operador?'Descanso insuf.':'',",
  "      r.medicamentos_chequeo?'Med: '+(r.medicamentos_detalle||'Si'):'',",
  "    ].filter(Boolean).join(' | ')||'Sin observaciones';",
  // Use backtick template — but escape inner $ with backslash so they don't execute in this context
  "    html += `<div class=\"ck-item\">",
  '      <div class="ck-top">',
  '        <div><div class="ck-plate">&#x1F69B; ${sanitize(r.patente_chequeo||\'-\')}</div>',
  '        <div class="ck-name">&#x1F464; ${sanitize(r.nombre_operador||\'-\')}</div></div>',
  '        <div style="display:flex;gap:6px;align-items:center">',
  "          <button class=\"btn-sm\" onclick=\"downloadChecklist('${r.id}')\">&#x2B07; PDF</button>",
  "          <button class=\"btn-sm danger\" onclick=\"deleteChecklist('${r.id}')\">Eliminar</button>",
  '        </div>',
  '      </div>',
  "      <div class=\"ck-date\">Fecha: ${formatDate(r.fecha_chequeo)} | Comb: ${sanitize(r.nivel_combustible||\'-\')}</div>",
  '      <div style="font-size:.75rem;color:var(--text2);margin-top:4px">${sanitize(obs)}</div>',
  "    </div>`;",
  '  });',
  "  cont.innerHTML = html || '<div class=\"empty\">Sin resultados.</div>';",
  '}',
].join('\n');

c = c.slice(0, startIdx) + newCK + c.slice(endIdx);
console.log('Fix 1 OK — loadChecklists + renderChecklistsPage replaced');

// ── FIX 2: downloadChecklist - fix signature (remove r param) ─────
const OLD_DL_A = 'function downloadChecklist(id, r){';
const OLD_DL_B = 'function downloadChecklist(id){';

if (c.includes(OLD_DL_A)) {
  // Old version still there
  const dlIdx = c.indexOf(OLD_DL_A);
  const oldDL = 'function downloadChecklist(id, r){\n  const win=window.open(\'\',\'_blank\');';
  const newDL = [
    'function downloadChecklist(id){',
    "  const r = _allDocs.find(d => d.id === id);",
    "  if(!r){ showToast('Registro no encontrado. Recarga la pagina.','error'); return; }",
    "  const win=window.open('','_blank');",
    "  if(!win){ showToast('Habilita pop-ups para este sitio.','error'); return; }",
  ].join('\n');
  if (c.includes(oldDL.replace(/\n/g, '\r\n'))) {
    c = c.replace(oldDL.replace(/\n/g, '\r\n'), newDL);
  } else {
    c = c.replace(oldDL, newDL);
  }
  console.log('Fix 2 OK — downloadChecklist signature fixed');
} else if (c.includes(OLD_DL_B)) {
  // Signature already correct from previous partial apply
  // Just make sure popup check is there
  const checkStr = "if(!win){ showToast";
  if (!c.includes(checkStr)) {
    const OLD_WIN = "  const win=window.open('','_blank');";
    const NEW_WIN = "  const win=window.open('','_blank');\n  if(!win){ showToast('Habilita pop-ups.','error'); return; }";
    c = c.replace(OLD_WIN, NEW_WIN);
  }
  console.log('Fix 2 SKIP — downloadChecklist already had correct signature');
}

fs.writeFileSync('admin.html', c, 'utf8');
console.log('Done. File size:', c.length, 'bytes');
