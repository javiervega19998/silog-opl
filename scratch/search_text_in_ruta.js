const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../ruta.html');
const content = fs.readFileSync(targetPath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("Foto Estado de Carga")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
