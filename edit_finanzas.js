const fs = require('fs');
let html = fs.readFileSync('scratch/silog-ops/finanzas.html', 'latin1');

let newHtml = html.replace(
  /<div id="gc-sec-servicio" class="row-2" style="display:none">([\s\S]*?)<\/div>\s*<\/div>/,
  \<div id="gc-sec-servicio" style="display:none; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap:10px; margin-bottom: 12px;">
          <div class="form-group">
            <label>Tipo de Servicio</label>
            <select class="field" id="gc-subtipo">
              <option value="luz">?? Luz</option>
              <option value="agua">?? Agua</option>
              <option value="electricidad">? Electricidad</option>
              <option value="telefonia_internet">?? Telefonía e Internet</option>
              <option value="arriendo_inmobiliario">?? Arriendo Inmobiliario</option>
            </select>
          </div>
          <div class="form-group">
            <label>Monto Neto (CLP)</label>
            <input class="field" type="number" id="gc-monto" placeholder="0" oninput="calcServicioIvaAutomatico()"/>
          </div>
          <div class="form-group">
            <label>IVA (19% auto)</label>
            <input class="field" id="gc-servicio-iva" placeholder="—" readonly style="background:var(--surface2); color:var(--text2);"/>
          </div>
          <div class="form-group">
            <label>Monto Total (auto)</label>
            <input class="field" id="gc-servicio-total" placeholder="—" readonly style="background:var(--surface2); color:var(--text2);"/>
          </div>
        </div>\
);

// add calcServicioIvaAutomatico() to the script block
newHtml = newHtml.replace(
  /function calcIngresoIvaAutomatico\(\)\{([\s\S]*?)\}/,
  \unction calcIngresoIvaAutomatico(){}
  
  function calcServicioIvaAutomatico() {
    const n = parseInt(document.getElementById('gc-monto').value)||0;
    if (n > 0) {
      const iva = Math.round(n * 0.19);
      document.getElementById('gc-servicio-iva').value = '$ ' + iva.toLocaleString('es-CL');
      document.getElementById('gc-servicio-total').value = '$ ' + (n + iva).toLocaleString('es-CL');
    } else {
      document.getElementById('gc-servicio-iva').value = '';
      document.getElementById('gc-servicio-total').value = '';
    }
  }\
);

// update guardarGastoContabilidad to save the new fields
newHtml = newHtml.replace(
  /const monto=parseInt\(document.getElementById\('gc-monto'\).value\)\|\|0;\s*if\(monto<=0\)\{showToast\('Ingresa un monto v.lido para el servicio','error'\);return;\}\s*data.subtipo=subtipo;\s*data.monto=monto;/,
  \const monto=parseInt(document.getElementById('gc-monto').value)||0;
        if(monto<=0){showToast('Ingresa un monto neto válido para el servicio','error');return;}
        const iva = Math.round(monto * 0.19);
        const total = monto + iva;
        data.subtipo=subtipo;
        data.monto=monto;
        data.monto_neto=monto;
        data.iva=iva;
        data.monto_total=total;\
);

fs.writeFileSync('scratch/silog-ops/finanzas.html', newHtml, 'latin1');
console.log('finanzas.html edited');
