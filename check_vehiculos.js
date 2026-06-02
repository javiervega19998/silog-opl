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
  
  if (vRes.status === 404) {
    console.log("No vehiculos collection found (0 vehicles)");
    return;
  }
  
  const vData = await vRes.json();
  const docs = vData.documents || [];
  console.log(`Vehicles in DB: ${docs.length}`);
  docs.forEach(d => {
    const p = d.fields.patente?.stringValue;
    const e = d.fields.estado?.stringValue;
    const c = d.fields.conductor?.stringValue;
    console.log(`- Patente: ${p}, Estado: ${e}, Conductor: ${c}`);
  });
}

run().catch(console.error);
