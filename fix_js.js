const fs = require('fs');
let html = fs.readFileSync('scratch/silog-ops/finanzas.html', 'utf8');

html = html.replace(
  /const monto=parseInt\(document.getElementById\('gc-monto'\)\.value\)\|\|0;\s*if\(monto<=0\)\{showToast\('Ingresa un monto .*?para el servicio','error'\);return;\}\s*data.subtipo=subtipo;\s*data.monto=monto;/g,
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

fs.writeFileSync('scratch/silog-ops/finanzas.html', html, 'utf8');
console.log('finanzas.html updated successfully');
