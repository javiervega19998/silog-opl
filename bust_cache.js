const fs = require('fs');
let c = fs.readFileSync('dashboard.html', 'utf8');
c = c.split('href="viajes.html"').join('href="viajes.html?v=3"');
fs.writeFileSync('dashboard.html', c);
console.log('Cache busted in dashboard.html');
