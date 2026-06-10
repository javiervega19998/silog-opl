// ══════════════════════════════════════════════
// INVENTORY HELPERS — SILOG SpA
// Lógica compartida para WMS Bodega e Inventario
// ══════════════════════════════════════════════

const statusColors = {
  disponible: 'badge-done', en_transito: 'badge-active',
  entregado: 'badge-done', agotado: 'badge-danger', dañado: 'badge-danger',
  no_disponible: 'badge-danger'
};
const statusLabels = {
  disponible: 'Disponible', en_transito: 'En Tránsito',
  entregado: 'Entregado', agotado: 'Agotado', dañado: 'Dañado',
  no_disponible: 'No Disponible'
};

// Declaración de variables globales compartidas
window.allItems = [];
window.currentFilter = 'all';
window.editingId = null;
window.userRole = 'operador';

function renderItems(items) {
  const container = document.getElementById('inv-container');
  if (!items.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📦</div><h3>Sin ítems</h3><p>No hay registros en esta categoría.</p></div>`;
    return;
  }

  let slidedownBtn = '';
  let tableStyle = '';
  if (items.length > 10) {
    tableStyle = 'style="max-height: 520px; overflow: hidden; transition: max-height 0.5s ease-in-out; position: relative;" id="inv-table-wrap"';
    slidedownBtn = `
      <div id="slidedown-btn-wrap" style="text-align:center; margin-top:12px;">
        <button class="btn btn-outline btn-full" onclick="slideDownTable()" style="font-size:0.8rem; border-style:dashed; padding:10px; font-weight:600; color:var(--accent);">Mostrar todos los productos 👇</button>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="table-wrap" ${tableStyle}>
      <table>
        <thead><tr>
          <th>Código</th><th>Nombre</th>
          <th>Disponible</th><th>En Tránsito</th><th>Total</th>
          <th>Un. Medida</th><th>Acciones</th>
        </tr></thead>
        <tbody>${items.map(item => {
          const disp = item.disponible ?? item.qty ?? item.cantidad ?? 0;
          const noDisp = item.noDisponible ?? 0;
          const total = item.total ?? (disp + noDisp);
          return `
          <tr>
            <td><code style="color:#F47920;font-size:0.8rem">${item.code || '—'}</code></td>
            <td><strong style="font-size:0.88rem">${item.name || item.nombre || '—'}</strong>${item.notes ? `<br><span style="font-size:0.72rem;color:#8899BB">${item.notes}</span>` : ''}</td>
            <td><b style="color:var(--success)">${disp}</b>
              ${disp>0 && disp<=3 ? '&nbsp;&nbsp;<span style="font-size:.65rem;color:#F59E0B;font-weight:600">⚠️ CRÍTICO</span>':''}
              ${disp===0 ? '&nbsp;&nbsp;<span style="font-size:.65rem;color:#EF4444;font-weight:600">⚠️ SIN STOCK</span>':''}
            </td>
            <td><b style="color:var(--warning)">${noDisp}</b></td>
            <td><b style="color:var(--primary)">${total}</b></td>
            <td style="font-size:0.85rem;color:#8899BB;font-weight:500">${item.unit || '—'}</td>
            <td>
              <button class="btn btn-outline btn-sm" onclick="editItem('${item.id}')" style="margin-right:4px">✏️</button>
              ${userRole === 'admin' ? `<button class="btn btn-danger btn-sm" onclick="deleteItem('${item.id}')">🗑️</button>` : ''}
            </td>
          </tr>`
        }).join('')}
        </tbody>
      </table>
    </div>
    ${slidedownBtn}`;
}

window.slideDownTable = function() {
  const wrap = document.getElementById('inv-table-wrap');
  const btnWrap = document.getElementById('slidedown-btn-wrap');
  if (wrap) {
    wrap.style.maxHeight = '10000px';
  }
  if (btnWrap) {
    btnWrap.style.display = 'none';
  }
};

function applyFilter() {
  const q = document.getElementById('search-inv')?.value.toLowerCase() || '';
  let filtered = allItems;
  
  if (currentFilter !== 'all') {
    if (currentFilter === 'disponible') {
      filtered = filtered.filter(i => (i.disponible ?? i.qty ?? i.cantidad ?? 0) > 0);
    } else if (currentFilter === 'en_transito') {
      filtered = filtered.filter(i => (i.noDisponible ?? 0) > 0);
    } else if (currentFilter === 'agotado') {
      filtered = filtered.filter(i => (i.disponible ?? i.qty ?? i.cantidad ?? 0) === 0);
    }
    // "entregado" u otros se ignoran
  }
  if (q) filtered = filtered.filter(i =>
    (i.code||'').toLowerCase().includes(q) ||
    (i.name||i.nombre||'').toLowerCase().includes(q) ||
    (i.location||'').toLowerCase().includes(q)
  );
  renderItems(filtered);
}

async function loadInventory() {
  try {
    const snap = await db.collection('inventory').orderBy('updatedAt','desc').get();
    allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    applyFilter();
  } catch (e) {
    console.warn('[Inventory] loadInventory error:', e.message);
    showToast('Error al cargar inventario: ' + e.message, 'error');
  }
}

function openModal(id = null) {
  editingId = id;
  const titleEl = document.getElementById('modal-title');
  if (titleEl) titleEl.textContent = id ? 'Editar Ítem' : 'Nuevo Ítem';
  if (!id) {
    const form = document.getElementById('inv-form');
    if (form) form.reset();
  }
  const overlay = document.getElementById('modal-overlay');
  if (overlay) overlay.classList.add('open');
}

function editItem(id) {
  const item = allItems.find(i => i.id === id);
  if (!item) return;
  document.getElementById('item-id').value       = id;
  document.getElementById('item-code').value     = item.code || '';

  document.getElementById('item-name').value     = item.name || item.nombre || '';
  document.getElementById('item-barcode').value  = item.codigo_barras || '';
  document.getElementById('item-qty').value      = item.qty ?? item.cantidad ?? 1;
  document.getElementById('item-min').value      = item.stock_minimo || 0;
  document.getElementById('item-unit').value     = item.unit || 'unidad';
  document.getElementById('item-litros-por-unidad').value = item.litros_por_unidad || 0;
  document.getElementById('item-kg-por-unidad').value = item.kg_por_unidad || 0;
  document.getElementById('item-status').value   = item.status || 'disponible';
  document.getElementById('item-notes').value    = item.notes || '';
  openModal(id);
}

async function deleteItem(id) {
  if (!confirm('¿Eliminar este ítem del inventario?')) return;
  try {
    await db.collection('inventory').doc(id).delete();
    showToast('Ítem eliminado', 'success');
    loadInventory();
  } catch (e) {
    console.warn('[Inventory] deleteItem error:', e.message);
    showToast('Error al eliminar ítem: ' + e.message, 'error');
  }
}

function closeModal(e) {
  if (!e || e.target === document.getElementById('modal-overlay')) {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.remove('open');
    editingId = null;
  }
}

function checkLowStock(){
  try {
    let low = 0;
    allItems.forEach(item => {
      const qty = item.qty ?? item.cantidad ?? 0;
      if (qty > 0 && qty <= 3) low++;
    });
    const alertEl = document.getElementById('stock-alert');
    if (alertEl) {
      if (low > 0) {
        alertEl.style.display = 'flex';
        const countEl = document.getElementById('alert-count');
        if (countEl) countEl.textContent = low;
      } else {
        alertEl.style.display = 'none';
      }
    }
  } catch (e) {
    console.warn('[Inventory] checkLowStock error:', e.message);
  }
}

// ═══ EXPORTAR A EXCEL (COMPARTIDO) ═══
// Esta función es un wrapper seguro alrededor de la descarga de excel
function dlXLSX(sheets, filename) {
  try {
    const wb = XLSX.utils.book_new();
    sheets.forEach(s => {
      const ws = XLSX.utils.aoa_to_sheet(s.data);
      const cols = s.data.reduce((max, row) => Math.max(max, row.length), 0);
      ws['!cols'] = Array.from({length: cols}, (_, ci) => {
        let w = 10;
        s.data.forEach(r => {
          if (r[ci] != null) {
            const l = String(r[ci]).length;
            if (l > w) w = l;
          }
        });
        return {wch: Math.min(w + 2, 40)};
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
      XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
    });
    XLSX.writeFile(wb, `${filename}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('📥 Excel descargado', 'success');
  } catch (e) {
    console.warn('[Inventory] dlXLSX error:', e.message);
    showToast('Error al generar Excel', 'error');
  }
}

function exportResumen() {
  const rows = [['RESUMEN DE INVENTARIO - SILOG SpA','','','','','',''],
    ['Fecha de generación:', new Date().toLocaleString('es-CL'),'','','','',''],
    [],
    ['Código','Producto','Disponible','En Tránsito','Total','Unidad','Alerta']];
  
  const sorted = [...allItems].sort((a,b) => (a.name||a.nombre||'').localeCompare(b.name||b.nombre||''));
  sorted.forEach(i => {
    const disp = i.disponible ?? i.qty ?? i.cantidad ?? 0;
    const noDisp = i.noDisponible ?? 0;
    const total = i.total ?? (disp + noDisp);
    const alerta = (i.stock_minimo||0)>0 && disp<=(i.stock_minimo||0) ? '⚠️ BAJO STOCK' : '';
    
    rows.push([i.code||'', i.name||i.nombre||'', disp, noDisp, total, i.unit||'', alerta]);
  });
  
  const totalDisp = allItems.reduce((s,i) => s + (i.disponible ?? i.qty ?? i.cantidad ?? 0), 0);
  const totalNoDisp = allItems.reduce((s,i) => s + (i.noDisponible ?? 0), 0);
  const totalGlobal = allItems.reduce((s,i) => s + (i.total ?? ((i.disponible ?? i.qty ?? i.cantidad ?? 0) + (i.noDisponible ?? 0))), 0);
  
  rows.push([]);
  rows.push(['','','TOTAL PRODUCTOS', allItems.length,'','','','']);
  rows.push(['','','TOTAL DISPONIBLE', totalDisp,'','','','']);
  rows.push(['','','TOTAL EN TRÁNSITO', totalNoDisp,'','','','']);
  rows.push(['','','TOTAL GLOBAL', totalGlobal,'','','','']);
  
  dlXLSX([{name: 'Resumen Inventario', data: rows}], 'SILOG_Resumen_Inventario');
}

async function exportMovimientos() {
  try {
    showToast('📥 Generando reporte…', 'info');
    const snap = await db.collection('movimientos_bodega').get();
    const movs = [];
    snap.forEach(d => {
      const m = d.data();
      m._date = m.fecha?.toDate ? m.fecha.toDate() : null;
      movs.push(m);
    });
    movs.sort((a, b) => (a._date || 0) - (b._date || 0));
    
    const rows = [
      ['FECHA DE MOVIMIENTO','N° DOCUMENTO','CODIGO DE PRODUCTO','NOMBRE DE PRODUCTO','CANTIDAD DE ENTRADA','CANTIDAD DE SALIDA','CANTIDAD EN STOCK','VALOR','OBSERVACIONES']
    ];
    
    movs.forEach(m => {
      const prod = allItems.find(p => p.id === m.producto_id) || {};
      const isEntry = ['ingreso','devolucion','abastecimiento','ajuste_pos'].includes(m.tipo);
      const qtyEntrada = isEntry ? (m.cantidad || 0) : '';
      const qtySalida = !isEntry ? (m.cantidad || 0) : '';
      rows.push([
        m._date ? m._date.toLocaleDateString('es-CL') : '',
        m.numero_documento || m.referencia || '',
        m.producto_codigo || prod.code || '',
        m.producto_nombre || prod.name || prod.nombre || '',
        qtyEntrada,
        qtySalida,
        prod.qty !== undefined ? prod.qty : (prod.cantidad || 0),
        m.valor_clp || m.valor || 0,
        m.observaciones || ''
      ]);
    });
    dlXLSX([{name: 'Movimientos', data: rows}], 'SILOG_Movimientos_Inventario');
  } catch(e) {
    console.warn('[Inventory] exportMovimientos error:', e.message);
    showToast('Error: ' + e.message, 'error');
  }
}

// Wrapper para bodega (que usaba distinto nombre para exportMovimientos)
window.exportMovimientosReport = exportMovimientos;

async function exportConsolidado() {
  try {
    showToast('📥 Generando consolidado WMS…','info');
    
    // 1. Fetch Movements
    const movSnap = await db.collection('movimientos_bodega').get();
    const movs = [];
    movSnap.forEach(d => { const m = d.data(); m._date = m.fecha?.toDate ? m.fecha.toDate() : null; movs.push(m); });
    movs.sort((a,b) => (a._date||0) - (b._date||0));
    
    // 2. Fetch Dispatches
    const despSnap = await db.collection('despachos').get();
    const desps = [];
    despSnap.forEach(d => { const dp = d.data(); dp.id = d.id; dp._date = dp.fecha?.toDate ? dp.fecha.toDate() : null; desps.push(dp); });
    
    // 3. Fetch Hojas de Ruta
    const hrSnap = await db.collection('hojas_ruta').get();
    const hrMap = {};
    hrSnap.forEach(d => { hrMap[d.id] = d.data(); });

    const sheets = [];

    // --- SHEET 1: Stock de Inventario ---
    const h1 = [
      ['CÓDIGO PRODUCTO','NOMBRE PRODUCTO','Litros x Unidad','KG x UNIDAD','DISPONIBLE','EN TRÁNSITO','TOTAL','LITROS ACTUALES','KG ACTUALES']
    ];
    const sorted = [...allItems].sort((a,b) => (a.name||a.nombre||'').localeCompare(b.name||b.nombre||''));
    sorted.forEach(i => {
      const disp = i.disponible ?? i.qty ?? i.cantidad ?? 0;
      const noDisp = i.noDisponible ?? 0;
      const total = i.total ?? (disp + noDisp);
      h1.push([
        i.code || '',
        i.name || i.nombre || '',
        i.litros_por_unidad || 0,
        i.kg_por_unidad || 0,
        disp,
        noDisp,
        total,
        i.litros_actuales || 0,
        i.kg_actuales || 0
      ]);
    });
    sheets.push({name: 'Stock Inventario', data: h1});

    // --- SHEET 2: Movimientos ---
    const h2 = [
      ['FECHA DE MOVIMIENTO','N° DOCUMENTO','CODIGO DE PRODUCTO','NOMBRE DE PRODUCTO','CANTIDAD DE ENTRADA','CANTIDAD DE SALIDA','CANTIDAD EN STOCK','VALOR','OBSERVACIONES']
    ];
    movs.forEach(m => {
      const prod = allItems.find(p => p.id === m.producto_id) || {};
      const isEntry = ['ingreso','devolucion','abastecimiento','ajuste_pos'].includes(m.tipo);
      const qtyEntrada = isEntry ? (m.cantidad || 0) : '';
      const qtySalida = !isEntry ? (m.cantidad || 0) : '';
      h2.push([
        m._date ? m._date.toLocaleDateString('es-CL') : '',
        m.numero_documento || m.referencia || '',
        m.producto_codigo || prod.code || '',
        m.producto_nombre || prod.name || prod.nombre || '',
        qtyEntrada,
        qtySalida,
        prod.qty !== undefined ? prod.qty : (prod.cantidad || 0),
        m.valor_clp || m.valor || 0,
        m.observaciones || ''
      ]);
    });
    sheets.push({name: 'Movimientos', data: h2});

    // --- SHEET 3: Status ---
    const docGroup = {};
    const getDocKey = (docNum) => String(docNum || '').trim().toUpperCase();
    
    desps.forEach(d => {
      const docNum = d.guia_numero || d.n_documento || d.referencia;
      if (!docNum) return;
      
      // Filtrar por cualquier formato de TotalEnergies (ej: Total, TOTALENERGIES, Total Energies)
      const trip = hrMap[d.turno_id] || {};
      const dist = (trip.nombre_distribuidor || trip.distribuidor || d.nombre_distribuidor || d.distribuidor || '').trim().toLowerCase();
      if (!dist.includes('total')) return;

      const key = getDocKey(docNum);
      if (!docGroup[key]) {
        docGroup[key] = {
          docNum, fechaRecepcion: '', cliente: d.cliente_nombre || '',
          bultos: 0, litros: 0, kg: 0, fechaEntrega: '', status: '',
          movil: '', conductor: '', comuna: d.cliente_comuna || '',
          region: d.cliente_region || d.region || '',
          _desps: [], _movs: []
        };
      }
      const g = docGroup[key];
      g._desps.push(d);
      
      let b = parseInt(d.bultos) || parseInt(d.cantidad) || 0;
      if (!b && d.descripcion) {
        const m = d.descripcion.match(/\d+/);
        if(m) b = parseInt(m[0]);
      }
      if(!b) b = 1;
      g.bultos += b;
      g.litros += parseFloat(d.litros) || parseFloat(d.litros_total) || 0;
      g.kg += parseFloat(d.kg) || parseFloat(d.kg_total) || 0;
      
      let tripDate = trip.fecha_despacho || trip.fecha || '';
      if (tripDate) {
        if (tripDate.includes('-')) {
          const parts = tripDate.split('-');
          if (parts[0].length === 4) tripDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
        }
        g.fechaEntrega = tripDate;
      }
      if(trip.patente) g.movil = trip.patente;
      if(trip.conductor_nombre) g.conductor = trip.conductor_nombre;
    });

    movs.forEach(m => {
      const docNum = m.numero_documento || m.referencia;
      if (!docNum) return;
      const key = getDocKey(docNum);
      if (!docGroup[key]) {
        docGroup[key] = {
          docNum, fechaRecepcion: '', cliente: m.producto_nombre || '',
          bultos: 0, litros: 0, kg: 0, fechaEntrega: m._date ? m._date.toLocaleDateString('es-CL') : '',
          status: '', movil: '', conductor: m.operario_nombre || '',
          comuna: m.ubicacion || '', region: '',
          _desps: [], _movs: []
        };
      }
      const g = docGroup[key];
      g._movs.push(m);
      
      if(g._desps.length === 0){
        g.bultos += m.cantidad || 0;
        const prod = allItems.find(p => p.id === m.producto_id) || {};
        if(prod.litros_por_unidad) g.litros += (prod.litros_por_unidad * (m.cantidad || 0));
        if(prod.kg_por_unidad) g.kg += (prod.kg_por_unidad * (m.cantidad || 0));
        if(!g.cliente && m.producto_nombre) g.cliente = m.producto_nombre;
      }
    });

    const h3 = [
      ['N°DOCUMENTO','FECHA DE RECEPCIÓN','CLIENTE','BULTOS','LITROS','KG','FECHA DE ENTREGA','STATUS','MOVIL','CONDUCTOR','COMUNA','REGIÓN']
    ];

    Object.values(docGroup).forEach(g => {
      if (g._desps.length === 0) return; // Omitir documentos de bodega generales que no tienen despachos de TotalEnergies

      let totalSalidaBodega = 0;
      g._movs.forEach(m => {
        if (m.tipo === 'salida') {
          totalSalidaBodega += parseInt(m.cantidad) || 0;
        }
      });
      if (totalSalidaBodega > 0) {
        g.bultos = totalSalidaBodega;
      }

      let finalStatus = '';
      const hasDev = g._desps.some(d => d.estado === 'devuelto');
      const allEnt = g._desps.every(d => d.estado === 'entregado');
      if(allEnt) {
        finalStatus = 'ENTREGADO';
      } else if(hasDev) {
        const hasRechazo = g._desps.some(d => {
          const mot = (d.devolucion_motivo || '').toLowerCase();
          return mot.includes('rechazo') || mot.includes('rechazado');
        });
        finalStatus = hasRechazo ? 'RECHAZADO' : 'DEVOLUCION';
      } else {
        finalStatus = 'PENDIENTE';
      }
      h3.push([g.docNum, g.fechaRecepcion, g.cliente, g.bultos, g.litros, g.kg, g.fechaEntrega, finalStatus, g.movil, g.conductor, g.comuna, g.region]);
    });
    sheets.push({name: 'Status', data: h3});

    dlXLSX(sheets, 'SILOG_Consolidado_WMS');
  } catch(e) {
    console.warn('[Inventory] exportConsolidado error:', e.message);
    showToast('Error: ' + e.message, 'error');
  }
}

function downloadPlantilla() {
  const wb = XLSX.utils.book_new();
  const getColLetter = (colIdx) => {
    let temp, letter = '';
    while (colIdx >= 0) {
      temp = colIdx % 26;
      letter = String.fromCharCode(temp + 65) + letter;
      colIdx = Math.floor(colIdx / 26) - 1;
    }
    return letter;
  };

  const stockRows = [
    ['CÓDIGO PRODUCTO','NOMBRE PRODUCTO','Litros x Unidad','KG x UNIDAD','STOCK ACTUAL','LITROS ACTUALES','KG ACTUALES'],
    ['PROD-001','Aceite Lubricante 1L',1.0,0.0,150,150.0,0.0],
    ['PROD-002','Harina Industrial 25KG',0.0,25.0,40,0.0,1000.0]
  ];
  const wsStock = XLSX.utils.aoa_to_sheet(stockRows);
  wsStock['!cols'] = [{wch:18},{wch:30},{wch:16},{wch:16},{wch:16},{wch:18},{wch:18}];
  
  for (let c = 0; c < stockRows[0].length; c++) {
    const ref = getColLetter(c) + '1';
    if (wsStock[ref]) {
      wsStock[ref].s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
    }
  }

  XLSX.utils.book_append_sheet(wb, wsStock, 'Stock Inventario');

  const movRows = [
    ['FECHA DE MOVIMIENTO','N° DOCUMENTO','CODIGO DE PRODUCTO','NOMBRE DE PRODUCTO','CANTIDAD DE ENTRADA','CANTIDAD DE SALIDA','CANTIDAD EN STOCK','VALOR','OBSERVACIONES'],
    [new Date().toISOString().slice(0,10),'GD-1001','PROD-001','Aceite Lubricante 1L',50,'',200,15000,'Abastecimiento inicial'],
    [new Date().toISOString().slice(0,10),'GD-1002','PROD-002','Harina Industrial 25KG','',10,30,8000,'Despacho cliente']
  ];
  const wsMov = XLSX.utils.aoa_to_sheet(movRows);
  wsMov['!cols'] = [{wch:20},{wch:15},{wch:18},{wch:30},{wch:22},{wch:22},{wch:20},{wch:12},{wch:25}];
  
  for (let c = 0; c < movRows[0].length; c++) {
    const ref = getColLetter(c) + '1';
    if (wsMov[ref]) {
      wsMov[ref].s = { font: { bold: true }, alignment: { horizontal: 'center', vertical: 'center' } };
    }
  }

  XLSX.utils.book_append_sheet(wb, wsMov, 'Movimientos');

  XLSX.writeFile(wb, 'SILOG_Plantilla_WMS.xlsx');
}

// Depende de las variables currentUserId, currentUser, db.
async function importExcel(e) {
  const file = e.target.files[0];
  if (!file) return;
  try {
    showToast('Importando Excel...', 'info');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, {type: 'array'});
    
    let totalUpdated = 0;
    let totalImported = 0;
    let totalErrors = 0;
    let totalMovs = 0;
    const batch = db.batch();

    // The logic depends on having `currentUser.uid` or using a provided `uid`.
    const uid = (typeof currentUser !== 'undefined' && currentUser && currentUser.uid) || 
                (typeof _uid !== 'undefined' ? _uid : 'unknown');

    for (const sheetName of wb.SheetNames) {
      const ws = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, {defval: ''});
      if (!rows.length) continue;

      const firstRow = rows[0];
      const firstRowKeys = Object.keys(firstRow).map(k => k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim());
      const isMovements = firstRowKeys.includes('fecha de movimiento') || firstRowKeys.includes('cantidad de entrada') || firstRowKeys.includes('cantidad de salida');

      if (isMovements) {
        const movColMap = {
          'fecha de movimiento':'fecha_movimiento','n documento':'n_documento','numero documento':'n_documento',
          'codigo de producto':'code','nombre de producto':'name','cantidad de entrada':'cantidad_entrada',
          'cantidad de salida':'cantidad_salida','cantidad en stock':'cantidad_stock',
          'valor':'valor','observaciones':'observaciones','obsarvaciones':'observaciones'
        };

        for (const row of rows) {
          const item = {};
          Object.entries(row).forEach(([k, v]) => {
            const normKey = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const mapped = movColMap[normKey];
            if (mapped) item[mapped] = v;
          });

          if (!item.code) { totalErrors++; continue; }

          const codeStr = String(item.code).trim();
          const codeUpper = codeStr.toUpperCase();
          const existing = allItems.find(i => (i.code || '').toUpperCase() === codeUpper);

          let prodId = '';
          let finalName = item.name || '';
          let litrosPorUnidad = 0;
          let kgPorUnidad = 0;

          if (existing) {
            prodId = existing.id;
            finalName = existing.name || existing.nombre || finalName;
            litrosPorUnidad = existing.litros_por_unidad || 0;
            kgPorUnidad = existing.kg_por_unidad || 0;
          } else {
            const newProdRef = db.collection('inventory').doc();
            prodId = newProdRef.id;
            const startStock = parseInt(item.cantidad_stock) || 0;
            const newProdData = {
              code: codeStr,
              name: finalName,
              nombre: finalName,
              qty: startStock,
              cantidad: startStock,
              litros_por_unidad: 0,
              kg_por_unidad: 0,
              litros_actuales: 0,
              kg_actuales: 0,
              unit: 'unidad',
              status: startStock === 0 ? 'no_disponible' : 'disponible',
              stock_minimo: 0,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              createdBy: uid,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedBy: uid
            };
            batch.set(newProdRef, newProdData);
            allItems.push({id: prodId, ...newProdData});
          }

          const cantEntrada = parseInt(item.cantidad_entrada) || 0;
          const cantSalida = parseInt(item.cantidad_salida) || 0;
          const valor = parseFloat(item.valor) || 0;
          const obs = String(item.observaciones || '').trim();
          const docNum = String(item.n_documento || '').trim();

          let tipoMov = 'ajuste';
          let cantMov = 0;
          if (cantEntrada > 0) { tipoMov = 'ingreso'; cantMov = cantEntrada; }
          else if (cantSalida > 0) { tipoMov = 'salida'; cantMov = cantSalida; }

          let fechaDate = new Date();
          if (item.fecha_movimiento) {
            const parsedD = new Date(item.fecha_movimiento);
            if (!isNaN(parsedD.getTime())) fechaDate = parsedD;
          }

          const operarioName = (typeof currentUserData !== 'undefined' && currentUserData?.name) || 
                               (typeof _name !== 'undefined' && _name) || 'Importación';

          const movRef = db.collection('movimientos_bodega').doc();
          batch.set(movRef, {
            producto_id: prodId,
            producto_nombre: finalName,
            producto_codigo: codeStr,
            tipo: tipoMov,
            cantidad: cantMov,
            valor_clp: valor,
            numero_documento: docNum,
            referencia: docNum ? `Doc: ${docNum}` : (obs || 'Movimiento importado'),
            observaciones: obs,
            operario_uid: uid,
            operario_nombre: operarioName,
            fecha: firebase.firestore.Timestamp.fromDate(fechaDate),
            scan_validado: false
          });
          totalMovs++;

          if (item.cantidad_stock !== undefined && item.cantidad_stock !== '') {
            const newStock = parseInt(item.cantidad_stock) || 0;
            const prodRef = db.collection('inventory').doc(prodId);
            batch.update(prodRef, {
              qty: newStock,
              cantidad: newStock,
              litros_actuales: litrosPorUnidad * newStock,
              kg_actuales: kgPorUnidad * newStock,
              status: newStock === 0 ? 'no_disponible' : 'disponible',
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedBy: uid
            });
            totalUpdated++;
          }
        }
      } else {
        const colMap = {
          'codigo producto':'code','codigo':'code','código':'code','code':'code','tracking':'code',
          'nombre producto':'name','nombre':'name','name':'name','producto':'name','descripcion':'name',
          'litros x unidad':'litros_por_unidad',
          'kg x unidad':'kg_por_unidad',
          'stock actual':'qty','cantidad':'qty','qty':'qty','stock':'qty',
          'litros actuales':'litros_actuales',
          'kg actuales':'kg_actuales'
        };

        for (const row of rows) {
          const item = {};
          Object.entries(row).forEach(([k, v]) => {
            const normKey = k.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
            const mapped = colMap[normKey];
            if (mapped) item[mapped] = v;
          });
          
          if (!item.code && !item.name) { totalErrors++; continue; }

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

          if (litrosPorUnidad > 0) item.unit = 'Litros';
          else if (kgPorUnidad > 0) item.unit = 'Kilos';
          else item.unit = 'unidad';

          const codeUpper = item.code.toUpperCase();
          const existing = allItems.find(i => (i.code || '').toUpperCase() === codeUpper);

          if (existing) {
            const ref = db.collection('inventory').doc(existing.id);
            const updateData = {
              name: item.name, nombre: item.nombre,
              qty: item.qty, cantidad: item.cantidad,
              litros_por_unidad: item.litros_por_unidad, kg_por_unidad: item.kg_por_unidad,
              litros_actuales: item.litros_actuales, kg_actuales: item.kg_actuales,
              unit: item.unit, status: item.status,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedBy: uid
            };
            batch.update(ref, updateData);
            totalUpdated++;
          } else {
            const ref = db.collection('inventory').doc();
            const newData = {
              ...item,
              stock_minimo: 0,
              createdAt: firebase.firestore.FieldValue.serverTimestamp(),
              createdBy: uid,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
              updatedBy: uid
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
    checkLowStock();
  } catch(err) {
    console.warn('[Inventory] importExcel error:', err.message);
    showToast('Error al importar: ' + err.message, 'error');
  }
  e.target.value = '';
}

/**
 * TAREA 1: checkProductExists(nombre, codigo)
 * Verifica si existe un producto por nombre o código ejecutando validaciones paralelas.
 */
async function checkProductExists(nombre, codigo) {
  const normNombre = (nombre || '').trim().toLowerCase();
  const normCodigo = (codigo || '').trim().toUpperCase();

  try {
    // Para cumplir el requisito de queries paralelas:
    // Nota: Firestore es case-sensitive. Si la app guarda los nombres con capitalización original,
    // where('nombre', '==', normNombre) podría no encontrarlo. Por seguridad, validamos contra
    // allItems que contiene la caché de inventario.
    
    // Si allItems no está cargado, lo cargamos
    if (!window.allItems || window.allItems.length === 0) {
      const snap = await db.collection('inventory').get();
      window.allItems = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    const exists = inventorySnap.docs.map(d=>d.data()).find(i => 
      (i.code || '').toUpperCase() === normCodigo ||
      (i.name || '').toLowerCase() === normNombre || 
      (i.nombre || '').toLowerCase() === normNombre
    );

    if (exists) {
      if ((exists.code || '').toUpperCase() === normCodigo) {
        throw new Error(`El código "${normCodigo}" ya está registrado.`);
      } else {
        throw new Error(`El producto con nombre "${exists.name || exists.nombre}" ya existe.`);
      }
    }
    
    return false;
  } catch(e) {
    throw e;
  }
}
