// ══════════════════════════════════════════════════════════
// SILOG SpA — REPORTE DE CHECKLIST OPERACIONAL
// Formato: Documento formal (estilo Google Docs / Word)
// Compartido: checklist.html  &  admin.html
// ══════════════════════════════════════════════════════════

function generateChecklistPDF(r) {
  const win = window.open('', '_blank');
  if (!win) { showToast('Habilita pop-ups para descargar el PDF', 'error'); return; }

  const fecha   = formatDate(r.fecha_chequeo);
  const patente = r.patente_chequeo || '—';
  const operador = r.nombre_operador || '—';
  const combustible = r.nivel_combustible || '—';

  // ── Logo (base64 from logo-data.js) ──────────────────────
  const logoSrc = (typeof SILOG_LOGO_B64 !== 'undefined') ? SILOG_LOGO_B64 : '';

  // ── Helpers ──────────────────────────────────────────────

  /** Quita acentos para comparación robusta */
  function strip(s) { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim(); }

  /** Normaliza un valor booleano (datos antiguos) o string (datos nuevos) */
  function norm(val) {
    if (val === true)  return 'Check';
    if (val === false) return 'Falla';
    if (!val || val === '—') return '';
    return String(val).trim();
  }

  /** Clasifica nivel de fluido: 'ok'|'info'|'warn'|'danger'|'' */
  function fluidLevel(v) {
    if (!v) return '';
    const s = strip(v);
    if (s === 'maximo' || s === 'full' || s === 'lleno' || s === 'check') return 'ok';
    if (s === 'normal')       return 'info';
    if (s === 'bajo' || s === '1/4') return 'warn';
    if (s === 'vacio' || s === 'critico') return 'danger';
    return 'warn'; // fallback
  }

  // ── 4-Tier badge system ──────────────────────────────────

  /** Badge para ítems mecánicos/equipamiento */
  function mechBadge(val) {
    const v = norm(val);
    if (!v) return '<span class="badge badge-na">— Sin dato</span>';
    if (strip(v) === 'check') return `<span class="badge badge-ok"><span class="dot dot-ok"></span>✓ ${v}</span>`;
    if (/Falla|Sin |Roto/i.test(v)) return `<span class="badge badge-danger"><span class="dot dot-danger"></span>✗ ${v}</span>`;
    return `<span class="badge badge-warn"><span class="dot dot-warn"></span>⚠ ${v}</span>`;
  }

  /** Mapea valor crudo a etiqueta de fluido para visualización */
  function fluidLabel(v) {
    const s = strip(v);
    if (s === 'maximo' || s === 'full' || s === 'lleno' || s === 'check') return 'Maximo';
    if (s === 'normal') return 'Normal';
    if (s === 'bajo' || s === '1/4') return 'Bajo';
    if (s === 'vacio' || s === 'critico' || s === 'minimo') return 'Vacio';
    return v; // fallback: valor original
  }

  /** Badge para niveles de fluidos (4 niveles con comparación sin acentos) */
  function fluidBadge(val) {
    const v = norm(val);
    const lvl = fluidLevel(v);
    const label = fluidLabel(v);
    if (!v) return '<span class="badge badge-na">— Sin dato</span>';
    if (lvl === 'ok')     return `<span class="badge badge-ok"><span class="dot dot-ok"></span>✓ ${label}</span>`;
    if (lvl === 'info')   return `<span class="badge badge-info"><span class="dot dot-info"></span>● ${label}</span>`;
    if (lvl === 'warn')   return `<span class="badge badge-warn"><span class="dot dot-warn"></span>⚠ ${label}</span>`;
    if (lvl === 'danger') return `<span class="badge badge-danger"><span class="dot dot-danger"></span>✗ ${label}</span>`;
    return `<span class="badge badge-warn"><span class="dot dot-warn"></span>⚠ ${v}</span>`;
  }

  /** Badge booleano */
  function boolBadge(val) {
    if (val === true || val === 'true') return '<span class="badge badge-ok"><span class="dot dot-ok"></span>✓ Sí</span>';
    return '<span class="badge badge-danger"><span class="dot dot-danger"></span>✗ No</span>';
  }

  /** Fila de tabla */
  function row(label, badgeHtml) {
    return `<tr><td class="col-label">${label}</td><td class="col-value">${badgeHtml}</td></tr>`;
  }

  /** Tabla de ítems mecánicos */
  function tblMech(keys, labels) {
    return keys.map(k => row(labels[k] || k, mechBadge(r['chequeo_' + k]))).join('');
  }

  /** Tabla de fluidos */
  function tblFluid(keys, labels) {
    return keys.map(k => row(labels[k] || k, fluidBadge(r['chequeo_' + k]))).join('');
  }

  // ── Contadores para resumen ─────────────────────────────
  const mechFields = [
    'frenos','direccion','suspension','sistema_electrico','panel','bocina',
    'sensor_retroceso','alarmas','neumaticos','neumatico_repuesto',
    'medidor_presion','carroseria','vidrios','espejos','asientos','aseo',
    'luces','cinturon','extintor','botiquin','conos','tacos','linterna',
    'herramientas','gata'
  ];
  const fluidFields = ['nivel_aceite','nivel_refrigerante','liquido_freno','liquido_direccion','agua_parabrisas'];
  const boolFields = [
    'chequeo_licencia_conductor','chequeo_padron','chequeo_permiso_circulacion',
    'chequeo_revision_tecnica','chequeo_soap','chequeo_medicion_gases',
    'condicion_fisica','descanso_operador','salud_mental_operador',
    'consiente_responsabilidad_chequeo'
  ];

  let totalItems = 0, okItems = 0, warnItems = 0, dangerItems = 0, naItems = 0;

  mechFields.forEach(k => {
    const v = norm(r['chequeo_' + k]);
    totalItems++;
    if (!v) { naItems++; return; }
    if (strip(v) === 'check') okItems++;
    else if (/Falla|Sin |Roto/i.test(v)) dangerItems++;
    else warnItems++;
  });

  fluidFields.forEach(k => {
    const v = norm(r['chequeo_' + k]);
    totalItems++;
    if (!v) { naItems++; return; }
    const lvl = fluidLevel(v);
    if (lvl === 'ok' || lvl === 'info') okItems++;   // Máximo y Normal = conforme
    else if (lvl === 'danger') dangerItems++;         // Vacío = crítico
    else warnItems++;                                 // Bajo = advertencia
  });

  boolFields.forEach(k => {
    totalItems++;
    if (r[k] === true || r[k] === 'true') okItems++;
    else dangerItems++;
  });

  const pctOk = totalItems > 0 ? Math.round((okItems / totalItems) * 100) : 0;
  const statusColor = pctOk >= 90 ? '#059669' : pctOk >= 70 ? '#d97706' : '#dc2626';
  const statusText  = pctOk >= 90 ? 'APROBADO' : pctOk >= 70 ? 'OBSERVACIONES' : 'NO CONFORME';

  const L = {
    frenos:'Frenos', direccion:'Dirección', suspension:'Suspensión',
    sistema_electrico:'Sistema Eléctrico', panel:'Panel de Instrumentos',
    bocina:'Bocina', sensor_retroceso:'Sensor de Retroceso', alarmas:'Alarmas',
    nivel_aceite:'Aceite Motor', nivel_refrigerante:'Refrigerante',
    liquido_freno:'Líquido de Frenos', liquido_direccion:'Líquido Dirección',
    agua_parabrisas:'Agua Parabrisas', neumaticos:'Neumáticos',
    neumatico_repuesto:'Neumático Repuesto', medidor_presion:'Medidor Presión',
    carroseria:'Carrocería', vidrios:'Vidrios', espejos:'Espejos',
    asientos:'Asientos', aseo:'Aseo Interior', luces:'Luces',
    cinturon:'Cinturón de Seguridad', extintor:'Extintor', botiquin:'Botiquín',
    conos:'Conos de Seguridad', tacos:'Tacos', linterna:'Linterna',
    herramientas:'Herramientas', gata:'Gata',
  };

  const now = new Date();
  const docNum = `CK-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${patente.replace(/[^A-Z0-9]/gi,'')}`;
  const emitDate = now.toLocaleDateString('es-CL', {day:'2-digit', month:'long', year:'numeric'});

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Checklist ${patente} — ${fecha}</title>
<style>
  @page { size: letter portrait; margin: 18mm 18mm 22mm 22mm; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-break { page-break-inside: avoid; }
  }
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    font-family: 'Segoe UI','Calibri','Helvetica Neue',Arial,sans-serif;
    font-size: 10.5pt; color: #1e293b; line-height: 1.5;
    background: #fff; max-width: 820px; margin: 0 auto; padding: 24px 32px 36px;
  }

  /* ── Header ─────────────────── */
  .header-bar {
    display:flex; align-items:center; justify-content:space-between;
    padding-bottom:6px; border-bottom:3px solid #1B4B9B; margin-bottom:2px;
  }
  .header-left { display:flex; align-items:center; gap:12px; }
  .logo-img { height:150px; width:auto; object-fit:contain; }
  .company-info .name { font-size:19px; font-weight:800; color:#1B4B9B; letter-spacing:-0.5px; line-height:1.2; }
  .company-info .tagline { font-size:8.5pt; color:#64748b; }
  .doc-meta { text-align:right; }
  .doc-meta .doc-type { font-size:12px; font-weight:700; color:#1B4B9B; text-transform:uppercase; letter-spacing:0.5px; }
  .doc-meta .doc-id { font-size:8pt; color:#94a3b8; letter-spacing:0.8px; margin-top:2px; font-family:'Consolas','Courier New',monospace; }
  .doc-meta .doc-date { font-size:8.5pt; color:#475569; margin-top:3px; }
  .accent-line { height:2px; background:linear-gradient(90deg,#F47920 0%,#F47920 30%,transparent 100%); margin-bottom:10px; }

  /* ── Title ──────────────────── */
  .title-block { margin-bottom:16px; }
  .title-block h1 { font-size:16pt; font-weight:700; color:#0f172a; margin-bottom:2px; }
  .title-block .subtitle { font-size:9pt; color:#64748b; }

  /* ── Info grid ──────────────── */
  .info-grid { display:grid; grid-template-columns:repeat(4,1fr); border:1px solid #e2e8f0; border-radius:8px; overflow:hidden; margin-bottom:14px; }
  .info-cell { padding:10px 14px; border-right:1px solid #e2e8f0; background:#f8fafc; }
  .info-cell:last-child { border-right:none; }
  .info-cell .lbl { font-size:7pt; text-transform:uppercase; letter-spacing:1px; color:#94a3b8; font-weight:600; margin-bottom:3px; }
  .info-cell .val { font-size:12pt; font-weight:700; color:#0f172a; }

  /* ── Summary bar ────────────── */
  .summary-bar { display:flex; align-items:center; justify-content:space-between; border:1px solid #e2e8f0; border-radius:8px; padding:12px 18px; margin-bottom:20px; background:#fafbfc; }
  .summary-stats { display:flex; gap:20px; }
  .summary-stat { text-align:center; }
  .summary-stat .num { font-size:17pt; font-weight:800; line-height:1.1; }
  .summary-stat .num.c-ok { color:#059669; }
  .summary-stat .num.c-warn { color:#d97706; }
  .summary-stat .num.c-danger { color:#dc2626; }
  .summary-stat .num.c-na { color:#94a3b8; }
  .summary-stat .s-label { font-size:7pt; text-transform:uppercase; letter-spacing:0.8px; color:#64748b; font-weight:600; }
  .summary-result { text-align:right; }
  .summary-result .pct { font-size:22pt; font-weight:800; line-height:1; }
  .summary-result .status-label { font-size:8pt; font-weight:700; text-transform:uppercase; letter-spacing:1.2px; padding:2px 10px; border-radius:4px; display:inline-block; margin-top:3px; }

  /* ── Section headings ───────── */
  .sec-heading { display:flex; align-items:center; gap:8px; font-size:10pt; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#1B4B9B; margin:16px 0 6px; padding-bottom:4px; border-bottom:1.5px solid #dbeafe; }
  .sec-num { background:#1B4B9B; color:#fff; font-size:7.5pt; font-weight:800; width:19px; height:19px; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }

  /* ── Tables ─────────────────── */
  .data-table { width:100%; border-collapse:collapse; font-size:10pt; margin-bottom:4px; }
  .data-table td { padding:5px 10px; border-bottom:1px solid #f1f5f9; vertical-align:middle; }
  .data-table tr:last-child td { border-bottom:none; }
  .data-table tr:nth-child(even) td { background:#fafbfc; }
  .col-label { color:#475569; width:50%; font-weight:500; padding-left:14px!important; }
  .col-value { text-align:left; }

  /* ── Badges (4 tiers) ───────── */
  .badge { display:inline-flex; align-items:center; gap:5px; font-size:9pt; font-weight:600; padding:2px 10px; border-radius:12px; white-space:nowrap; }
  .badge-ok     { background:#ecfdf5; color:#059669; }
  .badge-info   { background:#eff6ff; color:#2563eb; }
  .badge-warn   { background:#fffbeb; color:#d97706; }
  .badge-danger { background:#fef2f2; color:#dc2626; }
  .badge-na     { background:#f1f5f9; color:#94a3b8; font-style:italic; font-weight:400; }
  .dot { width:7px; height:7px; border-radius:50%; display:inline-block; flex-shrink:0; }
  .dot-ok     { background:#059669; }
  .dot-info   { background:#2563eb; }
  .dot-warn   { background:#d97706; }
  .dot-danger { background:#dc2626; }

  /* ── Two-column layout ──────── */
  .two-col { display:grid; grid-template-columns:1fr 1fr; gap:18px; }

  /* ── Observations ───────────── */
  .obs-section { margin-top:16px; border:1px solid #dbeafe; border-radius:8px; overflow:hidden; }
  .obs-header { background:#eff6ff; padding:7px 14px; font-size:9pt; font-weight:700; color:#1B4B9B; text-transform:uppercase; letter-spacing:0.8px; border-bottom:1px solid #dbeafe; }
  .obs-body { padding:10px 14px; font-size:10pt; color:#334155; min-height:32px; white-space:pre-wrap; }

  /* ── Signatures ─────────────── */
  .sig-block { margin-top:28px; display:grid; grid-template-columns:1fr 1fr; gap:40px; }
  .sig-field { padding-top:8px; border-top:1px solid #334155; }
  .sig-field .sig-name { font-size:10pt; font-weight:700; color:#0f172a; }
  .sig-field .sig-role { font-size:8.5pt; color:#64748b; margin-top:1px; }

  /* ── Footer ─────────────────── */
  .doc-footer { margin-top:24px; padding-top:10px; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:flex-end; font-size:7.5pt; color:#94a3b8; }
  .doc-footer .confidential { font-size:7pt; text-transform:uppercase; letter-spacing:0.5px; color:#cbd5e1; margin-top:2px; }
  .doc-footer strong { color:#1B4B9B; }

  /* ── Fluid legend ───────────── */
  .legend { display:flex; gap:14px; flex-wrap:wrap; margin:4px 0 2px 14px; }
  .legend-item { display:flex; align-items:center; gap:4px; font-size:7.5pt; color:#64748b; }
</style>
</head>
<body>

<!-- ══ HEADER ═════════════════════════════════════════ -->
<div class="header-bar">
  <div class="header-left">
    ${logoSrc ? '<img class="logo-img" src="'+logoSrc+'" alt="Silog SpA"/>' : '<div style="width:48px;height:48px;background:linear-gradient(135deg,#1B4B9B,#2563EB);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:11px;flex-shrink:0">SILOG</div>'}
    <div class="company-info">
      <div class="name">SILOG SpA</div>
      <div class="tagline">Transporte &amp; Logística de Última Milla</div>
    </div>
  </div>
  <div class="doc-meta">
    <div class="doc-type">Reporte Operacional</div>
    <div class="doc-id">${docNum}</div>
    <div class="doc-date">${emitDate}</div>
  </div>
</div>
<div class="accent-line"></div>

<!-- ══ TÍTULO ════════════════════════════════════════ -->
<div class="title-block">
  <h1>Checklist de Inspección Operacional</h1>
  <div class="subtitle">Registro de revisión diaria obligatoria — Silog SpA Ops Manager v2.0</div>
</div>

<!-- ══ DATOS GENERALES ══════════════════════════════ -->
<div class="info-grid no-break">
  <div class="info-cell"><div class="lbl">Patente</div><div class="val">${patente}</div></div>
  <div class="info-cell"><div class="lbl">Operador</div><div class="val" style="font-size:10.5pt">${operador}</div></div>
  <div class="info-cell"><div class="lbl">Fecha Inspección</div><div class="val" style="font-size:10pt">${fecha}</div></div>
  <div class="info-cell"><div class="lbl">Combustible</div><div class="val">${combustible}</div></div>
</div>

<!-- ══ RESUMEN ══════════════════════════════════════ -->
<div class="summary-bar no-break">
  <div class="summary-stats">
    <div class="summary-stat"><div class="num c-ok">${okItems}</div><div class="s-label">Conformes</div></div>
    <div class="summary-stat"><div class="num c-warn">${warnItems}</div><div class="s-label">Advertencias</div></div>
    <div class="summary-stat"><div class="num c-danger">${dangerItems}</div><div class="s-label">Críticos</div></div>
    <div class="summary-stat"><div class="num c-na">${naItems}</div><div class="s-label">Sin dato</div></div>
  </div>
  <div class="summary-result">
    <div class="pct" style="color:${statusColor}">${pctOk}%</div>
    <div class="status-label" style="background:${statusColor}15;color:${statusColor}">${statusText}</div>
  </div>
</div>

<!-- ══ SECCIONES EN DOS COLUMNAS ═══════════════════ -->
<div class="two-col">
  <div>
    <div class="sec-heading no-break"><span class="sec-num">1</span>Condición Mecánica</div>
    <table class="data-table no-break">
      ${tblMech(['frenos','direccion','suspension','sistema_electrico','panel','bocina','sensor_retroceso','alarmas'], L)}
    </table>

    <div class="sec-heading no-break"><span class="sec-num">2</span>Niveles de Fluidos</div>
    <div class="legend">
      <span class="legend-item"><span class="dot dot-ok"></span>Máximo</span>
      <span class="legend-item"><span class="dot dot-info"></span>Normal</span>
      <span class="legend-item"><span class="dot dot-warn"></span>Bajo</span>
      <span class="legend-item"><span class="dot dot-danger"></span>Vacío</span>
    </div>
    <table class="data-table no-break">
      ${tblFluid(['nivel_aceite','nivel_refrigerante','liquido_freno','liquido_direccion','agua_parabrisas'], L)}
    </table>
  </div>

  <div>
    <div class="sec-heading no-break"><span class="sec-num">3</span>Neumáticos y Carrocería</div>
    <table class="data-table no-break">
      ${tblMech(['neumaticos','neumatico_repuesto','medidor_presion','carroseria','vidrios','espejos','asientos','aseo'], L)}
    </table>

    <div class="sec-heading no-break"><span class="sec-num">4</span>Luces, Seguridad y Equipamiento</div>
    <table class="data-table no-break">
      ${tblMech(['luces','cinturon','extintor','botiquin','conos','tacos','linterna','herramientas','gata'], L)}
    </table>
  </div>
</div>

<!-- ══ DOCUMENTACIÓN + OPERADOR (2 col) ═══════════ -->
<div class="two-col" style="margin-top:8px;">
  <div>
    <div class="sec-heading no-break"><span class="sec-num">5</span>Documentación Vehículo</div>
    <table class="data-table no-break">
      ${row('Licencia de Conductor',  boolBadge(r.chequeo_licencia_conductor))}
      ${row('Padrón del Vehículo',    boolBadge(r.chequeo_padron))}
      ${row('Permiso de Circulación', boolBadge(r.chequeo_permiso_circulacion))}
      ${row('Revisión Técnica',       boolBadge(r.chequeo_revision_tecnica))}
      ${row('SOAP',                   boolBadge(r.chequeo_soap))}
      ${row('Medición de Gases',      boolBadge(r.chequeo_medicion_gases))}
    </table>
  </div>
  <div>
    <div class="sec-heading no-break"><span class="sec-num">6</span>Estado del Operador</div>
    <table class="data-table no-break">
      ${row('Condición Física',   boolBadge(r.condicion_fisica))}
      ${row('Descanso Adecuado',  boolBadge(r.descanso_operador))}
      ${row('Salud Mental',       boolBadge(r.salud_mental_operador))}
      ${row('Medicamentos',
        r.medicamentos_chequeo
          ? '<span class="badge badge-warn"><span class="dot dot-warn"></span>⚠ Sí — '+(r.medicamentos_detalle||'Sin detalle')+'</span>'
          : '<span class="badge badge-ok"><span class="dot dot-ok"></span>✓ No</span>'
      )}
      ${row('Acepta Responsabilidad', boolBadge(r.consiente_responsabilidad_chequeo))}
    </table>
  </div>
</div>

<!-- ══ OBSERVACIONES ═══════════════════════════════ -->
<div class="obs-section no-break">
  <div class="obs-header">📝 Observaciones del Operador</div>
  <div class="obs-body">${r.chequeo_observaciones || '<span style="color:#94a3b8;font-style:italic">Sin observaciones registradas.</span>'}</div>
</div>

<!-- ══ FIRMAS ══════════════════════════════════════ -->
<div class="sig-block no-break">
  <div class="sig-field"><div class="sig-name">${operador}</div><div class="sig-role">Firma del Operador / Conductor</div></div>
  <div class="sig-field"><div class="sig-name">Supervisión Silog SpA</div><div class="sig-role">V°B° Jefatura de Operaciones</div></div>
</div>

<!-- ══ FOOTER ═════════════════════════════════════ -->
<div class="doc-footer">
  <div>
    <span>Documento generado el ${now.toLocaleString('es-CL')} — Silog SpA Ops Manager</span>
    <div class="confidential">Documento de uso interno — Confidencial</div>
  </div>
  <strong>www.silog.cl</strong>
</div>

</body>
</html>`;

  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 700);
}
