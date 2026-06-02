const fs = require('fs');
let lines = fs.readFileSync('scratch/silog-ops/finanzas.html', 'utf8').split('\n');
let line = lines[2271]; // index 2271 is line 2272
let hex = '';
for(let i=0; i<line.length; i++) {
    hex += line.charCodeAt(i).toString(16) + ' ';
}
console.log('Hex: ' + hex);
console.log('Str: ' + line);
