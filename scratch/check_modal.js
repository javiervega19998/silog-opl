const fs = require('fs');
const content = fs.readFileSync('finanzas.html', 'utf8');
const start = content.indexOf('id="modal-hoja"');
if (start !== -1) {
  const chunk = content.slice(start, start + 4000);
  const lines = chunk.split('\n');
  lines.forEach((l, i) => {
    if (l.includes('id=') || l.includes('<input') || l.includes('<select')) {
      console.log(`${i+1}: ${l.trim()}`);
    }
  });
} else {
  console.log("Could not find modal-hoja in finanzas.html");
}
