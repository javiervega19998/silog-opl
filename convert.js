const fs = require('fs');
const buf = fs.readFileSync('scratch/silog-ops/finanzas.html');
// Try to decode as latin1 and write as utf-8
const str = buf.toString('latin1');
fs.writeFileSync('scratch/silog-ops/finanzas.html', str, 'utf8');
console.log('Converted to utf8');
