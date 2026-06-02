const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

async function run() {
  console.log("=== DIAGNOSING JULIO SHIFT INITIATION (REST) ===");

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

  const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

  // 1. Get Julio's user doc
  const userEmail = "juliocmartinezt21@gmail.com";
  console.log(`\n1. Fetching user document for ${userEmail}:`);
  const userQuery = {
    structuredQuery: {
      from: [{ collectionId: "users" }],
      where: {
        fieldFilter: { field: { fieldPath: "correo_electronico" }, op: "EQUAL", value: { stringValue: userEmail } }
      },
      limit: 1
    }
  };
  const userRes = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(userQuery)
  });
  const userData = await userRes.json();
  console.log("User Data:", JSON.stringify(userData, null, 2));

  // 2. Fetch vehicle KZGZ57
  const patente = "KZGZ57";
  console.log(`\n2. Fetching vehicle document for ${patente}:`);
  const vehQuery = {
    structuredQuery: {
      from: [{ collectionId: "vehiculos" }],
      where: {
        fieldFilter: { field: { fieldPath: "patente" }, op: "EQUAL", value: { stringValue: patente.toUpperCase() } }
      },
      limit: 1
    }
  };
  const vehRes = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(vehQuery)
  });
  const vehData = await vehRes.json();
  console.log("Vehicle Data:", JSON.stringify(vehData, null, 2));

  // 3. Simulate checklist query in iniciarTurno()
  console.log("\n3. Simulating checklist query in iniciarTurno():");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoString = today.toISOString();
  console.log(`Querying checklists for operator: ${userEmail}, patente: ${patente}, date >= ${isoString}`);

  const checklistQuery = {
    structuredQuery: {
      from: [{ collectionId: "chequeo_operacional" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "operador" }, op: "EQUAL", value: { stringValue: userEmail } } },
            { fieldFilter: { field: { fieldPath: "patente_chequeo" }, op: "EQUAL", value: { stringValue: patente.toUpperCase() } } },
            { fieldFilter: { field: { fieldPath: "fecha_chequeo" }, op: "GREATER_THAN_OR_EQUAL", value: { timestampValue: isoString } } }
          ]
        }
      }
    }
  };
  const checklistRes = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(checklistQuery)
  });
  const checklistData = await checklistRes.json();
  console.log("Checklist Query Results:", JSON.stringify(checklistData, null, 2));

  // 4. Simulate active turn check
  console.log("\n4. Simulating active turn check for Julio:");
  let julioUid = "hKFwXDoo6AQWQJq0AtzxZxaqaaX2";
  if (userData && userData[0] && userData[0].document) {
    const docPath = userData[0].document.name;
    julioUid = docPath.substring(docPath.lastIndexOf('/') + 1);
  }
  console.log(`Julio UID used: ${julioUid}`);
  const turnQuery = {
    structuredQuery: {
      from: [{ collectionId: "turnos" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "conductor_uid" }, op: "EQUAL", value: { stringValue: julioUid } } },
            { fieldFilter: { field: { fieldPath: "estado" }, op: "EQUAL", value: { stringValue: "abierto" } } }
          ]
        }
      }
    }
  };
  const turnRes = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(turnQuery)
  });
  const turnData = await turnRes.json();
  console.log("Active Turn Query Results:", JSON.stringify(turnData, null, 2));
}

run().catch(console.error);
