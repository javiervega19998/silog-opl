const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../turno.html');
console.log(`Checking syntax for: ${filePath}`);

const html = fs.readFileSync(filePath, 'utf8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gm;
let match;
let count = 0;
let errors = 0;

while ((match = scriptRegex.exec(html)) !== null) {
  const scriptContent = match[1];
  if (scriptContent.trim() !== '') {
    count++;
    try {
      new Function(scriptContent);
    } catch (e) {
      errors++;
      console.error(`❌ SyntaxError in script block ${count}:`, e.message);
      // Print context of error if possible
      const lines = scriptContent.split('\n');
      console.error("Script snippet around error:");
      console.error(lines.slice(0, 30).join('\n'));
    }
  }
}

if (errors === 0) {
  console.log(`\n✅ Syntax check PASSED for all ${count} script block(s). No syntax errors!`);
} else {
  console.error(`\n❌ Syntax check FAILED with ${errors} error(s).`);
  process.exit(1);
}
