// ══════════════════════════════════════════════════════════
// SILOG SpA — REPORTE DE CHECKLIST OPERACIONAL
// Formato: Documento formal (estilo Docs / Word)
// Compartido: checklist.html  &  admin.html
// ══════════════════════════════════════════════════════════

function generateChecklistPDF(r) {
  const win = window.open('', '_blank');
  if (!win) { showToast('Habilita pop-ups para descargar el PDF', 'error'); return; }

  const fecha   = formatDate(r.fecha_chequeo);
  const patente = r.patente_chequeo || '—';
  const operador = r.nombre_operador || '—';
  const combustible = r.nivel_combustible || '—';

  // ── Helpers ──────────────────────────────────────────────

  /** Select con colores */
  function sc(val, good) {
    if (!val || val === '—') return '<td class="na">—</td>';
    const ok = good ? good.includes(val) : val === 'Check';
    return `<td class="${ok ? 'ok' : 'warn'}">${val}</td>`;
  }

  /** Booleano */
  function bc(val) {
    return val
      ? '<td class="ok">&#10003;&nbsp;Sí</td>'
      : '<td class="warn">&#10007;&nbsp;No</td>';
  }

  /** Fila de tabla estándar */
  function row(label, cell) {
    return `<tr><td class="col-label">${label}</td>${cell}</tr>`;
  }

  /** Generar tabla a partir de lista de claves */
  function tbl(keys, labels, good) {
    return keys.map(k =>
      row(labels[k] || k, sc(r['chequeo_' + k], good))
    ).join('');
  }

  const L = {
    frenos:            'Frenos',
    direccion:         'Direcci\u00f3n',
    suspension:        'Suspensi\u00f3n',
    sistema_electrico: 'Sistema El\u00e9ctrico',
    panel:             'Panel de Instrumentos',
    bocina:            'Bocina',
    sensor_retroceso:  'Sensor de Retroceso',
    alarmas:           'Alarmas',
    nivel_aceite:      'Aceite Motor',
    nivel_refrigerante:'Refrigerante',
    liquido_freno:     'L\u00edquido de Frenos',
    liquido_direccion: 'L\u00edquido Direcci\u00f3n',
    agua_parabrisas:   'Agua Parabrisas',
    neumaticos:        'Neum\u00e1ticos',
    neumatico_repuesto:'Neum\u00e1tico Repuesto',
    medidor_presion:   'Medidor Presi\u00f3n',
    carroseria:        'Carrocer\u00eda',
    vidrios:           'Vidrios',
    espejos:           'Espejos',
    asientos:          'Asientos',
    aseo:              'Aseo Interior',
    luces:             'Luces',
    cinturon:          'Cintur\u00f3n de Seguridad',
    extintor:          'Extintor',
    botiquin:          'Botiqu\u00edn',
    conos:             'Conos de Seguridad',
    tacos:             'Tacos',
    linterna:          'Linterna',
    herramientas:      'Herramientas',
    gata:              'Gata',
  };

  // Número de documento (últimos 6 chars del timestamp o random)
  const now = new Date();
  const docNum = `CK-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}-${patente.replace(/[^A-Z0-9]/gi,'')}`;

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte Checklist ${patente} — ${fecha}</title>
<style>
  /* ── Page setup ─────────────────── */
  @page {
    size: letter portrait;
    margin: 22mm 20mm 22mm 25mm;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-break { page-break-inside: avoid; }
  }

  /* ── Base ───────────────────────── */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Segoe UI', 'Calibri', Arial, sans-serif;
    font-size: 11pt;
    color: #1a202c;
    line-height: 1.55;
    background: #fff;
    max-width: 820px;
    margin: 0 auto;
    padding: 28px 36px 40px;
  }

  /* ── Letterhead ──────────────────── */
  .letterhead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    padding-bottom: 14px;
    border-bottom: 3px solid #1B4B9B;
    margin-bottom: 6px;
  }
  .lh-logo {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo-box {
    width: 52px; height: 52px;
    background: linear-gradient(135deg, #1B4B9B 0%, #2563EB 100%);
    border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    color: #fff;
    font-weight: 900; font-size: 13px; letter-spacing: -0.5px;
    flex-shrink: 0;
  }
  .lh-company { }
  .lh-company .name { font-size: 21px; font-weight: 800; color: #1B4B9B; letter-spacing: -0.5px; }
  .lh-company .sub  { font-size: 9pt; color: #64748b; font-weight: 400; margin-top: 1px; }
  .lh-meta { text-align: right; }
  .lh-meta .doc-type { font-size: 13px; font-weight: 700; color: #1B4B9B; }
  .lh-meta .doc-num  { font-size: 8.5pt; color: #94a3b8; letter-spacing: 0.6px; margin-top: 3px; }
  .lh-meta .doc-date { font-size: 9pt; color: #475569; margin-top: 4px; }

  /* ── Document title block ────────── */
  .doc-title-block {
    margin: 14px 0 18px;
    padding: 14px 20px;
    background: #f1f5f9;
    border-left: 5px solid #1B4B9B;
    border-radius: 0 8px 8px 0;
  }
  .doc-title-block h1 {
    font-size: 15pt;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 2px;
  }
  .doc-title-block .subtitle {
    font-size: 9.5pt;
    color: #64748b;
  }

  /* ── Info grid (cover data) ──────── */
  .info-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
    margin-bottom: 22px;
  }
  .info-cell {
    padding: 10px 14px;
    border-right: 1px solid #cbd5e1;
  }
  .info-cell:last-child { border-right: none; }
  .info-cell .lbl {
    font-size: 7.5pt;
    text-transform: uppercase;
    letter-spacing: 0.9px;
    color: #94a3b8;
    font-weight: 600;
    margin-bottom: 3px;
  }
  .info-cell .val {
    font-size: 12.5pt;
    font-weight: 700;
    color: #0f172a;
  }

  /* ── Section headings ────────────── */
  .sec-heading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 10.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #1B4B9B;
    margin: 18px 0 6px;
    padding-bottom: 5px;
    border-bottom: 1.5px solid #bfdbfe;
  }
  .sec-heading .sec-num {
    background: #1B4B9B;
    color: #fff;
    font-size: 8pt;
    font-weight: 800;
    width: 20px; height: 20px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }

  /* ── Tables ──────────────────────── */
  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5pt;
    margin-bottom: 4px;
  }
  .data-table td {
    padding: 5.5px 12px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }
  .data-table tr:last-child td { border-bottom: none; }
  .data-table tr:nth-child(even) td { background: #f8fafc; }
  .col-label { color: #475569; width: 52%; font-weight: 500; }
  td.ok    { color: #059669; font-weight: 600; }
  td.warn  { color: #d97706; font-weight: 600; }
  td.danger{ color: #dc2626; font-weight: 600; }
  td.na    { color: #94a3b8; font-style: italic; }

  /* ── Two-column layout ───────────── */
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .two-col .col-wrap { }

  /* ── Observations box ────────────── */
  .obs-section {
    margin-top: 18px;
    border: 1px solid #bfdbfe;
    border-radius: 8px;
    overflow: hidden;
  }
  .obs-header {
    background: #eff6ff;
    padding: 7px 14px;
    font-size: 9.5pt;
    font-weight: 700;
    color: #1B4B9B;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    border-bottom: 1px solid #bfdbfe;
  }
  .obs-body {
    padding: 10px 14px;
    font-size: 10.5pt;
    color: #334155;
    min-height: 36px;
    white-space: pre-wrap;
  }

  /* ── Signature block ─────────────── */
  .sig-block {
    margin-top: 30px;
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 32px;
  }
  .sig-field {
    border-top: 1px solid #475569;
    padding-top: 6px;
    font-size: 9pt;
    color: #64748b;
  }
  .sig-field strong { display: block; font-size: 10pt; color: #1a202c; }

  /* ── Footer ──────────────────────── */
  .doc-footer {
    margin-top: 28px;
    padding-top: 10px;
    border-top: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    font-size: 8pt;
    color: #94a3b8;
  }
  .doc-footer strong { color: #1B4B9B; }
</style>
</head>
<body>

<!-- ══ LETTERHEAD ══════════════════════════════════════════ -->
<div class="letterhead">
  <div class="lh-logo">
    <div class="logo-box">SILOG</div>
    <div class="lh-company">
      <div class="name">SILOG SpA</div>
      <div class="sub">Transporte &amp; Log&iacute;stica de &Uacute;ltima Milla</div>
    </div>
  </div>
  <div class="lh-meta">
    <div class="doc-type">Reporte Operacional</div>
    <div class="doc-num">${docNum}</div>
    <div class="doc-date">Emitido: ${now.toLocaleDateString('es-CL',{day:'2-digit',month:'long',year:'numeric'})}</div>
  </div>
</div>

<!-- ══ TÍTULO ══════════════════════════════════════════════ -->
<div class="doc-title-block">
  <h1>Checklist de Inspección Operacional de Vehículo</h1>
  <div class="subtitle">Registro de revisión diaria obligatoria &mdash; Silog SpA Ops Manager</div>
</div>

<!-- ══ DATOS GENERALES ════════════════════════════════════ -->
<div class="info-grid">
  <div class="info-cell">
    <div class="lbl">Patente</div>
    <div class="val">${patente}</div>
  </div>
  <div class="info-cell">
    <div class="lbl">Operador</div>
    <div class="val" style="font-size:11.5pt">${operador}</div>
  </div>
  <div class="info-cell">
    <div class="lbl">Fecha Inspección</div>
    <div class="val" style="font-size:11pt">${fecha}</div>
  </div>
  <div class="info-cell">
    <div class="lbl">Combustible</div>
    <div class="val">${combustible}</div>
  </div>
</div>

<!-- ══ SECCIONES EN DOS COLUMNAS ══════════════════════════ -->
<div class="two-col">

  <!-- Columna 1 -->
  <div class="col-wrap">

    <div class="sec-heading no-break">
      <div class="sec-num">1</div>
      Condición Mecánica
    </div>
    <table class="data-table no-break">
      ${tbl(['frenos','direccion','suspension','sistema_electrico','panel','bocina','sensor_retroceso','alarmas'], L, ['Check'])}
    </table>

    <div class="sec-heading no-break">
      <div class="sec-num">2</div>
      Niveles de Fluidos
    </div>
    <table class="data-table no-break">
      ${tbl(['nivel_aceite','nivel_refrigerante','liquido_freno','liquido_direccion','agua_parabrisas'], L, ['M\u00e1ximo','Normal'])}
    </table>

  </div>

  <!-- Columna 2 -->
  <div class="col-wrap">

    <div class="sec-heading no-break">
      <div class="sec-num">3</div>
      Neumáticos y Carrocería
    </div>
    <table class="data-table no-break">
      ${tbl(['neumaticos','neumatico_repuesto','medidor_presion','carroseria','vidrios','espejos','asientos','aseo'], L, ['Check'])}
    </table>

    <div class="sec-heading no-break">
      <div class="sec-num">4</div>
      Luces, Seguridad y Equipamiento
    </div>
    <table class="data-table no-break">
      ${tbl(['luces','cinturon','extintor','botiquin','conos','tacos','linterna','herramientas','gata'], L, ['Check'])}
    </table>

  </div>
</div>

<!-- ══ DOCUMENTACIÓN ══════════════════════════════════════ -->
<div class="sec-heading no-break">
  <div class="sec-num">5</div>
  Documentación del Vehículo y Conductor
</div>
<table class="data-table no-break" style="max-width:480px">
  ${row('Licencia de Conductor',         bc(r.chequeo_licencia_conductor))}
  ${row('Padr\u00f3n del Veh\u00edculo', bc(r.chequeo_padron))}
  ${row('Permiso de Circulaci\u00f3n',   bc(r.chequeo_permiso_circulacion))}
  ${row('Revisi\u00f3n T\u00e9cnica',    bc(r.chequeo_revision_tecnica))}
  ${row('SOAP',                           bc(r.chequeo_soap))}
  ${row('Medici\u00f3n de Gases',         bc(r.chequeo_medicion_gases))}
</table>

<!-- ══ ESTADO DEL OPERADOR ════════════════════════════════ -->
<div class="sec-heading no-break">
  <div class="sec-num">6</div>
  Estado del Operador
</div>
<table class="data-table no-break" style="max-width:480px">
  ${row('Condici\u00f3n F\u00edsica',   bc(r.condicion_fisica))}
  ${row('Descanso Adecuado',             bc(r.descanso_operador))}
  ${row('Salud Mental',                  bc(r.salud_mental_operador))}
  ${row('Consumo de Medicamentos',
    `<td class="${r.medicamentos_chequeo ? 'warn' : 'ok'}">${r.medicamentos_chequeo ? '&#9888;&nbsp;S\u00ed &mdash; ' + (r.medicamentos_detalle || 'Sin detalle') : '&#10003;&nbsp;No'}</td>`
  )}
  ${row('Acepta Responsabilidad',         bc(r.consiente_responsabilidad_chequeo))}
</table>

<!-- ══ OBSERVACIONES ══════════════════════════════════════ -->
<div class="obs-section no-break">
  <div class="obs-header">&#128221; Observaciones del Operador</div>
  <div class="obs-body">${r.chequeo_observaciones ? r.chequeo_observaciones : '<span style="color:#94a3b8;font-style:italic">Sin observaciones registradas.</span>'}</div>
</div>

<!-- ══ FIRMA ═══════════════════════════════════════════════ -->
<div class="sig-block no-break">
  <div class="sig-field">
    <strong>${operador}</strong>
    Firma del Operador / Conductor
  </div>
  <div class="sig-field">
    <strong>Supervisión Silog SpA</strong>
    V&deg;B&deg; Jefatura de Operaciones
  </div>
</div>

<!-- ══ FOOTER ══════════════════════════════════════════════ -->
<div class="doc-footer">
  <span>Documento generado el ${now.toLocaleString('es-CL')} &mdash; Silog SpA Ops Manager</span>
  <strong>www.silog.cl</strong>
</div>

</body>
</html>`;

  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 700);
}
