const fs = require('fs');
let html = fs.readFileSync('viajes.html', 'utf8');

// 1. Add input to modal HTML
const targetHTML = `<div class="form-row">
          <label style="display:block;font-size:.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Combustible ($)</label>
          <input class="field" type="number" id="edit-combustible" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:.85rem;outline:none"/>
        </div>`;

const newHTML = `<div class="form-row">
          <label style="display:block;font-size:.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Litros Comb.</label>
          <input class="field" type="number" step="0.1" id="edit-litros" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:.85rem;outline:none"/>
        </div>
        <div class="form-row">
          <label style="display:block;font-size:.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Combustible ($)</label>
          <input class="field" type="number" id="edit-combustible" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:.85rem;outline:none"/>
        </div>`;
        
html = html.replace(targetHTML, newHTML);

// 2. Load liters into modal
const targetLoad = `document.getElementById('edit-combustible').value = r.monto_combustible ?? r.combustible ?? 0;`;
const newLoad = `document.getElementById('edit-combustible').value = r.monto_combustible ?? r.combustible ?? 0;
    document.getElementById('edit-litros').value = r.litros_combustible ?? 0;`;

html = html.replace(targetLoad, newLoad);

// 3. Save liters from modal
const targetSave1 = `const combustible = parseFloat(document.getElementById('edit-combustible').value) || 0;`;
const newSave1 = `const combustible = parseFloat(document.getElementById('edit-combustible').value) || 0;
  const litrosCombustible = parseFloat(document.getElementById('edit-litros').value) || 0;`;

html = html.replace(targetSave1, newSave1);

const targetSave2 = `monto_combustible: combustible,
      combustible,`;
const newSave2 = `monto_combustible: combustible,
      combustible,
      litros_combustible: litrosCombustible,`;

html = html.replace(targetSave2, newSave2);

fs.writeFileSync('viajes.html', html);
console.log('viajes.html modal updated successfully with fuel liters.');
