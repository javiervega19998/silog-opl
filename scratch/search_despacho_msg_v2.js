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
      const lines = content.split('\n');
      lines.forEach((line, idx) => {
        const lower = line.toLowerCase();
        if (lower.includes('despacho') && (lower.includes('crea') || lower.includes('agre') || lower.includes('guard') || lower.includes('exito') || lower.includes('succ'))) {
          console.log(`${file}:${idx + 1}: ${line.trim()}`);
        }
      });
    }
  }
}

search(dir);
