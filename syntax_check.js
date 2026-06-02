// Extrae los bloques <script> de un HTML y valida su sintaxis
const fs = require('fs');
const files = ['viajes.html','ruta.html','turno.html','analytics.html','admin.html','gastos.html','dashboard.html','finanzas.html'];
const { execSync } = require('child_process');
let allOk = true;

files.forEach(f => {
  if (!fs.existsSync(f)) { console.log('⚠️  Omitido (no existe):', f); return; }
  const html = fs.readFileSync(f, 'utf8');
  // Extraer contenido de todos los <script> inline
  const scripts = [];
  const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    scripts.push(m[1]);
  }
  if (!scripts.length) { console.log('ℹ️  Sin scripts inline:', f); return; }
  const combined = scripts.join('\n');
  const tmp = '__tmp_syntax_check.js';
  fs.writeFileSync(tmp, combined);
  try {
    execSync('node --check ' + tmp, { stdio: 'pipe' });
    console.log('✅ Sintaxis OK:', f);
  } catch(e) {
    console.log('❌ ERROR SINTAXIS en', f + ':');
    console.log('  ', e.stderr.toString().split('\n')[0]);
    allOk = false;
  }
  fs.unlinkSync(tmp);
});

// Verificar también los JS externos
['js/finanzas_script.js','js/dash_script.js','admin_script.js'].forEach(f => {
  if (!fs.existsSync(f)) return;
  const tmp = '__tmp_syntax_check.js';
  fs.copyFileSync(f, tmp);
  try {
    execSync('node --check ' + tmp, { stdio: 'pipe' });
    console.log('✅ Sintaxis OK:', f);
  } catch(e) {
    console.log('❌ ERROR SINTAXIS en', f + ':');
    console.log('  ', e.stderr.toString().split('\n')[0]);
    allOk = false;
  }
  fs.unlinkSync(tmp);
});

console.log(allOk ? '\n🎉 Todos los archivos tienen sintaxis correcta' : '\n🔴 Hay errores de sintaxis — revisar antes de deploy');
