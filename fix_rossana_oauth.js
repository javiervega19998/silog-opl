
// fix_rossana_oauth.js
// Usa el refresh token de Firebase CLI para actualizar Firestore via REST API

const https = require('https');

const REFRESH_TOKEN   = '1//0hgxk7djRMg0lCgYIARAAGBESNwF-L9Irk5Q1dNcYW17MyDETvMU96OL5Vl2LFAT-nLGlKeuVTanilAmuc9bgiC5XU_FQQD_9nIE';
const CLIENT_ID       = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const CLIENT_SECRET   = 'j9iVZfS8kkCEFUPaAeJV0sAi';
const PROJECT_ID      = 'silog-opl-681dc';
const ROSSANA_UID     = 'OxeQSDVrPqhnMUKdg1eh5BD655H2';
const ROSSANA_EMAIL   = 'finanzas@silogspa.cl';

function httpsPost(hostname, path, data, headers) {
  return new Promise((resolve, reject) => {
    const body = typeof data === 'string' ? data : JSON.stringify(data);
    const opts = {
      hostname, path, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
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

function httpsPatch(hostname, path, data, headers) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const opts = {
      hostname, path, method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body), ...headers }
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
  // 1. Obtener access token con refresh token
  console.log('1. Obteniendo access token...');
  const tokenRes = await httpsPost('oauth2.googleapis.com', '/token', 
    `client_id=${CLIENT_ID}&client_secret=${CLIENT_SECRET}&refresh_token=${REFRESH_TOKEN}&grant_type=refresh_token`,
    { 'Content-Type': 'application/x-www-form-urlencoded' }
  );
  
  if (!tokenRes.body.access_token) {
    console.error('❌ Error obteniendo token:', JSON.stringify(tokenRes.body));
    process.exit(1);
  }
  const token = tokenRes.body.access_token;
  console.log('✅ Access token obtenido');

  const AUTH = { 'Authorization': `Bearer ${token}` };
  const fsBase = `firestore.googleapis.com`;
  const docPath = `/v1/projects/${PROJECT_ID}/databases/(default)/documents/users/${ROSSANA_UID}`;

  // 2. Verificar documento actual
  console.log('\n2. Verificando documento actual en Firestore...');
  const getRes = await httpsGet(fsBase, docPath, AUTH);
  console.log('   Status:', getRes.status);
  if (getRes.status === 200) {
    const fields = getRes.body.fields || {};
    console.log('   Rol actual:', fields.rol?.stringValue || fields.role?.stringValue || 'NO ENCONTRADO');
    console.log('   Area actual:', fields.area?.stringValue || 'NO ENCONTRADA');
  } else {
    console.log('   Documento NO existe aún.');
  }

  // 3. Crear/actualizar documento con datos correctos
  console.log('\n3. Actualizando documento en Firestore...');
  const patchBody = {
    fields: {
      correo_electronico: { stringValue: ROSSANA_EMAIL },
      email:              { stringValue: ROSSANA_EMAIL },
      nombre:             { stringValue: 'Rossana' },
      apellido:           { stringValue: '' },
      nombre_completo:    { stringValue: 'Rossana' },
      rol:                { stringValue: 'administrativo' },
      role:               { stringValue: 'administrativo' },
      area:               { stringValue: 'Administración & Finanzas' },
      estado:             { stringValue: 'Activo' },
      auth_uid:           { stringValue: ROSSANA_UID },
    }
  };

  const patchRes = await httpsPatch(fsBase, docPath, patchBody, AUTH);
  console.log('   Status PATCH:', patchRes.status);
  if (patchRes.status === 200) {
    console.log('✅ Documento actualizado correctamente');
    const fields = patchRes.body.fields || {};
    console.log('   Nuevo rol:', fields.rol?.stringValue);
    console.log('   Nueva area:', fields.area?.stringValue);
  } else {
    console.error('❌ Error actualizando:', JSON.stringify(patchRes.body));
  }

  // 4. Verificación final
  console.log('\n4. Verificación final...');
  const verifyRes = await httpsGet(fsBase, docPath, AUTH);
  if (verifyRes.status === 200) {
    const f = verifyRes.body.fields || {};
    console.log('✅ VERIFICADO:');
    console.log('   UID:', ROSSANA_UID);
    console.log('   Email:', f.correo_electronico?.stringValue);
    console.log('   Rol:', f.rol?.stringValue);
    console.log('   Area:', f.area?.stringValue);
    console.log('   Estado:', f.estado?.stringValue);
  }

  console.log('\n🎉 Listo! Rossana debe cerrar sesión y volver a entrar.');
}

main().catch(e => {
  console.error('❌ Error fatal:', e.message);
  process.exit(1);
});
