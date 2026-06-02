const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\ASUS\\.gemini\\antigravity\\scratch\\silog-ops\\crm.html', 'utf8');
const lines = content.split('\n');
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('despacho') || line.toLowerCase().includes('cread') || line.toLowerCase().includes('agregad')) {
    console.log(`L${idx+1}: ${line.trim()}`);
  }
});
