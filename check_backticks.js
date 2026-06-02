const fs = require('fs');
let text = fs.readFileSync('scratch/silog-ops/finanzas.html', 'utf8');
let count = 0;
for(let i=0; i<text.length; i++) {
    if(text[i] === '\') count++;
}
console.log('Total backticks:', count);
if (count % 2 !== 0) console.log('UNEVEN BACKTICKS!');
else console.log('Even backticks');
