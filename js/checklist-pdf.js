// ══════════════════════════════════════════════
// CHECKLIST PDF GENERATOR — SILOG SpA
// Shared across checklist.html and admin.html
// ══════════════════════════════════════════════

function generateChecklistPDF(r) {
  const win = window.open('', '_blank');
  if (!win) { showToast('Habilita pop-ups para descargar el PDF', 'error'); return; }

  const fecha = formatDate(r.fecha_chequeo);
  const patente = r.patente_chequeo || '\u2014';
  const operador = r.nombre_operador || '\u2014';

  // Helper: status cell color
  function sc(val, good) {
    if (!val || val === '\u2014') return '<td class="na">\u2014</td>';
    const isOk = good ? good.includes(val) : val === 'Check';
    return '<td class="' + (isOk ? 'ok' : 'warn') + '">' + val + '</td>';
  }

  // Helper: boolean status
  function bc(val) {
    return val ? '<td class="ok">\u2713 OK</td>' : '<td class="warn">\u2717 No</td>';
  }

  // Label map for cleaner field names
  const labels = {
    frenos: 'Frenos', direccion: 'Direcci\u00f3n', suspension: 'Suspensi\u00f3n',
    sistema_electrico: 'Sistema El\u00e9ctrico', panel: 'Panel de Instrumentos',
    bocina: 'Bocina', sensor_retroceso: 'Sensor de Retroceso', alarmas: 'Alarmas',
    neumaticos: 'Neum\u00e1ticos', luces: 'Luces', cinturon: 'Cintur\u00f3n de Seguridad',
    extintor: 'Extintor', botiquin: 'Botiqu\u00edn', conos: 'Conos de Seguridad',
    tacos: 'Tacos', linterna: 'Linterna', herramientas: 'Herramientas', gata: 'Gata',
    nivel_aceite: 'Aceite Motor', nivel_refrigerante: 'Refrigerante',
    liquido_freno: 'L\u00edquido de Freno', liquido_direccion: 'L\u00edquido Direcci\u00f3n',
    agua_parabrisas: 'Agua Parabrisas',
    neumatico_repuesto: 'Neum\u00e1tico Repuesto', medidor_presion: 'Medidor Presi\u00f3n',
    carroseria: 'Carrocer\u00eda', vidrios: 'Vidrios', espejos: 'Espejos',
    asientos: 'Asientos', aseo: 'Aseo Interior'
  };

  function label(k) { return labels[k] || k; }

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Checklist ${patente} - ${fecha}</title>
<style>
  @page { margin: 15mm 12mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; font-size: 12px; line-height: 1.4; }

  /* Header */
  .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #1B4B9B; padding-bottom: 14px; margin-bottom: 18px; }
  .logo-area { display: flex; align-items: center; gap: 12px; }
  .logo-box { width: 48px; height: 48px; background: linear-gradient(135deg, #1B4B9B, #2563EB); border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 900; font-size: 14px; letter-spacing: -0.5px; }
  .company-name { font-size: 20px; font-weight: 800; color: #1B4B9B; letter-spacing: -0.5px; }
  .company-sub { font-size: 10px; color: #666; font-weight: 500; margin-top: 2px; }
  .doc-title { text-align: right; }
  .doc-title h1 { font-size: 16px; color: #1B4B9B; font-weight: 700; margin-bottom: 2px; }
  .doc-title .doc-id { font-size: 9px; color: #999; letter-spacing: 0.5px; }

  /* Info bar */
  .info-bar { display: flex; gap: 0; margin-bottom: 18px; border: 1px solid #dde1e6; border-radius: 8px; overflow: hidden; }
  .info-cell { flex: 1; padding: 10px 14px; border-right: 1px solid #dde1e6; }
  .info-cell:last-child { border-right: none; }
  .info-label { font-size: 9px; color: #888; text-transform: uppercase; letter-spacing: 0.8px; font-weight: 600; margin-bottom: 3px; }
  .info-value { font-size: 13px; font-weight: 700; color: #1a1a2e; }

  /* Section */
  .section { margin-bottom: 16px; }
  .section-header { background: #1B4B9B; color: #fff; padding: 7px 14px; border-radius: 6px 6px 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 6px 14px; border-bottom: 1px solid #eef0f3; font-size: 11.5px; }
  tr:nth-child(even) td { background: #f8f9fb; }
  td:first-child { color: #555; width: 45%; font-weight: 500; }
  td:last-child { font-weight: 600; }
  .ok { color: #059669; }
  .warn { color: #D97706; }
  .danger { color: #DC2626; }
  .na { color: #aaa; font-style: italic; }

  /* Obs box */
  .obs-box { background: #f0f4ff; border: 1px solid #d0d9f0; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
  .obs-box .obs-title { font-size: 10px; color: #1B4B9B; font-weight: 700; text-transform: uppercase; margin-bottom: 4px; }
  .obs-box p { font-size: 12px; color: #333; }

  /* Footer */
  .footer { margin-top: 24px; padding-top: 12px; border-top: 2px solid #eef0f3; display: flex; justify-content: space-between; align-items: center; }
  .footer-left { font-size: 9px; color: #999; }
  .footer-right { font-size: 9px; color: #1B4B9B; font-weight: 600; }

  /* Two-col layout */
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 16px; }

  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="logo-area">
    <div class="logo-box">SILOG</div>
    <div>
      <div class="company-name">SILOG SpA</div>
      <div class="company-sub">Transporte & Log\u00edstica de \u00daltima Milla</div>
    </div>
  </div>
  <div class="doc-title">
    <h1>Checklist Operacional</h1>
    <div class="doc-id">DOC-CK-${patente}-${fecha.replace(/\s/g,'')}</div>
  </div>
</div>

<!-- INFO BAR -->
<div class="info-bar">
  <div class="info-cell">
    <div class="info-label">Veh\u00edculo (Patente)</div>
    <div class="info-value">${patente}</div>
  </div>
  <div class="info-cell">
    <div class="info-label">Operador / Conductor</div>
    <div class="info-value">${operador}</div>
  </div>
  <div class="info-cell">
    <div class="info-label">Fecha de Inspecci\u00f3n</div>
    <div class="info-value">${fecha}</div>
  </div>
  <div class="info-cell">
    <div class="info-label">Nivel Combustible</div>
    <div class="info-value">${r.nivel_combustible || '\u2014'}</div>
  </div>
</div>

<div class="two-col">
  <!-- MECANICA -->
  <div class="section">
    <div class="section-header">Condici\u00f3n Mec\u00e1nica</div>
    <table>${['frenos','direccion','suspension','sistema_electrico','panel','bocina','sensor_retroceso','alarmas'].map(k =>
      '<tr><td>' + label(k) + '</td>' + sc(r['chequeo_'+k], ['Check']) + '</tr>'
    ).join('')}</table>
  </div>

  <!-- FLUIDOS -->
  <div class="section">
    <div class="section-header">Niveles de Fluidos</div>
    <table>${['nivel_aceite','nivel_refrigerante','liquido_freno','liquido_direccion','agua_parabrisas'].map(k =>
      '<tr><td>' + label(k) + '</td>' + sc(r['chequeo_'+k], ['M\u00e1ximo','Normal']) + '</tr>'
    ).join('')}</table>
  </div>
</div>

<div class="two-col">
  <!-- NEUMATICOS Y CARROCERIA -->
  <div class="section">
    <div class="section-header">Neum\u00e1ticos y Carrocer\u00eda</div>
    <table>${['neumaticos','neumatico_repuesto','medidor_presion','carroseria','vidrios','espejos','asientos','aseo'].map(k =>
      '<tr><td>' + label(k) + '</td>' + sc(r['chequeo_'+k], ['Check']) + '</tr>'
    ).join('')}</table>
  </div>

  <!-- LUCES Y SEGURIDAD -->
  <div class="section">
    <div class="section-header">Luces, Seguridad y Equipamiento</div>
    <table>${['luces','cinturon','extintor','botiquin','conos','tacos','linterna','herramientas','gata'].map(k =>
      '<tr><td>' + label(k) + '</td>' + sc(r['chequeo_'+k], ['Check']) + '</tr>'
    ).join('')}</table>
  </div>
</div>

<!-- DOCUMENTACION -->
<div class="section">
  <div class="section-header">Documentaci\u00f3n del Veh\u00edculo y Conductor</div>
  <table>
    <tr><td>Licencia de Conductor</td>${bc(r.chequeo_licencia_conductor)}</tr>
    <tr><td>Padr\u00f3n</td>${bc(r.chequeo_padron)}</tr>
    <tr><td>Permiso de Circulaci\u00f3n</td>${bc(r.chequeo_permiso_circulacion)}</tr>
    <tr><td>Revisi\u00f3n T\u00e9cnica</td>${bc(r.chequeo_revision_tecnica)}</tr>
    <tr><td>SOAP</td>${bc(r.chequeo_soap)}</tr>
    <tr><td>Medici\u00f3n de Gases</td>${bc(r.chequeo_medicion_gases)}</tr>
  </table>
</div>

<!-- ESTADO OPERADOR -->
<div class="section">
  <div class="section-header">Estado del Operador</div>
  <table>
    <tr><td>Condici\u00f3n F\u00edsica</td>${bc(r.condicion_fisica)}</tr>
    <tr><td>Descanso Adecuado</td>${bc(r.descanso_operador)}</tr>
    <tr><td>Salud Mental</td>${bc(r.salud_mental_operador)}</tr>
    <tr><td>Consumo de Medicamentos</td><td class="${r.medicamentos_chequeo ? 'warn' : 'ok'}">${r.medicamentos_chequeo ? 'S\u00ed \u2014 ' + (r.medicamentos_detalle || 'Sin detalle') : 'No'}</td></tr>
    <tr><td>Acepta Responsabilidad</td>${bc(r.consiente_responsabilidad_chequeo)}</tr>
  </table>
</div>

${r.chequeo_observaciones ? '<div class="obs-box"><div class="obs-title">Observaciones</div><p>' + r.chequeo_observaciones + '</p></div>' : ''}

<!-- FOOTER -->
<div class="footer">
  <div class="footer-left">Documento generado el ${new Date().toLocaleString('es-CL')} \u2014 Silog SpA Ops Manager</div>
  <div class="footer-right">www.silog.cl</div>
</div>

</body>
</html>`;

  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}
