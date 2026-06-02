const fs = require('fs');
let js = fs.readFileSync('js/finanzas_script.js', 'utf8');

const oldBackfillStart = '// --- AUTO BACKFILL DE HOJAS DE RUTA ANTIGUAS ---';
const oldBackfillEnd = '// --- FIN AUTO BACKFILL ---';

if (js.includes(oldBackfillStart) && js.includes(oldBackfillEnd)) {
  const prefix = js.substring(0, js.indexOf(oldBackfillStart));
  const suffix = js.substring(js.indexOf(oldBackfillEnd) + oldBackfillEnd.length);
  
  const newBackfill = `// --- AUTO BACKFILL AVANZADO DE HOJAS DE RUTA ---
    try {
      // 1. Identificar turnos que no tienen hoja_ruta
      const existingTurnosInHojas = new Set();
      const hojasACompletar = [];
      hSnap.forEach(d => {
        const hd = d.data();
        if (hd.turno_id) existingTurnosInHojas.add(hd.turno_id);
        
        // Identificar hojas_ruta backfilleadas que necesitan completarse con despachos/gastos
        if (hd.revisado_por === 'backfill_auto' || hd.revisado_por === 'backfill_v2') {
          // Si no tiene clientes_despacho (o similar), la marcamos para completarla
          if (!hd.clientes_despacho || hd.clientes_despacho.length === 0) {
            hojasACompletar.push({ id: d.id, ...hd });
          }
        }
      });
      
      const turnosParaBackfill = [];
      tSnap.forEach(d => {
        if (d.data().estado === 'cerrado' && !existingTurnosInHojas.has(d.id)) {
          turnosParaBackfill.push({ id: d.id, ...d.data() });
        }
      });
      
      if (turnosParaBackfill.length > 0 || hojasACompletar.length > 0) {
        console.log('Realizando backfill avanzado para', turnosParaBackfill.length, 'turnos nuevos y actualizando', hojasACompletar.length, 'hojas existentes...');
        setTimeout(async () => {
          try {
            let currentBatch = db.batch();
            let count = 0;
            
            // A. Crear los que faltan por completo
            for (const t of turnosParaBackfill) {
              const fDate = t.hora_cierre ? t.hora_cierre.toDate() : new Date();
              const fStr = fDate.toISOString().split('T')[0];
              const hId = \`\${fStr}_\${(t.conductor||'').replace(/\\s+/g,'_')}_bf_\${t.id.slice(-4)}\`;
              const hrRef = db.collection('hojas_ruta').doc(hId);
              
              // Buscar despachos y gastos (lento pero necesario una vez)
              const dSnap = await db.collection('despachos').where('turno_id','==',t.id).get();
              const gSnap = await db.collection('gastos_ruta').where('turno_id','==',t.id).get();
              
              let entregas = [];
              let devoluciones = 0;
              let clients = [];
              dSnap.forEach(dd => {
                const dp = dd.data();
                if(dp.estado === 'entregado') { entregas.push(dp); clients.push(dp.nombre_cliente||'Cliente'); }
                if(dp.estado === 'devuelto') devoluciones++;
              });
              
              let comb=0, peaje=0;
              gSnap.forEach(gg => {
                const gd = gg.data();
                if(gd.tipo === 'combustible') comb += (gd.monto_clp||0);
                else peaje += (gd.monto_clp||0);
              });

              currentBatch.set(hrRef, {
                turno_id: t.id,
                conductor_email: t.email || '',
                conductor_nombre: t.conductor || 'Desconocido',
                distribuidor: t.distribuidor || t.nombre_distribuidor || '',
                patente: t.patente || '',
                fecha: fStr,
                hora_inicio: t.hora_apertura || null,
                hora_termino: t.hora_cierre || null,
                km_inicial: t.km_inicial || 0,
                km_final: t.km_final || 0,
                km_recorridos: (t.km_final||0) - (t.km_inicial||0),
                entregas: entregas,
                total_entregas: entregas.length,
                total_devoluciones: devoluciones,
                clientes_despacho: clients,
                combustible: comb,
                monto_combustible: comb,
                peaje: peaje,
                estado: 'revisada',
                revisado_por: 'backfill_v2',
                created_at: firebase.firestore.FieldValue.serverTimestamp()
              });
              
              count++;
              if (count >= 100) { await currentBatch.commit(); currentBatch = db.batch(); count = 0; }
            }
            
            // B. Actualizar los que ya se crearon vacios en el v1
            for (const h of hojasACompletar) {
              const hrRef = db.collection('hojas_ruta').doc(h.id);
              const dSnap = await db.collection('despachos').where('turno_id','==',h.turno_id).get();
              const gSnap = await db.collection('gastos_ruta').where('turno_id','==',h.turno_id).get();
              
              let entregas = [];
              let devoluciones = 0;
              let clients = [];
              dSnap.forEach(dd => {
                const dp = dd.data();
                if(dp.estado === 'entregado') { entregas.push(dp); clients.push(dp.nombre_cliente||'Cliente'); }
                if(dp.estado === 'devuelto') devoluciones++;
              });
              
              let comb=0, peaje=0;
              gSnap.forEach(gg => {
                const gd = gg.data();
                if(gd.tipo === 'combustible') comb += (gd.monto_clp||0);
                else peaje += (gd.monto_clp||0);
              });
              
              currentBatch.update(hrRef, {
                entregas: entregas,
                total_entregas: entregas.length,
                total_devoluciones: devoluciones,
                clientes_despacho: clients,
                combustible: comb,
                monto_combustible: comb,
                peaje: peaje,
                revisado_por: 'backfill_v2'
              });
              
              count++;
              if (count >= 100) { await currentBatch.commit(); currentBatch = db.batch(); count = 0; }
            }
            
            if (count > 0) { await currentBatch.commit(); }
            console.log('Backfill avanzado completado exitosamente.');
          } catch(e) {
            console.warn('Error en backfill automatico avanzado:', e);
          }
        }, 5000);
      }
    } catch(err) {
      console.warn("Fallo al iniciar backfill", err);
    }
    // --- FIN AUTO BACKFILL ---`;
    
  js = prefix + newBackfill + suffix;
  fs.writeFileSync('js/finanzas_script.js', js);
  console.log("Advanced backfill injected successfully.");
} else {
  console.log("Could not find old backfill block.");
}
