const fs = require('fs');

let js = fs.readFileSync('js/finanzas_script.js', 'utf8');

js = js.replace(/await Promise\.all\(\[/, 'await Promise.allSettled([');

fs.writeFileSync('js/finanzas_script.js', js);
console.log("Updated Promise.all to Promise.allSettled in finanzas_script.js.");

let dash = fs.readFileSync('js/dash_script.js', 'utf8');
dash = dash.replace(/await Promise\.all\(\[/, 'await Promise.allSettled([');
fs.writeFileSync('js/dash_script.js', dash);
console.log("Updated Promise.all to Promise.allSettled in dash_script.js.");
