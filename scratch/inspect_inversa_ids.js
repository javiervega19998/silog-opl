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

function pv(v){
  if(!v) return null;
  if(v.stringValue!==undefined) return v.stringValue;
  if(v.integerValue!==undefined) return parseInt(v.integerValue);
  return null;
}

async function main() {
  const token = await getToken();
  
  const res = await httpReq('GET', `${BASE}/logistica_inversa?pageSize=300`, token);
  const docs = res.d.documents || [];
  
  console.log('ID | CODE | PRODUCT_ID (in doc) | NOM');
  console.log('-'.repeat(80));
  for (const doc of docs) {
    const f = doc.fields || {};
    const id = doc.name.split('/').pop();
    const code = pv(f.producto_codigo);
    const prodId = pv(f.producto_id) || pv(f.productoId);
    const nom = pv(f.producto_nombre);
    console.log(`${id} | ${code} | ${prodId} | ${nom}`);
  }
}

main().catch(e => console.error(e));
