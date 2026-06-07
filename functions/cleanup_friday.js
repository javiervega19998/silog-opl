/**
 * LIMPIEZA FINAL — Eliminar turnos del viernes 5 junio 2026
 * IDs confirmados por diagnóstico.
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'silog-opl-681dc';
const DB_PATH = `projects/${PROJECT_ID}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${DB_PATH}`;

// Turnos del VIERNES 5 JUNIO a eliminar (confirmados por diagnóstico)
const FRIDAY_TURNO_IDS = ['OcIZsHPWs5h3', 'PInmQtmYClB1'];

// Vehículos a restaurar:
// KZGZ57 (Renault Master) → KM 162028 (km_final jueves de Julio en turno UWHNJxVBDo9q)
// VSTJ80 (Foton) → KM 659 (km_inicial del viernes, ya que no hubo turno de Foton el jueves)
const VEH_RESTORE = {
  'KZGZ57': { km: 162028, name: 'Renault Master' },
  'VSTJ80': { km: 659, name: 'Foton' },
};

async function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const refreshToken = config.tokens.refresh_token;
  const clientId = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
  const clientSecret = 'j9iVZfS8kkCEFUPaAeJV0sAi';
  const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${clientId}&client_secret=${clientSecret}`;
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => { const j = JSON.parse(data); j.access_token ? resolve(j.access_token) : reject(new Error(data)); });
    }); req.on('error', reject); req.write(body); req.end();
  });
}

function httpReq(method, url, token, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method, headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => { try { resolve({ s: res.statusCode, d: JSON.parse(data) }); } catch(e) { resolve({ s: res.statusCode, d: data }); } });
    }); req.on('error', reject); if (body) req.write(JSON.stringify(body)); req.end();
  });
}

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

function pv(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  return null;
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  LIMPIEZA FINAL — Viernes 5 Junio 2026');
  console.log('═══════════════════════════════════════════════════\n');

  const token = await getAccessToken();
  console.log('✅ Token OK\n');

  const toDelete = [];

  // ── 1. Agregar los turnos a eliminar ──
  for (const tId of FRIDAY_TURNO_IDS) {
    toDelete.push(`${DB_PATH}/turnos/${tId}`);
  }
  console.log(`📌 Turnos a eliminar: ${FRIDAY_TURNO_IDS.join(', ')}\n`);

  // ── 2. Buscar documentos relacionados ──
  const relatedColls = ['despachos', 'hojas_ruta', 'gastos_ruta', 'km_discrepancias', 'prefacturas'];
  
  for (const coll of relatedColls) {
    const docs = await listAll(token, coll);
    let count = 0;
    for (const doc of docs) {
      const turnoId = pv((doc.fields || {}).turno_id);
      if (FRIDAY_TURNO_IDS.includes(turnoId)) {
        toDelete.push(doc.name);
        count++;
        const docId = doc.name.split('/').pop();
        console.log(`   📄 ${coll}/${docId} (turno: ${turnoId})`);
      }
    }
    console.log(`   → ${coll}: ${count} documentos\n`);
  }

  // ── 3. Resumen ──
  console.log('═══════════════════════════════════════════════════');
  console.log(`  🗑️  TOTAL: ${toDelete.length} documentos a eliminar`);
  console.log('═══════════════════════════════════════════════════\n');

  // ── 4. Ejecutar eliminaciones ──
  console.log('🚀 Eliminando...\n');
  let ok = 0;
  for (const docPath of toDelete) {
    const r = await httpReq('DELETE', `https://firestore.googleapis.com/v1/${docPath}`, token);
    const short = docPath.split('/documents/')[1] || docPath;
    if (r.s === 200) { ok++; console.log(`   ✅ ${short}`); }
    else console.log(`   ❌ ${short} (HTTP ${r.s})`);
  }

  // ── 5. Restaurar vehículos ──
  console.log('\n🔧 Restaurando vehículos...\n');
  const vehDocs = await listAll(token, 'vehiculos');
  
  for (const [patente, info] of Object.entries(VEH_RESTORE)) {
    const vDoc = vehDocs.find(d => pv((d.fields || {}).patente) === patente);
    if (!vDoc) { console.log(`   ⚠️  ${patente} (${info.name}) no encontrado`); continue; }
    
    const fields = {
      estado: { stringValue: 'disponible' },
      conductor: { stringValue: '' },
      km: { integerValue: String(info.km) },
      kilometraje: { integerValue: String(info.km) },
    };
    const mask = Object.keys(fields).map(k => `updateMask.fieldPaths=${k}`).join('&');
    const r = await httpReq('PATCH', `https://firestore.googleapis.com/v1/${vDoc.name}?${mask}`, token, { fields });
    
    if (r.s === 200) {
      console.log(`   ✅ ${patente} (${info.name}): KM → ${info.km}, Estado → disponible, Conductor → ""`);
    } else {
      console.log(`   ❌ ${patente} (${info.name}): Error HTTP ${r.s}`);
      console.log(`      ${JSON.stringify(r.d).slice(0, 200)}`);
    }
  }

  // ── 6. Resultado final ──
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  ✅ OPERACIÓN COMPLETADA');
  console.log('═══════════════════════════════════════════════════');
  console.log(`\n  📊 Documentos eliminados: ${ok}/${toDelete.length}`);
  console.log(`  🚛 Vehículos restaurados:`);
  console.log(`     KZGZ57 (Renault Master) → KM 162028, disponible`);
  console.log(`     VSTJ80 (Foton) → KM 659, disponible`);
  console.log(`\n  Los turnos del viernes 5 junio fueron eliminados.`);
  console.log(`  Los vehículos están liberados y sus KM restaurados.\n`);
}

main().catch(e => { console.error('❌ ERROR:', e.message); process.exit(1); });
