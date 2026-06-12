const { chromium } = require('playwright');
const path = require('path');

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

  await page.waitForNavigation();
  console.log("Navigated to:", page.url());
  
  // Wait for db to be initialized
  await page.waitForTimeout(3000);
  
  console.log("Starting backfill logic inside browser context...");
  const result = await page.evaluate(async () => {
    try {
      const db = firebase.firestore();
      
      let migratedFromMovimientos = 0;
      let mermasFound = 0;
      let inventoryUpdated = 0;
      
      const batch = db.batch();
      
      // 1. MIGRAR MOVIMIENTOS HUÉRFANOS DE DESPACHOS BODEGA
      const movSnap = await db.collection('movimientos').get();
      for (const doc of movSnap.docs) {
        const data = doc.data();
        if (data.tipo === 'logistica_inversa' || data.tipo === 'salida') {
          const mRef = db.collection('movimientos_bodega').doc();
          
          let nuevoTipo = 'ingreso';
          let nuevoSubtipo = 'devolucion';
          
          if (data.tipo === 'salida') {
            nuevoTipo = 'salida';
            nuevoSubtipo = 'despacho_ruta';
          } else if (data.clasificacion === 'merma') {
            nuevoTipo = 'merma';
            nuevoSubtipo = 'devolucion_rechazada';
          }
          
          batch.set(mRef, {
            tipo: nuevoTipo,
            subtipo: nuevoSubtipo,
            producto_id: data.productoId || '',
            producto_codigo: data.codigoProducto || '',
            producto_nombre: data.nombreProducto || '',
            cantidad: data.cantidad || 0,
            referencia: data.nDocumento || data.observaciones || 'Migrado de Despachos Bodega',
            operario_uid: data.conductor?.id || '',
            operario_nombre: data.conductor?.nombre || '',
            fecha: data.fecha || firebase.firestore.FieldValue.serverTimestamp(),
            _migrado_backfill: true
          });
          
          batch.delete(db.collection('movimientos').doc(doc.id));
          migratedFromMovimientos++;
        }
      }

      // 2. RECALCULAR MERMAS Y CORREGIR INVENTARIO
      // Obtenemos todos los movimientos_bodega actuales y los que acabamos de poner en el batch no están aquí,
      // pero está bien porque evaluaremos el snapshot actual.
      // Wait, los que acabamos de migrar de `movimientos` no estarán en esta query.
      // Así que los acumularemos manualmente.
      
      const mermasPorProducto = {}; // prodId -> cantidad
      const mermasAntiguas = {}; // prodId -> cantidad (para restar del disponible)

      // A) Las mermas ya existentes en movimientos_bodega
      const mbSnap = await db.collection('movimientos_bodega').where('tipo', '==', 'merma').get();
      mbSnap.forEach(d => {
        const data = d.data();
        if (data.producto_id && data.cantidad) {
          const cant = parseInt(data.cantidad);
          mermasPorProducto[data.producto_id] = (mermasPorProducto[data.producto_id] || 0) + cant;
          
          // Si fue creado ANTES del 10 de junio 2026, significa que sumó al disponible pero no se restó (bug viejo)
          // La fecha de corte aproximada es '2026-06-10T06:00:00Z'
          const cutoff = new Date('2026-06-10T06:00:00Z').getTime();
          let ts = Date.now();
          if (data.fecha && data.fecha.toMillis) ts = data.fecha.toMillis();
          else if (data.fecha instanceof Date) ts = data.fecha.getTime();
          
          if (ts < cutoff) {
            mermasAntiguas[data.producto_id] = (mermasAntiguas[data.producto_id] || 0) + cant;
          }
        }
      });

      // B) Las mermas que acabamos de migrar de `movimientos`
      for (const doc of movSnap.docs) {
        const data = doc.data();
        if (data.tipo === 'logistica_inversa' && data.clasificacion === 'merma') {
          const cant = parseInt(data.cantidad) || 0;
          if (data.productoId && cant > 0) {
            mermasPorProducto[data.productoId] = (mermasPorProducto[data.productoId] || 0) + cant;
            mermasAntiguas[data.productoId] = (mermasAntiguas[data.productoId] || 0) + cant;
          }
        }
      }

      mermasFound = Object.keys(mermasPorProducto).length;

      // 3. APLICAR AL INVENTARIO
      const invSnap = await db.collection('inventory').get();
      invSnap.forEach(doc => {
        const data = doc.data();
        const pId = doc.id;
        
        let disp = parseInt(data.disponible) || parseInt(data.qty) || parseInt(data.cantidad) || 0;
        let noDisp = parseInt(data.no_disponible) || parseInt(data.noDisponible) || 0;
        
        const correctNoDisp = mermasPorProducto[pId] || 0;
        const discountFromDisp = mermasAntiguas[pId] || 0;
        
        // Si hay inconsistencia, corregimos
        if (noDisp !== correctNoDisp || discountFromDisp > 0) {
          // Si detectamos mermas antiguas que estaban inflando el disponible, las restamos
          if (discountFromDisp > 0) {
            disp = Math.max(0, disp - discountFromDisp);
          }
          
          noDisp = correctNoDisp;
          const total = disp + noDisp;
          
          batch.update(db.collection('inventory').doc(pId), {
            disponible: disp,
            no_disponible: noDisp,
            qty: total,
            cantidad: total,
            total: total
          });
          inventoryUpdated++;
        }
      });
      
      if (migratedFromMovimientos > 0 || inventoryUpdated > 0) {
        await batch.commit();
      }

      return { migratedFromMovimientos, mermasFound, inventoryUpdated };
    } catch(err) {
      return { error: err.message, stack: err.stack };
    }
  });

  console.log("Backfill result:", result);
  await browser.close();
})();
