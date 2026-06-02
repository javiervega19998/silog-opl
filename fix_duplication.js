const fs = require('fs');

let js = fs.readFileSync('js/finanzas_script.js', 'utf8');

// Find the section where turnos are loaded to extract turnosIds
const turnosRegex = /turnos\.push\(\{id:d\.id, \.\.\.t, _fecha:fecha, _tipo:'turno'\}\);\s*\}\);/;
js = js.replace(turnosRegex, `turnos.push({id:d.id, ...t, _fecha:fecha, _tipo:'turno'});
    });
    const turnosIds = new Set(turnos.map(t => t.id));`);

// Find the section where hojas_ruta are pushed and add the duplication check
const hojasRegex = /const m=fecha\.toISOString\(\)\.slice\(0,7\);\s*if\(periodo&&m!==periodo\)return;\s*if\(vehiculo&&h\.patente!==vehiculo\)return;\s*if\(conductor&&h\.conductor_email!==conductor\)return;\s*hojas\.push\(\{id:d\.id, \.\.\.h, _fecha:fecha, _tipo:'hoja_ruta'\}\);/g;

js = js.replace(hojasRegex, `const m=fecha.toISOString().slice(0,7);
      if(periodo&&m!==periodo)return;
      if(vehiculo&&h.patente!==vehiculo)return;
      if(conductor&&h.conductor_email!==conductor)return;
      // EVITAR DUPLICADOS: Si este viaje de hoja_ruta proviene de un turno regular que ya cargamos, lo saltamos.
      if(turnosIds.has(h.turno_id)) return;
      hojas.push({id:d.id, ...h, _fecha:fecha, _tipo:'hoja_ruta'});`);

// Fix the "Viaje Ext" badge to be "Externo" ONLY if it's Total Energies, according to user's new rule.
// Or wait, if we only label TotalEnergies as "EXTERNO", what about CINTEC from "Nuevo Viaje"?
// The user said: "ya que, solo los viajes para realizados para Total Energies son los llamados 'Externos'"
const badgeRegex = /const tipoBadge = r\._tipo === 'hoja_ruta' \? '<span class="badge-sm" style="background:var\(--accent\);color:#fff;font-size:0\.6rem;padding:2px 4px;">VIAJE EXT<\/span>' : '';/g;

js = js.replace(badgeRegex, `const distStr = (r.nombre_distribuidor || r.distribuidor || '').toLowerCase();
        const isTotalEnergies = distStr.includes('total');
        const isExt = r._tipo === 'hoja_ruta';
        const tipoBadge = (isExt && isTotalEnergies) ? '<span class="badge-sm" style="background:var(--accent);color:#fff;font-size:0.6rem;padding:2px 4px;">EXTERNO</span>' : (isExt ? '<span class="badge-sm" style="background:var(--primary);color:#fff;font-size:0.6rem;padding:2px 4px;">ESPECIAL</span>' : '');`);

fs.writeFileSync('js/finanzas_script.js', js);
console.log("Fixed duplication and badge logic in finanzas_script.js.");
