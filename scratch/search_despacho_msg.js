const fs = require('fs');
const path = require('path');

const dir = 'C:\\Users\\ASUS\\.gemini\\antigravity\\scratch\\silog-ops';

function search(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        search(fullPath);
      }
    } else if (file.endsWith('.html') || file.endsWith('.js')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.toLowerCase().includes('despacho')) {
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.toLowerCase().includes('creado') || line.toLowerCase().includes('despacho')) {
            if (line.toLowerCase().includes('toast') || line.toLowerCase().includes('alert') || line.toLowerCase().includes('showtoast') || line.toLowerCase().includes('cread')) {
              console.log(`${file}:${idx + 1}: ${line.trim()}`);
            }
          }
        });
      }
    }
  }
}

search(dir);
