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
  
  // Simulate the browser logic:
  const _email = 'javier.vega.g1998@gmail.com';
  const vList = new Set();
  let assignedPatente = '';
  
  // In REST, we iterate over vData.documents
  vData.documents.forEach(d => {
    const v = {
      conductor: d.fields.conductor?.stringValue || '',
      patente: d.fields.patente?.stringValue || '',
      estado: d.fields.estado?.stringValue || ''
    };
    
    if(v.conductor === _email && v.patente) {
      assignedPatente = v.patente.toUpperCase();
      vList.add(assignedPatente);
    }
    if(v.estado === 'Disponible' || v.estado === 'Disponible ') {
      if(v.patente) vList.add(v.patente.toUpperCase());
    }
  });

  console.log("vList size:", vList.size);
  console.log("Elements:");
  vList.forEach(p => console.log(p));
}

run().catch(console.error);
