const fs = require('fs');
const content = fs.readFileSync('finanzas.html', 'utf8');

const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('valor_servicio') || l.includes('valor-servicio')) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});
