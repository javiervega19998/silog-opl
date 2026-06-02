const fs = require('fs');
const content = fs.readFileSync('finanzas.html', 'utf8');

const start = content.indexOf('id="modal-hoja"');
if (start !== -1) {
  console.log(content.slice(start, start + 3000));
} else {
  console.log("Could not find modal-hoja");
}
