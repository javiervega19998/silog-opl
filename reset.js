const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";
const projectId = "silog-opl-681dc";

async function createUserAuth(email, password) {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, returnSecureToken: true })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(JSON.stringify(data));
  return { uid: data.localId, token: data.idToken };
}

async function createFirestoreDoc(collection, docId, fields, token) {
  const res = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({ fields })
  });
  if (!res.ok) {
    const d = await res.json();
    throw new Error(JSON.stringify(d));
  }
}

async function run() {
  try {
    console.log("Creando Javier (Admin)...");
    const admin = await createUserAuth('javier.vega.g1998@gmail.com', 'v2g17773');
    await createFirestoreDoc('users', admin.uid, {
      nombre: { stringValue: 'Javier' },
      apellido: { stringValue: 'Vega' },
      rut: { stringValue: '20.011.818-9' },
      correo_electronico: { stringValue: 'javier.vega.g1998@gmail.com' },
      rol: { stringValue: 'admin' },
      estado: { stringValue: 'Activo' },
      area: { stringValue: 'Administracion' }
    }, admin.token);
    console.log(`Javier creado con UID: ${admin.uid}`);

    console.log("Creando Williams (Admin/Cond)...");
    const williams = await createUserAuth('administracion@silogspa.cl', 'v2g17773');
    await createFirestoreDoc('users', williams.uid, {
      nombre: { stringValue: 'Williams' },
      apellido: { stringValue: 'Vega' },
      rut: { stringValue: '10.777.717-2' },
      correo_electronico: { stringValue: 'administracion@silogspa.cl' },
      rol: { stringValue: 'administrativo.conductor' },
      estado: { stringValue: 'Activo' },
      area: { stringValue: 'Administracion' }
    }, williams.token); // Williams can write his own doc because he is authenticated!
    // Wait, the rules say `allow create: if isAuth() && (isAdmin() || request.auth.uid == uid);`
    // Since Williams is `request.auth.uid == uid`, he can create his own document!
    console.log(`Williams creado con UID: ${williams.uid}`);

    console.log("RESET FINALIZADO CON EXITO");
  } catch (e) {
    console.error("ERROR:", e);
  }
}

run();
