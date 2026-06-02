const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

// Check if `--commit` is in command-line arguments
const commit = process.argv.includes('--commit');

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

function toRESTValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string') return { stringValue: val };
  if (typeof val === 'number') {
    if (Number.isInteger(val)) return { integerValue: String(val) };
    return { doubleValue: val };
  }
  if (typeof val === 'boolean') return { booleanValue: val };
  if (Array.isArray(val)) {
    return {
      arrayValue: {
        values: val.map(x => toRESTValue(x))
      }
    };
  }
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) {
      fields[k] = toRESTValue(v);
    }
    return {
      mapValue: {
        fields
      }
    };
  }
  return { nullValue: null };
}

async function fetchDespachosForTurno(token, turnoId) {
  if (!turnoId) return [];
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: "despachos" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "turno_id" },
          op: "EQUAL",
          value: { stringValue: turnoId }
        }
      }
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
    const obj = {};
    for (const [k, v] of Object.entries(docFields)) {
      obj[k] = fromRESTValue(v);
    }
    return obj;
  }).filter(Boolean);
}

async function run() {
  console.log(`Starting waybill (hojas_ruta) client name repair migration...`);
  console.log(`Mode: ${commit ? '🚨 COMMIT (Applying changes to Firestore)' : '🔍 DRY RUN (Simulated)'}\n`);

  // 1. Authenticate
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'javier.vega.g1998@gmail.com', password: 'v2g17773', returnSecureToken: true })
  });
  if (!authRes.ok) {
    throw new Error(`Authentication failed: ${await authRes.text()}`);
  }
  const authData = await authRes.json();
  const token = authData.idToken;
  console.log(`✓ Authenticated successfully.`);

  // 2. Fetch all hojas_ruta
  console.log(`Fetching waybill documents from hojas_ruta...`);
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: "hojas_ruta" }]
    }
  };
  const hrRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(queryBody)
  });
  if (!hrRes.ok) {
    throw new Error(`Failed to fetch waybills: ${await hrRes.text()}`);
  }
  const hrData = await hrRes.json();
  if (!Array.isArray(hrData) || hrData.length === 0) {
    console.log(`No waybills found in hojas_ruta collection.`);
    return;
  }
  console.log(`✓ Found ${hrData.length} documents in hojas_ruta. Checking for corrupted delivery records...\n`);

  let totalChecked = 0;
  let totalRepaired = 0;

  for (const docObj of hrData) {
    const doc = docObj.document;
    if (!doc) continue;

    const docName = doc.name;
    const docId = docName.split('/').pop();
    const fields = doc.fields;
    if (!fields) continue;

    totalChecked++;

    const turnoId = fields.turno_id ? fields.turno_id.stringValue : '';
    const entregas = fields.entregas ? fromRESTValue(fields.entregas) : [];

    if (entregas.length === 0) {
      continue;
    }

    // Check if the waybill has any entries where name and address are identical (corrupted)
    // or if we should verify them against dispatches
    const needsCheck = entregas.some(e => e.cliente === e.direccion && e.cliente);
    if (!needsCheck) {
      continue;
    }

    console.log(`Document [${docId}] (Turno: ${turnoId}) requires verification:`);

    // Fetch despachos for this turno to restore exact values
    const despachos = await fetchDespachosForTurno(token, turnoId);
    if (despachos.length === 0) {
      console.log(`  ⚠ No dispatches found for Turno ID: ${turnoId}. Cannot verify.`);
      continue;
    }

    const despMap = {};
    despachos.forEach(d => {
      const docNum = String(d.guia_numero || d.factura_numero || '').trim().toUpperCase();
      if (docNum) {
        despMap[docNum] = d;
      }
    });

    let hasChanges = false;
    const repairedEntregas = entregas.map(e => {
      const docNum = String(e.documento || '').trim().toUpperCase();
      const match = despMap[docNum];
      if (match) {
        const trueClient = match.cliente_nombre || '';
        const trueAddress = match.cliente_direccion || '';
        if (trueClient && (e.cliente !== trueClient || e.direccion !== trueAddress)) {
          console.log(`    [RESTORE] Entry #${e.correlativo} (${e.documento}):`);
          console.log(`      Cliente:   "${e.cliente}" -> "${trueClient}"`);
          console.log(`      Direccion: "${e.direccion}" -> "${trueAddress}"`);
          e.cliente = trueClient;
          e.direccion = trueAddress;
          hasChanges = true;
        }
      }
      return e;
    });

    if (hasChanges) {
      totalRepaired++;
      if (commit) {
        const patchUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/hojas_ruta/${docId}?updateMask.fieldPaths=entregas`;
        const patchBody = {
          fields: {
            entregas: toRESTValue(repairedEntregas)
          }
        };
        const patchRes = await fetch(patchUrl, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(patchBody)
        });
        if (patchRes.ok) {
          console.log(`    ✓ Document [${docId}] successfully updated in Firestore.\n`);
        } else {
          console.error(`    ✗ Failed to update document [${docId}]:`, await patchRes.text(), '\n');
        }
      } else {
        console.log(`    [DRY RUN] Document [${docId}] would be updated.\n`);
      }
    } else {
      console.log(`  ✓ Document [${docId}] verified. No mismatched records found.\n`);
    }
  }

  console.log(`=========================================`);
  console.log(`Repair Migration Completed.`);
  console.log(`Total waybills checked: ${totalChecked}`);
  console.log(`Total waybills needing repair: ${totalRepaired}`);
  if (!commit && totalRepaired > 0) {
    console.log(`🚨 Re-run this script with the --commit flag to save the changes to Firestore.`);
  }
}

run().catch(console.error);
