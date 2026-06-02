const fs = require('fs');
const path = require('path');

const files = [
  path.join(__dirname, '../viajes.html'),
  path.join(__dirname, '../viajes_script.js')
];

let totalErrors = 0;

for (const filePath of files) {
  console.log(`Checking syntax for: ${filePath}`);
  const content = fs.readFileSync(filePath, 'utf8');
  
  if (filePath.endsWith('.html')) {
    const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gm;
    let match;
    let count = 0;
    while ((match = scriptRegex.exec(content)) !== null) {
      const scriptContent = match[1];
      if (scriptContent.trim() !== '') {
        count++;
        try {
          new Function(scriptContent);
        } catch (e) {
          totalErrors++;
          console.error(`❌ SyntaxError in ${path.basename(filePath)} script block ${count}:`, e.message);
        }
      }
    }
  } else {
    try {
      new Function(content);
    } catch (e) {
      totalErrors++;
      console.error(`❌ SyntaxError in ${path.basename(filePath)}:`, e.message);
    }
  }
}

if (totalErrors === 0) {
  console.log(`\n✅ All syntax checks PASSED successfully!`);
} else {
  console.error(`\n❌ Syntax checks FAILED with ${totalErrors} error(s).`);
  process.exit(1);
}
