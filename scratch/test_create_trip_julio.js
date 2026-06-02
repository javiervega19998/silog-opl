const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

async function run() {
  console.log("=== SIMULATING CREATE TRIP FOR JULIO (BATCH WRITE) ===");

  // Sign in as Admin to get token
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'javier.vega.g1998@gmail.com', password: 'v2g17773', returnSecureToken: true })
  });
  const authData = await authRes.json();
  const token = authData.idToken;

  if (!token) {
    console.error("Auth failed:", authData);
    return;
  }

  // We will perform a commit call using firestore REST API.
  // A commit is a POST to: https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents:commit
  // It takes an array of writes (e.g. update, delete, transform).
  
  const commitUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:commit`;
  
  const tripId = "test_trip_julio_" + Date.now();
  const dispatchId = "test_disp_julio_" + Date.now();
  
  const writeBody = {
    writes: [
      // 1. Create Hoja de Ruta
      {
        update: {
          name: `projects/${projectId}/databases/(default)/documents/hojas_ruta/${tripId}`,
          fields: {
            turno_id: { stringValue: tripId },
            id_viaje: { stringValue: "01062026" },
            conductor_uid: { stringValue: "hKFwXDoo6AQWQJq0AtzxZxaqaaX2" }, // Julio's UID
            conductor_email: { stringValue: "juliocmartinezt21@gmail.com" }, // Julio's email
            conductor_nombre: { stringValue: "Julio Martinez" },
            distribuidor: { stringValue: "CINTEC" },
            nombre_distribuidor: { stringValue: "CINTEC" },
            patente: { stringValue: "KZGZ57" },
            fecha: { stringValue: "2026-06-01" },
            fecha_despacho: { stringValue: "2026-06-01" },
            km_inicial: { integerValue: "161763" },
            km_final: { integerValue: "161800" },
            km_final_viaje: { integerValue: "161800" },
            km_recorridos: { integerValue: "37" },
            total_entregas: { integerValue: 1 },
            total_devoluciones: { integerValue: 0 },
            estado: { stringValue: "pendiente" },
            estado_viaje: { stringValue: "Conforme" },
            created_at: { timestampValue: new Date().toISOString() }
          }
        }
      },
      // 2. Create Despacho
      {
        update: {
          name: `projects/${projectId}/databases/(default)/documents/despachos/${dispatchId}`,
          fields: {
            turno_id: { stringValue: tripId },
            cliente_nombre: { stringValue: "Cliente Prueba" },
            cliente_direccion: { stringValue: "Ruta 5" },
            cliente_comuna: { stringValue: "Puerto Varas" },
            guia_numero: { stringValue: "GD-TEST-1" },
            n_documento: { stringValue: "GD-TEST-1" },
            referencia: { stringValue: "GD-TEST-1" },
            distribuidor: { stringValue: "CINTEC" },
            nombre_distribuidor: { stringValue: "CINTEC" },
            estado: { stringValue: "entregado" },
            devolucion_motivo: { stringValue: "" },
            fecha: { timestampValue: "2026-06-01T12:00:00Z" },
            pod_timestamp: { timestampValue: new Date().toISOString() },
            conductor_uid: { stringValue: "hKFwXDoo6AQWQJq0AtzxZxaqaaX2" }, // Julio's UID
            conductor_email: { stringValue: "juliocmartinezt21@gmail.com" }, // Julio's email
            conductor_nombre: { stringValue: "Julio Martinez" },
            patente: { stringValue: "KZGZ57" }
          }
        }
      }
    ]
  };

  console.log("Sending commit transaction...");
  const res = await fetch(commitUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(writeBody)
  });

  const resData = await res.json();
  console.log("REST Response:", JSON.stringify(resData, null, 2));

  if (resData.error) {
    console.error("❌ Transaction FAILED:", resData.error.message);
  } else {
    console.log("✅ Transaction SUCCESSFUL! All writes committed.");
    
    // Clean up
    console.log("\nCleaning up test documents...");
    const cleanupBody = {
      writes: [
        { delete: `projects/${projectId}/databases/(default)/documents/hojas_ruta/${tripId}` },
        { delete: `projects/${projectId}/databases/(default)/documents/despachos/${dispatchId}` }
      ]
    };
    await fetch(commitUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify(cleanupBody)
    });
    console.log("Test documents deleted successfully.");
  }
}

run().catch(console.error);
