const fs = require('fs');
const html = fs.readFileSync('scratch/silog-ops/dashboard.html', 'utf8');
const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gm;
let match;
while ((match = scriptRegex.exec(html)) !== null) {
  const scriptContent = match[1];
  if (scriptContent.trim() !== '') {
    try {
      new Function(scriptContent);
    } catch (e) {
      console.log('SyntaxError found:', e.message);
      console.log(scriptContent.substring(0, 150));
    }
  }
}
console.log('Syntax check complete.');
