const fs = require('fs');

function extractScript(htmlFile, jsFile) {
  let html = fs.readFileSync(htmlFile, 'utf8');
  const match = html.match(/<script>\s*\n([\s\S]*?)<\/script>\s*<\/body>/);
  if(match) {
    fs.writeFileSync('js/' + jsFile, match[1].trim());
    
    // Replace script block in HTML
    html = html.replace(/<script>\s*\n[\s\S]*?<\/script>\s*(<\/body>)/, `<script src="js/${jsFile}?v=9"></script>\n$1`);
    
    // Also bump auth.js version
    html = html.replace(/auth\.js\?v=\d+/, 'auth.js?v=9');
    
    fs.writeFileSync(htmlFile, html);
    console.log(`Extracted script from ${htmlFile} to js/${jsFile}`);
  } else {
    console.log(`Could not find main script block in ${htmlFile}`);
  }
}

extractScript('finanzas.html', 'finanzas_script.js');
extractScript('dashboard.html', 'dash_script.js');
extractScript('bodega.html', 'bodega_script.js');
