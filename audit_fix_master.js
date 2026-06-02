/**
 * SILOG - Master Audit Fix Script
 * Fixes the following bugs in finanzas_script.js:
 * 1. litros_combustible not saved in batch.update(hrRef) in guardarHoja()
 * 2. populateExpensesForHojasRuta overwrites manually edited values (trust hojas_ruta first)
 * 3. Multiple gastos_ruta docs for same turno/type not consolidated properly
 * 4. hojas_ruta not refreshed from DB after guardarHoja (stale cache)
 */
const fs = require('fs');

let js = fs.readFileSync('js/finanzas_script.js', 'utf8');

// ────────────────────────────────────────────────────────────────────────────
// FIX 1: Add litros_combustible to batch.update(hrRef) in guardarHoja()
// ────────────────────────────────────────────────────────────────────────────
const fix1_target = `    batch.update(hrRef, {
      entregas,
      n_guias: totalGuias,
      total_entregas: entregas.length,
      total_devoluciones: devueltasCount,
      combustible: combustibleEditado,
      monto_combustible: combustibleEditado,
      peaje: peajeEditado,
      estado: document.getElementById('hoja-estado').value,
      revisado_por: _email,
      revisado_at: firebase.firestore.FieldValue.serverTimestamp()
    });`;

const fix1_replacement = `    batch.update(hrRef, {
      entregas,
      n_guias: totalGuias,
      total_entregas: entregas.length,
      total_devoluciones: devueltasCount,
      combustible: combustibleEditado,
      monto_combustible: combustibleEditado,
      litros_combustible: litrosEditado,
      peaje: peajeEditado,
      estado: document.getElementById('hoja-estado').value,
      revisado_por: _email,
      revisado_at: firebase.firestore.FieldValue.serverTimestamp()
    });`;

if (js.includes(fix1_target)) {
  js = js.replace(fix1_target, fix1_replacement);
  console.log('✅ FIX 1: litros_combustible added to batch.update(hrRef)');
} else {
  console.log('❌ FIX 1: Target not found');
}

// ────────────────────────────────────────────────────────────────────────────
// FIX 2: populateExpensesForHojasRuta — trust hojas_ruta values when available
// Replace so it only overrides if the hojas_ruta value is 0/missing
// ────────────────────────────────────────────────────────────────────────────
const fix2_target = `  hojas.forEach(h => {
    if (h.turno_id && gastosByTurno[h.turno_id]) {
      h.combustible = gastosByTurno[h.turno_id].combustible;
      h.peaje = gastosByTurno[h.turno_id].peaje;
    } else {
      h.combustible = h.combustible || 0;
      h.peaje = h.peaje || 0;
    }
  });`;

const fix2_replacement = `  hojas.forEach(h => {
    // If the hoja already has admin-edited values (non-zero), trust them.
    // Only fall back to gastos_ruta sum when the hoja has no values (new/unedited).
    const hasEditedCombustible = (h.combustible || 0) > 0;
    const hasEditedPeaje = (h.peaje || 0) > 0;
    if (h.turno_id && gastosByTurno[h.turno_id]) {
      if (!hasEditedCombustible) h.combustible = gastosByTurno[h.turno_id].combustible;
      if (!hasEditedPeaje) h.peaje = gastosByTurno[h.turno_id].peaje;
    } else {
      h.combustible = h.combustible || 0;
      h.peaje = h.peaje || 0;
    }
  });`;

if (js.includes(fix2_target)) {
  js = js.replace(fix2_target, fix2_replacement);
  console.log('✅ FIX 2: populateExpensesForHojasRuta now trusts admin-edited values');
} else {
  console.log('❌ FIX 2: Target not found');
}

// ────────────────────────────────────────────────────────────────────────────
// FIX 3: Consolidate multiple gastos_ruta documents for same type on save
// When multiple combustible or peaje docs exist for a turno, update the first
// and delete the rest to avoid double-counting
// ────────────────────────────────────────────────────────────────────────────
const fix3_target = `    // Sync con Gastos en Ruta para el Centro de Costos
    if(_hojaActual && _hojaActual.turno_id) {
      const gSnap = await db.collection('gastos_ruta').where('turno_id', '==', _hojaActual.turno_id).get();
      let combustibleDoc = null;
      let peajeDoc = null;
      gSnap.forEach(d => {
        if(d.data().tipo === 'combustible') combustibleDoc = d;
        if(d.data().tipo === 'peaje') peajeDoc = d;
      });
      
      if(combustibleEditado > 0) {
        if(combustibleDoc) batch.update(combustibleDoc.ref, { monto_clp: combustibleEditado, monto: combustibleEditado, litros: litrosEditado });
        else {
          const newG = db.collection('gastos_ruta').doc();
          batch.set(newG, {
            turno_id: _hojaActual.turno_id,
            conductor_uid: _hojaActual.conductor_uid || '',
            tipo: 'combustible',
            monto_clp: combustibleEditado,
            monto: combustibleEditado,
            fecha: _hojaActual.created_at || firebase.firestore.FieldValue.serverTimestamp(),
            created_at: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } else if (combustibleDoc) {
         batch.update(combustibleDoc.ref, { monto_clp: 0, monto: 0 });
      }
      
      if(peajeEditado > 0) {
        if(peajeDoc) batch.update(peajeDoc.ref, { monto_clp: peajeEditado, monto: peajeEditado });
        else {
          const newG = db.collection('gastos_ruta').doc();
          batch.set(newG, {
            turno_id: _hojaActual.turno_id,
            conductor_uid: _hojaActual.conductor_uid || '',
            tipo: 'peaje',
            monto_clp: peajeEditado,
            monto: peajeEditado,
            fecha: _hojaActual.created_at || firebase.firestore.FieldValue.serverTimestamp(),
            created_at: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      } else if (peajeDoc) {
         batch.update(peajeDoc.ref, { monto_clp: 0, monto: 0 });
      }
    }`;

const fix3_replacement = `    // Sync con Gastos en Ruta para el Centro de Costos
    // Consolidates multiple docs of same type into a single authoritative record
    if(_hojaActual && _hojaActual.turno_id) {
      const gSnap = await db.collection('gastos_ruta').where('turno_id', '==', _hojaActual.turno_id).get();
      const combustibleDocs = [];
      const peajeDocs = [];
      gSnap.forEach(d => {
        if(d.data().tipo === 'combustible') combustibleDocs.push(d);
        else if(d.data().tipo === 'peaje') peajeDocs.push(d);
      });
      
      // Handle combustible: update first doc, delete extras
      if(combustibleEditado >= 0) {
        if(combustibleDocs.length > 0) {
          batch.update(combustibleDocs[0].ref, { monto_clp: combustibleEditado, monto: combustibleEditado, litros: litrosEditado });
          // Delete duplicates
          for(let i = 1; i < combustibleDocs.length; i++) {
            batch.delete(combustibleDocs[i].ref);
          }
        } else if(combustibleEditado > 0) {
          const newG = db.collection('gastos_ruta').doc();
          batch.set(newG, {
            turno_id: _hojaActual.turno_id,
            conductor_uid: _hojaActual.conductor_uid || '',
            conductor_email: _hojaActual.conductor_email || '',
            patente: _hojaActual.patente || '',
            tipo: 'combustible',
            monto_clp: combustibleEditado,
            monto: combustibleEditado,
            litros: litrosEditado,
            fecha: _hojaActual.created_at || firebase.firestore.FieldValue.serverTimestamp(),
            created_at: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }
      
      // Handle peaje: update first doc with total, delete extras
      if(peajeEditado >= 0) {
        if(peajeDocs.length > 0) {
          batch.update(peajeDocs[0].ref, { monto_clp: peajeEditado, monto: peajeEditado });
          // Delete duplicates
          for(let i = 1; i < peajeDocs.length; i++) {
            batch.delete(peajeDocs[i].ref);
          }
        } else if(peajeEditado > 0) {
          const newG = db.collection('gastos_ruta').doc();
          batch.set(newG, {
            turno_id: _hojaActual.turno_id,
            conductor_uid: _hojaActual.conductor_uid || '',
            conductor_email: _hojaActual.conductor_email || '',
            patente: _hojaActual.patente || '',
            tipo: 'peaje',
            monto_clp: peajeEditado,
            monto: peajeEditado,
            fecha: _hojaActual.created_at || firebase.firestore.FieldValue.serverTimestamp(),
            created_at: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
      }
    }`;

if (js.includes(fix3_target)) {
  js = js.replace(fix3_target, fix3_replacement);
  console.log('✅ FIX 3: gastos_ruta sync now consolidates duplicates');
} else {
  console.log('❌ FIX 3: Target not found');
}

// ────────────────────────────────────────────────────────────────────────────
// FIX 4: After guardarHoja() batch.commit(), reload hoja from DB to update cache
// so populateExpensesForHojasRuta doesn't overwrite fresh values on next render
// ────────────────────────────────────────────────────────────────────────────
const fix4_target = `    await batch.commit();
    showToast('💵 Hoja de ruta actualizada','success');
    closeHojaModal();
    loadHojasRuta();`;

const fix4_replacement = `    await batch.commit();
    showToast('💵 Hoja de ruta actualizada','success');
    closeHojaModal();
    // Update local cache immediately so re-render shows correct values
    const updatedIdx = _hojasRuta.findIndex(h => h.id === id);
    if(updatedIdx >= 0) {
      _hojasRuta[updatedIdx].combustible = combustibleEditado;
      _hojasRuta[updatedIdx].peaje = peajeEditado;
      _hojasRuta[updatedIdx].litros_combustible = litrosEditado;
      _hojasRuta[updatedIdx].total_entregas = entregas.length;
      _hojasRuta[updatedIdx].total_devoluciones = devueltasCount;
      _hojasRuta[updatedIdx].entregas = entregas;
      _hojasRuta[updatedIdx].estado = document.getElementById('hoja-estado') ? document.getElementById('hoja-estado').value : _hojasRuta[updatedIdx].estado;
    }
    loadHojasRuta();`;

if (js.includes(fix4_target)) {
  js = js.replace(fix4_target, fix4_replacement);
  console.log('✅ FIX 4: Local cache updated immediately after guardarHoja()');
} else {
  console.log('❌ FIX 4: Target not found');
}

fs.writeFileSync('js/finanzas_script.js', js);
console.log('\nAll fixes applied to js/finanzas_script.js');
