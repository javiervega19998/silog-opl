const fs = require('fs');
const { execSync } = require('child_process');

const issues = [];
const add = (sev, file, line, msg) => issues.push({ sev, file, line, msg });

// ═══════════════════════════════════════════════════
// 1. SYNTAX CHECK — all HTML inline scripts + JS files
// ═══════════════════════════════════════════════════
const htmlFiles = fs.readdirSync('.').filter(f => f.endsWith('.html'));
const jsFiles = ['js/finanzas_script.js','js/dash_script.js','admin_script.js','js/auth.js','js/firebase-config.js'];

htmlFiles.forEach(f => {
  const html = fs.readFileSync(f, 'utf8');
  const scripts = [];
  const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) scripts.push(m[1]);
  if (!scripts.length) return;
  fs.writeFileSync('__tmp.js', scripts.join('\n'));
  try { execSync('node --check __tmp.js', { stdio: 'pipe' }); }
  catch(e) { add('CRITICAL', f, '?', 'SYNTAX ERROR: ' + e.stderr.toString().split('\n')[0]); }
});
jsFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  fs.writeFileSync('__tmp.js', fs.readFileSync(f, 'utf8'));
  try { execSync('node --check __tmp.js', { stdio: 'pipe' }); }
  catch(e) { add('CRITICAL', f, '?', 'SYNTAX ERROR: ' + e.stderr.toString().split('\n')[0]); }
});
try { fs.unlinkSync('__tmp.js'); } catch(e) {}

// ═══════════════════════════════════════════════════
// 2. VARIABLE CONSISTENCY — batch vs masterBatch
// ═══════════════════════════════════════════════════
const viajes = fs.readFileSync('viajes.html', 'utf8');
const vLines = viajes.split('\n');

// Check for batch.set/batch.update OUTSIDE submitViaje (should be masterBatch in saveEditedTrip)
let inSaveEdited = false;
vLines.forEach((l, i) => {
  if (l.includes('async function saveEditedTrip')) inSaveEdited = true;
  if (inSaveEdited && l.includes('function ') && !l.includes('saveEditedTrip')) inSaveEdited = false;
  if (inSaveEdited) {
    // Inside saveEditedTrip, only masterBatch should be used (not bare 'batch')
    if (/\bbatch\.(set|update|delete)\b/.test(l) && !l.includes('masterBatch')) {
      add('CRITICAL', 'viajes.html', i+1, 'Uses "batch" instead of "masterBatch" inside saveEditedTrip: ' + l.trim().substring(0, 80));
    }
  }
});

// Check duplicate const declarations in same scope
const batchDecls = [];
vLines.forEach((l, i) => {
  if (l.includes('const batch=') || l.includes('const batch =')) batchDecls.push(i+1);
});
if (batchDecls.length > 1) {
  // Check if they're in different functions (OK) or same scope (BAD)
  // Simple heuristic: if both are inside submitViaje, that's bad
  const submitStart = vLines.findIndex(l => l.includes('async function submitViaje'));
  const submitEnd = vLines.findIndex((l, i) => i > submitStart && /^async function|^function/.test(l.trim()));
  const inSubmit = batchDecls.filter(ln => ln > submitStart && ln < (submitEnd > 0 ? submitEnd : 99999));
  if (inSubmit.length > 1) {
    add('CRITICAL', 'viajes.html', inSubmit[1], 'Duplicate "const batch" declaration in submitViaje scope');
  }
}

// ═══════════════════════════════════════════════════
// 3. DATA FLOW — hojas_ruta fields consistency
// ═══════════════════════════════════════════════════
const fin = fs.readFileSync('js/finanzas_script.js', 'utf8');
const finLines = fin.split('\n');

// Verify hojasByTurnoId is built from hSnap (not a different snapshot)
const hojaMapLine = finLines.findIndex(l => l.includes('hojasByTurnoId'));
if (hojaMapLine < 0) add('CRITICAL', 'finanzas_script.js', '?', 'hojasByTurnoId map not found');
else {
  // Check it uses hSnap
  const nearbyLines = finLines.slice(hojaMapLine, hojaMapLine + 10).join(' ');
  if (!nearbyLines.includes('hSnap')) add('HIGH', 'finanzas_script.js', hojaMapLine+1, 'hojasByTurnoId may not be built from hSnap');
}

// Verify hojaAuth is used for entregados/devueltos
const hojaAuthLine = finLines.findIndex(l => l.includes('const hojaAuth'));
if (hojaAuthLine >= 0) {
  const block = finLines.slice(hojaAuthLine, hojaAuthLine + 20).join('\n');
  if (!block.includes('total_entregas')) add('HIGH', 'finanzas_script.js', hojaAuthLine+1, 'hojaAuth does not read total_entregas');
  if (!block.includes('total_devoluciones')) add('HIGH', 'finanzas_script.js', hojaAuthLine+1, 'hojaAuth does not read total_devoluciones');
}

// Verify guardarHoja saves entregadosCount (not entregas.length)
const guardarLine = finLines.findIndex(l => l.includes('async function guardarHoja'));
if (guardarLine >= 0) {
  const guardarBlock = finLines.slice(guardarLine, guardarLine + 80).join('\n');
  if (guardarBlock.includes('total_entregas: entregas.length')) {
    add('HIGH', 'finanzas_script.js', guardarLine+1, 'guardarHoja saves total_entregas as entregas.length instead of entregadosCount');
  }
  if (!guardarBlock.includes('entregadosCount')) {
    add('HIGH', 'finanzas_script.js', guardarLine+1, 'guardarHoja does not use entregadosCount');
  }
}

// ═══════════════════════════════════════════════════
// 4. ANALYTICS — chart rendering and OTIF
// ═══════════════════════════════════════════════════
const analytics = fs.readFileSync('analytics.html', 'utf8');
const aLines = analytics.split('\n');

// Check renderBarChartFuture is NOT used for chart-entregas
if (analytics.includes("renderBarChartFuture('chart-entregas'")) {
  add('HIGH', 'analytics.html', '?', 'chart-entregas still uses renderBarChartFuture (should use renderBarChart for historical data)');
}

// Check OTIF empty returns 0 not 100
const otifReturn = aLines.findIndex(l => l.includes('totalClosed > 0'));
if (otifReturn >= 0 && aLines[otifReturn].includes(': 100')) {
  add('HIGH', 'analytics.html', otifReturn+1, 'calculateOTIF returns 100 when no data (should return 0)');
}

// Check topResults is assigned
if (!analytics.includes('const topResults')) {
  add('MEDIUM', 'analytics.html', '?', 'OTIF by vehicle does not assign slice result to topResults');
}

// Check prevStart/prevEnd delta calculation
if (!analytics.includes('prevStart') || !analytics.includes('prevEnd')) {
  add('HIGH', 'analytics.html', '?', 'Delta KPI may overlap current period (missing prevStart/prevEnd)');
}

// Check sanitize function exists
if (!analytics.includes('function sanitize')) {
  // Check if it's loaded from an external script
  if (!analytics.includes('auth.js') && !analytics.includes('sanitize')) {
    add('MEDIUM', 'analytics.html', '?', 'sanitize() function not defined and not imported');
  }
}

// ═══════════════════════════════════════════════════
// 5. ADMIN — status enum consistency
// ═══════════════════════════════════════════════════
const admin = fs.readFileSync('admin_script.js', 'utf8');
const admLines = admin.split('\n');

// Check isPendState or equivalent normalization
if (!admin.includes('pendiente_revision')) {
  add('HIGH', 'admin_script.js', '?', 'pendiente_revision enum not handled');
}

// Check all batch operations in deleteViaje
const delViajeLine = admLines.findIndex(l => l.includes('async function deleteViaje'));
if (delViajeLine >= 0) {
  const dvBlock = admLines.slice(delViajeLine, delViajeLine + 30).join('\n');
  if (!dvBlock.includes('batch.commit')) add('HIGH', 'admin_script.js', delViajeLine+1, 'deleteViaje does not commit batch');
  if (!dvBlock.includes('despachos')) add('MEDIUM', 'admin_script.js', delViajeLine+1, 'deleteViaje does not clean despachos');
  if (!dvBlock.includes('gastos_ruta')) add('MEDIUM', 'admin_script.js', delViajeLine+1, 'deleteViaje does not clean gastos_ruta');
}

// ═══════════════════════════════════════════════════
// 6. RUTA — atomicity and devolucion flow
// ═══════════════════════════════════════════════════
const ruta = fs.readFileSync('ruta.html', 'utf8');
if (!ruta.includes('devBatch')) {
  add('CRITICAL', 'ruta.html', '?', 'confirmarDevolucion does not use devBatch for atomic operations');
}
if (!ruta.includes('logistica_inversa')) {
  add('MEDIUM', 'ruta.html', '?', 'logistica_inversa collection not referenced');
}

// ═══════════════════════════════════════════════════
// 7. TURNO — double shift and listener cleanup
// ═══════════════════════════════════════════════════
const turno = fs.readFileSync('turno.html', 'utf8');
if (!turno.includes('Ya tienes un turno activo')) {
  add('HIGH', 'turno.html', '?', 'No double-shift prevention logic found');
}
if (!turno.includes('_vehiculosUnsub')) {
  add('HIGH', 'turno.html', '?', 'No vehicle listener cleanup found');
}

// ═══════════════════════════════════════════════════
// 8. DASH — security checks
// ═══════════════════════════════════════════════════
const dash = fs.readFileSync('js/dash_script.js', 'utf8');
if (!dash.includes('textContent')) {
  add('HIGH', 'dash_script.js', '?', 'XSS: task rendering may use innerHTML with unsanitized data');
}
if (!dash.includes('FAIL CLOSED') && !dash.includes('fail closed')) {
  add('HIGH', 'dash_script.js', '?', 'Role fallback is not fail-closed');
}
if (!dash.includes('.limit(')) {
  add('MEDIUM', 'dash_script.js', '?', 'cleanupFinalizados has no limit — batch overflow risk');
}

// ═══════════════════════════════════════════════════
// 9. CROSS-MODULE — field name consistency
// ═══════════════════════════════════════════════════
const allCode = [
  { name: 'viajes.html', code: viajes },
  { name: 'finanzas_script.js', code: fin },
  { name: 'admin_script.js', code: admin },
  { name: 'analytics.html', code: analytics },
  { name: 'ruta.html', code: ruta },
  { name: 'turno.html', code: turno },
];

// Check that every file writing to hojas_ruta uses the same field names
const hrWriters = allCode.filter(f => f.code.includes("collection('hojas_ruta')") && (f.code.includes('.set(') || f.code.includes('.update(')));
hrWriters.forEach(f => {
  // Check key fields exist when writing
  if (f.code.includes('.set(') && f.code.includes('hojas_ruta')) {
    if (!f.code.includes('total_entregas')) {
      add('MEDIUM', f.name, '?', 'Writes to hojas_ruta but does not include total_entregas field');
    }
  }
});

// ═══════════════════════════════════════════════════
// 10. UNDEFINED FUNCTION CALLS
// ═══════════════════════════════════════════════════
// Check that sanitize is available in files that use it
['analytics.html', 'admin_script.js', 'viajes.html'].forEach(fname => {
  const code = fs.readFileSync(fname === 'admin_script.js' ? fname : fname, 'utf8');
  if (code.includes('sanitize(') && !code.includes('function sanitize')) {
    // Check if it's imported via auth.js or another script
    if (!code.includes('auth.js')) {
      add('MEDIUM', fname, '?', 'Uses sanitize() but may not import it (check if auth.js or another script provides it)');
    }
  }
});

// Check formatDate is available where used
['admin_script.js'].forEach(fname => {
  const code = fs.readFileSync(fname, 'utf8');
  if (code.includes('formatDate(') && !code.includes('function formatDate')) {
    if (!code.includes('auth.js')) {
      add('LOW', fname, '?', 'Uses formatDate() but does not define it (check if imported)');
    }
  }
});

// ═══════════════════════════════════════════════════
// 11. GASTOS — button re-enable
// ═══════════════════════════════════════════════════
const gastos = fs.readFileSync('gastos.html', 'utf8');
if (gastos.includes('btn.disabled=true') && !gastos.includes('btn.disabled=false')) {
  add('HIGH', 'gastos.html', '?', 'Submit button disabled but never re-enabled on error');
}

// ═══════════════════════════════════════════════════
// 12. XSS — innerHTML with unsanitized data
// ═══════════════════════════════════════════════════
allCode.forEach(({ name, code }) => {
  const lines = code.split('\n');
  lines.forEach((l, i) => {
    // Look for innerHTML assignments with template literals containing non-sanitized variables
    if (l.includes('.innerHTML') && l.includes('${') && !l.includes('sanitize(')) {
      // Exclude common safe patterns like numbers, fmt(), etc.
      const hasDangerous = /\$\{(?!fmt\(|sanitize\(|r\.pct|pct|r\.count|r\.total|[0-9]|i\+1|count|color|h\b|Math|km|totalValor|r\.km)/.test(l);
      if (hasDangerous && !l.includes('sanitize(')) {
        // Check if any of the template vars are sanitized
        const unsanitized = l.match(/\$\{([^}]+)\}/g);
        if (unsanitized && unsanitized.some(v => !v.includes('sanitize') && !v.includes('fmt(') && !/^\$\{\d/.test(v) && !v.includes('.pct') && !v.includes('.count') && !v.includes('.total'))) {
          // Only flag if it looks like user data
          if (l.includes('nombre') || l.includes('email') || l.includes('patente') || l.includes('cliente') || l.includes('motivo')) {
            add('MEDIUM', name, i+1, 'Potential XSS: innerHTML with unsanitized user data');
          }
        }
      }
    }
  });
});

// ═══════════════════════════════════════════════════
// REPORT
// ═══════════════════════════════════════════════════
console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║     SILOG Deep Code Audit — Professional Report     ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

const bySev = { CRITICAL: [], HIGH: [], MEDIUM: [], LOW: [] };
issues.forEach(i => bySev[i.sev].push(i));

Object.entries(bySev).forEach(([sev, items]) => {
  if (!items.length) return;
  const icon = { CRITICAL: '🔴', HIGH: '🟠', MEDIUM: '🟡', LOW: '🔵' }[sev];
  console.log(`\n${icon} ${sev} (${items.length}):`);
  items.forEach(i => {
    console.log(`  ${i.file}:${i.line} — ${i.msg}`);
  });
});

const total = issues.length;
const criticals = bySev.CRITICAL.length;
const highs = bySev.HIGH.length;

console.log('\n────────────────────────────────────────────────────');
console.log(`Total issues: ${total}`);
console.log(`  🔴 CRITICAL: ${criticals}`);
console.log(`  🟠 HIGH:     ${highs}`);
console.log(`  🟡 MEDIUM:   ${bySev.MEDIUM.length}`);
console.log(`  🔵 LOW:      ${bySev.LOW.length}`);
console.log('────────────────────────────────────────────────────');

if (criticals === 0 && highs === 0) {
  console.log('\n🎉 RESULTADO: Código limpio — sin issues críticos ni altos');
} else if (criticals === 0) {
  console.log('\n⚠️  RESULTADO: Sin issues críticos pero hay ' + highs + ' issues altos a revisar');
} else {
  console.log('\n🔴 RESULTADO: HAY ' + criticals + ' ISSUES CRÍTICOS — REQUIERE ACCIÓN INMEDIATA');
}
