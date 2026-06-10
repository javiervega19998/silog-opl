/**
 * services/export_pipeline.js  — v3.0 (Sábana Maestra Unificada)
 * Genera UN SOLO CSV maestro (silog_master_bi.csv) con estructura plana
 * que combina Viajes, Inventario TotalEnergies y Distribución TotalEnergies
 * en filas tipadas, optimizado para ingesta directa en Power BI sin
 * transformaciones adicionales.
 *
 * Columnas:  Tipo_Registro | Proveedor | Fecha | ID_Referencia |
 *            Patente_Vehiculo | Ruta_Comuna | Cliente | Producto_Cdigo |
 *            Volumen_Lts | Peso_Kg | Stock_Actual | Gasto_Asociado
 */

// ── Constantes ────────────────────────────────────────────────────────────────

const CSV_MASTER_FILENAME = 'silog_master_bi.csv';

const HEADERS = [
  'Tipo_Registro',
  'Proveedor',
  'Fecha',
  'ID_Referencia',
  'Patente_Vehiculo',
  'Ruta_Comuna',
  'Cliente',
  'Producto_Cdigo',
  'Volumen_Lts',
  'Peso_Kg',
  'Stock_Actual',
  'Gasto_Asociado',
];

const BOM = '\uFEFF';

// ── Utilidades ────────────────────────────────────────────────────────────────

function formatFechaBI(ts) {
  if (!ts) return '';
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    if (isNaN(d.getTime())) return '';
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  } catch { return ''; }
}

function csv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val)
    .replace(/\r?\n|\r/g, ' ')
    .replace(/\t/g, ' ')
    .replace(/"/g, "'");
  return (s.includes(',') || s.includes(';')) ? `"${s}"` : s;
}

function fila(tipo, proveedor, fecha, id, patente, ruta, cliente, Cdigo, lts, kg, stock, gasto) {
  return [tipo, proveedor, fecha, id, patente, ruta, cliente, Cdigo, lts, kg, stock, gasto].map(csv).join(',');
}

function triggerDownload(content, filename) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename; a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function normalizarProveedor(distribuidor) {
  const d = (distribuidor || '').toLowerCase();
  if (d.includes('total')) return 'TotalEnergies';
  if (d.includes('cintec')) return 'Cintec';
  return distribuidor || 'Otro';
}

function esTotalEnergies(dist) {
  return (dist || '').toLowerCase().includes('total');
}

// ── Bloque A: Filas de Viajes ─────────────────────────────────────────────────

function filasViajes(datosFlota) {
  return datosFlota.map(r => {
    const kmInicial   = parseFloat(r.km_inicial || r.km_inicial_actual || 0) || 0;
    const kmFinal     = parseFloat(r.km_final   || 0) || 0;
    const combustible = parseFloat(r.combustible || 0) || 0;
    const peaje       = parseFloat(r.peaje       || 0) || 0;

    let rutaComunas = r.ruta_comunas || r.ruta || r.cliente_comuna || '';
    if (!rutaComunas && Array.isArray(r.entregas) && r.entregas.length > 0) {
      rutaComunas = [...new Set(r.entregas.map(e => e.cliente_comuna || e.comuna || '').filter(Boolean))].join(' / ');
    }

    const fecha = r.fecha || formatFechaBI(r.created_at);

    return fila(
      'Viaje',
      normalizarProveedor(r.distribuidor),
      fecha,
      r.id || '',
      (r.patente || '').toUpperCase(),
      rutaComunas,
      r.cliente_nombre || '',   // cliente del viaje si existe
      'N/A',                    // sin Cdigo en viajes
      '',                       // sin litros a nivel de viaje
      '',                       // sin kg a nivel de viaje
      '',                       // sin stock a nivel de viaje
      combustible + peaje
    );
  });
}

// ── Bloque B: Filas de Inventario TotalEnergies ───────────────────────────────

async function filasInventarioTE() {
  const db = firebase.firestore();

  const [invSnap, movSnap] = await Promise.all([
    db.collection('inventory').get(),
    db.collection('movimientos_bodega').get()
  ]);

  const invItems = invSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Acumuladores de movimientos por producto_id
  const acum = {};
  movSnap.docs.forEach(d => {
    const m   = d.data();
    const pid = m.producto_id;
    if (!pid) return;
    if (!acum[pid]) acum[pid] = { abast: 0, merma: 0, salidas: 0 };
    const tipo     = (m.tipo || '').toLowerCase();
    const cantidad = parseFloat(m.cantidad) || 0;
    if (['ingreso', 'abastecimiento', 'devolucion'].includes(tipo)) acum[pid].abast   += cantidad;
    else if (tipo === 'merma')  acum[pid].merma   += cantidad;
    else if (tipo === 'salida') acum[pid].salidas += cantidad;
  });

  // Una fila por producto — incluye stock 0
  const sorted = [...invItems].sort((a, b) =>
    (a.name || a.nombre || '').localeCompare(b.name || b.nombre || '', 'es')
  );

  return sorted.map(item => {
    const pid      = item.id;
    const stock    = parseFloat(item.qty ?? item.cantidad ?? 0) || 0;
    const litrosUn = parseFloat(item.litros_por_unidad) || 0;
    const kgUn     = parseFloat(item.kg_por_unidad)     || 0;
    const acc      = acum[pid] || { abast: 0, merma: 0, salidas: 0 };
    const litrosSalidos = acc.salidas > 0 ? (acc.salidas * litrosUn).toFixed(2) : 0;
    const kgSalidos     = acc.salidas > 0 ? (acc.salidas * kgUn).toFixed(2)     : 0;

    return fila(
      'Inventario',
      'TotalEnergies',
      '',                           // sin fecha a nivel de ítem de stock
      pid,
      '',                           // sin patente
      '',                           // sin ruta
      '',                           // sin cliente
      item.Cdigo || item.code || '',
      litrosSalidos,
      kgSalidos,
      stock,
      ''                            // sin gasto monetario directo
    );
  });
}

// ── Bloque C: Filas de Distribución TotalEnergies ─────────────────────────────

async function filasDistribucionTE() {
  const db = firebase.firestore();

  const [despSnap, hrSnap, invSnap] = await Promise.all([
    db.collection('despachos').get(),
    db.collection('hojas_ruta').get(),
    db.collection('inventory').get()
  ]);

  const hrMap  = {};
  hrSnap.docs.forEach(d => { hrMap[d.id] = d.data(); });

  const invMap = {};
  invSnap.docs.forEach(d => { invMap[d.id] = d.data(); });

  const rows = [];

  despSnap.docs.forEach(d => {
    const desp = d.data();
    const hr   = hrMap[desp.turno_id] || {};
    const dist = desp.distribuidor || hr.distribuidor || hr.nombre_distribuidor || '';

    if (!esTotalEnergies(dist)) return;

    const idDoc  = desp.guia_numero || desp.n_factura || desp.numero_guia || desp.n_documento || d.id;
    const tipoDoc = desp.n_factura || desp.factura_numero ? 'Factura' : 'Guia';
    const cliente  = desp.cliente_nombre || desp.nombre_cliente || '';
    const comuna   = desp.cliente_comuna || desp.comuna || hr.cliente_comuna || '';

    let litros = parseFloat(desp.litros || desp.litros_total || desp.volumen_litros || 0) || 0;
    let kg     = parseFloat(desp.kg     || desp.kg_total     || desp.peso_kg        || 0) || 0;

    if (!litros && !kg && desp.producto_id) {
      const prod = invMap[desp.producto_id] || {};
      const cant = parseFloat(desp.cantidad || desp.bultos || 1) || 1;
      litros = (parseFloat(prod.litros_por_unidad) || 0) * cant;
      kg     = (parseFloat(prod.kg_por_unidad)     || 0) * cant;
    }

    if (!litros && !kg && Array.isArray(desp.entregas)) {
      desp.entregas.forEach(e => {
        const prod = invMap[e.producto_id || ''] || {};
        const cant = parseFloat(e.cantidad || e.bultos || 1) || 1;
        litros += (parseFloat(prod.litros_por_unidad) || 0) * cant;
        kg     += (parseFloat(prod.kg_por_unidad)     || 0) * cant;
      });
    }

    const fecha = formatFechaBI(desp.pod_timestamp || desp.fecha_entrega || desp.fecha || desp.created_at);

    rows.push(fila(
      tipoDoc === 'Factura' ? 'Distribucion_Factura' : 'Distribucion_Guia',
      'TotalEnergies',
      fecha,
      idDoc,
      (hr.patente || '').toUpperCase(),
      comuna,
      cliente,
      '',                          // sin Cdigo a nivel de despacho
      litros ? litros.toFixed(2) : 0,
      kg     ? kg.toFixed(2)     : 0,
      '',                          // sin stock a nivel de despacho
      ''                           // sin gasto CLP a nivel de despacho
    ));
  });

  return rows;
}

// ── Función pública exportada ─────────────────────────────────────────────────

/**
 * Genera y descarga un único CSV maestro (silog_master_bi.csv) con
 * filas tipadas para Viajes, Inventario y Distribución.
 *
 * @param {Array} datosFlotaFiltrados - state.allDocs del orquestador (hojas_ruta filtradas).
 */
export async function generarDatasetBI(datosFlotaFiltrados) {
  if (typeof showToast === 'function') {
    showToast('⏳ Construyendo sábana de datos maestra...', 'info');
  }

  // ── Recolectar filas de los 3 bloques ────────────────────────────────────
  const errores = [];

  let rowsViajes      = [];
  let rowsInventario  = [];
  let rowsDistribucion = [];

  // Bloque A — sincrónico (datos ya en memoria)
  try {
    if (datosFlotaFiltrados && datosFlotaFiltrados.length > 0) {
      rowsViajes = filasViajes(datosFlotaFiltrados);
    }
  } catch (e) {
    console.error('[ExportBI] Error en bloque Viajes:', e);
    errores.push('Viajes');
  }

  // Bloques B y C — asíncronos (Firestore)
  const [resInv, resDist] = await Promise.allSettled([
    filasInventarioTE(),
    filasDistribucionTE()
  ]);

  if (resInv.status === 'fulfilled') {
    rowsInventario = resInv.value;
  } else {
    console.error('[ExportBI] Error en bloque Inventario:', resInv.reason);
    errores.push('Inventario');
  }

  if (resDist.status === 'fulfilled') {
    rowsDistribucion = resDist.value;
  } else {
    console.error('[ExportBI] Error en bloque Distribución:', resDist.reason);
    errores.push('Distribucion');
  }

  // ── Ensamblar CSV único ──────────────────────────────────────────────────
  const totalFilas = rowsViajes.length + rowsInventario.length + rowsDistribucion.length;

  if (totalFilas === 0) {
    if (typeof showToast === 'function') {
      showToast('⚠️ No hay datos para exportar. Verifica los filtros activos.', 'error');
    }
    return;
  }

  const headerLine = HEADERS.map(csv).join(',');
  const allRows    = [...rowsViajes, ...rowsInventario, ...rowsDistribucion];
  const csvContent = BOM + [headerLine, ...allRows].join('\r\n');

  triggerDownload(csvContent, CSV_MASTER_FILENAME);

  if (typeof showToast === 'function') {
    const msg = errores.length === 0
      ? `✅ Sábana maestra exportada: ${totalFilas} filas → ${CSV_MASTER_FILENAME}`
      : `⚠️ Exportado con errores en: ${errores.join(', ')} (${totalFilas} filas totales)`;
    showToast(msg, errores.length === 0 ? 'success' : 'error');
  }
}
