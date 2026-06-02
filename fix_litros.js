const fs = require('fs');

let js = fs.readFileSync('viajes.html', 'utf8');

const injectionPoint = `const hasFuel=document.getElementById('carga_combustible_viaje').checked;
    let fotoUrl='';
    const fotoFile=document.getElementById('foto_combustible').files[0];`;

const newCode = `const hasFuel=document.getElementById('carga_combustible_viaje').checked;
    
    // Validar carga de combustible
    if (hasFuel) {
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

if (js.includes(injectionPoint)) {
  js = js.replace(injectionPoint, newCode);
  fs.writeFileSync('viajes.html', js);
  console.log('viajes.html updated successfully with fuel validation.');
} else {
  console.log('Failed to find injection point in viajes.html');
}
