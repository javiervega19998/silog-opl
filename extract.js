const fs = require('fs');
let html = fs.readFileSync('scratch/silog-ops/finanzas.html', 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/g);
if(scriptMatch) {
    const js = scriptMatch[scriptMatch.length-1].replace(/<\/?script>/g, '');
    fs.writeFileSync('scratch/silog-ops/test.js', js, 'utf8');
}
