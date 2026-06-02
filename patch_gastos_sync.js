const fs = require('fs');
let html = fs.readFileSync('viajes.html', 'utf8');

const injection = `
        // 3) Sincronizar Gastos Operacionales (Combustible y Peaje)
        const gSnap = await db.collection('gastos_ruta').where('turno_id', '==', turnoId).get();
        const gDocs = [];
        gSnap.forEach(doc => gDocs.push({ id: doc.id, ref: doc.ref, ...doc.data() }));
        
        let foundComb = false;
        let foundPeaje = false;
        
        for (let i = 0; i < gDocs.length; i++) {
          const gd = gDocs[i];
          if (gd.tipo === 'combustible') {
            if (!foundComb && combustible > 0) {
               batch.update(gd.ref, { monto: combustible, monto_clp: combustible, litros: litrosCombustible });
               foundComb = true;
            } else {
               batch.delete(gd.ref);
            }
          } else if (gd.tipo === 'peaje') {
            if (!foundPeaje && peaje > 0) {
               batch.update(gd.ref, { monto: peaje, monto_clp: peaje });
               foundPeaje = true;
            } else {
               batch.delete(gd.ref);
            }
          }
        }
        
        if (!foundComb && combustible > 0) {
          const newG = db.collection('gastos_ruta').doc();
          batch.set(newG, {
            turno_id: turnoId,
            tipo: 'combustible',
            monto: combustible,
            monto_clp: combustible,
            litros: litrosCombustible,
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            created_at: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        if (!foundPeaje && peaje > 0) {
          const newG = db.collection('gastos_ruta').doc();
          batch.set(newG, {
            turno_id: turnoId,
            tipo: 'peaje',
            monto: peaje,
            monto_clp: peaje,
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            created_at: firebase.firestore.FieldValue.serverTimestamp()
          });
        }

        await batch.commit();
        console.log('Sincronización de despachos y gastos completada con éxito.');`;

html = html.replace(/await batch\.commit\(\);\s*console\.log\('Sincronización de despachos completada con éxito\.'\);/g, injection);

fs.writeFileSync('viajes.html', html);
console.log("viajes.html patched with gastos sync logic successfully.");
