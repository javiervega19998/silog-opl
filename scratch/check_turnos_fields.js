const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

async function run() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'javier.vega.g1998@gmail.com', password: 'v2g17773', returnSecureToken: true })
  });
  const authData = await res.json();
  const token = authData.idToken;

  const tRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/turnos?pageSize=5`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const tData = await tRes.json();
  const docs = tData.documents || [];
  console.log(`Fetched ${docs.length} turnos:`);
  docs.forEach((d, idx) => {
    console.log(`\nTurno ${idx + 1} fields:`);
    console.log(JSON.stringify(d.fields, null, 2));
  });
}

run().catch(console.error);
