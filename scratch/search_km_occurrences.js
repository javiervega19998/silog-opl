const fs = require('fs');
const path = require('path');

const dir = '.';
const ignoreDirs = ['node_modules', '.git', '.firebase'];

function walk(currentDir) {
  const files = fs.readdirSync(currentDir);
  for (const file of files) {
    const fullPath = path.join(currentDir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (!ignoreDirs.includes(file)) {
        walk(fullPath);
      }
    } else {
      const ext = path.extname(file);
      if (ext === '.html' || ext === '.js') {
        const content = fs.readFileSync(fullPath, 'utf8');
        let lineNum = 1;
        const lines = content.split('\n');
        for (const line of lines) {
          if (line.includes('.km') || line.includes('kilometraje') || line.includes('base_km') || line.includes('km_final') || line.includes('km_inicial')) {
            // Filter out comments and styling
            if (!line.trim().startsWith('//') && !line.includes(':root') && !line.includes('var(--')) {
              console.log(`${fullPath}:${lineNum}: ${line.trim()}`);
            }
          }
          lineNum++;
        }
      }
    }
  }
}

console.log("Searching for KM-related references in codebase...");
walk(dir);
console.log("Search completed.");
