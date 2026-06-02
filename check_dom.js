const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('scratch/silog-ops/dashboard.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;
const sOps = doc.getElementById('sec-operaciones');
if (!sOps) console.log('sec-operaciones NOT FOUND!');
else console.log('sec-operaciones parent:', sOps.parentElement.className, 'children:', sOps.children.length);

const sGest = doc.getElementById('sec-gestion');
if (!sGest) console.log('sec-gestion NOT FOUND!');
else console.log('sec-gestion parent:', sGest.parentElement.className, 'children:', sGest.children.length);
