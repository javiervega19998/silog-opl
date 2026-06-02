const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

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

async function run() {
  console.log("Authenticating...");
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'javier.vega.g1998@gmail.com', password: 'v2g17773', returnSecureToken: true })
  });
  const authData = await authRes.json();
  const token = authData.idToken;

  console.log("Fetching Rossana's legacy trip...");
  const docId = "5jFeymP3bXkJkzKldrrB";
  const getUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/viajes/${docId}`;
  const getRes = await fetch(getUrl, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!getRes.ok) {
    throw new Error(`Failed to fetch legacy trip: ${await getRes.text()}`);
  }
  const doc = await getRes.json();
  console.log("✓ Loaded legacy trip:", JSON.stringify(doc.fields));

  const tripId = "manual_27052026_rossana";

  // Build Hojas de Ruta Document
  const hrFields = {
    turno_id: { stringValue: tripId },
    id_viaje: doc.fields.id_viaje,
    conductor_uid: { stringValue: "migrated" },
    conductor_email: doc.fields.correo_conductor || { stringValue: "rossana@silog.cl" },
    conductor_nombre: doc.fields.nombre_conductor_viaje || { stringValue: "Rossana García" },
    distribuidor: doc.fields.nombre_distribuidor || { stringValue: "TOTALENERGIES" },
    nombre_distribuidor: doc.fields.nombre_distribuidor || { stringValue: "TOTALENERGIES" },
    patente: doc.fields.patente,
    fecha: { stringValue: "2026-05-27" },
    fecha_despacho: { stringValue: "2026-05-27" },
    km_inicial: doc.fields.km_inicial,
    km_final: doc.fields.km_final_viaje,
    km_final_viaje: doc.fields.km_final_viaje,
    km_recorridos: { integerValue: "100" }, // standard estimate
    total_entregas: { integerValue: "1" },
    total_devoluciones: { integerValue: "0" },
    clientes_despacho: doc.fields.clientes_despacho,
    carga_combustible_viaje: doc.fields.carga_combustible_viaje,
    monto_combustible: doc.fields.monto_combustible,
    litros_combustible: doc.fields.litros_combustible,
    factura_combustible: doc.fields.factura_combustible,
    foto_combustible_url: doc.fields.foto_combustible_url || { stringValue: "" },
    detalle_devoluciones: doc.fields.detalle_devoluciones || { stringValue: "Sin Observaciones" },
    estado: { stringValue: "revisada" },
    estado_viaje: { stringValue: "Conforme" },
    created_at: { timestampValue: new Date().toISOString() },
    entregas: toRESTValue([
      {
        correlativo: 1,
        documento: "GD Nº 245825",
        cliente: "Comercial Serpan",
        direccion: "",
        comuna: "",
        observaciones: "",
        estado: "entregado"
      }
    ])
  };

  // 1. Create Hoja de Ruta
  console.log("Creating Hoja de Ruta...");
  const hrUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/hojas_ruta/${tripId}`;
  const hrRes = await fetch(hrUrl, {
    method: 'PATCH',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: hrFields })
  });
  if (!hrRes.ok) {
    throw new Error(`Failed to create hojas_ruta doc: ${await hrRes.text()}`);
  }
  console.log("✓ Created Hoja de Ruta.");

  // 2. Create Despacho
  console.log("Creating Despacho...");
  const dFields = {
    turno_id: { stringValue: tripId },
    cliente_nombre: { stringValue: "Comercial Serpan" },
    cliente_direccion: { stringValue: "" },
    cliente_comuna: { stringValue: "" },
    guia_numero: { stringValue: "GD Nº 245825" },
    n_documento: { stringValue: "GD Nº 245825" },
    referencia: { stringValue: "GD Nº 245825" },
    distribuidor: { stringValue: "TOTALENERGIES" },
    nombre_distribuidor: { stringValue: "TOTALENERGIES" },
    estado: { stringValue: "entregado" },
    devolucion_motivo: { stringValue: "" },
    fecha: { timestampValue: new Date("2026-05-27T12:00:00Z").toISOString() },
    pod_timestamp: { timestampValue: new Date().toISOString() }
  };

  const dUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/despachos`;
  const dRes = await fetch(dUrl, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: dFields })
  });
  if (!dRes.ok) {
    throw new Error(`Failed to create despacho doc: ${await dRes.text()}`);
  }
  console.log("✓ Created Despacho.");

  // 3. Delete from legacy voyages
  console.log("Deleting legacy trip...");
  const delRes = await fetch(getUrl, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!delRes.ok) {
    throw new Error(`Failed to delete legacy trip: ${await delRes.text()}`);
  }
  console.log("✓ Legacy trip deleted.");
  console.log("Migration completed successfully!");
}

run().catch(console.error);
