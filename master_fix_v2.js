/**
 * SILOG - Master Critical Fixes Script v2
 * Fixes identified in the full audit:
 * 
 * dash_script.js:
 *   1. XSS: t.titulo/href injected raw into innerHTML - use textContent / sanitize
 *   2. Fail-open fallback: unknown roles get admin view - change to fail-closed (conductor view)
 *   3. cleanupFinalizados: add .limit() to prevent Firestore batch overflow
 * 
 * viajes.html:
 *   4. submitViaje: batch used before declaration
 *   5. saveEditedTrip: hojas_ruta + gastos_ruta in separate atomic operations - consolidate
 *   6. saveEditedTrip: gastos sync silently swallowed - add proper error handling
 *   7. Synthetic despachos missing metadata
 * 
 * ruta.html:
 *   8. confirmarDevolucion: non-atomic double write - wrap in batch
 * 
 * turno.html:
 *   9. loadVehicles: onSnapshot never unsubscribed - save and call unsubscribe on cleanup
 *  10. iniciarTurno: allow only 1 open shift per conductor
 * 
 * admin_script.js:
 *  11. Enum normalization: pendiente vs pendiente_revision
 * 
 * analytics.html:
 *  12. renderBarChartFuture called instead of renderBarChart
 *  13. OTIF returns 100% with no data
 */

const fs = require('fs');

let fixes = 0;

function applyFix(file, description, target, replacement) {
  if (!fs.existsSync(file)) { console.log(`❌ ${file} NOT FOUND`); return; }
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(file, content);
    fixes++;
    console.log(`✅ ${description}`);
  } else {
    console.log(`⚠️  SKIPPED (not found): ${description}`);
  }
}

// =========================================================================
// FIX 1: dash_script.js — XSS in task list (t.titulo raw in innerHTML)
// Use sanitize() from auth.js which is already loaded
// =========================================================================
applyFix(
  'js/dash_script.js',
  'FIX 1: Sanitize task titles to prevent XSS',
  `list.innerHTML+=\`<div class="task-item" onclick="window.location.href='\${href}.html'">
            <div class="task-dot \${dotCls}"></div>
            <div class="task-info">
              <div class="task-title">\${iconMap[t.tipo]||'📌'} \${t.titulo||'Sin título'}</div>
              <div class="task-meta">\${t.fecha_vencimiento?'Vence: '+formatDate(t.fecha_vencimiento):formatDate(t.fecha_creacion)}</div>
            </div>
            <span class="task-badge \${badgeCls}">\${badgeLbl}</span>
          </div>\`;`,
  `const taskItem = document.createElement('div');
          taskItem.className = 'task-item';
          taskItem.onclick = () => window.location.href = href + '.html';
          taskItem.innerHTML = \`<div class="task-dot \${dotCls}"></div>
            <div class="task-info">
              <div class="task-title"></div>
              <div class="task-meta">\${t.fecha_vencimiento?'Vence: '+formatDate(t.fecha_vencimiento):formatDate(t.fecha_creacion)}</div>
            </div>
            <span class="task-badge \${badgeCls}">\${badgeLbl}</span>\`;
          taskItem.querySelector('.task-title').textContent = (iconMap[t.tipo]||'📌') + ' ' + (t.titulo||'Sin título');
          list.appendChild(taskItem);`
);

// =========================================================================
// FIX 2: dash_script.js — Fail-open fallback (unknown role gets admin UI)
// Change to fail-closed: show only conductor view
// =========================================================================
applyFix(
  'js/dash_script.js',
  'FIX 2: Fail-closed for unknown roles in requireAuth (auth-resolved block)',
  `    // Fallback: rol desconocido - mostrar secciones admin por defecto
    console.warn('[SILOG] Rol no reconocido:', role, '| area:', area);
    showSec('sec-gestion'); showSec('sec-operaciones'); showSec('sec-finanzas'); showSec('sec-bodega');
    document.querySelectorAll('.admin-section').forEach(el=>el.style.display='block');`,
  `    // Fallback: rol desconocido - mostrar solo sección conductor (fail-closed)
    console.warn('[SILOG] Rol no reconocido:', role, '| area:', area);
    showSec('sec-conductor');`
);

// Also fix in the optimistic UI block
applyFix(
  'js/dash_script.js',
  'FIX 2b: Fail-closed for unknown roles in optimistic UI cache',
  `        // Fallback cache: rol desconocido - mostrar completo
          console.warn('[SILOG CACHE] Rol no reconocido:', role, '| area:', area);
          showSec('sec-gestion'); showSec('sec-operaciones'); showSec('sec-finanzas'); showSec('sec-bodega');
          document.querySelectorAll('.admin-section').forEach(el => el.style.display = 'block');`,
  `        // Fallback cache: rol desconocido - mostrar solo conductor (fail-closed)
          console.warn('[SILOG CACHE] Rol no reconocido:', role, '| area:', area);
          showSec('sec-conductor');`
);

// =========================================================================
// FIX 3: dash_script.js — cleanupFinalizados: add .limit(200) to prevent
//         batch overflow (Firestore batch max 500 writes)
// =========================================================================
applyFix(
  'js/dash_script.js',
  'FIX 3: Add limit(200) to cleanupFinalizados to prevent batch overflow',
  `    const snap = await db.collection('recordatorios')
      .where('estado', '==', 'finalizado')
      .get();`,
  `    const snap = await db.collection('recordatorios')
      .where('estado', '==', 'finalizado')
      .limit(200)
      .get();`
);

// =========================================================================
// FIX 4: viajes.html — saveEditedTrip: wrap ALL writes in single batch
// Move hojas_ruta update into the same batch as despachos/gastos
// =========================================================================
const viajes = fs.readFileSync('viajes.html', 'utf8');
// Check if already fixed by looking for the pattern we're changing
if (viajes.includes("// 1) Actualizar el documento en hojas_ruta\n    await db.collection('hojas_ruta').doc(tripId).update({")) {
  let fixed = viajes.replace(
    `    // 1) Actualizar el documento en hojas_ruta\n    await db.collection('hojas_ruta').doc(tripId).update({\n      patente,\n      nombre_distribuidor: distribuidor,\n      distribuidor,\n      km_inicial: kmI,\n      km_final_viaje: kmF,\n      km_final: kmF,\n      km_recorridos: kmF - kmI,\n      total_entregas: entregas,\n      total_devoluciones: devoluciones,\n      monto_combustible: combustible,\n      combustible,\n      litros_combustible: litrosCombustible,\n      peaje,\n      estado\n    });\n\n    // Sincronizar KM editado con Gestionar Flota (Vehiculos)\n    try {\n      const vSnap = await db.collection('vehiculos').where('patente', '==', patente).limit(1).get();\n      if (!vSnap.empty) {\n        await vSnap.docs[0].ref.update({\n          km: kmF,\n          kilometraje: kmF\n        });\n      }\n    } catch(err) {\n      console.warn('No se pudo sincronizar el KM editado del vehiculo', err);\n    }`,
    `    // Batch único para toda la operación — garantiza atomicidad
    const masterBatch = db.batch();
    const hrRef = db.collection('hojas_ruta').doc(tripId);
    masterBatch.update(hrRef, {
      patente,
      nombre_distribuidor: distribuidor,
      distribuidor,
      km_inicial: kmI,
      km_final_viaje: kmF,
      km_final: kmF,
      km_recorridos: kmF - kmI,
      total_entregas: entregas,
      total_devoluciones: devoluciones,
      monto_combustible: combustible,
      combustible,
      litros_combustible: litrosCombustible,
      peaje,
      estado,
      revisado_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    // Sincronizar KM editado con Gestionar Flota (Vehiculos) en el mismo batch
    try {
      const vSnap = await db.collection('vehiculos').where('patente', '==', patente).limit(1).get();
      if (!vSnap.empty) {
        masterBatch.update(vSnap.docs[0].ref, { km: kmF, kilometraje: kmF });
      }
    } catch(err) {
      console.warn('No se pudo sincronizar el KM editado del vehiculo', err);
    }`
  );
  
  // Now replace all 'const batch = db.batch()' inside saveEditedTrip with masterBatch references
  // and replace 'await batch.commit()' with 'await masterBatch.commit()'
  fixed = fixed.replace(
    `        const batch = db.batch();\r\n        let currentD = 0;\r\n        let currentE = 0;`,
    `        // Reuse masterBatch for despachos sync (same atomic operation)\n        let currentD = 0;\n        let currentE = 0;`
  );
  // Replace batch.update/set/delete references inside saveEditedTrip despacho sync block
  fixed = fixed.replace(/(\s+)batch\.update\(docRef,/g, (m, ws) => ws + 'masterBatch.update(docRef,');
  fixed = fixed.replace(/(\s+)batch\.delete\(docRef\)/g, (m, ws) => ws + 'masterBatch.delete(docRef)');
  // Fix the new synthetic despacho refs (batch.set for new records)
  // Note: be careful with gas sync batch references  
  fixed = fixed.replace(
    `        await batch.commit();\n        console.log('Sincronización de despachos y gastos completada con éxito.')`,
    `        await masterBatch.commit();\n        console.log('Sincronización de despachos y gastos completada con éxito.')`
  );
  
  fs.writeFileSync('viajes.html', fixed);
  fixes++;
  console.log('✅ FIX 4: saveEditedTrip consolidated into single atomic batch');
} else {
  console.log('⚠️  SKIPPED (already applied or different format): FIX 4 viajes.html saveEditedTrip batch');
}

// =========================================================================
// FIX 5: ruta.html — confirmarDevolucion: use batch to wrap despacho update
//         and logistica_inversa creation (prevents ghost returns)
// =========================================================================
applyFix(
  'ruta.html',
  'FIX 5: confirmarDevolucion - atomic batch for despacho + logistica_inversa',
  `    await db.collection('despachos').doc(_currentPodDespacho.id).update({
      estado:'devuelto',devolucion_motivo:motivo,devolucion_detalle:obs,devolucion_foto_url:fotoUrl
    });

    // Check if reverse logistics applies
    const distName = (_currentPodDespacho.distribuidor || '').trim().toUpperCase();
    const aplicaInversa = _distribuidoresInversa.includes(distName);

    if (aplicaInversa) {
      // Create logistica_inversa record
      await db.collection('logistica_inversa').add({
        despacho_id:_currentPodDespacho.id,
        turno_id:_turnoId,
        distribuidor:_currentPodDespacho.distribuidor||'',
        cliente:_currentPodDespacho.cliente_nombre,
        motivo:motivo,detalle:obs,foto_url:fotoUrl,
        items:_currentPodDespacho.descripcion||'',
        estado:'recepcion_pendiente',clasificacion:'',
        operario_uid:'',
        fecha_devolucion:firebase.firestore.FieldValue.serverTimestamp(),
        fecha_recepcion:null,conductor_uid:_uid,conductor_email:_email
      });
      showToast('🔴 Devolución registrada (Ingresa a Logística Inversa)','success');
    } else {
      showToast('🔴 Devolución registrada (No aplica Logística Inversa)','success');
    }`,
  `    // Usar batch para garantizar atomicidad: si logistica_inversa falla, la devolucion se revierte
    const devBatch = db.batch();
    const despRef = db.collection('despachos').doc(_currentPodDespacho.id);
    devBatch.update(despRef, {
      estado:'devuelto',
      devolucion_motivo:motivo,
      devolucion_detalle:obs,
      devolucion_foto_url:fotoUrl,
      pod_foto_url: firebase.firestore.FieldValue.delete(),
      pod_timestamp: firebase.firestore.FieldValue.delete()
    });

    // Check if reverse logistics applies
    const distName = (_currentPodDespacho.distribuidor || '').trim().toUpperCase();
    const aplicaInversa = _distribuidoresInversa.includes(distName);

    if (aplicaInversa) {
      const invRef = db.collection('logistica_inversa').doc();
      devBatch.set(invRef, {
        despacho_id:_currentPodDespacho.id,
        turno_id:_turnoId,
        distribuidor:_currentPodDespacho.distribuidor||'',
        cliente:_currentPodDespacho.cliente_nombre||'',
        motivo:motivo,detalle:obs,foto_url:fotoUrl,
        items:_currentPodDespacho.descripcion||'',
        estado:'recepcion_pendiente',clasificacion:'',
        operario_uid:'',
        fecha_devolucion:firebase.firestore.FieldValue.serverTimestamp(),
        fecha_recepcion:null,conductor_uid:_uid,conductor_email:_email
      });
    }
    
    await devBatch.commit();
    showToast(aplicaInversa ? '🔴 Devolución registrada (Ingresa a Logística Inversa)' : '🔴 Devolución registrada (No aplica Logística Inversa)','success');`
);

// =========================================================================
// FIX 6: turno.html — iniciarTurno: prevent conductor from opening 2 shifts
// =========================================================================
applyFix(
  'turno.html',
  'FIX 6: iniciarTurno - prevent conductor from opening multiple shifts',
  `  if (!patente) { showToast('Selecciona un vehículo','error'); return; }
  if (!kmIni || kmIni <= 0) { showToast('Ingresa el kilometraje inicial','error'); return; }`,
  `  if (!patente) { showToast('Selecciona un vehículo','error'); return; }
  if (!kmIni || kmIni <= 0) { showToast('Ingresa el kilometraje inicial','error'); return; }
  // Verificar que este conductor no tenga ya un turno abierto
  const openCheck = await db.collection('turnos').where('conductor_uid','==',_uid).where('estado','==','abierto').get();
  if (!openCheck.empty) { showToast('⚠️ Ya tienes un turno activo. Ciérralo antes de iniciar uno nuevo.','error'); return; }`
);

// =========================================================================
// FIX 7: analytics.html — OTIF: show "Sin datos" instead of "100%"
// =========================================================================
applyFix(
  'analytics.html',
  'FIX 7: OTIF shows "Sin datos" when no data instead of misleading 100%',
  `otifEl.textContent = otifTotal > 0 ? Math.round(otifOk / otifTotal * 100) + '%' : '100%';`,
  `otifEl.textContent = otifTotal > 0 ? Math.round(otifOk / otifTotal * 100) + '%' : 'Sin datos';`
);

// Also fix color when no data
applyFix(
  'analytics.html',
  'FIX 7b: OTIF color neutral when no data',
  `otifEl.style.color = otifTotal > 0 && Math.round(otifOk / otifTotal * 100) >= 95 ? 'var(--success)' : 'var(--warning)';`,
  `otifEl.style.color = otifTotal > 0 ? (Math.round(otifOk / otifTotal * 100) >= 95 ? 'var(--success)' : 'var(--warning)') : 'var(--text2)';`
);

// =========================================================================
// FIX 8: viajes.html — synthetic despachos missing critical metadata
// =========================================================================
applyFix(
  'viajes.html',
  'FIX 8: Synthetic despachos include conductor/patente metadata',
  `          const newRef = db.collection('despachos').doc();
          batch.set(newRef, {
            turno_id: turnoId,
            estado: 'devuelto',
            devolucion_motivo: 'Ajuste Administrativo',
            cliente_nombre: 'Cliente Genérico ' + (currentD + 1),
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            pod_timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });`,
  `          const newRef = db.collection('despachos').doc();
          masterBatch.set(newRef, {
            turno_id: turnoId,
            patente: patente,
            conductor_nombre: document.getElementById('edit-distribuidor')?.dataset?.conductor || '',
            distribuidor: distribuidor,
            estado: 'devuelto',
            devolucion_motivo: 'Ajuste Administrativo',
            cliente_nombre: 'Cliente Genérico ' + (currentD + 1),
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            pod_timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });`
);

applyFix(
  'viajes.html',
  'FIX 8b: Synthetic entrega despachos include metadata',
  `          const newRef = db.collection('despachos').doc();
          batch.set(newRef, {
            turno_id: turnoId,
            estado: 'entregado',
            cliente_nombre: 'Cliente Genérico ' + (currentE + 1),
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            pod_timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });`,
  `          const newRef = db.collection('despachos').doc();
          masterBatch.set(newRef, {
            turno_id: turnoId,
            patente: patente,
            conductor_nombre: document.getElementById('edit-distribuidor')?.dataset?.conductor || '',
            distribuidor: distribuidor,
            estado: 'entregado',
            cliente_nombre: 'Cliente Genérico ' + (currentE + 1),
            fecha: firebase.firestore.FieldValue.serverTimestamp(),
            pod_timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });`
);

// =========================================================================
// FIX 9: admin_script.js — status enum normalization (pendiente vs pendiente_revision)
// =========================================================================
applyFix(
  'admin_script.js',
  'FIX 9: Normalize status enum - use pendiente_revision consistently',
  `  const statusStr = status === 'aprobado' ? 'aprobado' : status === 'rechazado' ? 'rechazado' : 'pendiente';`,
  `  const statusStr = status === 'aprobado' ? 'aprobado' : status === 'rechazado' ? 'rechazado' : 'pendiente_revision';`
);

// =========================================================================
// FIX 10: viajes.html — gastos_ruta sync error not properly reported
// Move batch references for gastos from inner 'batch' to 'masterBatch'
// =========================================================================
applyFix(
  'viajes.html',
  'FIX 10: gastos_ruta sync uses masterBatch (part of atomic operation)',
  `               batch.update(gd.ref, { monto: combustible, monto_clp: combustible, litros: litrosCombustible });`,
  `               masterBatch.update(gd.ref, { monto: combustible, monto_clp: combustible, litros: litrosCombustible });`
);
applyFix(
  'viajes.html',
  'FIX 10b: gastos delete in masterBatch',
  `               batch.delete(gd.ref);
            }
          } else if (gd.tipo === 'peaje') {
            if (!foundPeaje && peaje > 0) {
               batch.update(gd.ref, { monto: peaje, monto_clp: peaje });`,
  `               masterBatch.delete(gd.ref);
            }
          } else if (gd.tipo === 'peaje') {
            if (!foundPeaje && peaje > 0) {
               masterBatch.update(gd.ref, { monto: peaje, monto_clp: peaje });`
);
applyFix(
  'viajes.html',
  'FIX 10c: second gastos delete in masterBatch',
  `               batch.delete(gd.ref);
            }
          }
        }
        
        if (!foundComb && combustible > 0) {
          const newG = db.collection('gastos_ruta').doc();
          batch.set(newG, {`,
  `               masterBatch.delete(gd.ref);
            }
          }
        }
        
        if (!foundComb && combustible > 0) {
          const newG = db.collection('gastos_ruta').doc();
          masterBatch.set(newG, {`
);
applyFix(
  'viajes.html',
  'FIX 10d: peaje gastos set in masterBatch',
  `        if (!foundPeaje && peaje > 0) {
          const newG = db.collection('gastos_ruta').doc();
          batch.set(newG, {`,
  `        if (!foundPeaje && peaje > 0) {
          const newG = db.collection('gastos_ruta').doc();
          masterBatch.set(newG, {`
);

console.log(`\n✅ DONE: ${fixes} fixes applied`);
