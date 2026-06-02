const fs = require('fs');
const filePath = 'js/finanzas_script.js';

let content = fs.readFileSync(filePath, 'utf8');

// Identify exact start and end bounds
const targetStart = 'let _hojasRuta=[],_hojaActual=null;';
const targetEnd = 'function openHoja(id){';

const startIndex = content.indexOf(targetStart);
if (startIndex === -1) {
  console.error("Could not find start block");
  process.exit(1);
}

const endIndex = content.indexOf(targetEnd);
if (endIndex === -1) {
  console.error("Could not find targetEnd block");
  process.exit(1);
}

const replacement = `let _hojasRuta=[],_hojaActual=null;
async function loadHojasRuta(isMore = false){
  if(_loadingMoreHR) return;
  if(isMore && !_hasMoreHR) return;
  
  if(!isMore) {
    _lastHRDoc = null;
    _hasMoreHR = true;
    document.getElementById('hr-body').innerHTML = '<tr><td colspan="12" class="txt-c" style="color:var(--text2);padding:20px">Cargando…</td></tr>';
  } else {
    _loadingMoreHR = true;
    const loadBtn = document.getElementById('btn-load-more-hr');
    if(loadBtn) loadBtn.innerHTML = '<span class="spinner"></span> Cargando más...';
  }

  // Populate conductor filter from existing users
  const hrSel=document.getElementById('hr-conductor');
  if(hrSel.options.length<=1){
    try{const uSnap=await db.collection('users').get();
    uSnap.forEach(d=>{const u=d.data();if((u.rol||'').toLowerCase().includes('conductor')){const o=document.createElement('option');o.value=u.correo_electronico||u.email||'';o.textContent=u.nombre||u.name||'';hrSel.appendChild(o);}});}catch(e){}
  }
  try{
    let query=db.collection('hojas_ruta').orderBy('fecha','desc');
    const conductorF=document.getElementById('hr-conductor').value;
    const fechaF=document.getElementById('hr-fecha').value;
    if(conductorF)query=query.where('conductor_email','==',conductorF);
    if(fechaF)query=query.where('fecha','==',fechaF);
    
    if(isMore && _lastHRDoc) {
      query = query.startAfter(_lastHRDoc);
    }
    query = query.limit(10);
    
    const snap=await query.get();
    if(snap.empty) {
      _hasMoreHR = false;
      if(!isMore) {
        document.getElementById('hr-body').innerHTML = '<tr><td colspan="12" class="txt-c" style="color:var(--text2);padding:20px">Sin hojas de ruta</td></tr>';
      }
      updateLoadMoreBtnVisibility();
      return;
    }
    
    _lastHRDoc = snap.docs[snap.docs.length - 1];
    if(snap.size < 10) _hasMoreHR = false;
    
    let newDocs=[];
    snap.forEach(d=>newDocs.push({id:d.id,...d.data()}));
    await populateExpensesForHojasRuta(newDocs);
    
    // Client-side empresa filter
    const empF=(document.getElementById('hr-empresa').value||'').toLowerCase();
    if(empF) newDocs=newDocs.filter(h=>(h.entregas||[]).some(e=>(e.cliente||'').toLowerCase().includes(empF)));
    
    if(isMore) {
      _hojasRuta = _hojasRuta.concat(newDocs);
    } else {
      _hojasRuta = newDocs;
    }
  }catch(e){
    console.warn("Ordered native query failed, falling back to index-safe query:", e.message);
    try {
      let queryFallback=db.collection('hojas_ruta');
      const conductorF=document.getElementById('hr-conductor').value;
      const fechaF=document.getElementById('hr-fecha').value;
      if(conductorF)queryFallback=queryFallback.where('conductor_email','==',conductorF);
      if(fechaF)queryFallback=queryFallback.where('fecha','==',fechaF);
      
      if(isMore && _lastHRDoc) {
        queryFallback = queryFallback.startAfter(_lastHRDoc);
      }
      queryFallback = queryFallback.limit(10);
      
      const snap=await queryFallback.get();
      if(snap.empty) {
        _hasMoreHR = false;
        updateLoadMoreBtnVisibility();
        return;
      }
      _lastHRDoc = snap.docs[snap.docs.length - 1];
      if(snap.size < 10) _hasMoreHR = false;
      
      let newDocs=[];
      snap.forEach(d=>newDocs.push({id:d.id,...d.data()}));
      await populateExpensesForHojasRuta(newDocs);
      newDocs.sort((a,b)=>(b.fecha||'').localeCompare(a.fecha||''));
      
      if(isMore) {
        _hojasRuta = _hojasRuta.concat(newDocs);
      } else {
        _hojasRuta = newDocs;
      }
    } catch(err2) {
      document.getElementById('hr-body').innerHTML = \`<tr><td colspan="12" class="txt-c">Error: \${err2.message}</td></tr>\`;
    }
  } finally {
    _loadingMoreHR = false;
    const loadBtn = document.getElementById('btn-load-more-hr');
    if(loadBtn) loadBtn.innerHTML = '➕ Cargar más hojas de ruta';
    updateLoadMoreBtnVisibility();
  }
  renderHojasRuta();
}
function renderHojasRuta(){
  const body=document.getElementById('hr-body');
  if(!_hojasRuta.length){body.innerHTML='<tr><td colspan="12" class="txt-c" style="color:var(--text2);padding:20px">Sin hojas de ruta</td></tr>';return;}
  const estadoBadge={'pendiente_revision':'<span class="badge-sm b-borrador">🟡 Pendiente</span>','revisada':'<span class="badge-sm b-pagada">🟢 Revisada</span>','observada':'<span class="badge-sm b-enviada">🔴 Observada</span>'};
  body.innerHTML=_hojasRuta.map(h=>{
    const conductorFull = h.conductor_nombre || h.conductor_email || '—';
    const distribuidorFull = h.distribuidor || h.nombre_distribuidor || '—';
    return \`<tr>
      <td>\${sanitize(h.fecha||'—')}</td>
      <td>\${sanitize(conductorFull)}</td>
      <td>\${sanitize(distribuidorFull)}</td>
      <td>\${sanitize(h.comuna||'—')}</td>
      <td style="font-weight:700;color:var(--accent)">\${sanitize(h.patente||'—')}</td>
      <td class="txt-c">\${h.total_entregas||0}</td>
      <td class="txt-c" style="color:var(--danger)">\${h.total_devoluciones||0}</td>
      <td class="txt-r money">\${fmt(h.combustible||0)}</td>
      <td class="txt-r money">\${fmt(h.peaje||0)}</td>
      <td class="txt-c">\${h.km_recorridos !== undefined && h.km_recorridos !== null ? h.km_recorridos : '—'} km</td>
      <td class="txt-c">\${estadoBadge[h.estado]||sanitize(h.estado)}</td>
      <td class="txt-c"><button class="btn-sm" onclick="openHoja('\${sanitize(h.id)}')">👁️ Ver</button> <button class="btn-sm" style="background:var(--success);border-color:var(--success);color:#fff" onclick="exportHojaExcelById('\${sanitize(h.id)}')">📥</button> <button class="btn-sm" style="background:var(--danger);border-color:var(--danger);color:#fff" onclick="eliminarHojaDeRuta('\${sanitize(h.id)}', this)">🗑️</button></td>
    </tr>\`;
  }).join('');
}
async function eliminarHojaDeRuta(id, btn) {
  if (!confirm('¿Estás seguro de que deseas eliminar esta Hoja de Ruta? Esta acción eliminará permanentemente todos los registros del viaje, su turno, gastos operacionales, fotos adjuntas, checklist y revertirá el stock de inventario para TotalEnergies, restando además los kilómetros del odómetro del vehículo. Esta acción no se puede deshacer.')) return;
  
  const prevHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner"></span>';
  
  try {
    const hrDoc = await db.collection('hojas_ruta').doc(id).get();
    if (!hrDoc.exists) {
      throw new Error('La Hoja de Ruta seleccionada no existe en el sistema.');
    }
    const hrData = hrDoc.data();
    const turnoId = hrData.turno_id || '';
    const patente = hrData.patente || '';
    const kmRecorridos = parseFloat(hrData.km_recorridos) || 0;
    const distribuidor = (hrData.distribuidor || hrData.nombre_distribuidor || '').toLowerCase();
    
    if (patente && kmRecorridos > 0) {
      const vSnap = await db.collection('vehiculos').where('patente', '==', patente).limit(1).get();
      if (!vSnap.empty) {
        const vRef = vSnap.docs[0].ref;
        await db.runTransaction(async (transaction) => {
          const vDoc = await transaction.get(vRef);
          if (vDoc.exists) {
            const currentKm = parseFloat(vDoc.data().km || vDoc.data().kilometraje || 0);
            const newKm = Math.max(0, currentKm - kmRecorridos);
            transaction.update(vRef, {
              km: newKm,
              kilometraje: newKm
            });
          }
        });
        console.log(\`Deducidos \${kmRecorridos} km del vehículo \${patente}.\`);
      }
    }
    
    if (distribuidor.includes('total')) {
      const documents = hrData.documentos_wms || [];
      if (documents.length > 0) {
        const movsToRevert = [];
        for (const docNum of documents) {
          const snap1 = await db.collection('movimientos_bodega').where('numero_documento', '==', docNum).get();
          snap1.forEach(d => movsToRevert.push({ id: d.id, ref: d.ref, ...d.data() }));
          
          const snap2 = await db.collection('movimientos_bodega').where('referencia', '==', docNum).get();
          snap2.forEach(d => {
            if (!movsToRevert.some(m => m.id === d.id)) {
              movsToRevert.push({ id: d.id, ref: d.ref, ...d.data() });
            }
          });
        }
        
        if (movsToRevert.length > 0) {
          const batchInv = db.batch();
          for (const mov of movsToRevert) {
            if (mov.tipo === 'salida' || mov.tipo === 'despacho' || mov.cantidad > 0) {
              const prodId = mov.producto_id;
              const cant = parseFloat(mov.cantidad) || 0;
              if (prodId && cant > 0) {
                const prodRef = db.collection('inventory').doc(prodId);
                const prodDoc = await prodRef.get();
                if (prodDoc.exists) {
                  const currentStock = parseFloat(prodDoc.data().stock || prodDoc.data().cantidad || 0);
                  const currentDisp = parseFloat(prodDoc.data().stock_disponible || prodDoc.data().disponible || currentStock);
                  batchInv.update(prodRef, {
                    stock: currentStock + cant,
                    stock_disponible: currentDisp + cant,
                    cantidad: currentStock + cant,
                    disponible: currentDisp + cant
                  });
                }
              }
            }
            batchInv.delete(mov.ref);
          }
          await batchInv.commit();
          console.log(\`Reversado stock de inventario para \${movsToRevert.length} movimientos de TotalEnergies.\`);
        }
      }
    }
    
    const urlsToDelete = [];
    if (hrData.foto_combustible_url) urlsToDelete.push(hrData.foto_combustible_url);
    if (hrData.pod_doc_url) urlsToDelete.push(hrData.pod_doc_url);
    
    let gSnap;
    if (turnoId) {
      gSnap = await db.collection('gastos_ruta').where('turno_id', '==', turnoId).get();
      gSnap.forEach(d => {
        const gData = d.data();
        if (gData.foto_url) urlsToDelete.push(gData.foto_url);
        if (gData.comprobante_url) urlsToDelete.push(gData.comprobante_url);
      });
    }
    
    for (const url of urlsToDelete) {
      if (url && url.startsWith('http')) {
        try {
          const ref = storage.refFromURL(url);
          await ref.delete();
        } catch(err) {
          console.warn("Storage delete failed for URL:", url, err.message);
        }
      }
    }
    
    const batch = db.batch();
    batch.delete(db.collection('hojas_ruta').doc(id));
    
    if (turnoId) {
      batch.delete(db.collection('turnos').doc(turnoId));
    }
    
    if (turnoId) {
      const dSnap = await db.collection('despachos').where('turno_id', '==', turnoId).get();
      dSnap.forEach(doc => batch.delete(doc.ref));
    }
    
    if (gSnap && !gSnap.empty) {
      gSnap.forEach(doc => batch.delete(doc.ref));
    }
    
    if (hrData.conductor_email && patente && hrData.fecha) {
      const cSnap = await db.collection('chequeo_operacional')
        .where('operador', '==', hrData.conductor_email)
        .where('patente_chequeo', '==', patente)
        .get();
      cSnap.forEach(d => {
        const cData = d.data();
        const cDate = cData.fecha_chequeo?.toDate ? cData.fecha_chequeo.toDate() : (cData.fecha_chequeo ? new Date(cData.fecha_chequeo) : null);
        if (cDate) {
          const cDateStr = cDate.toISOString().slice(0, 10);
          if (cDateStr === hrData.fecha) {
            batch.delete(d.ref);
          }
        }
      });
    }
    
    await batch.commit();
    showToast('✅ Hoja de ruta y todos sus datos asociados eliminados exitosamente.', 'success');
    
    loadCentroCostos();
    loadHojasRuta();
    if (typeof loadFacturas === 'function') loadFacturas();
    
  } catch(err) {
    console.error("Error al eliminar Hoja de Ruta:", err);
    showToast('Error al eliminar: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = prevHtml;
    }
  }
}
`;

const prefix = content.slice(0, startIndex);
const suffix = content.slice(endIndex);

fs.writeFileSync(filePath, prefix + replacement + suffix, 'utf8');
console.log("Successfully replaced Hoja de Ruta render and added delete function boundaries!");
