const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

async function run() {
  console.log("=== CHECKING ADMIN USER IN FIRESTORE ===");

  // Sign in as Admin to get token
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'javier.vega.g1998@gmail.com', password: 'v2g17773', returnSecureToken: true })
  });
  const authData = await authRes.json();
  const token = authData.idToken;

  const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;
  
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: "users" }],
      where: {
        fieldFilter: { field: { fieldPath: "correo_electronico" }, op: "EQUAL", value: { stringValue: "javier.vega.g1998@gmail.com" } }
      },
      limit: 1
    }
  };

  const res = await fetch(queryUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(queryBody)
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run().catch(console.error);
