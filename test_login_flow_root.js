const { chromium } = require('playwright');

(async () => {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  page.on('pageerror', exception => {
    console.error("PAGE ERROR (EXCEPTION):", exception);
  });
  
  page.on('console', msg => {
    console.log("PAGE CONSOLE:", msg.type(), msg.text());
  });

  console.log("Navigating to https://silog-opl-681dc.web.app ...");
  await page.goto('https://silog-opl-681dc.web.app');
  
  console.log("Filling login credentials...");
  await page.fill('#login-email', 'javier.vega.g1998@gmail.com');
  await page.fill('#login-pass', 'v2g17773');

  console.log("Clicking 'Iniciar Sesión'...");
  await page.click('#btn-login');

  console.log("Waiting for network idle or error element to show...");
  await page.waitForTimeout(5000);

  const errorVisible = await page.isVisible('#login-error');
  if (errorVisible) {
    const errorText = await page.textContent('#login-error');
    console.log("Error shown in UI:", errorText);
  } else {
    console.log("No visible error shown. Current URL:", page.url());
  }

  await browser.close();
  console.log("Done.");
})();
