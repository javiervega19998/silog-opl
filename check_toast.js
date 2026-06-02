const fs = require('fs');
let lines = fs.readFileSync('scratch/silog-ops/finanzas.html', 'utf8').split('\n');
for(let i=0; i<lines.length; i++) {
    let m = lines[i].match(/showToast\('([^']+)'/);
    if(m) {
        // If there's another quote after the matched string but before the comma, it's broken!
        // Actually, just let's look at all showToast lines
        if (lines[i].includes("Registro eliminado")) {
            console.log(i+1, lines[i]);
        }
    }
}
