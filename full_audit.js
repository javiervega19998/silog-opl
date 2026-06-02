const fs = require('fs');

// ==========================================
// AUDIT SCRIPT - Full SILOG codebase
// ==========================================

const issues = [];
const info = [];

function flag(severity, file, line, msg) {
  issues.push({ severity, file, line, msg });
}

// ==========================================
// 1. Check cache-busting on JS imports
// ==========================================
const htmlFiles = ['turno.html','ruta.html','gastos.html','dashboard.html','viajes.html','finanzas.html','admin.html','analytics.html','checklist.html','bodega.html','crm.html','vehiculos.html'];
htmlFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  const txt = fs.readFileSync(f,'utf8');
  const lines = txt.split('\n');
  lines.forEach((l, i) => {
    const m = l.match(/src="(js\/[^"]+)"/);
    if (m && !m[1].includes('?v=')) {
      flag('HIGH', f, i+1, `Script without cache-busting: ${m[1]}`);
    }
  });
});

// ==========================================
// 2. Cross-module write analysis
// ==========================================
const allFiles = htmlFiles.concat(['admin_script.js','dash_script.js','viajes_script.js']);
const collectionWrites = {};

allFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  const txt = fs.readFileSync(f,'utf8');
  const lines = txt.split('\n');
  lines.forEach((l, i) => {
    const m = l.match(/db\.collection\('([^']+)'\)\.(doc\([^)]*\)\.)?(update|set|add|delete)\(/);
    if (m) {
      const col = m[1];
      const op = m[3];
      if (!collectionWrites[col]) collectionWrites[col] = [];
      collectionWrites[col].push(`${f}:${i+1} [${op}]`);
    }
  });
});

// ==========================================
// 3. Check for missing conductor_email in gastos_ruta
// ==========================================
const turnoHtml = fs.readFileSync('turno.html','utf8');
if (turnoHtml.includes("tipo: 'combustible'") && !turnoHtml.includes("conductor_email: _email")) {
  flag('MEDIUM', 'turno.html', 0, 'gastos_ruta records created in turno.html may be missing conductor_email');
}

// ==========================================
// 4. Check viajes.html for incomplete gastos sync
// ==========================================
const viajesHtml = fs.readFileSync('viajes.html','utf8');
const viajesLines = viajesHtml.split('\n');
viajesLines.forEach((l, i) => {
  if (l.includes('saveEditedTrip')) {
    info.push(`viajes.html:${i+1}: saveEditedTrip call/def`);
  }
  if (l.includes('litros') || l.includes('Litros')) {
    info.push(`viajes.html:${i+1}: litros reference - ${l.trim()}`);
  }
});

// ==========================================
// 5. Check for version mismatches in script tags
// ==========================================
const scriptVersions = {};
htmlFiles.forEach(f => {
  if (!fs.existsSync(f)) return;
  const txt = fs.readFileSync(f,'utf8');
  const matches = [...txt.matchAll(/src="js\/auth\.js\?v=(\d+)"/g)];
  matches.forEach(m => {
    if (!scriptVersions[f]) scriptVersions[f] = {};
    scriptVersions[f]['auth'] = m[1];
  });
  const matches2 = [...txt.matchAll(/src="js\/dash_script\.js\?v=(\d+)"/g)];
  matches2.forEach(m => {
    if (!scriptVersions[f]) scriptVersions[f] = {};
    scriptVersions[f]['dash'] = m[1];
  });
});

// ==========================================
// 6. Check viajes.html saveEditedTrip for missing sync 
// ==========================================
const saveEditIdx = viajesHtml.indexOf('async function saveEditedTrip');
if (saveEditIdx > -1) {
  const snippet = viajesHtml.substring(saveEditIdx, saveEditIdx + 3000);
  if (!snippet.includes('gastos_ruta')) {
    flag('CRITICAL', 'viajes.html', 0, 'saveEditedTrip does NOT sync gastos_ruta - peaje/combustible edits not persisted to Centro de Costos');
  } else {
    info.push('viajes.html: saveEditedTrip DOES include gastos_ruta sync');
  }
  if (!snippet.includes('litros')) {
    flag('HIGH', 'viajes.html', 0, 'saveEditedTrip does not save litros field to hojas_ruta');
  }
}

// ==========================================
// 7. Check hojas_ruta double-write potential
// ==========================================
const adminScript = fs.readFileSync('admin_script.js','utf8');
if (adminScript.includes("hojas_ruta")) {
  const adminHojaLines = adminScript.split('\n').filter((l,i) => l.includes('hojas_ruta'));
  info.push('admin_script.js hojas_ruta references: ' + adminHojaLines.length);
  adminHojaLines.forEach(l => info.push('  ' + l.trim()));
}

// ==========================================
// 8. Check for missing turno_id in hojas_ruta queries
// ==========================================
const finanzasJs = fs.readFileSync('js/finanzas_script.js','utf8');
const finanzasLines = finanzasJs.split('\n');
finanzasLines.forEach((l, i) => {
  if (l.includes('hojas_ruta') && l.includes('.get(')) {
    info.push(`finanzas_script.js:${i+1}: hojas_ruta query - ${l.trim()}`);
  }
  if (l.includes('gastos_ruta') && (l.includes('.update(') || l.includes('.set(') || l.includes('.delete('))) {
    info.push(`finanzas_script.js:${i+1}: gastos_ruta write - ${l.trim()}`);
  }
});

// ==========================================
// 9. Check for orphaned collection reads without corresponding writes
// ==========================================
const collections = ['hojas_ruta', 'gastos_ruta', 'despachos', 'turnos', 'vehiculos', 'users'];
collections.forEach(col => {
  const writers = collectionWrites[col] || [];
  if (writers.length === 0) {
    flag('MEDIUM', 'global', 0, `Collection '${col}' has no write operations found (read-only or missed)`);
  }
});

// ==========================================
// 10. Check for duplicate index creation
// ==========================================
const firestoreRules = fs.readFileSync('firestore.rules','utf8');
if (firestoreRules.includes('isAdmin')) {
  flag('LOW', 'firestore.rules', 0, "Unused function 'isAdmin' declared in firestore.rules");
}

// ==========================================
// REPORT
// ==========================================
console.log('\n========================================');
console.log('SILOG AUDIT REPORT');
console.log('========================================\n');

const criticals = issues.filter(i => i.severity === 'CRITICAL');
const highs = issues.filter(i => i.severity === 'HIGH');
const mediums = issues.filter(i => i.severity === 'MEDIUM');
const lows = issues.filter(i => i.severity === 'LOW');

console.log(`CRITICAL: ${criticals.length}  HIGH: ${highs.length}  MEDIUM: ${mediums.length}  LOW: ${lows.length}\n`);

['CRITICAL','HIGH','MEDIUM','LOW'].forEach(sev => {
  const sevIssues = issues.filter(i => i.severity === sev);
  if (sevIssues.length > 0) {
    console.log(`\n--- ${sev} ---`);
    sevIssues.forEach((issue, idx) => {
      console.log(`${idx+1}. [${issue.file}:${issue.line}] ${issue.msg}`);
    });
  }
});

console.log('\n--- COLLECTION WRITE MAP ---');
Object.entries(collectionWrites).sort().forEach(([col, writes]) => {
  console.log(`\n${col} (${writes.length} writes):`);
  writes.forEach(w => console.log('  ' + w));
});

console.log('\n--- INFO ---');
info.slice(0, 60).forEach(i => console.log(i));

console.log('\n--- SCRIPT VERSIONS ---');
Object.entries(scriptVersions).forEach(([f, v]) => {
  console.log(f + ': ' + JSON.stringify(v));
});
