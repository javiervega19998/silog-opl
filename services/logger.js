/**
 * services/logger.js
 * Servicio de registro de errores y auditoría (Módulo ES6) para Silog SpA.
 * Integra Sentry para el monitoreo en tiempo real.
 */


/**
 * Registra un error en Firestore (audit_log) y lo envía a Sentry.
 * @param {Error|Object} error - El error capturado.
 * @param {string} moduloContexto - El módulo o contexto donde ocurrió el error.
 */
export async function logError(error, moduloContexto) {
  // 1. Enviar a Sentry
  try {
    if (typeof Sentry !== 'undefined') {
      Sentry.captureException(error, {
        tags: { modulo: moduloContexto }
      });
    }
  } catch (sentryErr) {
    console.warn("No se pudo enviar el error a Sentry:", sentryErr);
  }

  // 2. Intentar guardar en Firestore (audit_log)
  try {
    const db = firebase.firestore();
    const errorMsg = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : '';

    await db.collection('audit_log').add({
      fecha: firebase.firestore.FieldValue.serverTimestamp(),
      error: errorMsg,
      stack: errorStack,
      modulo: moduloContexto,
      usuario_email: firebase.auth().currentUser ? firebase.auth().currentUser.email : 'anónimo'
    });
  } catch (dbErr) {
    console.error("Error al guardar el log de auditoría en Firestore:", dbErr);
  }
}
