const fs = require('fs');
const path = require('path');

function walk(dir) {
  fs.readdirSync(dir).forEach(f => {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') walk(p);
    } else if (f.endsWith('.js') || f.endsWith('.html')) {
      const content = fs.readFileSync(p, 'utf8');
      const matches = content.match(/db\.collection\(['"`]([a-zA-Z0-9_-]+)['"`]\)/g);
      if (matches && matches.length) {
        console.log(`${p}:`);
        console.log('  ' + [...new Set(matches)].join(', '));
      }
    }
  });
}

console.log("Analyzing project collections...");
walk(path.resolve(__dirname, '..'));
