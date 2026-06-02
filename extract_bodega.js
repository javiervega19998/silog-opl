const fs = require('fs');

function extractBodega() {
  let html = fs.readFileSync('bodega.html', 'utf8');
  // find the script that contains "function showTab" or similar
  const match = html.match(/<script>([\s\S]*?function showTab[\s\S]*?)<\/script>/);
  if(match) {
    fs.writeFileSync('js/bodega_script.js', match[1].trim());
    html = html.replace(match[0], '<script src="js/bodega_script.js?v=9"></script>');
    html = html.replace(/auth\.js\?v=\d+/, 'auth.js?v=9');
    fs.writeFileSync('bodega.html', html);
    console.log("Extracted bodega.html script.");
  } else {
    console.log("Not found in bodega.html");
  }
}

extractBodega();
