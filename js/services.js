/**
 * js/services.js
 * Capa de Servicios centralizada (Módulo ES6) para interactuar con Cloud Functions.
 */

// Se asume que firebase (v8) está disponible globalmente a través de los CDN en el index.html / inventario.html
// o si estuvieran usando bundlers sería import { firebase } from 'firebase/app';
// Para mantener compatibilidad con el entorno actual (Vanilla JS con CDNs), usamos el objeto global `firebase`.

const functions = firebase.app().functions('us-central1');

/**
 * Manejador centralizado de errores para llamadas al backend
 */
const handleBackendError = (error, context) => {
  console.error(`[Services API Error] ${context}:`, error.code, error.message);
  
  let userMessage = 'Ocurrió un error inesperado al procesar la solicitud.';
  
  if (error.code === 'functions/permission-denied') {
    userMessage = 'No tienes permisos suficientes para realizar esta acción.';
  } else if (error.code === 'functions/unauthenticated') {
    userMessage = 'Tu sesión ha expirado o no estás autenticado.';
  } else if (error.code === 'functions/invalid-argument') {
    userMessage = 'Los datos enviados son inválidos.';
  } else if (error.message) {
    userMessage = error.message;
  }

  // Integración con el sistema de notificaciones visuales (Toasts) si existe globalmente
  if (typeof showToast === 'function') {
    showToast(userMessage, 'error');
  } else {
    alert(userMessage);
  }

  throw error;
};

// ── INVENTARIO ────────────────────────────────────────────────────────

/**
 * Actualiza o crea un registro de inventario de forma segura
 * @param {Object} data - Datos del inventario (incluir 'id' para actualizar)
 * @returns {Promise<Object>}
 */
export const updateInventory = async (data) => {
  try {
    const updateInventoryFn = functions.httpsCallable('updateInventory');
    const result = await updateInventoryFn(data);
    return result.data;
  } catch (error) {
    return handleBackendError(error, 'updateInventory');
  }
};

// ── DISTRIBUIDORES ────────────────────────────────────────────────────

/**
 * Administra distribuidores (Crear, Actualizar, Eliminar)
 * @param {string} action - 'create', 'update', 'delete'
 * @param {string|null} id - ID del distribuidor (null para create)
 * @param {Object} data - Datos a guardar
 * @returns {Promise<Object>}
 */
export const manageDistribuidores = async (action, id, data = {}) => {
  try {
    const manageDistFn = functions.httpsCallable('manageDistribuidores');
    const result = await manageDistFn({ action, id, data });
    return result.data;
  } catch (error) {
    return handleBackendError(error, `manageDistribuidores (${action})`);
  }
};

// ── NOTIFICACIONES ────────────────────────────────────────────────────

/**
 * Administra notificaciones (Crear, Actualizar, Eliminar)
 * @param {string} action - 'create', 'update', 'delete'
 * @param {string|null} id - ID de la notificación
 * @param {Object} data - Datos de la notificación
 * @returns {Promise<Object>}
 */
export const manageNotificaciones = async (action, id, data = {}) => {
  try {
    const manageNotifFn = functions.httpsCallable('manageNotificaciones');
    const result = await manageNotifFn({ action, id, data });
    return result.data;
  } catch (error) {
    return handleBackendError(error, `manageNotificaciones (${action})`);
  }
};
