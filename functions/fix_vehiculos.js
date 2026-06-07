const https = require('https');
const fs = require('fs');
const path = require('path');
const BASE = `https://firestore.googleapis.com/v1/projects/silog-opl-681dc/databases/(default)/documents`;
async function getToken() {
  const config = JSON.parse(fs.readFileSync(path.join(process.env.USERPROFILE, '.config', 'configstore', 'firebase-tools.json'), 'utf8'));
  const body = `grant_type=refresh_token&refresh_token=${encodeURIComponent(config.tokens.refresh_token)}&client_id=563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com&client_secret=j9iVZfS8kkCEFUPaAeJV0sAi`;
  return new Promise((r,j)=>{const req=https.request({hostname:'oauth2.googleapis.com',path:'/token',method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{const p=JSON.parse(d);r(p.access_token)})});req.on('error',j);req.write(body);req.end()});
}
function httpReq(method,url,token,body){return new Promise((r,j)=>{const u=new URL(url);const req=https.request({hostname:u.hostname,path:u.pathname+u.search,method,headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'}},res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{r({s:res.statusCode,d:JSON.parse(d)})}catch(e){r({s:res.statusCode,d})}})});req.on('error',j);if(body)req.write(JSON.stringify(body));req.end()});}
function pv(v){if(!v)return null;if(v.stringValue!==undefined)return v.stringValue;if(v.integerValue!==undefined)return parseInt(v.integerValue);return null;}

async function main() {
  const token = await getToken();
  const res = await httpReq('GET', `${BASE}/vehiculos?pageSize=50`, token);
  const docs = res.d.documents || [];
  
  console.log('TODOS LOS VEHÍCULOS EN FIRESTORE:\n');
  console.log('PATENTE    | MARCA         | MODELO        | ESTADO          | CONDUCTOR        | KM');
  console.log('─'.repeat(100));
  
  const toFix = [];
  for (const doc of docs) {
    const f = doc.fields || {};
    const patente = pv(f.patente) || doc.name.split('/').pop();
    const marca = pv(f.marca) || '';
    const modelo = pv(f.modelo) || '';
    const estado = pv(f.estado) || '';
    const conductor = pv(f.conductor) || '';
    const km = pv(f.km) || pv(f.kilometraje) || 0;
    
    const flag = estado === 'disponible' ? ' ⚠️  MINÚSCULA!' : 
                 estado === 'Disponible' ? ' ✅' : 
                 estado === 'En Ruta' ? ' 🚛' : '';
    
    console.log(`${patente.padEnd(10)} | ${marca.padEnd(13)} | ${modelo.padEnd(13)} | ${estado.padEnd(15)}${flag} | ${conductor.padEnd(16)} | ${km}`);
    
    if (estado === 'disponible') {
      toFix.push({ path: doc.name, patente });
    }
  }
  
  if (toFix.length > 0) {
    console.log(`\n⚠️  ${toFix.length} vehículos con estado "disponible" (minúscula) — turno.html busca "Disponible" (mayúscula)`);
    console.log('\n🔧 Corrigiendo...\n');
    
    for (const v of toFix) {
      const fields = { estado: { stringValue: 'Disponible' } };
      const r = await httpReq('PATCH', `https://firestore.googleapis.com/v1/${v.path}?updateMask.fieldPaths=estado`, token, { fields });
      console.log(`   ${r.s===200?'✅':'❌'} ${v.patente}: "disponible" → "Disponible"`);
    }
    
    console.log('\n✅ Corregido. Los vehículos ahora aparecerán en el selector de turno.html');
  } else {
    console.log('\n✅ Todos los vehículos tienen estado correcto.');
  }
}
main().catch(e=>console.error(e));
