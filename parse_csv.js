const fs = require('fs');
const path = require('path');

const csvPath = 'C:\\Users\\ASUS\\Downloads\\silog_inventario_totalenergies (1).csv';
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.split('\n').filter(l => l.trim() !== '');

const data = {};
// Skip header
for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(',');
  if (parts.length >= 5) {
    const code = parts[0].trim();
    const disp = parseInt(parts[2]) || 0;
    const merma = parseInt(parts[4]) || 0;
    
    if (code && code !== 'N/A') {
      data[code] = { disp, noDisp: merma };
    }
  }
}

fs.writeFileSync('base_stock.json', JSON.stringify(data, null, 2));
console.log('Parsed', Object.keys(data).length, 'products');
