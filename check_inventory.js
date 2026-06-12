const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', err => console.error('PAGE ERROR:', err.message));

  console.log("Navigating to index...");
  await page.goto('https://silog-opl-681dc.web.app/index.html');
  
  await page.fill('#login-email', 'javier.vega.g1998@gmail.com');
  await page.fill('#login-pass', 'Silog2026!');
  await page.evaluate(() => doLogin());

  await page.waitForTimeout(5000);
  
  await page.waitForTimeout(3000);
  
  const result = await page.evaluate(async () => {
    try {
      const db = firebase.firestore();
      const movSnap = await db.collection('movimientos_bodega').limit(5).get();
      let docs = [];
      movSnap.forEach(doc => {
        docs.push({ id: doc.id, data: doc.data() });
      });
      return docs;
    } catch(err) {
      return { error: err.message };
    }
  });

  console.log("Inventory Sample:", JSON.stringify(result.slice(0, 3), null, 2));
  require('fs').writeFileSync('inventory_dump.json', JSON.stringify(result, null, 2));
  console.log("Dumped to inventory_dump.json");
  
  await browser.close();
})();
