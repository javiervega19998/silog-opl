const projectId = "silog-opl-681dc";
const apiKey = "AIzaSyBdgN8lrojCCuQ7XWvNngkwXE6BThdjqlU";

async function run() {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'javier.vega.g1998@gmail.com', password: 'v2g17773', returnSecureToken: true })
  });
  const authData = await res.json();
  if (!res.ok) throw new Error("Auth failed: " + JSON.stringify(authData));
  const token = authData.idToken;

  console.log("Authenticated. Buscando movimientos para GD N° 245825...");

  // Let's query by string value in reference
  // FireStore doesn't do "includes", we must fetch all and filter or query directly if exact
  // We will query where tipo == "salida" and filter locally just to be safe.
  
  const queryBody = {
    structuredQuery: {
      from: [{ collectionId: "movimientos_bodega" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "tipo" },
          op: "EQUAL",
          value: { stringValue: "salida" }
        }
      }
    }
  };

  const qRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(queryBody)
  });
  const qData = await qRes.json();

  if (!qRes.ok) {
    throw new Error("Query failed: " + JSON.stringify(qData));
  }

  const toRevert = [];

  for (const item of qData) {
    if (!item.document) continue;
    const doc = item.document;
    const ref = doc.fields.referencia?.stringValue || "";
    if (ref.includes("245825")) {
      const docName = doc.name;
      const parts = docName.split('/');
      const docId = parts[parts.length - 1];
      toRevert.push({
        id: docId,
        name: docName,
        producto_id: doc.fields.producto_id?.stringValue,
        cantidad: doc.fields.cantidad?.integerValue || 0
      });
    }
  }

  console.log(`Encontrados ${toRevert.length} movimientos de salida.`);
  
  // Also search for "despacho" just in case
  const queryBody2 = {
    structuredQuery: {
      from: [{ collectionId: "movimientos_bodega" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "tipo" },
          op: "EQUAL",
          value: { stringValue: "despacho" }
        }
      }
    }
  };

  const qRes2 = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(queryBody2)
  });
  const qData2 = await qRes2.json();

  if (qRes2.ok) {
    for (const item of qData2) {
      if (!item.document) continue;
      const doc = item.document;
      const ref = doc.fields.referencia?.stringValue || "";
      if (ref.includes("245825")) {
        const docName = doc.name;
        const parts = docName.split('/');
        const docId = parts[parts.length - 1];
        toRevert.push({
          id: docId,
          name: docName,
          producto_id: doc.fields.producto_id?.stringValue,
          cantidad: doc.fields.cantidad?.integerValue || 0
        });
      }
    }
  }

  console.log(`Total encontrados para 245825: ${toRevert.length}`);

  for (const mov of toRevert) {
    console.log(`Reverting movement ${mov.id}: prod=${mov.producto_id}, cant=${mov.cantidad}`);
    
    // 1. Update inventory
    if (mov.producto_id) {
      // Get current product
      const pRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${mov.producto_id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (pRes.ok) {
        const pData = await pRes.json();
        const currentQty = parseInt(pData.fields.qty?.integerValue || pData.fields.cantidad?.integerValue || 0);
        const addedQty = parseInt(mov.cantidad);
        const newQty = currentQty + addedQty;
        
        console.log(`Update product ${mov.producto_id}: ${currentQty} -> ${newQty}`);
        
        const updateBody = {
          fields: {
            ...pData.fields,
            qty: { integerValue: newQty },
            cantidad: { integerValue: newQty },
            status: { stringValue: newQty > 0 ? 'disponible' : 'no_disponible' }
          }
        };

        const uRes = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/inventory/${mov.producto_id}`, {
          method: 'PATCH',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(updateBody)
        });
        if (!uRes.ok) console.error("Failed to update inventory", await uRes.json());
      }
    }

    // 2. Delete movement
    const dRes = await fetch(`https://firestore.googleapis.com/v1/${mov.name}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (dRes.ok) {
      console.log(`Successfully deleted movement ${mov.id}`);
    } else {
      console.error(`Failed to delete movement ${mov.id}`);
    }
  }
  
  console.log("Done.");
}

run().catch(console.error);
