const fs = require('fs');
let html = fs.readFileSync('finanzas.html', 'utf8');

const targetHtml = `<div class="form-group"><label>Combustible ($)</label><input class="field" type="number" id="hoja-combustible" placeholder="0"/></div>`;
const newHtml = `<div class="form-group"><label>Combustible ($)</label><input class="field" type="number" id="hoja-combustible" placeholder="0"/></div>
          <div class="form-group"><label>Litros</label><input class="field" type="number" id="hoja-litros" placeholder="0"/></div>`;

if (html.includes(targetHtml)) {
  html = html.replace(targetHtml, newHtml);
  fs.writeFileSync('finanzas.html', html);
  console.log('finanzas.html updated');
} else {
  console.log('Target not found in finanzas.html');
}

let js = fs.readFileSync('js/finanzas_script.js', 'utf8');

const t1 = `document.getElementById('hoja-combustible').value = _hojaActual.combustible || 0;`;
const r1 = `document.getElementById('hoja-combustible').value = _hojaActual.combustible || 0;
  document.getElementById('hoja-litros').value = _hojaActual.litros_combustible || 0;`;
if(js.includes(t1)) js = js.replace(t1, r1);

const t2 = `const combustibleEditado = parseFloat(document.getElementById('hoja-combustible').value)||0;`;
const r2 = `const combustibleEditado = parseFloat(document.getElementById('hoja-combustible').value)||0;
  const litrosEditado = parseFloat(document.getElementById('hoja-litros').value)||0;`;
if(js.includes(t2)) js = js.replace(t2, r2);

const t3 = `combustible: combustibleEditado,
      monto_combustible: combustibleEditado,`;
const r3 = `combustible: combustibleEditado,
      monto_combustible: combustibleEditado,
      litros_combustible: litrosEditado,`;
if(js.includes(t3)) js = js.replace(t3, r3);

const t4 = `batch.update(combustibleDoc.ref, { monto_clp: combustibleEditado, monto: combustibleEditado });`;
const r4 = `batch.update(combustibleDoc.ref, { monto_clp: combustibleEditado, monto: combustibleEditado, litros: litrosEditado });`;
if(js.includes(t4)) js = js.replace(t4, r4);

const t5 = `tipo: 'combustible',
            monto_clp: combustibleEditado,
            monto: combustibleEditado,`;
const r5 = `tipo: 'combustible',
            monto_clp: combustibleEditado,
            monto: combustibleEditado,
            litros: litrosEditado,`;
if(js.includes(t5)) js = js.replace(t5, r5);

fs.writeFileSync('js/finanzas_script.js', js);
console.log('js/finanzas_script.js updated');
