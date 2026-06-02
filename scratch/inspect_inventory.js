const fs = require('fs');
const path = require('path');

function searchFile(filePath, term) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log(`=== Matches for "${term}" in ${path.basename(filePath)} ===`);
  lines.forEach((line, i) => {
    if (line.includes(term)) {
      console.log(`${i+1}: ${line.trim()}`);
    }
  });
}

const workspace = path.resolve(__dirname, '..');
searchFile(path.join(workspace, 'js/inventory-helpers.js'), 'movimientos_bodega');
searchFile(path.join(workspace, 'js/inventory-helpers.js'), 'inventory');
searchFile(path.join(workspace, 'viajes.html'), 'movimientos_bodega');
