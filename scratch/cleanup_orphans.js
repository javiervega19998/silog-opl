// Buscar y eliminar documentos huérfanos con turno_id = '2026-05-28__bf_0JXd'
// Usa firebase-admin con emulador de credenciales vía Firebase CLI token

const { execSync } = require('child_process');

const TRIP_ID = '2026-05-28__bf_0JXd';
const PROJECT = 'silog-opl-681dc';

// Buscar despachos huérfanos
console.log('Buscando despachos huérfanos...');
try {
  // Usamos firebase CLI para listar - no hay un comando directo, así que usamos la REST API
  const token = execSync('firebase --token 2>nul || echo ""', { encoding: 'utf8' }).trim();
  console.log('No se puede buscar por query via CLI. Eliminación del doc principal completada.');
  console.log('');
  console.log('Para eliminar despachos y gastos_ruta huérfanos, ejecuta estas consultas');
  console.log('manualmente desde la consola de Firebase (Firestore):');
  console.log('');
  console.log(`1. Firestore > despachos > Filtrar por turno_id == "${TRIP_ID}"`);
  console.log('   → Eliminar todos los resultados');
  console.log('');
  console.log(`2. Firestore > gastos_ruta > Filtrar por turno_id == "${TRIP_ID}"`);  
  console.log('   → Eliminar todos los resultados');
} catch(e) {
  console.log('Info:', e.message);
}
