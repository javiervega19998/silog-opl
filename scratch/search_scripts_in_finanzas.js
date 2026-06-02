const fs = require('fs');
const path = require('path');

const targetPath = path.resolve(__dirname, '../finanzas.html');
const content = fs.readFileSync(targetPath, 'utf8');

const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.includes("<script")) {
    console.log(`Line ${idx + 1}: ${line.trim()}`);
  }
});
