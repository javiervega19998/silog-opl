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
      if (content.toLowerCase().includes('despacho') && (content.toLowerCase().includes('cread') || content.toLowerCase().includes('agregad') || content.toLowerCase().includes('pantalla'))) {
        console.log(`FOUND IN: ${file}`);
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          const lower = line.toLowerCase();
          if (lower.includes('despacho') || lower.includes('cread') || lower.includes('agregad') || lower.includes('toast') || lower.includes('alert')) {
            if (lower.includes('toast') || lower.includes('alert') || lower.includes('exito') || lower.includes('success') || lower.includes('cread') || lower.includes('agregad')) {
              console.log(`  L${idx + 1}: ${line.trim()}`);
            }
          }
        });
      }
    }
  }
}

search(dir);
