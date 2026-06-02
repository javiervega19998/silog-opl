const fs = require('fs');
let text = fs.readFileSync('scratch/silog-ops/finanzas.html', 'utf8');
let line = text.split('\n')[2266];
console.log('Line 2267:', line);
console.log('Includes backtick?', line.includes(String.fromCharCode(96)));
