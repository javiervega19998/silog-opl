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

  const vRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/vehiculos`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const vData = await vRes.json();
  console.log(JSON.stringify(vData, null, 2));
}

run().catch(console.error);
