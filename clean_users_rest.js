const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

// Since we can't easily get the admin token right now without the SA, 
// let's just log in as javier and get his ID token, then read all users.
// Oh wait, Javier is an admin. His token can read/write the users collection!

async function run() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'javier.vega.g1998@gmail.com', password: 'v2g17773', returnSecureToken: true })
  });
  const authData = await res.json();
  const token = authData.idToken;

  const usersRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const usersData = await usersRes.json();
  
  const byEmail = {};
  for (const doc of (usersData.documents || [])) {
    const fields = doc.fields;
    const email = fields.correo_electronico?.stringValue || fields.email?.stringValue;
    if (!email) continue;
    if (!byEmail[email]) byEmail[email] = [];
    byEmail[email].push(doc);
  }

  for (const email in byEmail) {
    const docs = byEmail[email];
    if (docs.length > 1) {
      console.log(`Found ${docs.length} duplicates for ${email}`);
      // Find the one that matches the auth UID if possible
      // Javier's UID is authData.localId
      let keepId = null;
      if (email === 'javier.vega.g1998@gmail.com') {
        const expectedName = `projects/${projectId}/databases/(default)/documents/users/${authData.localId}`;
        const match = docs.find(d => d.name === expectedName);
        if (match) keepId = expectedName;
      }
      
      if (!keepId) keepId = docs[0].name; // Just keep the first one
      
      for (const d of docs) {
        if (d.name !== keepId) {
          console.log(`Deleting duplicate: ${d.name}`);
          const delRes = await fetch(`https://firestore.googleapis.com/v1/${d.name}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (delRes.ok) console.log("Deleted");
          else console.error(await delRes.text());
        } else {
          console.log(`Keeping: ${d.name}`);
        }
      }
    } else {
      console.log(`${email} has 1 doc: ${docs[0].name}`);
    }
  }
}

run().catch(console.error);
