const https = require('https');
const REFRESH_TOKEN   = '1//0hgxk7djRMg0lCgYIARAAGBESNwF-L9Irk5Q1dNcYW17MyDETvMU96OL5Vl2LFAT-nLGlKeuVTanilAmuc9bgiC5XU_FQQD_9nIE';
const CLIENT_ID       = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET   = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const PROJECT_ID      = 'silog-opl-681dc';

function httpsPost(hostname, path, data) {
  return new Promise((resolve) => {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const opts = { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body) } };
    const req = https.request(opts, res => { let r=''; res.on('data', c=>r+=c); res.on('end', ()=>resolve(JSON.parse(r))); });
    req.write(body); req.end();
  });
}
function httpsPostJson(hostname, path, data, headers) {
  return new Promise((resolve) => {
    const body = JSON.stringify(data);
    const opts = { hostname, path, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers } };
    const req = https.request(opts, res => { let r=''; res.on('data', c=>r+=c); res.on('end', ()=>resolve(JSON.parse(r))); });
    req.write(body); req.end();
  });
}

async function main() {
  const t = await httpsPost('oauth2.googleapis.com', '/token', client_id=&client_secret=&refresh_token=&grant_type=refresh_token);
  const token = t.access_token;
  
  const query = { structuredQuery: { from: [{collectionId: 'users'}], where: { fieldFilter: { field: {fieldPath: 'correo_electronico'}, op: 'EQUAL', value: {stringValue: 'finanzas@silogspa.cl'} } } } };
  const r = await httpsPostJson('firestore.googleapis.com', /v1/projects//databases/(default)/documents:runQuery, query, { Authorization: 'Bearer ' + token });
  console.log("correo_electronico query:");
  r.forEach(x => { if(x.document) console.log(x.document.name) });

  const query2 = { structuredQuery: { from: [{collectionId: 'users'}], where: { fieldFilter: { field: {fieldPath: 'email'}, op: 'EQUAL', value: {stringValue: 'finanzas@silogspa.cl'} } } } };
  const r2 = await httpsPostJson('firestore.googleapis.com', /v1/projects//databases/(default)/documents:runQuery, query2, { Authorization: 'Bearer ' + token });
  console.log("email query:");
  r2.forEach(x => { if(x.document) console.log(x.document.name) });
}
main();
