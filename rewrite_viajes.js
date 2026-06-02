const fs = require('fs');
let html = fs.readFileSync('viajes.html', 'utf8');

// 1. Add validation for liters in submitViaje
const targetFuelValidation = `    const hasFuel=document.getElementById('carga_combustible_viaje').checked;
    let fotoUrl='';
    const fotoFile=document.getElementById('foto_combustible').files[0];`;

const newFuelValidation = `    const hasFuel=document.getElementById('carga_combustible_viaje').checked;
    
    // Validar campos de combustible
    if(hasFuel) {
      const vLitros = parseFloat(document.getElementById('litros_combustible').value);
      const vMonto = parseFloat(document.getElementById('monto_combustible').value);
      const vFoto = document.getElementById('foto_combustible').files[0];
      
      if (!vLitros || vLitros <= 0) {
        showToast('Debe ingresar la cantidad de litros cargados.', 'error');
        btn.disabled = false; btn.innerHTML = '📋 Registrar Hoja de Ruta'; return;
      }
      if (!vMonto || vMonto <= 0) {
        showToast('Debe ingresar el monto total del combustible.', 'error');
        btn.disabled = false; btn.innerHTML = '📋 Registrar Hoja de Ruta'; return;
      }
      if (!vFoto) {
        showToast('Debe adjuntar la foto o boleta del comprobante de combustible.', 'error');
        btn.disabled = false; btn.innerHTML = '📋 Registrar Hoja de Ruta'; return;
      }
    }

    let fotoUrl='';
    const fotoFile=document.getElementById('foto_combustible').files[0];`;

if(html.includes(targetFuelValidation)) {
  html = html.replace(targetFuelValidation, newFuelValidation);
  console.log("Fuel validation added.");
}

// 2. Add Litros field to modal-edit-trip HTML
const targetModalGrid = `<div class="row-2" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="form-row">
          <label style="display:block;font-size:.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Combustible ($)</label>
          <input class="field" type="number" id="edit-combustible" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:.85rem;outline:none"/>
        </div>
        <div class="form-row">
          <label style="display:block;font-size:.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Peaje ($)</label>
          <input class="field" type="number" id="edit-peaje" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:.85rem;outline:none"/>
        </div>
      </div>`;
const newModalGrid = `<div class="row-2" style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="form-row">
          <label style="display:block;font-size:.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Litros Comb.</label>
          <input class="field" type="number" step="0.1" id="edit-litros" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:.85rem;outline:none"/>
        </div>
        <div class="form-row">
          <label style="display:block;font-size:.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Combustible ($)</label>
          <input class="field" type="number" id="edit-combustible" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:.85rem;outline:none"/>
        </div>
        <div class="form-row">
          <label style="display:block;font-size:.75rem;color:var(--text2);text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px">Peaje ($)</label>
          <input class="field" type="number" id="edit-peaje" style="width:100%;background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:10px 12px;color:var(--text);font-size:.85rem;outline:none"/>
        </div>
      </div>`;
if(html.includes(targetModalGrid)) {
  html = html.replace(targetModalGrid, newModalGrid);
  console.log("Modal grid updated.");
}

// 3. Load / Save Litros in Modal JS + Save Vehicles Sync in saveEditedTrip
const targetLoadModal = `document.getElementById('edit-combustible').value = r.monto_combustible ?? r.combustible ?? 0;
    document.getElementById('edit-peaje').value = r.peaje ?? 0;`;
const newLoadModal = `document.getElementById('edit-combustible').value = r.monto_combustible ?? r.combustible ?? 0;
    document.getElementById('edit-litros').value = r.litros_combustible ?? 0;
    document.getElementById('edit-peaje').value = r.peaje ?? 0;`;
if(html.includes(targetLoadModal)) {
  html = html.replace(targetLoadModal, newLoadModal);
  console.log("Modal load updated.");
}

const targetSaveVars = `const combustible = parseFloat(document.getElementById('edit-combustible').value) || 0;
  const peaje = parseFloat(document.getElementById('edit-peaje').value) || 0;`;
const newSaveVars = `const combustible = parseFloat(document.getElementById('edit-combustible').value) || 0;
  const litrosCombustible = parseFloat(document.getElementById('edit-litros').value) || 0;
  const peaje = parseFloat(document.getElementById('edit-peaje').value) || 0;`;
if(html.includes(targetSaveVars)) {
  html = html.replace(targetSaveVars, newSaveVars);
  console.log("Modal save vars updated.");
}

const targetSavePayload = `monto_combustible: combustible,
      combustible,
      peaje,
      estado
    });`;
const newSavePayload = `monto_combustible: combustible,
      combustible,
      litros_combustible: litrosCombustible,
      peaje,
      estado
    });

    // Sincronizar KM editado con Gestionar Flota (Vehiculos)
    try {
      const vSnap = await db.collection('vehiculos').where('patente', '==', patente).limit(1).get();
      if (!vSnap.empty) {
        await vSnap.docs[0].ref.update({
          km: kmF,
          kilometraje: kmF
        });
      }
    } catch(err) {
      console.warn("No se pudo sincronizar el KM editado del vehículo", err);
    }`;
if(html.includes(targetSavePayload)) {
  html = html.replace(targetSavePayload, newSavePayload);
  console.log("Modal save payload updated.");
}

// 4. Update vehicle km in submitViaje
const targetSubmitTrip = `const hrRef=db.collection('hojas_ruta').doc();`;
const newSubmitTrip = `// Sincronizar KM con Gestionar Flota (Vehiculos)
    try {
      const vSnap = await db.collection('vehiculos').where('patente', '==', patente).limit(1).get();
      if (!vSnap.empty) {
        batch.update(vSnap.docs[0].ref, {
          km: kmF,
          kilometraje: kmF
        });
      }
    } catch(err) {
      console.warn("No se pudo sincronizar el KM del vehículo", err);
    }
    
    const hrRef=db.collection('hojas_ruta').doc();`;
if(html.includes(targetSubmitTrip)) {
  html = html.replace(targetSubmitTrip, newSubmitTrip);
  console.log("submitViaje vehicle update added.");
}

fs.writeFileSync('viajes.html', html);
console.log('viajes.html successfully rewritten with all logic.');
