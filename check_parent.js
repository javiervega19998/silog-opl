const fs = require('fs');
const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const html = fs.readFileSync('scratch/silog-ops/dashboard.html', 'utf8');
const dom = new JSDOM(html);
const doc = dom.window.document;
const sGest = doc.getElementById('sec-gestion');
console.log('sec-gestion parent tag:', sGest.parentElement.tagName, 'id:', sGest.parentElement.id, 'class:', sGest.parentElement.className);

const mainEl = doc.querySelector('.main');
if (mainEl) {
  console.log('Main children IDs:');
  for (let i=0; i<mainEl.children.length; i++) {
    console.log(' - ' + mainEl.children[i].tagName + ' id=' + mainEl.children[i].id);
  }
}
