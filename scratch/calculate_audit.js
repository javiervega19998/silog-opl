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

  // 1. Fetch inventory
  const invRes = await httpReq('GET', `${BASE}/inventory?pageSize=300`, token);
  const inventory = invRes.d.documents || [];
  
  // 2. Fetch movimientos_bodega
  const movBodegaRes = await httpReq('GET', `${BASE}/movimientos_bodega?pageSize=500`, token);
  const movimientos_bodega = movBodegaRes.d.documents || [];
  
  // 3. Fetch logistica_inversa
  const logInversaRes = await httpReq('GET', `${BASE}/logistica_inversa?pageSize=300`, token);
  const logistica_inversa = logInversaRes.d.documents || [];

  const totals = {};
  
  // Initialize from inventory
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
      dbDisp: pv(f.disponible) ?? 0,
      dbNoDisp: pv(f.no_disponible) ?? 0,
      calcDisp: baseStock[code] !== undefined ? baseStock[code] : 0,
      calcNoDisp: 0,
      mermasBodega: 0,
      mermasInversa: 0,
      ingresosPost: 0,
      salidasPost: 0,
      logs: []
    };
  }

  const snapshotTime = new Date('2026-06-08T20:42:14-04:00').getTime();

  // Process movimientos_bodega
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

    if (tipo === 'merma' || tipo === 'devolucion_rechazada') {
      // These are registered in movimientos_bodega
      totals[pId].mermasBodega += cant;
      totals[pId].logs.push(`movimientos_bodega: +${cant} merma (${subtipo || tipo})`);
      // Note: we will calculate the final no_disponible from logistica_inversa and/or movements.
    } else if (ts > snapshotTime) {
      const isIn = ['ingreso', 'devolucion', 'abastecimiento', 'ajuste_pos'].includes(tipo);
      const isOut = ['salida', 'despacho', 'despacho_ruta', 'ajuste_neg'].includes(tipo);
      
      if (isIn) {
        totals[pId].calcDisp += cant;
        totals[pId].ingresosPost += cant;
        totals[pId].logs.push(`movimientos_bodega: +${cant} disp (tipo: ${tipo}, subtipo: ${subtipo})`);
      } else if (isOut) {
        totals[pId].calcDisp -= cant;
        totals[pId].salidasPost += cant;
        totals[pId].logs.push(`movimientos_bodega: -${cant} disp (tipo: ${tipo}, subtipo: ${subtipo})`);
      }
    }
  }

  // Process logistica_inversa to count mermas
  for (const doc of logistica_inversa) {
    const f = doc.fields || {};
    const code = pv(f.producto_codigo);
    const clasificacion = pv(f.clasificacion);
    const cantidad = pv(f.cantidad) || 0;
    const estado = pv(f.estado);

    if (clasificacion === 'merma') {
      let pId = pv(f.producto_id);
      if (!pId && code) {
        pId = Object.keys(totals).find(k => totals[k].code === code);
      }
      if (pId && totals[pId]) {
        totals[pId].mermasInversa += cantidad;
        totals[pId].logs.push(`logistica_inversa: +${cantidad} merma (id: ${doc.name.split('/').pop()})`);
      }
    }
  }

  // Calculate final stock totals
  console.log('\nAUDIT ANALYSIS:');
  console.log('CODE | NAME | EXCEL | DISP_DB | NODISP_DB | CALC_DISP | CALC_NODISP (MermasInversa) | MATCH?');
  console.log('-'.repeat(120));
  
  for (const id of Object.keys(totals)) {
    const t = totals[id];
    
    // As per user request:
    // "si en la pestaña logistica inversa hay viajes con productos clasificados como merma, estos sumaran al stock total y a No disponible. verifica todo para que quede como el stock original con las condiciones mencionada"
    // So the final no_disponible should be the sum of all mermas found in logistica_inversa for this product!
    t.calcNoDisp = t.mermasInversa; 
    
    // Wait, does the mermasInversa (which was reclasified from logistica_inversa) affect calcDisp?
    // Let's check: if it was a reclasificacion, does it subtract from the base stock?
    // In our inspection of logistica_inversa, we saw all 15 items had estado = "reclasificado" and clasificacion = "merma".
    // When they are reclasified as merma in the bodega script, they are subtracted from disponible (newDisp = Math.max(0, disp - cant)) because when they were received they were added to disponible.
    // Wait! Let's think:
    // If the baseStock represents the original stock at the beginning, does that baseStock ALREADY include these mermas?
    // No, mermas are non-available products. Base stock from Excel is "Stock Disponible".
    // So these mermas should just add to "No Disponible" and to the total stock.
    // Wait! If they were received as logistica_inversa *after* the Excel snapshot, did they add to disponible?
    // Yes, they were received, which added to disponible, and then reclasified, which subtracted from disponible.
    // So their net effect on disponible is +cant - cant = 0!
    // So `calcDisp` should remain equal to the original `stockExcel` + any regular post-snapshot movements.
    // Let's check if there are any other movements for these products.
    
    const match = (t.dbDisp === t.calcDisp && t.dbNoDisp === t.calcNoDisp);
    
    if (t.calcNoDisp > 0 || t.ingresosPost > 0 || t.salidasPost > 0 || !match) {
      console.log(`${t.code.padEnd(8)} | ${t.name.substring(0, 30).padEnd(30)} | ${String(t.stockExcel).padStart(5)} | ${String(t.dbDisp).padStart(7)} | ${String(t.dbNoDisp).padStart(9)} | ${String(t.calcDisp).padStart(9)} | ${String(t.calcNoDisp).padStart(12)} (${t.mermasInversa}) | ${match ? 'YES' : 'NO'}`);
      if (t.logs.length > 0) {
        console.log('   Logs:');
        t.logs.forEach(l => console.log(`     - ${l}`));
      }
    }
  }
}

main().catch(e => console.error(e));
