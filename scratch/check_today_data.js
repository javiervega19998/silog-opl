const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

async function fetchCollection(token, collectionId) {
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId }]
    }
  };
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(queryBody)
  });
  const data = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map(d => {
    const docFields = d.document?.fields;
    if (!docFields) return null;
    const obj = { id: d.document.name.split('/').pop() };
    for (const [k, v] of Object.entries(docFields)) {
      obj[k] = fromRESTValue(v);
    }
    return obj;
  }).filter(Boolean);
}

function fromRESTValue(val) {
  if (!val) return null;
  if ('stringValue' in val) return val.stringValue;
  if ('integerValue' in val) return parseInt(val.integerValue);
  if ('doubleValue' in val) return parseFloat(val.doubleValue);
  if ('booleanValue' in val) return val.booleanValue;
  if ('timestampValue' in val) return val.timestampValue;
  if ('arrayValue' in val) {
    const arr = val.arrayValue.values || [];
    return arr.map(x => fromRESTValue(x));
  }
  if ('mapValue' in val) {
    const obj = {};
    const fields = val.mapValue.fields || {};
    for (const [k, v] of Object.entries(fields)) {
      obj[k] = fromRESTValue(v);
    }
    return obj;
  }
  return null;
}

async function run() {
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'javier.vega.g1998@gmail.com', password: 'v2g17773', returnSecureToken: true })
  });
  const authData = await authRes.json();
  const token = authData.idToken;

  console.log("=== LEGACY VIAJES COLLECTION ===");
  const legacyViajes = await fetchCollection(token, "viajes");
  legacyViajes.forEach(v => {
    console.log(`ID: ${v.id} | ViajeID: ${v.id_viaje} | Conductor: ${v.nombre_conductor_viaje || v.correo_conductor} | Dist: ${v.nombre_distribuidor || v.distribuidor} | Clientes: ${JSON.stringify(v.clientes_despacho)}`);
  });
}

run().catch(console.error);
