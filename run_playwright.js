const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', exception => {
    console.log(Uncaught exception: "");
  });
  page.on('console', msg => {
    console.log(Console : );
  });
  await page.goto('file://' + path.resolve('scratch/silog-ops/finanzas.html').replace(/\\/g, '/'));
  await browser.close();
})();
