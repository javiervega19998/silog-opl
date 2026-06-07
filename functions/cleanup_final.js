/**
 * ELIMINAR turnos del viernes con IDs COMPLETOS + restaurar vehículos
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'silog-opl-681dc';
const DB_PATH = `projects/${PROJECT_ID}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${DB_PATH}`;

// IDs COMPLETOS (corregidos)
const FRIDAY_TURNO_IDS = ['OcIZsHPWs5h3EV0L6qOH', 'PInmQtmYClB1n2C1ALmv'];

async function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(config.tokens.refresh_token)}&client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8kkCEFUPaAeJV0sAi`;
  return new Promise((r,j) => { const req = https.request({hostname:'oauth2.googleapis.com',path:'/token',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const p=JSON.parse(d);p.access_token?r(p.access_token):j(d)})});req.on('error',j);req.write(body);req.end(); });
}

function httpReq(method, url, token, body) {
  return new Promise((r,j) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => { try { r({ s: res.statusCode, d: JSON.parse(data) }); } catch(e) { r({ s: res.statusCode, d: data }); } });
    }); req.on('error', j); if (body) req.write(JSON.stringify(body)); req.end();
  });
}

function pv(v){if(!v)return null;if(v.stringValue!==undefined)return v.stringValue;if(v.integerValue!==undefined)return parseInt(v.integerValue);return null;}

async function listAll(token, coll) {
  const docs = []; let pt = '';
  do {
    let url = `${BASE}/${coll}?pageSize=300`; if (pt) url += `&pageToken=${pt}`;
    const r = await httpReq('GET', url, token);
    if (r.s !== 200) break;
    if (r.d.documents) docs.push(...r.d.documents);
    pt = r.d.nextPageToken || '';
  } while (pt);
  return docs;
}

async function main() {
  console.log('🚀 Eliminando turnos del viernes (IDs completos)...\n');
  const token = await getAccessToken();

  const toDelete = [];

  // Agregar turnos
  for (const id of FRIDAY_TURNO_IDS) {
    toDelete.push(`${DB_PATH}/turnos/${id}`);
  }

  // Buscar documentos relacionados
  const colls = ['despachos', 'hojas_ruta', 'gastos_ruta', 'km_discrepancias', 'prefacturas'];
  for (const coll of colls) {
    const docs = await listAll(token, coll);
    let c = 0;
    for (const doc of docs) {
      const turnoId = pv((doc.fields||{}).turno_id);
      if (FRIDAY_TURNO_IDS.includes(turnoId)) { toDelete.push(doc.name); c++; }
    }
    if (c > 0) console.log(`   ${coll}: ${c} docs`);
  }

  console.log(`\n🗑️  Eliminando ${toDelete.length} documentos...\n`);
  let ok = 0;
  for (const p of toDelete) {
    const r = await httpReq('DELETE', `https://firestore.googleapis.com/v1/${p}`, token);
    const short = p.split('/documents/')[1];
    console.log(`   ${r.s === 200 ? '✅' : '❌'} ${short}`);
    if (r.s === 200) ok++;
  }

  // Restaurar vehículos
  console.log('\n🔧 Restaurando vehículos...\n');
  const vehDocs = await listAll(token, 'vehiculos');

  const restores = [
    { patente: 'KZGZ57', km: 162028, name: 'Renault Master' },
    { patente: 'VSTJ80', km: 659, name: 'Foton' },
  ];

  for (const info of restores) {
    const vDoc = vehDocs.find(d => pv((d.fields||{}).patente) === info.patente);
    if (!vDoc) { console.log(`   ⚠️  ${info.patente} no encontrado`); continue; }
    const fields = {
      estado: { stringValue: 'disponible' },
      conductor: { stringValue: '' },
      km: { integerValue: String(info.km) },
      kilometraje: { integerValue: String(info.km) },
    };
    const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
    const r = await httpReq('PATCH', `https://firestore.googleapis.com/v1/${vDoc.name}?${mask}`, token, { fields });
    console.log(`   ${r.s===200?'✅':'❌'} ${info.patente} (${info.name}): KM=${info.km}, disponible`);
  }

  console.log(`\n✅ Completado: ${ok}/${toDelete.length} eliminados, 2 vehículos restaurados\n`);
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
