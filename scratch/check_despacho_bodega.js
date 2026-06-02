const fs = require('fs');
const { execSync } = require('child_process');

const f = 'despacho_bodega.html';
if (!fs.existsSync(f)) {
  console.log('⚠️  Omitido (no existe):', f);
  process.exit(1);
}

const html = fs.readFileSync(f, 'utf8');
const scripts = [];
const re = /<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi;
let m;
while ((m = re.exec(html)) !== null) {
  scripts.push(m[1]);
}

if (!scripts.length) {
  console.log('ℹ️  Sin scripts inline:', f);
  process.exit(0);
}

const combined = scripts.join('\n');
const tmp = '__tmp_despacho_check.js';
fs.writeFileSync(tmp, combined);

try {
  execSync('node --check ' + tmp, { stdio: 'pipe' });
  console.log('✅ Sintaxis OK:', f);
} catch(e) {
  console.log('❌ ERROR SINTAXIS en', f + ':');
  console.log(e.stderr.toString());
  process.exit(1);
} finally {
  if (fs.existsSync(tmp)) {
    fs.unlinkSync(tmp);
  }
}
