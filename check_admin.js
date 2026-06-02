const https = require('https');

const REFRESH_TOKEN   = '1//0hgxk7djRMg0lCgYIARAAGBESNwF-L9Irk5Q1dNcYW17MyDETvMU96OL5Vl2LFAT-nLGlKeuVTanilAmuc9bgiC5XU_FQQD_9nIE';
const CLIENT_ID       = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET   = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const PROJECT_ID      = 'silog-opl-681dc';
const ADMIN_UID       = 'RbbGgZJUFYeVdFKjvJYqx2kJFnr2'; // Javier's UID from the export

function httpsPost(hostname, path, data, headers) {
  return new Promise((resolve, reject) => {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const opts = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Content-Length': Buffer.byteLength(body), ...headers }
    };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function httpsGet(hostname, path, headers) {
  return new Promise((resolve, reject) => {
    const opts = { hostname, path, method: 'GET', headers };
    const req = https.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
        catch { resolve({ status: res.statusCode, body: raw }); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  const tokenRes = await httpsPost('oauth2.googleapis.com', '/token', 
    `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${REFRESH_TOKEN}&grant_type=refresh_token`,
    {}
  );
  const token = tokenRes.body.access_token;
  const AUTH = { 'Authorization': `Bearer ${token}` };
  
  const fsBase = `firestore.googleapis.com`;
  const docPath = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${ADMIN_UID}`;
  const getRes = await httpsGet(fsBase, docPath, AUTH);
  console.log("Admin Firestore data:", JSON.stringify(getRes.body, null, 2));
}

main().catch(console.error);
