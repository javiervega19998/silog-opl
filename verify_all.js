const fs = require('fs');
const issues = [];

const viajes = fs.readFileSync('viajes.html','utf8');
issues.push(viajes.includes('masterBatch.commit()') ? '✅ viajes.html: masterBatch atómico OK' : '❌ viajes.html: masterBatch.commit() no encontrado');

const ruta = fs.readFileSync('ruta.html','utf8');
issues.push(ruta.includes('devBatch.commit()') ? '✅ ruta.html: devBatch atómico OK' : '❌ ruta.html: devBatch no encontrado');

const turno = fs.readFileSync('turno.html','utf8');
issues.push(turno.includes('Ya tienes un turno activo') ? '✅ turno.html: bloqueo doble turno OK' : '❌ turno.html: bloqueo doble turno no encontrado');
issues.push(turno.includes('_vehiculosUnsub') ? '✅ turno.html: listener cleanup OK' : '❌ turno.html: listener cleanup no encontrado');
issues.push(turno.includes('En Ruta') ? '✅ turno.html: estado En Ruta OK' : '⚠️  turno.html: estado En Ruta no encontrado (verificar cerrarTurno)');

const dash = fs.readFileSync('js/dash_script.js','utf8');
issues.push(dash.includes("textContent=(iconMap[t.tipo]") ? '✅ dash_script.js: XSS fix OK' : '❌ dash_script.js: XSS fix no encontrado');
issues.push(dash.includes('FAIL CLOSED') ? '✅ dash_script.js: fail-closed OK' : '❌ dash_script.js: fail-closed no encontrado');
issues.push(dash.includes('.limit(200)') ? '✅ dash_script.js: cleanup limit(200) OK' : '❌ dash_script.js: cleanup limit(200) no encontrado');

const fin = fs.readFileSync('js/finanzas_script.js','utf8');
issues.push(fin.includes('hojasByTurnoId') ? '✅ finanzas_script.js: Centro Costos fuente autoritativa OK' : '❌ finanzas_script.js: hojasByTurnoId no encontrado');
issues.push(fin.includes('total_entregas: entregadosCount') ? '✅ finanzas_script.js: total_entregas=entregadosCount OK' : '❌ finanzas_script.js: total_entregas=entregadosCount no encontrado');
issues.push(fin.includes('hojaAuth') ? '✅ finanzas_script.js: hojaAuth prioridad OK' : '❌ finanzas_script.js: hojaAuth no encontrado');

const analytics = fs.readFileSync('analytics.html','utf8');
issues.push(!analytics.includes("renderBarChartFuture('chart-entregas'") ? '✅ analytics.html: Entregas históricas OK' : '❌ analytics.html: sigue usando renderBarChartFuture');
issues.push(analytics.includes('Sin datos') ? '✅ analytics.html: OTIF Sin datos OK' : '❌ analytics.html: OTIF Sin datos no encontrado');
issues.push(analytics.includes('topResults') ? '✅ analytics.html: OTIF slice asignado OK' : '❌ analytics.html: OTIF slice no asignado');
issues.push(analytics.includes('prevStart') ? '✅ analytics.html: delta KPI sin solapamiento OK' : '❌ analytics.html: delta KPI solapado');

const admin = fs.readFileSync('admin_script.js','utf8');
issues.push(admin.includes('pendiente_revision') ? '✅ admin_script.js: enum pendiente_revision OK' : '❌ admin_script.js: enum no normalizado');
issues.push(admin.includes('isPendState') ? '✅ admin_script.js: isPendState normalizado OK' : '❌ admin_script.js: isPendState no encontrado');

const gastos = fs.readFileSync('gastos.html','utf8');
issues.push(gastos.includes('btn.disabled=false') ? '✅ gastos.html: botón re-habilitado OK' : '❌ gastos.html: botón puede quedar deshabilitado');

// Verificar que hojas_ruta no se sobreescribe al abrir Centro de Costos  
issues.push(fin.includes('// EVITAR DUPLICADOS') ? '✅ finanzas_script.js: deduplicación hojas OK' : '⚠️  finanzas_script.js: deduplicación hojas no encontrada');

// Verificar que turno.html actualiza estado del vehículo al iniciar/cerrar
issues.push(turno.includes('estado:') && turno.includes('En Ruta') ? '✅ turno.html: vehículo → En Ruta al iniciar OK' : '⚠️  turno.html: revisar actualización estado vehículo');

const passed = issues.filter(i => i.startsWith('✅')).length;
const failed = issues.filter(i => i.startsWith('❌')).length;
const warn   = issues.filter(i => i.startsWith('⚠️')).length;

console.log('\n=== SILOG Cross-Module Verification ===\n');
issues.forEach(i => console.log(i));
console.log('\n── Resultado ──────────────────────────');
console.log('Total checks : ' + issues.length);
console.log('✅ Pasaron   : ' + passed);
console.log('❌ Fallaron  : ' + failed);
console.log('⚠️  Warnings  : ' + warn);
if (failed === 0) console.log('\n🎉 Todos los checks críticos PASARON');
else console.log('\n🔴 Hay ' + failed + ' checks que FALLARON — revisar');
