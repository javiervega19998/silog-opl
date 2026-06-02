const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

async function run() {
  console.log("=== GETTING RECENT NOTIFICATIONS AND DISCREPANCIES ===");
  const authRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'javier.vega.g1998@gmail.com', password: 'v2g17773', returnSecureToken: true })
  });
  const authData = await authRes.json();
  const token = authData.idToken;

  console.log("\n--- RECENT NOTIFICATIONS (LAST 3) ---");
  const notifUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/notificaciones?orderBy=fecha%20desc&pageSize=3`;
  const notifRes = await fetch(notifUrl, { headers: { 'Authorization': `Bearer ${token}` } });
  console.log(JSON.stringify(await notifRes.json(), null, 2));

  console.log("\n--- RECENT DISCREPANCIES (LAST 3) ---");
  const discUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/km_discrepancias?orderBy=fecha%20desc&pageSize=3`;
  const discRes = await fetch(discUrl, { headers: { 'Authorization': `Bearer ${token}` } });
  console.log(JSON.stringify(await discRes.json(), null, 2));
}

run().catch(console.error);
