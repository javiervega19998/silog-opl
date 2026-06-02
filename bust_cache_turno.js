const fs = require('fs');
let c = fs.readFileSync('dashboard.html', 'utf8');
c = c.split('href="turno.html"').join('href="turno.html?v=4"');
fs.writeFileSync('dashboard.html', c);
console.log('Cache busted turno.html in dashboard');
