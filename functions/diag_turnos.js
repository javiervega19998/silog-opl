/**
 * DIAGNÓSTICO — Lista TODOS los turnos de la DB con sus fechas
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'silog-opl-681dc';
const DB_PATH = `projects/${PROJECT_ID}/databases/(default)/documents`;
const BASE = `https://firestore.googleapis.com/v1/${DB_PATH}`;

async function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const refreshToken = config.tokens.refresh_token;
  const clientId = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
  const clientSecret = 'j9iVZfS8kkCEFUPaAeJV0sAi';
  const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}&client_id=${clientId}&client_secret=${clientSecret}`;
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: 'oauth2.googleapis.com', path: '/token', method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => { const j = JSON.parse(data); if (j.access_token) resolve(j.access_token); else reject(new Error(data)); });
    }); req.on('error', reject); req.write(body); req.end();
  });
}

function httpGet(url, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET', headers: { 'Authorization': `Bearer ${token}` } }, res => {
      let data = ''; res.on('data', c => data += c); res.on('end', () => resolve(JSON.parse(data)));
    }); req.on('error', reject); req.end();
  });
}

async function listAll(token, coll) {
  const docs = []; let pt = '';
  do {
    let url = `${BASE}/${coll}?pageSize=300`; if (pt) url += `&pageToken=${pt}`;
    const res = await httpGet(url, token);
    if (res.documents) docs.push(...res.documents);
    pt = res.nextPageToken || '';
  } while (pt);
  return docs;
}

function pv(v) {
  if (!v) return null;
  if (v.stringValue !== undefined) return v.stringValue;
  if (v.integerValue !== undefined) return parseInt(v.integerValue);
  if (v.doubleValue !== undefined) return v.doubleValue;
  if (v.booleanValue !== undefined) return v.booleanValue;
  if (v.timestampValue) return new Date(v.timestampValue);
  if (v.nullValue !== undefined) return null;
  return JSON.stringify(v);
}

async function main() {
  const token = await getAccessToken();
  console.log('Token OK\n');
  
  const docs = await listAll(token, 'turnos');
  console.log(`Total turnos en BD: ${docs.length}\n`);
  console.log('FECHA_INICIO | FECHA_STR | DOC_ID | CONDUCTOR | PATENTE | ESTADO | KM_INI | KM_FIN');
  console.log('─'.repeat(120));
  
  for (const doc of docs) {
    const f = doc.fields || {};
    const id = doc.name.split('/').pop();
    const conductor = pv(f.conductor_email) || pv(f.conductor_nombre) || '?';
    const patente = pv(f.patente) || '?';
    const estado = pv(f.estado) || '?';
    const kmIni = pv(f.km_inicial) || pv(f.km_inicial_actual) || '?';
    const kmFin = pv(f.km_final) || '?';
    const fechaStr = pv(f.fecha) || '';
    const fechaInicio = pv(f.fecha_inicio);
    const fiStr = fechaInicio instanceof Date ? fechaInicio.toISOString().slice(0,19) : String(fechaInicio || '');
    
    console.log(`${fiStr.padEnd(20)} | ${String(fechaStr).padEnd(12)} | ${id.slice(0,12)} | ${String(conductor).slice(0,25).padEnd(25)} | ${String(patente).padEnd(8)} | ${String(estado).padEnd(10)} | ${String(kmIni).padEnd(8)} | ${kmFin}`);
  }
}

main().catch(e => { console.error('ERROR:', e.message); process.exit(1); });
