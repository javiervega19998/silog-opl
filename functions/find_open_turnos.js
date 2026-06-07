/**
 * Busca turnos abiertos para Julio y Williams
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'silog-opl-681dc';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

async function getAccessToken() {
  const configPath = path.join(process.env.USERPROFILE || process.env.HOME, '.config', 'configstore', 'firebase-tools.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(config.tokens.refresh_token)}&client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8kkCEFUPaAeJV0sAi`;
  return new Promise((r,j) => { const req = https.request({hostname:'oauth2.googleapis.com',path:'/token',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const p=JSON.parse(d);p.access_token?r(p.access_token):j(d)})});req.on('error',j);req.write(body);req.end(); });
}

function httpGet(url,token) {
  return new Promise((r,j)=>{const u=new URL(url);const req=https.request({hostname:u.hostname,path:u.pathname+u.search,method:'GET',headers:{'Authorization':'Bearer '+token}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>r(JSON.parse(d)))});req.on('error',j);req.end()});
}

function pv(v){if(!v)return null;if(v.stringValue!==undefined)return v.stringValue;if(v.integerValue!==undefined)return parseInt(v.integerValue);if(v.timestampValue)return v.timestampValue;return JSON.stringify(v);}

async function main() {
  const token = await getAccessToken();
  const res = await httpGet(`${BASE}/turnos?pageSize=300`, token);
  const docs = res.documents || [];
  
  const julioUid = 'hKFwXDoo6AQWQJq0AtzxZxaqaaX2';
  const williamsUid = 'ozuEAboiqOUByG8CyimLDMAZwzh1';
  
  console.log('Turnos ABIERTOS de Julio y Williams:\n');
  for (const doc of docs) {
    const f = doc.fields || {};
    const uid = pv(f.conductor_uid);
    const estado = pv(f.estado);
    
    if ((uid === julioUid || uid === williamsUid) && estado === 'abierto') {
      const id = doc.name.split('/').pop();
      console.log(`ID: ${id}`);
      console.log(`  conductor_uid: ${uid}`);
      console.log(`  conductor_email: ${pv(f.conductor_email)}`);
      console.log(`  patente: ${pv(f.patente)}`);
      console.log(`  estado: ${estado}`);
      console.log(`  fecha: ${pv(f.fecha)}`);
      console.log(`  fecha_inicio: ${pv(f.fecha_inicio)}`);
      console.log(`  km_inicial: ${pv(f.km_inicial) || pv(f.km_inicial_actual)}`);
      console.log(`  km_final: ${pv(f.km_final)}`);
      console.log('');
    }
  }
}
main().catch(e=>console.error(e));
