const fs = require('fs');
const files = ['turno.html','ruta.html','gastos.html','dashboard.html','viajes.html','finanzas.html','admin.html','analytics.html','checklist.html','bodega.html','crm.html','vehiculos.html'];
let total = 0;
files.forEach(f => {
  if (!fs.existsSync(f)) return;
  let txt = fs.readFileSync(f,'utf8');
  const before = txt;
  txt = txt.replace(/auth\.js\?v=6/g, 'auth.js?v=7');
  txt = txt.replace(/auth\.js\?v=9/g, 'auth.js?v=7');
  txt = txt.replace(/dash_script\.js\?v=9/g, 'dash_script.js?v=10');
  txt = txt.replace(/"js\/firebase-config\.js"/g, '"js/firebase-config.js?v=2"');
  txt = txt.replace(/"js\/logo-data\.js"/g, '"js/logo-data.js?v=2"');
  txt = txt.replace(/"js\/checklist-pdf\.js"/g, '"js/checklist-pdf.js?v=2"');
  txt = txt.replace(/"js\/inventory-helpers\.js"/g, '"js/inventory-helpers.js?v=2"');
  if (txt !== before) { fs.writeFileSync(f, txt); total++; console.log('Bumped: '+f); }
});
console.log('Total files updated:', total);
