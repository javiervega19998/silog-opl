/**
 * Script para agregar theme toggle y scripts de utils a todos los HTML
 * - Agrega <script src="js/theme.js"> y <script src="js/utils.js"> y <script src="js/constants.js">
 * - Agrega botón de theme toggle en el nav de cada página
 * - Agrega compressImage() en páginas que hacen uploads
 */
const fs = require('fs');
const path = require('path');

const BASE = 'C:\\Users\\ASUS\\.gemini\\antigravity\\scratch\\silog-ops';

// Páginas que necesitan los scripts base
const ALL_PAGES = [
  'dashboard.html','turno.html','ruta.html','gastos.html','viajes.html',
  'vehiculos.html','admin.html','finanzas.html','checklist.html',
  'bodega.html','despacho_bodega.html','analytics.html'
];

// Páginas que suben imágenes (necesitan compressImage inlineado)
const UPLOAD_PAGES = ['ruta.html','gastos.html','turno.html','viajes.html'];

let changed = 0;

for (const page of ALL_PAGES) {
  const filePath = path.join(BASE, page);
  if (!fs.existsSync(filePath)) { console.log(`⏭️  ${page} no existe`); continue; }
  
  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;
  
  // 1. Agregar scripts antes de </body> si no están ya
  const scriptsBefore = '</body>';
  const toInject = [];
  
  if (!html.includes('js/constants.js')) toInject.push('<script src="js/constants.js?v=1"></script>');
  if (!html.includes('js/utils.js'))     toInject.push('<script src="js/utils.js?v=1"></script>');
  if (!html.includes('js/theme.js'))     toInject.push('<script src="js/theme.js?v=1"></script>');
  
  if (toInject.length > 0) {
    // Insert before the last </body>
    const lastBodyIdx = html.lastIndexOf('</body>');
    if (lastBodyIdx !== -1) {
      html = html.slice(0, lastBodyIdx) + toInject.join('\n') + '\n</body>';
    }
  }
  
  // 2. Agregar botón de theme toggle en el nav (si no existe ya)
  if (!html.includes('theme-toggle') && html.includes('class="nav"')) {
    // Find nav-right div and add button before closing
    html = html.replace(
      /(<div class="nav-right"[^>]*>)/,
      '$1\n    <button id="theme-toggle" onclick="toggleTheme()" title="Cambiar tema" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);width:34px;height:34px;border-radius:8px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">☀️</button>'
    );
  }
  
  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`✅ ${page} actualizado (${toInject.length} scripts + toggle)`);
    changed++;
  } else {
    console.log(`ℹ️  ${page} sin cambios`);
  }
}

// 3. Agregar compressImage a páginas de upload
const COMPRESS_FN = `
// ── Compresión de imagen antes de upload ──────────────────
async function compressImage(file, maxWidth, quality) {
  maxWidth = maxWidth || 1200; quality = quality || 0.7;
  return new Promise(function(resolve) {
    if (!file || !file.type || !file.type.startsWith('image/')) { resolve(file); return; }
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) { resolve(blob || file); }, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
`;

for (const page of UPLOAD_PAGES) {
  const filePath = path.join(BASE, page);
  if (!fs.existsSync(filePath)) continue;
  
  let html = fs.readFileSync(filePath, 'utf8');
  const original = html;
  
  if (html.includes('compressImage')) { console.log(`ℹ️  ${page} ya tiene compressImage`); continue; }
  
  // Find the first <script> tag that contains firebase code and insert after it
  // We'll insert before the first async function that does storage.ref().put()
  const putIdx = html.indexOf('.put(');
  if (putIdx === -1) { console.log(`⏭️  ${page} sin uploads`); continue; }
  
  // Find the opening of the <script> block containing this put()
  const scriptBeforePut = html.lastIndexOf('<script>', putIdx);
  if (scriptBeforePut === -1) continue;
  
  // Insert after the opening <script> tag
  const insertAt = html.indexOf('\n', scriptBeforePut) + 1;
  html = html.slice(0, insertAt) + COMPRESS_FN + html.slice(insertAt);
  
  // Now replace .put(file) and .put(podFile) with compressed versions
  // For ruta.html: uploadFile uses file param → wrap the put call
  // We'll do targeted replacements
  if (page === 'ruta.html') {
    // uploadFile function: add compression
    html = html.replace(
      /async function uploadFile\(file,path\)\{[\s\r\n]*const ref=storage\.ref\(path\);[\s\r\n]*await ref\.put\(file\);[\s\r\n]*return await ref\.getDownloadURL\(\);[\s\r\n]*\}/,
      'async function uploadFile(file,path){\n  const compressed = await compressImage(file);\n  const ref=storage.ref(path);\n  await ref.put(compressed);\n  return await ref.getDownloadURL();\n}'
    );
  }
  
  if (page === 'gastos.html') {
    html = html.replace(
      /(const ref=storage\.ref\(`gastos\/\$\{_turnoId\}\/\$\{tipo\}_\$\{Date\.now\(\)\}\.jpg`\);[\s\r\n]*await ref\.put\()(file)(\);)/,
      '$1(await compressImage($2))$3'
    );
  }
  
  if (page === 'turno.html') {
    html = html.replace(
      /(const ref = storage\.ref\(`pods\/\$\{Date\.now\(\)\}_\$\{podFile\.name\}`\);[\s\r\n]*await ref\.put\()(podFile)(\);)/,
      '$1(await compressImage($2))$3'
    );
  }
  
  if (page === 'viajes.html') {
    // Multiple upload points - replace all .put(fotoFile) and .put(podFile)
    html = html.replace(/await ref\.put\(fotoFile\);/g, 'await ref.put(await compressImage(fotoFile));');
    html = html.replace(/await ref\.put\(podFile\);/g, 'await ref.put(await compressImage(podFile));');
  }
  
  if (html !== original) {
    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`✅ ${page} → compressImage agregado`);
    changed++;
  }
}

console.log(`\n✅ Total archivos modificados: ${changed}`);
