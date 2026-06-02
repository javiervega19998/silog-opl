const fs = require('fs');
let html = fs.readFileSync('scratch/silog-ops/finanzas.html', 'utf8');

const target1 = }else{
        const subtipo=document.getElementById('gc-subtipo').value;
        const monto=parseInt(document.getElementById('gc-monto').value)||0;
        if(monto<=0){showToast('Ingresa un monto valido para el servicio','error');return;}
        data.subtipo=subtipo;
        data.monto=monto;
      };
      
const target2 = }else{
        const subtipo=document.getElementById('gc-subtipo').value;
        const monto=parseInt(document.getElementById('gc-monto').value)||0;
        if(monto<=0){showToast('Ingresa un monto vÃ¡lido para el servicio','error');return;}
        data.subtipo=subtipo;
        data.monto=monto;
      };

const target3 = }else{
        const subtipo=document.getElementById('gc-subtipo').value;
        const monto=parseInt(document.getElementById('gc-monto').value)||0;
        if(monto<=0){showToast('Ingresa un monto válido para el servicio','error');return;}
        data.subtipo=subtipo;
        data.monto=monto;
      };

const replace = }else{
        const subtipo=document.getElementById('gc-subtipo').value;
        const monto=parseInt(document.getElementById('gc-monto').value)||0;
        if(monto<=0){showToast('Ingresa un monto neto válido para el servicio','error');return;}
        const iva = Math.round(monto * 0.19);
        data.subtipo=subtipo;
        data.monto=monto;
        data.monto_neto=monto;
        data.iva=iva;
        data.monto_total=monto + iva;
      };

let replaced = false;
if (html.includes(target1)) { html = html.replace(target1, replace); replaced = true; }
else if (html.includes(target2)) { html = html.replace(target2, replace); replaced = true; }
else if (html.includes(target3)) { html = html.replace(target3, replace); replaced = true; }

if (replaced) {
  fs.writeFileSync('scratch/silog-ops/finanzas.html', html, 'utf8');
  console.log('Successfully replaced');
} else {
  console.log('Target not found!');
}
