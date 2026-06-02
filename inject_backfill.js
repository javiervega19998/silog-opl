const fs = require('fs');

let js = fs.readFileSync('js/finanzas_script.js', 'utf8');

const targetLine = `hojas.push({id:d.id, ...h, _fecha:fecha, _tipo:'hoja_ruta'});
    });`;

const newCode = `hojas.push({id:d.id, ...h, _fecha:fecha, _tipo:'hoja_ruta'});
    });

    // --- AUTO BACKFILL DE HOJAS DE RUTA ANTIGUAS ---
    // Detecta si hay turnos cerrados que no tienen su "fotografia" en hojas_ruta y las crea en background
    try {
      const existingTurnosInHojas = new Set();
      hSnap.forEach(d => {
        const hd = d.data();
        if (hd.turno_id) existingTurnosInHojas.add(hd.turno_id);
      });
      
      const turnosParaBackfill = [];
      tSnap.forEach(d => {
        if (d.data().estado === 'cerrado' && !existingTurnosInHojas.has(d.id)) {
          turnosParaBackfill.push({ id: d.id, ...d.data() });
        }
      });
      
      if (turnosParaBackfill.length > 0) {
        console.log('Realizando backfill de hojas_ruta para', turnosParaBackfill.length, 'turnos antiguos...');
        setTimeout(async () => {
          try {
            let currentBatch = db.batch();
            let count = 0;
            let total = 0;
            
            for (const t of turnosParaBackfill) {
              const fDate = t.hora_cierre ? t.hora_cierre.toDate() : new Date();
              const fStr = fDate.toISOString().split('T')[0];
              const hId = \`\${fStr}_\${(t.conductor||'').replace(/\\s+/g,'_')}_bf_\${t.id.slice(-4)}\`;
              const hrRef = db.collection('hojas_ruta').doc(hId);
              
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
                estado: 'revisada',
                revisado_por: 'backfill_auto',
                created_at: firebase.firestore.FieldValue.serverTimestamp()
              });
              
              count++;
              total++;
              if (count >= 400) {
                await currentBatch.commit();
                currentBatch = db.batch();
                count = 0;
              }
            }
            if (count > 0) {
              await currentBatch.commit();
            }
            console.log('Backfill completado exitosamente. Turnos procesados:', total);
          } catch(e) {
            console.warn('Error en backfill automático:', e);
          }
        }, 5000);
      }
    } catch(err) {
      console.warn("Fallo al iniciar backfill", err);
    }
    // --- FIN AUTO BACKFILL ---`;

if (js.includes(targetLine)) {
  js = js.replace(targetLine, newCode);
  fs.writeFileSync('js/finanzas_script.js', js);
  console.log("finanzas_script.js updated successfully with backfill logic.");
} else {
  console.log("Could not find target line in finanzas_script.js");
}
