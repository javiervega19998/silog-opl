/**
 * services/admin_users.js
 * Servicio modular de administración de usuarios (Módulo ES6) para Silog SpA.
 * Proporciona operaciones CRUD, sincronización de roles y perfiles sin interactuar con el DOM.
 */

import { logError } from './logger.js';

/**
 * Obtiene todos los usuarios desde la colección 'users' de Firestore.
 * @returns {Promise<Array>} Lista de usuarios.
 */
export async function getAllUsers() {
  try {
    const db = firebase.firestore();
    const snap = await db.collection('users').get();
    const docs = [];
    snap.forEach(d => {
      docs.push({ id: d.id, ...d.data() });
    });
    return docs;
  } catch (error) {
    logError(error, 'AdminUsers');
    console.error("Error al obtener la lista de usuarios desde Firestore:", error);
    throw error;
  }
}

/**
 * Obtiene los detalles de un usuario específico por su ID de documento.
 * @param {string} id - ID del usuario (generalmente UID).
 * @returns {Promise<Object>} Datos del usuario.
 */
export async function getUserById(id) {
  try {
    const db = firebase.firestore();
    const doc = await db.collection('users').doc(id).get();
    if (!doc.exists) {
      throw new Error(`El usuario con ID ${id} no existe.`);
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    logError(error, 'AdminUsers');
    console.error(`Error al obtener el perfil del usuario con ID ${id} desde Firestore:`, error);
    throw error;
  }
}

/**
 * Actualiza la información de un usuario en Firestore.
 * @param {string} id - ID del usuario.
 * @param {Object} userData - Datos de actualización del usuario.
 * @returns {Promise<Object>} Estado de la operación.
 */
export async function updateUser(id, userData) {
  try {
    const db = firebase.firestore();
    const nombre = (userData.nombre || '').trim();
    const apellido = (userData.apellido || '').trim();
    const nombre_completo = (nombre + ' ' + apellido).trim();

    const updateData = {
      nombre,
      apellido,
      nombre_completo,
      rut: (userData.rut || '').trim(),
      area: (userData.area || '').trim(),
      rol: userData.rol,
      estado: userData.estado
    };

    await db.collection('users').doc(id).update(updateData);
    return { success: true };
  } catch (error) {
    logError(error, 'AdminUsers');
    console.error(`Error al actualizar el usuario con ID ${id} en Firestore:`, error);
    throw error;
  }
}

/**
 * Elimina un usuario de la colección de Firestore.
 * @param {string} id - ID del usuario.
 * @returns {Promise<Object>} Estado de la operación.
 */
export async function deleteUser(id) {
  try {
    const db = firebase.firestore();
    await db.collection('users').doc(id).delete();
    return { success: true };
  } catch (error) {
    logError(error, 'AdminUsers');
    console.error(`Error al eliminar el usuario con ID ${id} de Firestore:`, error);
    throw error;
  }
}

/**
 * Invoca la Cloud Function para sincronizar roles de todos los usuarios con Firebase Auth.
 * @returns {Promise<Object>} Datos de respuesta de la función.
 */
export async function syncAllClaims() {
  try {
    const functions = firebase.app().functions('us-central1');
    const syncAllClaimsFn = functions.httpsCallable('syncAllClaims');
    const result = await syncAllClaimsFn({});
    return result.data;
  } catch (error) {
    logError(error, 'AdminUsers');
    console.error("Error al invocar la sincronización de roles (syncAllClaims):", error);
    throw error;
  }
}

/**
 * Invoca la Cloud Function para migrar usuarios con correo como ID a UID como ID.
 * @returns {Promise<Object>} Datos de respuesta de la función.
 */
export async function migrateUsersToUID() {
  try {
    const functions = firebase.app().functions('us-central1');
    const migrateUsersToUIDFn = functions.httpsCallable('migrateUsersToUID');
    const result = await migrateUsersToUIDFn({});
    return result.data;
  } catch (error) {
    logError(error, 'AdminUsers');
    console.error("Error al invocar la migración de usuarios a UID (migrateUsersToUID):", error);
    throw error;
  }
}
