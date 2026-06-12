const https = require('https');
const fs = require('fs');
const path = require('path');
const BASE = `https://firestore.googleapis.com/v1/projects/silog-opl-681dc/databases/(default)/documents`;

const baseStock = {
  "110382": 4, "110801": 12, "112594": 3, "120659": 1, "130089": 2, "140069": 6, "152102": 2, "161211": 1, "161212": 45, "161222": 2, "161226": 2, "164424": 12, "164479": 7, "164551": 0, "164560": 3, "165879": 0, "170391": 3, "170443": 0, "170862": 0, "177040": 3, "178454": 2, "178456": 0, "178458": 2, "179449": 1, "183336": 3, "183337": 10, "183760": 4, "187147": 89, "187183": 2, "187184": 20, "195722": 8, "195723": 0, "204024": 15, "205476": 15, "207848": 1, "207849": 2, "207910": 0, "208127": 2, "208281": 1, "208510": 1, "209045": 15, "209911": 40, "209912": 6, "210256": 44, "210746": 2, "211575": 2, "212425": 35, "212601": 6, "213656": 0, "213658": 3, "213824": 0, "214146": 5, "217029": 0, "217637": 10, "218555": 1, "218575": 45, "218589": 8, "218590": 10, "218613": 4, "218664": 4, "218665": 4, "218673": 2, "218732": 0, "218739": 10, "218741": 10, "218742": 4, "218750": 1, "218751": 0, "218923": 6, "218927": 24, "227129": 2, "227131": 39, "230488": 4, "230490": 4, "231119": 1, "232695": 36, "232696": 1, "232697": 0, "233555": 3, "233556": 10, "233659": 1, "234138": 35, "236110": 2, "236260": 0, "236539": 1, "236563": 4, "236564": 10, "236570": 3, "236615": 5, "236616": 80, "236745": 18, "236793": 8, "236794": 30, "236809": 4, "1100004": 0
};

async function getToken() {
  const config = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
  const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(config.tokens.refresh_token)}&client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8kkCEFUPaAeJV0sAi`;
  return new Promise((r,j)=>{const req=https.request({hostname:'oauth2.googleapis.com',path:'/token',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const p=JSON.parse(d);r(p.access_token)})});req.on('error',j);req.write(body);req.end()});
}

function httpReq(method,url,token,body){return new Promise((r,j)=>{const u=new URL(url);const req=https.request({hostname:u.hostname,path:u.pathname+u.search,method,headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{r({s:res.statusCode,d:JSON.parse(d)})}catch(e){r({s:res.statusCode,d})}})});req.on('error',j);if(body)req.write(JSON.stringify(body));req.end()});}

function pv(v){
  if(!v) return null;
  if(v.stringValue!==undefined) return v.stringValue;
  if(v.integerValue!==undefined) return parseInt(v.integerValue);
  if(v.doubleValue!==undefined) return parseFloat(v.doubleValue);
  if(v.booleanValue!==undefined) return v.booleanValue;
  if(v.timestampValue!==undefined) return new Date(v.timestampValue).getTime();
  return null;
}

async function main() {
  const token = await getToken();

  console.log('1. Loading Firestore collections...');
  const invRes = await httpReq('GET', `${BASE}/inventory?pageSize=300`, token);
  const inventory = invRes.d.documents || [];
  
  const movBodegaRes = await httpReq('GET', `${BASE}/movimientos_bodega?pageSize=500`, token);
  const movimientos_bodega = movBodegaRes.d.documents || [];
  
  const logInversaRes = await httpReq('GET', `${BASE}/logistica_inversa?pageSize=300`, token);
  const logistica_inversa = logInversaRes.d.documents || [];

  const movOldRes = await httpReq('GET', `${BASE}/movimientos?pageSize=500`, token);
  const movimientos_old = movOldRes.d.documents || [];

  const totals = {};
  
  // Initialize inventory products
  for (const doc of inventory) {
    const f = doc.fields || {};
    const id = doc.name.split('/').pop();
    const code = pv(f.code) || pv(f.producto_codigo) || pv(f.SKU) || '';
    const name = pv(f.name) || pv(f.nombre) || '';
    
    totals[id] = {
      id,
      code,
      name,
      stockExcel: baseStock[code] !== undefined ? baseStock[code] : 0,
      calcDisp: baseStock[code] !== undefined ? baseStock[code] : 0,
      calcNoDisp: 0,
      mermasInversa: 0,
      mermasOld: 0,
      ingresosPost: 0,
      salidasPost: 0
    };
  }

  const snapshotTime = new Date('2026-06-08T20:42:14-04:00').getTime();

  // Process movimientos_bodega for post-snapshot regular updates
  for (const doc of movimientos_bodega) {
    const f = doc.fields || {};
    let pId = pv(f.producto_id);
    const code = pv(f.producto_codigo);
    
    if (!pId && code) {
      pId = Object.keys(totals).find(k => totals[k].code === code);
    }
    if (!pId || !totals[pId]) continue;
    
    const cant = pv(f.cantidad) || 0;
    const tipo = pv(f.tipo);
    const subtipo = pv(f.subtipo);
    const ts = pv(f.fecha) || 0;

    if (ts > snapshotTime) {
      const isIn = ['ingreso', 'devolucion', 'abastecimiento', 'ajuste_pos'].includes(tipo);
      const isOut = ['salida', 'despacho', 'despacho_ruta', 'ajuste_neg'].includes(tipo);
      const isReclassMerma = (tipo === 'merma' && subtipo === 'reclasificacion_merma');

      if (isIn) {
        totals[pId].calcDisp += cant;
        totals[pId].ingresosPost += cant;
      } else if (isOut || isReclassMerma) {
        totals[pId].calcDisp -= cant;
        totals[pId].salidasPost += cant;
      }
    }
  }

  // Count mermas from new logistica_inversa collection
  for (const doc of logistica_inversa) {
    const f = doc.fields || {};
    const code = pv(f.producto_codigo);
    const clasificacion = pv(f.clasificacion);
    const cantidad = pv(f.cantidad) || 0;

    if (clasificacion === 'merma') {
      let pId = pv(f.producto_id);
      if (!pId && code) {
        pId = Object.keys(totals).find(k => totals[k].code === code);
      }
      if (pId && totals[pId]) {
        totals[pId].mermasInversa += cantidad;
      }
    }
  }

  // Count mermas from old movimientos collection (if any, not migrated)
  for (const doc of movimientos_old) {
    const f = doc.fields || {};
    const code = pv(f.codigoProducto);
    const clasificacion = pv(f.clasificacion);
    const cantidad = pv(f.cantidad) || 0;
    const migrado = pv(f._migrado_backfill) || false;

    if (clasificacion === 'merma' && !migrado) {
      let pId = pv(f.productoId) || pv(f.producto_id);
      if (!pId && code) {
        pId = Object.keys(totals).find(k => totals[k].code === code);
      }
      if (pId && totals[pId]) {
        totals[pId].mermasOld += cantidad;
      }
    }
  }

  console.log('\n2. Starting Firestore Database updates...');
  let updateCount = 0;
  
  // We can write updates in chunks of 20 documents since Firestore REST API allows multiple commits or we can do patch requests sequentially.
  // Sequential patch requests are extremely safe and simple to log.
  
  for (const pId of Object.keys(totals)) {
    const t = totals[pId];
    
    // Total mermas sum to No Disponible
    const mermas = t.mermasInversa + t.mermasOld;
    t.calcNoDisp = mermas;
    
    const disp = Math.max(0, t.calcDisp);
    const noDisp = Math.max(0, t.calcNoDisp);
    const total = disp + noDisp;
    
    // Prepare the update fields for Firestore API
    const fields = {
      disponible: { integerValue: disp },
      no_disponible: { integerValue: noDisp },
      qty: { integerValue: total },
      cantidad: { integerValue: total },
      total: { integerValue: total }
    };
    
    const url = `https://firestore.googleapis.com/v1/projects/silog-opl-681dc/databases/(default)/documents/inventory/${pId}?updateMask.fieldPaths=disponible&updateMask.fieldPaths=no_disponible&updateMask.fieldPaths=qty&updateMask.fieldPaths=cantidad&updateMask.fieldPaths=total`;
    
    const patchRes = await httpReq('PATCH', url, token, { fields });
    if (patchRes.s === 200) {
      console.log(`   [OK] Product ${t.code} (${t.name.substring(0, 25)}) updated -> Disp: ${disp}, NoDisp: ${noDisp}, Total: ${total}`);
      updateCount++;
    } else {
      console.error(`   [ERROR] Failed to update product ${t.code}: Code ${patchRes.s}, Data: ${JSON.stringify(patchRes.d)}`);
    }
  }

  console.log(`\nCOMPLETED: Succeeded to repair ${updateCount} products in the database!`);
}

main().catch(e => console.error(e));
