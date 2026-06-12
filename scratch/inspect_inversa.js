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
  if(v.doubleValue!==undefined) return parseFloat(v.doubleValue);
  if(v.booleanValue!==undefined) return v.booleanValue;
  return null;
}

async function main() {
  const token = await getToken();
  
  console.log('Querying logistica_inversa documents...');
  const res = await httpReq('GET', `${BASE}/logistica_inversa?pageSize=300`, token);
  const docs = res.d.documents || [];
  
  console.log(`Found ${docs.length} documents in logistica_inversa.`);
  
  const mermas = [];
  const others = [];
  
  for (const doc of docs) {
    const f = doc.fields || {};
    const id = doc.name.split('/').pop();
    const cliente = pv(f.cliente);
    const conductor = pv(f.conductor_nombre) || pv(f.conductor_email);
    const producto_codigo = pv(f.producto_codigo);
    const producto_nombre = pv(f.producto_nombre);
    const cantidad = pv(f.cantidad) || 0;
    const estado = pv(f.estado);
    const clasificacion = pv(f.clasificacion);
    
    const item = { id, cliente, conductor, producto_codigo, producto_nombre, cantidad, estado, clasificacion };
    if (clasificacion === 'merma') {
      mermas.push(item);
    } else {
      others.push(item);
    }
  }
  
  console.log('\nCLASSIFIED AS MERMA:');
  console.log('ID | CODE | PRODUCTO | CANT | ESTADO | CLASIFICACION | CLIENTE');
  console.log('-'.repeat(100));
  mermas.forEach(m => {
    console.log(`${m.id} | ${m.producto_codigo} | ${m.producto_nombre} | ${m.cantidad} | ${m.estado} | ${m.clasificacion} | ${m.cliente}`);
  });
  
  console.log('\nOTHERS IN LOGISTICA INVERSA (Not Merma):');
  console.log('ID | CODE | PRODUCTO | CANT | ESTADO | CLASIFICACION | CLIENTE');
  console.log('-'.repeat(100));
  others.forEach(m => {
    console.log(`${m.id} | ${m.producto_codigo} | ${m.producto_nombre} | ${m.cantidad} | ${m.estado} | ${m.clasificacion} | ${m.cliente}`);
  });
}

main().catch(e => console.error(e));
