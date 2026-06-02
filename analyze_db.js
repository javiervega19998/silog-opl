const fs = require('fs');
const files = fs.readdirSync('.').filter(f => f.endsWith('.html') || f.endsWith('.js'));
const data = {};
files.forEach(f => {
  if (fs.statSync(f).isDirectory()) return;
  const content = fs.readFileSync(f, 'utf8');
  const collections = [...content.matchAll(/db\.collection\(['"]([^'"]+)['"]\)/g)].map(m => m[1]);
  const uniqueColl = [...new Set(collections)];
  if(uniqueColl.length > 0) data[f] = uniqueColl;
});
console.log(JSON.stringify(data, null, 2));
