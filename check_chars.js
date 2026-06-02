const fs = require('fs');
let lines = fs.readFileSync('scratch/silog-ops/finanzas.html', 'utf8').split('\n');
for(let i=2260; i<=2285; i++) {
    let line = lines[i];
    for(let j=0; j<line.length; j++) {
        let code = line.charCodeAt(j);
        if(code > 127 || code < 32) {
            if(code !== 13) console.log('Line ' + (i+1) + ', col ' + j + ': charCode ' + code + ' (char: ' + line[j] + ')');
        }
    }
}
