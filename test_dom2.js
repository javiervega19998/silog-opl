const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync('scratch/silog-ops/finanzas.html', 'utf8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on('jsdomError', (err) => {
    console.log('JSDOM Internal Error: ', err.message);
});
virtualConsole.on('error', (err) => {
    console.log('Error: ', err.message);
});

const dom = new JSDOM(html, {
    url: "file://" + path.resolve('scratch/silog-ops/finanzas.html').replace(/\\/g, '/'),
    runScripts: "dangerously",
    resources: "usable",
    virtualConsole
});
