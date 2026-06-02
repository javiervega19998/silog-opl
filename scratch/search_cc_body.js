const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../js/finanzas_script.js');
const content = fs.readFileSync(targetPath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("cc-body")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
