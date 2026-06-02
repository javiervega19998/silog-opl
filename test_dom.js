const jsdom = require('jsdom');
const { JSDOM } = jsdom;
const fs = require('fs');

const html = fs.readFileSync('finanzas.html', 'utf8');

const virtualConsole = new jsdom.VirtualConsole();
virtualConsole.on('error', (err) => {
    console.log('JSDOM Error: ', err.message);
    if(err.stack) console.log(err.stack);
});
virtualConsole.on('jsdomError', (err) => {
    console.log('JSDOM Internal Error: ', err.message);
    if(err.detail) console.log(err.detail);
});

const dom = new JSDOM(html, { runScripts: "dangerously", virtualConsole });
console.log('Done parsing');
