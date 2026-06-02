
// fix_rossana.js - Ejecutar con: node fix_rossana.js
// Crea/actualiza el documento de Rossana en Firestore directamente

const { initializeApp, cert, applicationDefault } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

// UID de Rossana obtenido del export de Auth
const ROSSANA_UID   = 'OxeQSDVrPqhnMUKdg1eh5BD655H2';
const ROSSANA_EMAIL = 'finanzas@silogspa.cl';
const PROJECT_ID    = 'silog-opl-681dc';

process.env.GOOGLE_CLOUD_PROJECT  = PROJECT_ID;
process.env.GCLOUD_PROJECT        = PROJECT_ID;
process.env.FIREBASE_CONFIG       = JSON.stringify({ projectId: PROJECT_ID });

initializeApp({ projectId: PROJECT_ID });

const db   = getFirestore();
const auth = getAuth();

async function main() {
  console.log('=== Fix Rossana ===');
  console.log('UID:', ROSSANA_UID);
  console.log('Email:', ROSSANA_EMAIL);

  // 1. Verificar si ya existe el doc por UID
  const uidRef  = db.collection('users').doc(ROSSANA_UID);
  const uidSnap = await uidRef.get();
  console.log('\n[Firestore] Documento por UID existe:', uidSnap.exists);
  if (uidSnap.exists) {
    console.log('[Firestore] Datos actuales:', JSON.stringify(uidSnap.data(), null, 2));
  }

  // 2. Buscar por correo_electronico
  const q = await db.collection('users').where('correo_electronico', '==', ROSSANA_EMAIL).get();
  console.log('\n[Firestore] Docs por correo_electronico:', q.size);
  q.forEach(d => console.log('  -', d.id, ':', JSON.stringify(d.data(), null, 2)));

  // 3. Buscar legacy (email como ID)
  const legacySnap = await db.collection('users').doc(ROSSANA_EMAIL).get();
  console.log('\n[Firestore] Documento legacy (email como ID):', legacySnap.exists);
  if (legacySnap.exists) {
    console.log('[Firestore] Datos legacy:', JSON.stringify(legacySnap.data(), null, 2));
  }

  // 4. Crear/sobrescribir el documento correcto con UID como ID
  const profileData = {
    correo_electronico: ROSSANA_EMAIL,
    email:              ROSSANA_EMAIL,
    nombre:             'Rossana',
    apellido:           '',
    nombre_completo:    'Rossana',
    rol:                'administrativo',
    role:               'administrativo',
    roles:              ['administrativo'],
    area:               'Administración & Finanzas',
    estado:             'Activo',
    auth_uid:           ROSSANA_UID,
    updated_at:         FieldValue.serverTimestamp(),
  };

  await uidRef.set(profileData, { merge: true });
  console.log('\n✅ Documento users/' + ROSSANA_UID + ' creado/actualizado con rol=administrativo');

  // 5. Sincronizar custom claims en Auth
  try {
    await auth.setCustomUserClaims(ROSSANA_UID, {
      rol:  'administrativo',
      area: 'Administración & Finanzas',
    });
    console.log('✅ Custom claims sincronizados en Firebase Auth');
  } catch (e) {
    console.warn('⚠️  Error sincronizando claims:', e.message);
  }

  // 6. Si existe documento legacy, eliminarlo para evitar confusión
  if (legacySnap.exists) {
    await db.collection('users').doc(ROSSANA_EMAIL).delete();
    console.log('🗑️  Documento legacy eliminado:', ROSSANA_EMAIL);
  }

  // 7. Verificar resultado final
  const finalSnap = await uidRef.get();
  console.log('\n=== Resultado Final ===');
  console.log(JSON.stringify(finalSnap.data(), null, 2));
  console.log('\n✅ Fix completado. Rossana debe cerrar sesión y volver a entrar.');
}

main().catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
