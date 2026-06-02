const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('pageerror', err => {
    console.log('PAGE ERROR:', err.message);
    console.log(err.stack);
  });
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('CONSOLE ERROR:', msg.text());
    }
  });

  const url = 'file://' + path.resolve('scratch/silog-ops/finanzas.html').replace(/\\/g, '/');
  console.log('Navigating to', url);
  await page.goto(url);
  
  await browser.close();
})();
