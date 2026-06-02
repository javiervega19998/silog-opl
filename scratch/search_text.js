const fs = require('fs');
const content = fs.readFileSync('finanzas.html', 'utf8');
const lines = content.split('\n');

console.log('--- Search for guardarHoja ---');
lines.forEach((line, index) => {
  if (line.includes('function guardarHoja')) {
    console.log(`${index + 1}: ${line.trim()}`);
  }
});
