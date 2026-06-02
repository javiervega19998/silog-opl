const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../js/dash_script.js');
const content = fs.readFileSync(targetPath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes("turno") || line.includes("Activo") || line.includes("estado")) {
    // Show matching line with surrounding context if possible
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
