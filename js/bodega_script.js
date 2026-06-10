let _uid='',_email='',_name='',_inversas=[],_productos=[],_movimientos=[];
let _scannerStream=null, _scanning=false;

// Variables de estado del Inventario (importadas vía inventory-helpers.js)

requireAuth(async(user,data)=>{
  _uid=user.uid;
  _email=data.correo_electronico||data.email||user.email;
  _name=data.name||data.nombre||'';
  userRole = (data.rol||data.role) || 'operador';
  await Promise.all([loadInversas(),loadProductos(),loadMovimientos(),loadInventory()]);
  checkLowStock();

  // Restringir cantidad de salida en tiempo real según stock disponible
  document.getElementById('sal-cant')?.addEventListener('input', (e) => {
    const prodId = document.getElementById('sal-producto').value;
    if (!prodId) return;
    const prod = _productos.find(p => p.id === prodId);
    if (prod) {
      const stock = prod.qty ?? prod.cantidad ?? 0;
      const val = parseInt(e.target.value) || 0;
      if (val > stock) {
        e.target.value = stock;
        showToast(`⚠️ Cantidad máxima disponible en stock: ${stock}`, 'error');
      }
    }
  });
});

function showTab(t){
  ['inversa','scan','movimientos','ingreso','salida','inventario'].forEach(id=>{
    const el = document.getElementById('tab-'+id);
    if (el) el.style.display=id===t?'block':'none';
  });
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabsList = ['scan','ingreso','salida','inversa','movimientos','inventario'];
  tabButtons.forEach((b,i)=>{
    if (tabsList[i]) {
      b.classList.toggle('active', tabsList[i]===t);
    }
  });
  if(t!=='scan'&&_scanning) stopScanner();
}

// ═══ LOGÍSTICA INVERSA ═══
async function loadInversas(){
  try{
    const s=await db.collection('logistica_inversa').get();
    _inversas=[];s.forEach(d=>{_inversas.push({id:d.id,...d.data()});});
    _inversas.sort((a,b)=>{
      const order={recepcion_pendiente:0,recibido:1,reclasificado:2};
      return (order[a.estado]??9)-(order[b.estado]??9);
    });
    renderInversas();
  }catch(e){console.warn(e);}
}

function renderInversas(){
  const list=document.getElementById('inversa-list');
  const empty=document.getElementById('inversa-empty');
  const pend=_inversas.filter(i=>i.estado==='recepcion_pendiente').length;
  const recv=_inversas.filter(i=>i.estado==='recibido').length;
  const done=_inversas.filter(i=>i.estado==='reclasificado').length;
  document.getElementById('inv-pend').textContent=pend;
  document.getElementById('inv-recv').textContent=recv;
  document.getElementById('inv-done').textContent=done;

  if(!_inversas.length){list.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';

  // Agrupar por Cliente + Conductor + Motivo (simula una agrupación por viaje/documento)
  const grupos = {};
  _inversas.forEach(inv => {
    const key = `${inv.cliente||'SinCliente'}|${inv.conductor_email||'SinConductor'}|${inv.motivo||'SinMotivo'}`;
    if (!grupos[key]) grupos[key] = {
      cliente: inv.cliente,
      conductor: inv.conductor_email?.split('@')[0] || inv.conductor_nombre,
      motivo: inv.motivo,
      fecha: inv.fecha_devolucion ? formatDate(inv.fecha_devolucion) : '—',
      items: [],
      estadoGlobal: 'reclasificado' // se calculará el mínimo estado
    };
    grupos[key].items.push(inv);
  });

  const order={recepcion_pendiente:0, recibido:1, reclasificado:2};
  const gruposArr = Object.values(grupos);
  gruposArr.forEach(g => {
    let minE = 2;
    g.items.forEach(i => {
      const eVal = order[i.estado||'recepcion_pendiente']??9;
      if (eVal < minE) minE = eVal;
    });
    g.estadoGlobal = minE === 0 ? 'recepcion_pendiente' : (minE === 1 ? 'recibido' : 'reclasificado');
  });

  gruposArr.sort((a,b) => order[a.estadoGlobal] - order[b.estadoGlobal]);

  list.innerHTML = gruposArr.map((g, idx) => {
    const badgeCls={recepcion_pendiente:'badge-pend',recibido:'badge-recv',reclasificado:'badge-done'}[g.estadoGlobal]||'badge-pend';
    const badgeTxt={recepcion_pendiente:'⏳ Pendiente',recibido:'📥 Recibido',reclasificado:'✅ Reclasificado'}[g.estadoGlobal]||g.estadoGlobal;
    
    // Generar las filas de los productos dentro del acordeón
    const itemsHtml = g.items.map(inv => {
      let actions = '';
      if(inv.estado==='recepcion_pendiente'){
        actions = `<button class="inv-btn" style="padding:4px 8px;font-size:0.75rem" onclick="confirmarRecepcion('${inv.id}', this)">📥 Confirmar</button>`;
      } else if(inv.estado==='recibido'){
        actions = `
          <button class="inv-btn inv-btn-stock" style="padding:4px 8px;font-size:0.75rem" onclick="reclasificar('${inv.id}','stock_disponible', this)">📦 Stock</button>
          <button class="inv-btn inv-btn-merma" style="padding:4px 8px;font-size:0.75rem" onclick="reclasificar('${inv.id}','merma', this)">🗑️ Merma</button>
        `;
      } else {
        actions = `<span style="font-size:.75rem;color:var(--text2)">Clasificado: <b style="color:${inv.clasificacion==='merma'?'var(--danger)':'var(--success)'}">${inv.clasificacion==='merma'?'🗑️ Merma':'📦 Stock'}</b></span>`;
      }

      return `
        <div style="display:flex; justify-content:space-between; align-items:center; background:var(--bg); padding:8px; margin-bottom:6px; border-radius:6px; border:1px solid var(--border);">
          <div>
            <strong style="font-size:0.8rem">${sanitize(inv.producto_nombre || 'Producto')}</strong><br>
            <small style="color:var(--text2)">Cant: <b>${inv.cantidad}</b> | Cód: ${sanitize(inv.producto_codigo||'')}</small>
          </div>
          <div style="display:flex; gap:6px; align-items:center">
            ${actions}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="inv-item" style="padding:0; overflow:hidden;">
        <!-- Header del Acordeón -->
        <div style="padding:16px; cursor:pointer; background:var(--surface);" onclick="document.getElementById('acc-${idx}').style.display = document.getElementById('acc-${idx}').style.display === 'none' ? 'block' : 'none'">
          <div class="inv-top">
            <div class="inv-client">${sanitize(g.cliente||'—')}</div>
            <div class="inv-badge ${badgeCls}">${badgeTxt}</div>
          </div>
          <div class="inv-meta">📅 ${g.fecha} · 🚛 Conductor: ${sanitize(g.conductor||'—')}</div>
          <div class="inv-motivo">💬 ${sanitize(g.motivo||'Sin motivo')}</div>
          <div style="text-align:center; font-size:0.75rem; color:var(--text2); margin-top:8px;">
            🔽 Ver ${g.items.length} productos
          </div>
        </div>
        <!-- Contenido del Acordeón -->
        <div id="acc-${idx}" style="display:none; padding:12px; background:rgba(0,0,0,0.2); border-top:1px solid var(--border);">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join('');
}

async function _confirmarRecepcion(id, btn){
  if(btn) btn.disabled=true;
  try{
    const d=await db.collection('logistica_inversa').doc(id).get();
    if(!d.exists) throw new Error('No existe');
    const b=d.data();
    if(b.estado!=='pendiente') throw new Error('Ya procesado');

    await db.runTransaction(async(t)=>{
      const pref=db.collection('inventory').doc(b.producto_id);
      const pdoc=await t.get(pref);
      let qty=0;
      if(pdoc.exists){
        const prodData = pdoc.data();
        qty = prodData.disponible ?? prodData.qty ?? prodData.cantidad ?? 0;
      }
      const numCant = parseInt(b.cantidad)||0;
      t.update(pref,{qty:qty+numCant,disponible:qty+numCant});
      t.update(db.collection('logistica_inversa').doc(id),{
        estado:'ingresado_bodega',
        fecha_recepcion:firebase.firestore.FieldValue.serverTimestamp(),
        receptor_uid:_uid,
        receptor_email:_email
      });
      const mref=db.collection('movimientos_bodega').doc();
      t.set(mref,{
        tipo:'devolucion',
        producto_id:b.producto_id,
        producto_codigo:b.producto_codigo||'',
        producto_nombre:b.producto_nombre||'',
        cantidad:numCant,
        referencia:'Ingreso a Bodega (Recepción Logística Inversa)',
        operario_uid:_uid,
        operario_nombre:_name||_email,
        fecha:firebase.firestore.FieldValue.serverTimestamp()
      });
      // Registrar log de auditoría
      t.set(db.collection('audit_log').doc(), {
        tipo: 'recepcion_inversa',
        documento_id: id,
        producto_id: b.producto_id,
        cantidad: numCant,
        usuario: _email,
        fecha: firebase.firestore.FieldValue.serverTimestamp()
      });
    });
    showToast('✅ Recepción confirmada e inventario actualizado','success');
  }catch(e){
    if(btn) btn.disabled=false;
    showToast('Error: '+e.message,'error');
  }
}
window.confirmarRecepcion = withOnceClick(_confirmarRecepcion);

async function _reclasificar(id, tipo, btn){
  const label=tipo==='merma'?'MERMA':'STOCK DISPONIBLE';
  if(!confirm(`¿Clasificar como ${label}?`))return;
  if(btn) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span>...';
  }
  try{
    await db.collection('logistica_inversa').doc(id).update({
      estado:'reclasificado',
      clasificacion:tipo,
      operario_uid:_uid
    });
    // If stock, create ingreso movement and update inventory
    if(tipo==='stock_disponible'){
      const inv=_inversas.find(i=>i.id===id);
      const prodId = inv?.producto_id || '';
      const cant = parseInt(inv?.cantidad) || 0;
      
      if (prodId && cant > 0) {
        const prodDoc = await db.collection('inventory').doc(prodId).get();
        if (prodDoc.exists) {
          const prodData = prodDoc.data();
          const currentStock = prodData.qty ?? prodData.cantidad ?? 0;
          const newStock = currentStock + cant;
          
          await db.collection('movimientos_bodega').add({
            producto_id: prodId,
            producto_codigo: inv?.producto_codigo || prodData.code || '',
            producto_nombre: inv?.producto_nombre || prodData.name || prodData.nombre || '',
            tipo: 'devolucion',
            cantidad: cant,
            ubicacion: 'Pendiente asignar',
            operario_uid: _uid,
            operario_nombre: _name,
            referencia: `Dev: ${inv?.cliente || '—'}`,
            scan_validado: false,
            fecha: firebase.firestore.FieldValue.serverTimestamp()
          });
          
          const updateData = {
            qty: newStock,
            cantidad: newStock,
            status: newStock === 0 ? 'no_disponible' : 'disponible',
            litros_actuales: (prodData.litros_por_unidad || 0) * newStock,
            kg_actuales: (prodData.kg_por_unidad || 0) * newStock,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
            updatedBy: _uid
          };
          await db.collection('inventory').doc(prodId).update(updateData);
        } else {
          console.warn("Product doc not found in inventory:", prodId);
        }
      } else {
        console.warn("Invalid product_id or cantidad in logistica_inversa doc:", prodId, cant);
      }
    }
    showToast(`✅ Clasificado como ${label}`,'success');
    await Promise.all([loadInversas(), loadProductos(), typeof loadInventory === 'function' ? loadInventory() : Promise.resolve()]);
  }catch(e){
    showToast('Error: '+e.message,'error');
    if(btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }
}
window.reclasificar = withOnceClick(_reclasificar);

// ═══ PRODUCTOS ═══
async function loadProductos(){
  try{
    const s=await db.collection('inventory').get();
    _productos=[];s.forEach(d=>{_productos.push({id:d.id,...d.data()});});
    _productos.sort((a,b)=>(a.nombre||'').localeCompare(b.nombre||''));
    populateProductSelects();
  }catch(e){console.warn(e);}
}

function populateProductSelects(){
  ['ing-producto','sal-producto'].forEach(selId=>{
    const sel=document.getElementById(selId);
    while(sel.options.length>1)sel.remove(1);
    _productos.forEach(p=>{
      const o=document.createElement('option');
      o.value=p.id;
      o.textContent=`${p.name||p.nombre||p.id} - Stock: ${p.qty??p.cantidad??0}`;
      sel.appendChild(o);
    });
  });
}

function validarCodigo(dir) {
  const isIn = dir === 'ingreso';
  const codigoInput = document.getElementById(isIn ? 'ing-codigo' : 'sal-codigo');
  const feedbackEl = document.getElementById(isIn ? 'ing-valid-feedback' : 'sal-valid-feedback');
  const selectEl = document.getElementById(isIn ? 'ing-producto' : 'sal-producto');
  
  if (!codigoInput) return;
  const val = codigoInput.value.trim().toLowerCase();
  
  if (!val) {
    showToast('Ingresa un código para validar', 'error');
    if (feedbackEl) {
      feedbackEl.style.display = 'block';
      feedbackEl.style.border = '1px solid var(--danger)';
      feedbackEl.style.color = '#FCA5A5';
      feedbackEl.style.background = 'rgba(239, 68, 68, 0.08)';
      feedbackEl.innerHTML = '⚠️ Por favor, ingresa un código o Código de barras.';
    }
    return;
  }
  
  // Search in _productos
  const prod = _productos.find(p => 
    (p.code || '').toLowerCase() === val || 
    (p.codigo_barras || '').toLowerCase() === val || 
    p.id.toLowerCase() === val
  );
  
  if (prod) {
    // Select the product in the dropdown
    selectEl.value = prod.id;
    
    // Check stock
    const stock = prod.qty ?? prod.cantidad ?? 0;
    
    // Display visual feedback card
    feedbackEl.style.display = 'block';
    feedbackEl.style.border = '1px solid var(--success)';
    feedbackEl.style.color = '#6EE7B7';
    feedbackEl.style.background = 'rgba(16, 185, 129, 0.08)';
    feedbackEl.innerHTML = `
      <strong>✅ Producto Validado:</strong> ${prod.nombre || prod.name || 'Sin Nombre'}<br>
      <span style="font-size:0.72rem;color:var(--text2)">
        Código: ${prod.code || '—'} | Barras: ${prod.codigo_barras || '—'}<br>
        Stock Disponible: <b>${stock}</b> ${prod.unit || 'un'}
      </span>
    `;
    showToast(`✅ Código validado: ${prod.nombre || prod.name}`, 'success');

    // Restringir si la cantidad ya ingresada excede el stock disponible
    if (!isIn) {
      const cantInput = document.getElementById('sal-cant');
      const cant = parseInt(cantInput?.value) || 0;
      if (cant > stock) {
        cantInput.value = stock;
        showToast(`⚠️ Cantidad ajustada al stock máximo disponible: ${stock}`, 'error');
      }
    }
  } else {
    // Reset dropdown selection
    selectEl.value = '';
    
    feedbackEl.style.display = 'block';
    feedbackEl.style.border = '1px solid var(--danger)';
    feedbackEl.style.color = '#FCA5A5';
    feedbackEl.style.background = 'rgba(239, 68, 68, 0.08)';
    feedbackEl.innerHTML = `
      <strong>❌ Código no registrado:</strong> "${codigoInput.value.trim()}"<br>
      <span style="font-size:0.72rem;color:var(--text2)">
        El código ingresado no coincide con ningún producto en inventario.
      </span>
    `;
    showToast('❌ Producto no encontrado por código', 'error');
  }
}

function seleccionarProductoDropdown(dir) {
  const isIn = dir === 'ingreso';
  const selectEl = document.getElementById(isIn ? 'ing-producto' : 'sal-producto');
  const codigoInput = document.getElementById(isIn ? 'ing-codigo' : 'sal-codigo');
  const feedbackEl = document.getElementById(isIn ? 'ing-valid-feedback' : 'sal-valid-feedback');
  
  if (!selectEl) return;
  const prodId = selectEl.value;
  if (!prodId) {
    if (codigoInput) codigoInput.value = '';
    if (feedbackEl) feedbackEl.style.display = 'none';
    return;
  }
  
  const prod = _productos.find(p => p.id === prodId);
  if (prod) {
    // Put code/barcode in input
    if (codigoInput) {
      codigoInput.value = prod.code || prod.codigo_barras || prod.id;
    }
    
    // Display feedback card
    const stock = prod.qty ?? prod.cantidad ?? 0;
    feedbackEl.style.display = 'block';
    feedbackEl.style.border = '1px solid var(--primary)';
    feedbackEl.style.color = 'var(--text)';
    feedbackEl.style.background = 'rgba(27, 75, 155, 0.08)';
    feedbackEl.innerHTML = `
      <strong>ℹ️ Producto Seleccionado:</strong> ${prod.nombre || prod.name || 'Sin Nombre'}<br>
      <span style="font-size:0.72rem;color:var(--text2)">
        Código: ${prod.code || '—'} | Barras: ${prod.codigo_barras || '—'}<br>
        Stock Disponible: <b>${stock}</b> ${prod.unit || 'un'}
      </span>
    `;

    // Restringir si la cantidad ya ingresada excede el stock disponible
    if (!isIn) {
      const cantInput = document.getElementById('sal-cant');
      const cant = parseInt(cantInput?.value) || 0;
      if (cant > stock) {
        cantInput.value = stock;
        showToast(`⚠️ Cantidad ajustada al stock máximo disponible: ${stock}`, 'error');
      }
    }
  }
}

// ═══ ESCANEO ═══
async function toggleScanner(){
  if(_scanning){stopScanner();return;}
  const container=document.getElementById('scanner-container');
  const video=document.getElementById('scanner-video');
  const btn=document.getElementById('btn-scan');
  try{
    _scannerStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    video.srcObject=_scannerStream;
    await video.play();
    container.style.display='block';
    btn.textContent='⏹️ Detener Escaneo';
    _scanning=true;
    // Use BarcodeDetector if available, otherwise fallback to manual
    if('BarcodeDetector' in window){
      const detector=new BarcodeDetector({formats:['qr_code','ean_13','ean_8','code_128','code_39']});
      scanFrame(detector,video);
    }else{
      showToast('Escaneo automático no soportado. Ingresa el código manualmente.','info');
    }
  }catch(e){
    showToast('Error accediendo a cámara: '+e.message,'error');
  }
}

async function scanFrame(detector,video){
  if(!_scanning)return;
  try{
    const barcodes=await detector.detect(video);
    if(barcodes.length>0){
      const code=barcodes[0].rawValue;
      stopScanner();
      buscarProducto(code);
      return;
    }
  }catch(e){}
  requestAnimationFrame(()=>scanFrame(detector,video));
}

function stopScanner(){
  _scanning=false;
  if(_scannerStream){_scannerStream.getTracks().forEach(t=>t.stop());_scannerStream=null;}
  document.getElementById('scanner-container').style.display='none';
  document.getElementById('btn-scan').textContent='📸 Iniciar Escaneo';
}

function buscarProducto(code){
  if(!code){showToast('Ingresa un código','error');return;}
  code=code.trim();
  const prod=_productos.find(p=>
    p.code===code||p.codigo_barras===code||p.nombre===code||p.id===code
  );
  const result=document.getElementById('scan-result');
  result.style.display='block';
  if(prod){
    document.getElementById('sr-code').textContent=prod.code||prod.codigo_barras||prod.id;
    document.getElementById('sr-name').textContent=prod.name||prod.nombre||'—';
    document.getElementById('sr-detail').textContent=`Stock: ${prod.qty??prod.cantidad??0} ${prod.unit||'un'} · Min: ${prod.stock_minimo||0}`;
    showToast('✅ Producto encontrado','success');
  }else{
    document.getElementById('sr-code').textContent=code;
    document.getElementById('sr-name').textContent='❌ Producto no encontrado';
    const cleanCode = code.replace(/'/g, "\\'").replace(/"/g, '\\"');
    document.getElementById('sr-detail').innerHTML=`
      El código ingresado no coincide con ningún producto registrado.<br>
      <button class="btn btn-accent btn-sm" onclick="openModalWithCode('${cleanCode}')" style="margin-top:10px; width:100%; padding:10px; font-weight:600; font-family:'Inter',sans-serif; border:none; border-radius:10px; cursor:pointer; background:var(--accent); color:#fff;">➕ Registrar Nuevo Producto</button>
    `;
    showToast('Producto no encontrado','error');
  }
}

function openModalWithCode(code) {
  // Cambiar a la pestaña de Inventario
  showTab('inventario');
  
  // Limpiar el formulario
  const form = document.getElementById('inv-form');
  if (form) form.reset();
  editingId = null;
  
  // Modificar título del modal
  document.getElementById('modal-title').textContent = 'Registrar Nuevo Producto (Código Pre-cargado)';
  
  // Pre-cargar el código en los campos relevantes
  document.getElementById('item-code').value = code;
  document.getElementById('item-code').value = code;
  document.getElementById('item-barcode').value = code;
  
  // Mostrar modal
  document.getElementById('modal-overlay').classList.add('open');
}

// ═══ MOVIMIENTOS ═══
async function loadMovimientos(){
  try{
    let s;
    try {
      s=await db.collection('movimientos_bodega').orderBy('fecha','desc').limit(50).get();
    } catch(err) {
      console.warn("Ordered query for movements failed, using fallback limit 50:", err);
      s=await db.collection('movimientos_bodega').limit(50).get();
    }
    _movimientos=[];s.forEach(d=>{_movimientos.push({id:d.id,...d.data()});});
    _movimientos.sort((a,b)=>{const ta=a.fecha?.toDate?a.fecha.toDate():new Date(0);const tb=b.fecha?.toDate?b.fecha.toDate():new Date(0);return tb-ta;});
    renderMovimientos();
  }catch(e){console.warn(e);}
}

function renderMovimientos(){
  const list=document.getElementById('mov-list');
  const empty=document.getElementById('mov-empty');
  if(!_movimientos.length){list.innerHTML='';empty.style.display='block';return;}
  empty.style.display='none';
  
  const currentRole = (typeof userRole !== 'undefined') ? userRole.toLowerCase().trim() : 'operador';
  const isAdmin = ['admin','administrador'].includes(currentRole);

  list.innerHTML=_movimientos.map(m=>{
    const isIn=['ingreso','devolucion','abastecimiento','ajuste_pos'].includes(m.tipo);
    const icons={ingreso:'📥',salida:'📤',despacho:'🚛',merma:'🗑️',devolucion:'🔄',abastecimiento:'📥',ajuste:'🔧'};
    const iconCls={ingreso:'mov-in',salida:'mov-out',despacho:'mov-out',merma:'mov-out',devolucion:'mov-dev',abastecimiento:'mov-in',ajuste:'mov-adj'};
    const prod=_productos.find(p=>p.id===m.producto_id);

    let adminHtml = '';
    if (isAdmin) {
      adminHtml = `
        <div style="display:flex; gap:6px; flex-shrink:0;">
          <button class="btn btn-sm" style="padding:4px 8px; font-size:0.7rem; background:var(--bg); border:1px solid var(--border); color:var(--text); border-radius:4px; cursor:pointer;" onclick="editarMovimiento('${m.id}')">✏️</button>
          <button class="btn btn-sm" style="padding:4px 8px; font-size:0.7rem; background:rgba(239, 68, 68, 0.1); border:1px solid rgba(239, 68, 68, 0.3); color:#EF4444; border-radius:4px; cursor:pointer;" onclick="eliminarMovimiento('${m.id}')">🗑️</button>
        </div>
      `;
    }

    return `<div class="mov-item" style="display:flex; justify-content:space-between; align-items:center;">
      <div style="display:flex; align-items:center; flex:1; gap:12px; min-width:0;">
        <div class="mov-icon ${iconCls[m.tipo]||'mov-adj'}">${icons[m.tipo]||'📦'}</div>
        <div class="mov-info" style="min-width:0;">
          <div class="mv-prod" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sanitize(prod?.nombre||m.referencia||m.tipo)}</div>
          <div class="mv-meta">${m.fecha?formatDateTime(m.fecha):'—'} · ${sanitize(m.operario_nombre||'—')}</div>
        </div>
      </div>
      <div style="display:flex; align-items:center; gap:12px; flex-shrink:0;">
        <div class="mov-qty ${isIn?'pos':'neg'}">${isIn?'+':'-'}${m.cantidad||0}</div>
        ${adminHtml}
      </div>
    </div>`;
  }).join('');
}

async function eliminarMovimiento(id) {
  if (!confirm('¿Estás seguro de eliminar este movimiento? El inventario será recalculado.')) return;
  
  const mov = _movimientos.find(m => m.id === id);
  if (!mov) return;
  
  try {
    await db.runTransaction(async (transaction) => {
      const movRef = db.collection('movimientos_bodega').doc(id);
      const prodRef = db.collection('inventory').doc(mov.producto_id);
      
      const pDoc = await transaction.get(prodRef);
      if (pDoc.exists) {
        const pData = pDoc.data();
        const currentStock = pData.qty ?? pData.cantidad ?? 0;
        
        const isIn = ['ingreso','devolucion','abastecimiento','ajuste_pos'].includes(mov.tipo);
        
        // Revertir
        let newStock = currentStock;
        if (isIn) {
          newStock = Math.max(0, currentStock - (mov.cantidad || 0));
        } else {
          newStock = currentStock + (mov.cantidad || 0);
        }
        
        transaction.update(prodRef, {
          qty: newStock,
          cantidad: newStock,
          status: newStock === 0 ? 'no_disponible' : 'disponible',
          litros_actuales: (pData.litros_por_unidad || 0) * newStock,
          kg_actuales: (pData.kg_por_unidad || 0) * newStock,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      transaction.delete(movRef);
    });
    
    showToast('✅ Movimiento eliminado e inventario recalculado', 'success');
    await Promise.all([loadMovimientos(), loadProductos(), typeof loadInventory === 'function' ? loadInventory() : Promise.resolve()]);
  } catch(e) {
    console.error(e);
    showToast('Error al eliminar: ' + e.message, 'error');
  }
}

async function editarMovimiento(id) {
  const mov = _movimientos.find(m => m.id === id);
  if (!mov) return;
  
  const newCantStr = prompt(`Editar cantidad para ${mov.producto_nombre || mov.tipo}:\n(Cantidad actual: ${mov.cantidad})`, mov.cantidad);
  if (newCantStr === null) return;
  
  const newCant = parseInt(newCantStr);
  if (isNaN(newCant) || newCant < 0) {
    showToast('Cantidad inválida', 'warning');
    return;
  }
  
  try {
    await db.runTransaction(async (transaction) => {
      const movRef = db.collection('movimientos_bodega').doc(id);
      const prodRef = db.collection('inventory').doc(mov.producto_id);
      
      const pDoc = await transaction.get(prodRef);
      if (pDoc.exists) {
        const pData = pDoc.data();
        const currentStock = pData.qty ?? pData.cantidad ?? 0;
        const isIn = ['ingreso','devolucion','abastecimiento','ajuste_pos'].includes(mov.tipo);
        
        let tempStock = currentStock;
        if (isIn) {
          tempStock = Math.max(0, currentStock - (mov.cantidad || 0));
        } else {
          tempStock = currentStock + (mov.cantidad || 0);
        }
        
        let newStock = 0;
        if (isIn) {
          newStock = tempStock + newCant;
        } else {
          newStock = Math.max(0, tempStock - newCant);
        }
        
        transaction.update(prodRef, {
          qty: newStock,
          cantidad: newStock,
          status: newStock === 0 ? 'no_disponible' : 'disponible',
          litros_actuales: (pData.litros_por_unidad || 0) * newStock,
          kg_actuales: (pData.kg_por_unidad || 0) * newStock,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      }
      
      transaction.update(movRef, {
        cantidad: newCant,
        fecha_edicion: firebase.firestore.FieldValue.serverTimestamp(),
        editado_por: _uid
      });
    });
    
    showToast('✅ Movimiento editado e inventario recalculado', 'success');
    await Promise.all([loadMovimientos(), loadProductos(), typeof loadInventory === 'function' ? loadInventory() : Promise.resolve()]);
  } catch(e) {
    console.error(e);
    showToast('Error al editar: ' + e.message, 'error');
  }
}

async function _registrarMovimiento(dir){
  const isIn=dir==='ingreso';
  const prodId=document.getElementById(isIn?'ing-producto':'sal-producto').value;
  const tipo=document.getElementById(isIn?'ing-tipo':'sal-tipo').value;
  const cant=parseInt(document.getElementById(isIn?'ing-cant':'sal-cant').value);
  const ref=document.getElementById(isIn?'ing-ref':'sal-ref').value.trim();
  const ubicacion='';

  if(!prodId){showToast('Selecciona un producto','error');return;}
  if(!cant||cant<=0){showToast('Ingresa la cantidad','error');return;}

  const prod=_productos.find(p=>p.id===prodId);
  if(!isIn&&prod){
    const stock=prod.qty??prod.cantidad??0;
    if(stock===0){
      showToast('❌ Acción no válida: Producto SIN STOCK disponible.', 'error');
      alert(`La acción no es válida:\nEl producto seleccionado se encuentra actualmente sin stock disponible en bodega para registrar salidas.`);
      return;
    }
    if(cant>stock){
      showToast(`❌ Acción no válida: Cantidad supera el stock disponible (${stock}).`, 'error');
      alert(`La acción no es válida:\nEstás intentando registrar una salida de ${cant} unidades, pero el producto seleccionado solo cuenta con ${stock} unidades en stock.`);
      return;
    }
  }

  const btn = document.querySelector(isIn ? '#tab-ingreso .btn-save' : '#tab-salida .btn-save');
  if(btn) {
    btn.disabled = true;
    btn.dataset.originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="spinner"></span> Procesando...';
  }

  try{
    await db.runTransaction(async(t)=>{
      const pref=db.collection('inventory').doc(prodId);
      const pdoc=await t.get(pref);
      let stock=0;
      if(pdoc.exists){
        const prodData = pdoc.data();
        stock = prodData.disponible ?? prodData.qty ?? prodData.cantidad ?? 0;
      }

      if(!isIn && cant>stock){
        throw new Error(`Stock insuficiente (Actual: ${stock}, Solicitado: ${cant}).`);
      }

      let n=stock+(isIn?cant:-cant);
      if(n<0) n=0;
      t.update(pref,{qty:n,disponible:n});

      const mref=db.collection('movimientos_bodega').doc();
      t.set(mref,{
        tipo:isIn?tipo:'salida',
        producto_id:prodId,
        producto_codigo:prod.code||'',
        producto_nombre:prod.name||prod.nombre||'',
        cantidad:cant,
        referencia:ref,
        ubicacion:ubicacion,
        operario_uid:_uid,
        operario_nombre:_name||_email,
        fecha:firebase.firestore.FieldValue.serverTimestamp()
      });
      // Log auditoría
      t.set(db.collection('audit_log').doc(), {
        tipo: 'movimiento_manual',
        direccion: dir,
        producto_id: prodId,
        cantidad: cant,
        usuario: _email,
        fecha: firebase.firestore.FieldValue.serverTimestamp()
      });
    });

    showToast('✅ Movimiento registrado','success');
    document.getElementById(isIn?'ing-cant':'sal-cant').value='';
    document.getElementById(isIn?'ing-ref':'sal-ref').value='';
    document.getElementById(isIn?'ing-codigo':'sal-codigo').value='';
    document.getElementById(isIn?'ing-valid-feedback':'sal-valid-feedback').style.display='none';
    await Promise.all([loadProductos(),loadMovimientos()]);
  }catch(e){
    if(e.message.includes('Stock insuficiente')) {
      alert(`⚠️ ${e.message}`);
    } else {
      showToast('Error: '+e.message,'error');
    }
  }finally{
    if(btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.originalHtml;
    }
  }
}

// ═══ TAB INVENTARIO LÓGICA COMPLETA (vía inventory-helpers.js) ═══

// Configurar listeners de la pestaña inventario al inicializar
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('search-inv');
  if (searchInput) searchInput.addEventListener('input', applyFilter);

  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      window.currentFilter = tab.dataset.filter;
      if (window.applyFilter) window.applyFilter();
    });
  });

  const invForm = document.getElementById('inv-form');
  if (invForm) {
    invForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = document.getElementById('btn-save-inv');
      btn.disabled = true; btn.textContent = 'Guardando...';
      const qty = parseInt(document.getElementById('item-qty').value) || 0;
      let status = document.getElementById('item-status').value;
      if (qty === 0) status = 'no_disponible';
      
      const litrosPorUnidad = parseFloat(document.getElementById('item-litros-por-unidad').value) || 0;
      const kgPorUnidad = parseFloat(document.getElementById('item-kg-por-unidad').value) || 0;

      const data = {
        code:          document.getElementById('item-code').value.trim(),
        name:          document.getElementById('item-name').value.trim(),
        codigo_barras: document.getElementById('item-barcode').value.trim(),
        qty:           qty,
        cantidad:      qty,
        disponible:    qty,
        stock_minimo:  parseInt(document.getElementById('item-min').value) || 0,
        unit:          document.getElementById('item-unit').value,
        litros_por_unidad: litrosPorUnidad,
        kg_por_unidad:     kgPorUnidad,
        litros_actuales:   litrosPorUnidad * qty,
        kg_actuales:       kgPorUnidad * qty,
        nombre:        document.getElementById('item-name').value.trim(),
        status:        status,
        notes:         document.getElementById('item-notes').value.trim(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: _uid,
      };
      try {
        if (window.editingId) {
          await db.collection('inventory').doc(window.editingId).update(data);
          showToast('Ítem actualizado ✅', 'success');
        } else {
          data.createdAt = firebase.firestore.FieldValue.serverTimestamp();
          data.createdBy = _uid;
          await db.collection('inventory').add(data);
          showToast('Ítem agregado ✅', 'success');
        }
        closeModal();
        await loadInventory();
        await loadProductos();
        checkLowStock();
      } catch(err) {
        showToast('Error al guardar: ' + err.message, 'error');
      }
      btn.disabled = false; btn.textContent = 'Guardar';
    });
  }
});

function checkLowStock(){
  try{
    let low=0;
    allItems.forEach(item=>{
      const qty = item.qty || item.cantidad || 0;
      if(qty > 0 && qty <= 3) low++;
    });
    const alertEl = document.getElementById('stock-alert');
    const alertCount = document.getElementById('alert-count');
    if(low>0){
      if(alertEl) alertEl.style.display='flex';
      if(alertCount) alertCount.textContent=low;
    } else {
      if(alertEl) alertEl.style.display='none';
    }
  }catch(e){}
}

// ═══ EXPORTACIÓN E IMPORTACIÓN EXCEL (vía inventory-helpers.js) ═══
async function importExcel(e){
  const file=e.target.files[0];
  if(!file){return;}
  try{
    const data=await file.arrayBuffer();
    const wb=XLSX.read(data,{type:'array'});
    
    let totalUpdated=0;
    let totalImported=0;
    let totalErrors=0;
    let totalMovs=0;
    const batch=db.batch();

    for(const sheetName of wb.SheetNames){
      const ws=wb.Sheets[sheetName];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      if(!rows.length) continue;

      const firstRow=rows[0];
      const firstRowKeys=Object.keys(firstRow).map(k=>k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim());
      const isMovements=firstRowKeys.includes('fecha de movimiento') || firstRowKeys.includes('cantidad de entrada') || firstRowKeys.includes('cantidad de salida');

      if(isMovements){
        const movColMap={
          'fecha de movimiento':'fecha_movimiento',
          'n documento':'n_documento',
          'numero documento':'n_documento',
          'codigo de producto':'code',
          'nombre de producto':'name',
          'cantidad de entrada':'cantidad_entrada',
          'cantidad de salida':'cantidad_salida',
          'cantidad en stock':'cantidad_stock',
          'valor':'valor',
          'observaciones':'observaciones',
          'obsarvaciones':'observaciones'
        };

        for(const row of rows){
          const item={};
          Object.entries(row).forEach(([k,v])=>{
            const normKey=k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const mapped=movColMap[normKey];
            if(mapped) item[mapped]=v;
          });

          if(!item.code){
            totalErrors++;
            continue;
          }

          const codeStr=String(item.code).trim();
          const codeUpper=codeStr.toUpperCase();
          const existing=allItems.find(i=>(i.code||'').toUpperCase()===codeUpper);

          let prodId='';
          let finalName=item.name||'';
          let litrosPorUnidad=0;
          let kgPorUnidad=0;

          if(existing){
            prodId=existing.id;
            finalName=existing.name||finalName;
            litrosPorUnidad=existing.litros_por_unidad||0;
            kgPorUnidad=existing.kg_por_unidad||0;
          } else {
            const newProdRef=db.collection('inventory').doc();
            prodId=newProdRef.id;
            const startStock=parseInt(item.cantidad_stock)||0;
            const newProdData={
              code:codeStr,
              name:finalName,
              nombre:finalName,
              qty:startStock,
              cantidad:startStock,
              litros_por_unidad:0,
              kg_por_unidad:0,
              litros_actuales:0,
              kg_actuales:0,
              unit:'unidad',
              status:startStock===0?'no_disponible':'disponible',
              stock_minimo:0,
              location:'',
              createdAt:firebase.firestore.FieldValue.serverTimestamp(),
              createdBy:_uid,
              updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
              updatedBy:_uid
            };
            batch.set(newProdRef,newProdData);
            allItems.push({id:prodId,...newProdData});
          }

          const cantEntrada=parseInt(item.cantidad_entrada)||0;
          const cantSalida=parseInt(item.cantidad_salida)||0;
          const valor=parseFloat(item.valor)||0;
          const obs=String(item.observaciones||'').trim();
          const docNum=String(item.n_documento||'').trim();

          let tipoMov='ajuste';
          let cantMov=0;
          if(cantEntrada>0){
            tipoMov='ingreso';
            cantMov=cantEntrada;
          } else if(cantSalida>0){
            tipoMov='salida';
            cantMov=cantSalida;
          }

          let fechaDate=new Date();
          if(item.fecha_movimiento){
            const parsedD=new Date(item.fecha_movimiento);
            if(!isNaN(parsedD.getTime())){
              fechaDate=parsedD;
            }
          }

          const movRef=db.collection('movimientos_bodega').doc();
          batch.set(movRef,{
            producto_id:prodId,
            producto_nombre:finalName,
            producto_codigo:codeStr,
            tipo:tipoMov,
            cantidad:cantMov,
            valor_clp:valor,
            numero_documento:docNum,
            referencia:docNum?`Doc: ${docNum}`:(obs||'Movimiento importado'),
            observaciones:obs,
            operario_uid:_uid,
            operario_nombre:_name,
            fecha:firebase.firestore.Timestamp.fromDate(fechaDate),
            scan_validado:false
          });
          totalMovs++;

          if(item.cantidad_stock!==undefined&&item.cantidad_stock!==''){
            const newStock=parseInt(item.cantidad_stock)||0;
            const prodRef=db.collection('inventory').doc(prodId);
            batch.update(prodRef,{
              qty:newStock,
              cantidad:newStock,
              litros_actuales:litrosPorUnidad*newStock,
              kg_actuales:kgPorUnidad*newStock,
              status:newStock===0?'no_disponible':'disponible',
              updatedAt:firebase.firestore.FieldValue.serverTimestamp(),
              updatedBy:_uid
            });
            totalUpdated++;
          }
        }
      } else {
        const colMap={
          'codigo producto':'code','codigo':'code','código':'code','code':'code','tracking':'code',
          'nombre producto':'name','nombre':'name','name':'name','producto':'name','descripcion':'name',
          'litros x unidad':'litros_por_unidad',
          'kg x unidad':'kg_por_unidad',
          'stock actual':'qty','cantidad':'qty','qty':'qty','stock':'qty',
          'litros actuales':'litros_actuales',
          'kg actuales':'kg_actuales'
        };

        for(const row of rows){
          const item={};
          Object.entries(row).forEach(([k,v])=>{
            const normKey=k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const mapped=colMap[normKey];
            if(mapped) item[mapped]=v;
          });
          
          if(!item.code && !item.name){
            totalErrors++;
            continue;
          }

          item.code = String(item.code || '').trim();
          item.name = String(item.name || '').trim();
          item.nombre = item.name;

          const qty = parseInt(item.qty) || 0;
          item.qty = qty;
          item.cantidad = qty;
          item.status = qty === 0 ? 'no_disponible' : 'disponible';

          const litrosPorUnidad = parseFloat(item.litros_por_unidad) || 0;
          item.litros_por_unidad = litrosPorUnidad;

          const kgPorUnidad = parseFloat(item.kg_por_unidad) || 0;
          item.kg_por_unidad = kgPorUnidad;

          item.litros_actuales = litrosPorUnidad * qty;
          item.kg_actuales = kgPorUnidad * qty;

          if(litrosPorUnidad > 0){
            item.unit = 'Litros';
          } else if(kgPorUnidad > 0){
            item.unit = 'Kilos';
          } else {
            item.unit = 'unidad';
          }

          const codeUpper = item.code.toUpperCase();
          const existing = allItems.find(i => (i.code || '').toUpperCase() === codeUpper);

          if(existing){
            const ref = db.collection('inventory').doc(existing.id);
            const updateData = {
              name: item.name,
              nombre: item.nombre,
              qty: item.qty,
              cantidad: item.cantidad,
              litros_por_unidad: item.litros_por_unidad,
              kg_por_unidad: item.kg_por_unidad,
              litros_actuales: item.litros_actuales,
              kg_actuales: item.kg_actuales,
              unit: item.unit,
              status: item.status,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedBy: _uid
            };
            batch.update(ref, updateData);
            totalUpdated++;
          } else {
            const ref = db.collection('inventory').doc();
            const newData = {
              ...item,
              stock_minimo: 0,
              location: '',
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              createdBy: _uid,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedBy: _uid
            };
            batch.set(ref, newData);
            totalImported++;
          }
        }
      }
    }
    await batch.commit();
    showToast(`✅ Importación completada: ${totalUpdated} stocks act., ${totalImported} prod. creados, ${totalMovs} mov. registrados${totalErrors?' ('+totalErrors+' omitidos)':''}`, 'success');
    await loadInventory();
    await loadProductos();
    checkLowStock();
  }catch(err){
    showToast('Error al importar: '+err.message,'error');
  }
  e.target.value='';
}

function dlXLSX(sheets,filename){
  const wb=XLSX.utils.book_new();
  sheets.forEach(s=>{
    const ws=XLSX.utils.aoa_to_sheet(s.data);
    const cols=s.data.reduce((max,row)=>Math.max(max,row.length),0);
    ws['!cols']=Array.from({length:cols},(_,ci)=>{
      let w=10;s.data.forEach(r=>{if(r[ci]!=null){const l=String(r[ci]).length;if(l>w)w=l;}});return{wch:Math.min(w+2,40)};
    });
    
    let headerRow = 1;
    if (s.name === 'Resumen Inventario') {
      headerRow = 4;
    }
    if (s.data && s.data.length >= headerRow && s.data[headerRow - 1]) {
      const getColLetter = (colIdx) => {
        let temp, letter = '';
        while (colIdx >= 0) {
          temp = colIdx % 26;
          letter = String.fromCharCode(temp + 65) + letter;
          colIdx = Math.floor(colIdx / 26) - 1;
        }
        return letter;
      };
      const colCount = s.data[headerRow - 1].length;
      for (let c = 0; c < colCount; c++) {
        const cellRef = getColLetter(c) + headerRow;
        if (ws[cellRef]) {
          ws[cellRef].s = {
            font: { bold: true },
            alignment: { horizontal: 'center', vertical: 'center' }
          };
        }
      }
    }

    XLSX.utils.book_append_sheet(wb,ws,s.name.slice(0,31));
  });
  XLSX.writeFile(wb,`${filename}_${new Date().toISOString().slice(0,10)}.xlsx`);
  showToast('📥 Excel descargado','success');
}
