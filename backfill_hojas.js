const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}
const db = admin.firestore();

async function backfillHojasRuta() {
  console.log("Starting backfill of hojas_ruta from old turnos...");
  try {
    const turnosSnap = await db.collection('turnos').where('estado', '==', 'cerrado').get();
    let created = 0;
    
    for (const doc of turnosSnap.docs) {
      const t = doc.data();
      const turnoId = doc.id;
      
      // Check if a hoja_ruta already exists for this turno
      const hrSnap = await db.collection('hojas_ruta').where('turno_id', '==', turnoId).get();
      if (!hrSnap.empty) {
        continue; // Already exists
      }
      
      // Calculate data from related collections if needed (like despachos, gastos)
      // Actually, t already has km_inicial, km_final, patente, conductor, etc.
      // We need to fetch gastos to get combustible and peaje
      const gastosSnap = await db.collection('gastos_ruta').where('turno_id', '==', turnoId).get();
      let combustible = 0;
      let peaje = 0;
      gastosSnap.forEach(g => {
        const gd = g.data();
        if (gd.tipo === 'combustible') combustible += (gd.monto_clp || gd.monto || 0);
        if (gd.tipo === 'peaje') peaje += (gd.monto_clp || gd.monto || 0);
      });
      
      const despSnap = await db.collection('despachos').where('turno_id', '==', turnoId).get();
      let entregas = [];
      let devoluciones = 0;
      despSnap.forEach(d => {
        const dp = d.data();
        if (dp.estado === 'entregado') entregas.push(dp);
        if (dp.estado === 'devuelto') devoluciones++;
      });
      
      // We don't have fecha easily if it's not in t. Let's use hora_cierre.
      let fechaObj = t.hora_cierre ? t.hora_cierre.toDate() : (t.fecha_apertura ? new Date(t.fecha_apertura) : new Date());
      let fechaStr = fechaObj.toISOString().split('T')[0];
      
      const hojaId = `${fechaStr}_${(t.conductor || 'conductor').replace(/\\s+/g,'_')}_backfill`;
      
      await db.collection('hojas_ruta').doc(hojaId).set({
        turno_id: turnoId,
        conductor_uid: t.uid || '',
        conductor_email: t.email || '',
        conductor_nombre: t.conductor || 'Desconocido',
        distribuidor: t.distribuidor || t.nombre_distribuidor || '',
        patente: t.patente || '',
        fecha: fechaStr,
        hora_inicio: t.hora_apertura || null,
        hora_termino: t.hora_cierre || null,
        km_inicial: t.km_inicial || 0,
        km_final: t.km_final || 0,
        km_recorridos: (t.km_final || 0) - (t.km_inicial || 0),
        entregas: entregas,
        total_entregas: entregas.length,
        total_devoluciones: devoluciones,
        combustible: combustible,
        peaje: peaje,
        n_guias: '',
        estado: 'revisada', // automatically checked since it's old
        revisado_por: 'backfill',
        created_at: t.hora_cierre || admin.firestore.FieldValue.serverTimestamp()
      });
      
      created++;
      console.log(`Created backfill hoja_ruta for turno ${turnoId}`);
    }
    
    console.log(`Backfill complete. Created ${created} missing hojas_ruta.`);
  } catch (err) {
    console.error("Error during backfill:", err);
  }
}

backfillHojasRuta();
