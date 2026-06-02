const fs = require('fs');
let c = fs.readFileSync('viajes.html', 'utf8');

const targetHTML = `<div class="form-row"><label>Patente</label><input class="field" id="patente" placeholder="KZGZ57" style="text-transform:uppercase"/></div>`;
const replacementHTML = `<div class="form-row"><label>Patente</label><select class="field" id="patente" style="text-transform:uppercase"><option value="">Seleccione Vehículo...</option></select></div>`;

c = c.replace(targetHTML, replacementHTML);

fs.writeFileSync('viajes.html', c);
console.log('Done replacement');
