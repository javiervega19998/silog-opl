const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  console.log('1. Launching browser...');
  const browser = await chromium.launch();
  const page = await browser.newPage();

  console.log('2. Navigating to login...');
  await page.goto('https://silog-opl-681dc.web.app/index.html');
  await page.fill('#login-email', 'javier.vega.g1998@gmail.com');
  await page.fill('#login-pass', 'Silog2026!');
  await page.click('#btn-login');

  console.log('3. Waiting for login to complete...');
  await page.waitForTimeout(10000); // 10 seconds should be enough for Firebase Auth + redirect
  await page.waitForTimeout(3000);

  console.log('4. Extracting database via injected script...');
  const data = await page.evaluate(async () => {
    
    function parseDoc(d) {
      const data = d.data();
      const res = { id: d.id };
      for (const key of Object.keys(data)) {
        const val = data[key];
        if (val && typeof val.toMillis === 'function') {
           res[key] = val.toMillis();
        } else {
           res[key] = val;
        }
      }
      return res;
    }

    const invSnap = await db.collection('inventory').get();
    const inventory = [];
    invSnap.forEach(d => inventory.push(parseDoc(d)));

    const movSnap = await db.collection('movimientos_bodega').get();
    const movimientos_bodega = [];
    movSnap.forEach(d => movimientos_bodega.push(parseDoc(d)));

    const movOldSnap = await db.collection('movimientos').get();
    const movimientos_old = [];
    movOldSnap.forEach(d => movimientos_old.push(parseDoc(d)));

    return { inventory, movimientos_bodega, movimientos_old };
  });

  console.log(`Extracted: ${data.inventory.length} inventory, ${data.movimientos_bodega.length} movimientos_bodega, ${data.movimientos_old.length} movimientos_old`);
  
  fs.writeFileSync('db_dump.json', JSON.stringify(data, null, 2));
  console.log('Dump saved to db_dump.json');

  await browser.close();
})();
