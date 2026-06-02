const fs = require('fs');
let lines = fs.readFileSync('scratch/silog-ops/finanzas.html', 'utf8').split('\n');
for(let i=2260; i<=2285; i++) {
    console.log((i+1) + ': ' + lines[i]);
}
