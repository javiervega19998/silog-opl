const fs = require('fs');
const path = require('path');

function searchCode(filePath, term, numLinesBefore = 0, numLinesAfter = 10) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  console.log(`=== Matches for "${term}" in ${path.basename(filePath)} ===`);
  lines.forEach((line, i) => {
    if (line.includes(term)) {
      console.log(`Match at line ${i+1}:`);
      const start = Math.max(0, i - numLinesBefore);
      const end = Math.min(lines.length, i + 1 + numLinesAfter);
      console.log(lines.slice(start, end).join('\n'));
      console.log('------------------------------------------------');
    }
  });
}

const workspace = path.resolve(__dirname, '..');
searchCode(path.join(workspace, 'js/inventory-helpers.js'), 'movimientos_bodega', 2, 8);
searchCode(path.join(workspace, 'js/bodega_script.js'), 'movimientos_bodega', 2, 8);
