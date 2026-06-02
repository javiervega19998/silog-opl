const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  await page.goto('https://silog-opl-681dc.web.app/index.html');
  
  await page.fill('#email', 'javier.vega.g1998@gmail.com');
  await page.fill('#password', 'Silog2026!');
  await page.click('button[type="submit"]');

  await page.waitForNavigation();
  
  console.log("Navigated to:", page.url());
  
  await page.waitForTimeout(5000);
  
  const fleetTotal = await page.locator('#fleet-total').textContent().catch(() => 'NOT FOUND');
  console.log("fleet-total:", fleetTotal);

  await browser.close();
})();
