// ══════════════════════════════════════════════
// UTILS — SILOG SpA
// Utilidades globales reutilizables
// ══════════════════════════════════════════════

/**
 * Comprime una imagen antes de subirla a Storage.
 * @param {File|Blob} file - Archivo de imagen
 * @param {number} maxWidth - Ancho máximo en px (default 1200)
 * @param {number} quality - Calidad JPEG 0-1 (default 0.7)
 * @returns {Promise<Blob>} - Imagen comprimida
 */
function compressImage(file, maxWidth, quality) {
  maxWidth = maxWidth || 1200;
  quality  = quality  || 0.7;
  return new Promise(function(resolve) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      resolve(file); return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
      var img = new Image();
      img.onload = function() {
        var canvas = document.createElement('canvas');
        var w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(function(blob) { resolve(blob || file); }, 'image/jpeg', quality);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Registra una acción en el audit log de Firestore.
 * @param {string} action - Tipo de acción (ej: 'user_created', 'vehicle_deleted')
 * @param {object} details - Detalles adicionales
 */
function auditLog(action, details) {
  try {
    if (typeof db === 'undefined') return;
    var logEntry = {
      action:     action,
      details:    details || {},
      user_email: '',
      user_uid:   '',
      timestamp:  firebase.firestore.FieldValue.serverTimestamp(),
      user_agent: navigator.userAgent,
    };
    if (typeof currentUser !== 'undefined' && currentUser) {
      logEntry.user_uid = currentUser.uid || '';
      logEntry.user_email = currentUser.email || '';
    }
    if (typeof currentUserData !== 'undefined' && currentUserData) {
      logEntry.user_email = currentUserData.email || currentUserData.correo_electronico || logEntry.user_email;
    }
    db.collection('audit_log').add(logEntry).catch(function(e) {
      console.warn('[audit] Error logging:', e.message);
    });
  } catch(e) {
    console.warn('[audit] Error:', e.message);
  }
}

/**
 * Envuelve una función asíncrona para evitar ejecuciones múltiples (Doble Click).
 * Equivalente al hook useOnceClick solicitado. Utiliza un closure en lugar de useRef.
 * @param {Function} handler - Función asíncrona a ejecutar.
 * @param {number} cooldown - Tiempo de bloqueo en ms (default 2000).
 * @returns {Function} - Función envuelta.
 */
function withOnceClick(handler, cooldown = 2000) {
  let fired = false;
  return async function(...args) {
    if (fired) {
      console.warn('Acción bloqueada: prevención de doble click.');
      return;
    }
    fired = true;
    try {
      return await handler.apply(this, args);
    } finally {
      setTimeout(() => { fired = false; }, cooldown);
    }
  };
}
