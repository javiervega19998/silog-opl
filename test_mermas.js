const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('LOG:', msg.text()));
  await page.goto('https://silog-opl-681dc.web.app/admin_check.html');
  await page.click('button');
  await page.waitForTimeout(3000);
  await browser.close();
})();
