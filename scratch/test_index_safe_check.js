// Let's use REST fetch instead!
const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

async function run() {
  console.log("=== DRY-RUN OF NEW INDEX-SAFE QUERY ===");

  // Sign in as Admin to get token
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'javier.vega.g1998@gmail.com', password: 'v2g17773', returnSecureToken: true })
  });
  const authData = await authRes.json();
  const token = authData.idToken;

  const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

  const userEmail = "juliocmartinezt21@gmail.com";
  const patente = "KZGZ57";
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isoString = today.toISOString();

  console.log(`Querying checklists for operator: ${userEmail}, date >= ${isoString}`);

  // Simulating the optimized query: operador == userEmail AND fecha_chequeo >= ts
  const checklistQuery = {
    structuredQuery: {
      from: [{ collectionId: "chequeo_operacional" }],
      where: {
        compositeFilter: {
          op: "AND",
          filters: [
            { fieldFilter: { field: { fieldPath: "operador" }, op: "EQUAL", value: { stringValue: userEmail } } },
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
  
  if (checklistData.error) {
    console.error("❌ Optimized query failed:", checklistData.error);
    return;
  }

  console.log(`✅ Query returned ${checklistData.length} records without any error!`);

  // Filtering in memory like in our modified code
  const filtered = checklistData.filter(item => {
    if (!item.document) return false;
    const fields = item.document.fields;
    const pat = fields.patente_chequeo ? fields.patente_chequeo.stringValue : '';
    return pat.toUpperCase() === patente.toUpperCase();
  });

  console.log(`Filtered size: ${filtered.length}`);
  if (filtered.length > 0) {
    console.log("✅ Conductor has a valid checklist for today! Shift initiation WILL proceed.");
    filtered.forEach(item => {
      const fields = item.document.fields;
      console.log(`  - Doc ID: ${item.document.name.substring(item.document.name.lastIndexOf('/') + 1)}`);
      console.log(`    fecha_chequeo: ${fields.fecha_chequeo.timestampValue}`);
      console.log(`    patente_chequeo: ${fields.patente_chequeo.stringValue}`);
    });
  } else {
    console.log("❌ No checklist matches. Shift initiation will be blocked.");
  }
}

run().catch(console.error);
