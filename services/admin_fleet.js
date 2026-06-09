/**
 * services/admin_fleet.js
 * Servicio modular de administración de flota, viajes, checklists, discrepancias,
 * configuración de logística inversa y estadísticas ejecutivas (Módulo ES6) para Silog SpA.
 * Proporciona operaciones CRUD y lógica de negocio sin interactuar con el DOM.
 */

import { logError } from './logger.js';

/**
 * Obtiene todos los vehículos desde la colección 'vehiculos' de Firestore.
 * @returns {Promise<Array>} Lista de vehículos.
 */
export async function getAllVehicles() {
  try {
    const db = firebase.firestore();
    const snap = await db.collection('vehiculos').get();
    const docs = [];
    snap.forEach(d => {
      docs.push({ id: d.id, ...d.data() });
    });
    return docs;
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al obtener la lista de vehículos desde Firestore:", error);
    throw error;
  }
}

/**
 * Obtiene un vehículo específico de Firestore por su ID de documento.
 * @param {string} id - ID del documento del vehículo.
 * @returns {Promise<Object>} Datos del vehículo.
 */
export async function getVehicleById(id) {
  try {
    const db = firebase.firestore();
    const doc = await db.collection('vehiculos').doc(id).get();
    if (!doc.exists) {
      throw new Error(`El vehículo con ID ${id} no existe.`);
    }
    return { id: doc.id, ...doc.data() };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al obtener el vehículo con ID ${id} desde Firestore:`, error);
    throw error;
  }
}

/**
 * Crea o actualiza un vehículo en Firestore, registrando el cambio de kilometraje en su historial.
 * @param {string|null} id - ID del vehículo (null para crear uno nuevo).
 * @param {Object} vehicleData - Datos del vehículo.
 * @param {string} currentUserEmail - Email del usuario que realiza el cambio.
 * @returns {Promise<Object>} Estado de la operación.
 */
export async function saveVehicle(id, vehicleData, currentUserEmail) {
  try {
    const db = firebase.firestore();
    const kmVal = parseFloat(vehicleData.kilometraje) || parseFloat(vehicleData.km) || 0;
    
    const data = {
      patente: (vehicleData.patente || '').trim().toUpperCase(),
      marca: (vehicleData.marca || '').trim(),
      modelo: (vehicleData.modelo || '').trim(),
      kilometraje: kmVal,
      km: kmVal,
      proxima_revision: parseFloat(vehicleData.proxima_revision) || 0,
      capacidad_kg: parseFloat(vehicleData.capacidad_kg) || 0,
      capacidad_m_3: parseFloat(vehicleData.capacidad_m_3) || 0,
      estado: vehicleData.estado || 'Disponible'
    };

    if (id) {
      const snap = await db.collection('vehiculos').doc(id).get();
      if (!snap.exists) {
        throw new Error(`El vehículo con ID ${id} no existe.`);
      }
      
      const existingData = snap.data();
      const kmAnterior = existingData.kilometraje || existingData.km || 0;
      
      if (kmVal !== kmAnterior) {
        data.historial_vehiculo = firebase.firestore.FieldValue.arrayUnion({
          fecha: new Date().toISOString(),
          km_final: kmVal,
          km_recorridos: kmVal - kmAnterior,
          conductor: "ajuste_manual",
          ajustado_por: currentUserEmail || 'admin',
          motivo: "Corrección manual odómetro"
        });
      }

      if (vehicleData.conductor !== undefined) {
        data.conductor = vehicleData.conductor;
      }
      
      await db.collection('vehiculos').doc(id).update(data);
    } else {
      data.base_km = kmVal;
      data.base_edited_at = firebase.firestore.FieldValue.serverTimestamp();
      data.conductor = vehicleData.conductor || '';
      await db.collection('vehiculos').add(data);
    }
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al guardar el vehículo en Firestore:", error);
    throw error;
  }
}

/**
 * Elimina un vehículo de la colección 'vehiculos' de Firestore.
 * @param {string} id - ID del vehículo a eliminar.
 * @returns {Promise<Object>} Estado de la operación.
 */
export async function deleteVehicle(id) {
  try {
    const db = firebase.firestore();
    await db.collection('vehiculos').doc(id).delete();
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al eliminar el vehículo con ID ${id} de Firestore:`, error);
    throw error;
  }
}

/**
 * Asigna un conductor por su correo electrónico a un vehículo específico por su patente.
 * @param {string} patente - Patente del vehículo.
 * @param {string} driverEmail - Correo del conductor a asignar.
 * @returns {Promise<Object>} Estado de la operación.
 */
export async function assignDriverToVehicle(patente, driverEmail) {
  try {
    const db = firebase.firestore();
    const snap = await db.collection('vehiculos').where('patente', '==', patente.toUpperCase()).limit(1).get();
    if (snap.empty) {
      throw new Error(`No se encontró el vehículo con patente ${patente}.`);
    }
    const docRef = snap.docs[0].ref;
    await docRef.update({ conductor: driverEmail || '' });
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al asignar el conductor ${driverEmail} al vehículo ${patente}:`, error);
    throw error;
  }
}

/**
 * Obtiene el historial completo de un vehículo (turnos y ajustes manuales), y calcula estadísticas de uso.
 * @param {string} id - ID del documento del vehículo.
 * @param {string} patente - Patente del vehículo.
 * @returns {Promise<Object>} Historial consolidado del vehículo.
 */
export async function getVehicleHistory(id, patente) {
  try {
    const db = firebase.firestore();

    const turnosSnap = await db.collection('turnos')
      .where('patente', '==', patente.toUpperCase())
      .get();

    const userSnap = await db.collection('users').get();
    const nameMap = {};
    userSnap.forEach(d => {
      const u = d.data();
      const email = (u.correo_electronico || u.email || '').toLowerCase().trim();
      const fullName = u.nombre_completo || ((u.nombre || '') + ' ' + (u.apellido || '')).trim() || u.nombre || u.name || '';
      if (email) nameMap[email] = fullName;
      nameMap[d.id] = fullName;
    });

    const turnos = [];
    turnosSnap.forEach(d => {
      const t = d.data();
      
      let fechaObj = null;
      if (t.fecha && t.fecha.toDate) fechaObj = t.fecha.toDate();
      else if (t.hora_cierre && t.hora_cierre.toDate) fechaObj = t.hora_cierre.toDate();
      else if (typeof t.fecha === 'string') {
        try { fechaObj = new Date(t.fecha); } catch(e) {}
      }

      const email = (t.conductor_email || '').toLowerCase().trim();
      const conductorName = t.conductor_nombre || nameMap[email] || nameMap[t.conductor_uid] || email || '—';

      turnos.push({
        fecha: fechaObj ? fechaObj.toISOString() : null,
        conductor: conductorName,
        km_inicial: t.km_inicial || t.km_inicial_actual || 0,
        km_final: t.km_final || null,
        estado: t.estado || 'desconocido',
        turno_id: d.id,
      });
    });

    turnos.sort((a, b) => {
      const da = a.fecha ? new Date(a.fecha).getTime() : 0;
      const dbVal = b.fecha ? new Date(b.fecha).getTime() : 0;
      return dbVal - da;
    });

    const vehSnap = await db.collection('vehiculos').doc(id).get();
    if (!vehSnap.exists) {
      throw new Error(`El vehículo con ID ${id} no existe.`);
    }
    const manualHist = vehSnap.data()?.historial_vehiculo || [];

    const cerrados = turnos.filter(t => t.estado === 'cerrado' && t.km_final !== null);
    const totalKm = cerrados.reduce((sum, t) => sum + Math.max(0, (t.km_final || 0) - (t.km_inicial || 0)), 0);
    const totalTurnos = cerrados.length;
    const conductoresUnicos = [...new Set(cerrados.map(t => t.conductor))];

    return {
      turnos,
      manualHist,
      summary: {
        totalTurnos,
        totalKm,
        conductoresCount: conductoresUnicos.length
      }
    };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al obtener el historial del vehículo ${patente}:`, error);
    throw error;
  }
}

// ── CHEQUEOS OPERACIONALES (CHECKLISTS) ─────────────────────────

export async function getAllChecklists() {
  try {
    const db = firebase.firestore();
    const snap = await db.collection('chequeo_operacional').get();
    const docs = [];
    snap.forEach(d => {
      docs.push({ id: d.id, ...d.data() });
    });
    return docs;
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al obtener checklists:", error);
    throw error;
  }
}

export async function deleteChecklist(id) {
  try {
    const db = firebase.firestore();
    await db.collection('chequeo_operacional').doc(id).delete();
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al eliminar el checklist ${id}:`, error);
    throw error;
  }
}

// ── HOJAS DE RUTA (VIAJES) ──────────────────────────────────────

export async function getAllViajes() {
  try {
    const db = firebase.firestore();
    const snap = await db.collection('hojas_ruta').get();
    const docs = [];
    snap.forEach(d => {
      docs.push({ id: d.id, ...d.data() });
    });
    return docs;
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al obtener hojas de ruta:", error);
    throw error;
  }
}

export async function updateViajeStatus(id, status) {
  try {
    const db = firebase.firestore();
    await db.collection('hojas_ruta').doc(id).update({ estado: status });
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al actualizar estado del viaje ${id}:`, error);
    throw error;
  }
}

export async function deleteViaje(id) {
  try {
    const db = firebase.firestore();
    const batch = db.batch();
    
    batch.delete(db.collection('hojas_ruta').doc(id));
    
    const dSnap = await db.collection('despachos').where('turno_id', '==', id).get();
    dSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    const gSnap = await db.collection('gastos_ruta').where('turno_id', '==', id).get();
    gSnap.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al eliminar el viaje ${id} y sus asociados:`, error);
    throw error;
  }
}

// ── NOTIFICACIONES ──────────────────────────────────────────────

export async function getAllNotificaciones() {
  try {
    const db = firebase.firestore();
    const snap = await db.collection('notificaciones').get();
    const docs = [];
    snap.forEach(d => {
      const data = d.data();
      if (data.tipo === 'checklist' || data.tipo === 'tarea_completada') {
        docs.push({ id: d.id, ...data });
      }
    });
    return docs;
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al obtener notificaciones:", error);
    throw error;
  }
}

export async function markNotificacionLeida(id) {
  try {
    const db = firebase.firestore();
    await db.collection('notificaciones').doc(id).update({ leida: true });
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al marcar como leída la notificación ${id}:`, error);
    throw error;
  }
}

export async function deleteNotificacion(id) {
  try {
    const db = firebase.firestore();
    await db.collection('notificaciones').doc(id).delete();
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al eliminar la notificación ${id}:`, error);
    throw error;
  }
}

// ── DISCREPANCIAS DE KILOMETRAJE ────────────────────────────────

export async function getAllDiscrepancias() {
  try {
    const db = firebase.firestore();
    const snap = await db.collection('km_discrepancias').get();
    const docs = [];
    snap.forEach(d => {
      docs.push({ id: d.id, ...d.data() });
    });
    return docs;
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al obtener discrepancias de KM:", error);
    throw error;
  }
}

export async function resolverDiscrepancia(id, justificacion, revisadoPorEmail) {
  try {
    const db = firebase.firestore();
    await db.collection('km_discrepancias').doc(id).update({
      estado: 'revisada',
      justificacion: justificacion.trim(),
      revisado_por: revisadoPorEmail || 'admin'
    });
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al resolver discrepancia ${id}:`, error);
    throw error;
  }
}

export async function resolverDiscrepanciaConOdometro(id, justificacion, revisadoPorEmail, patente, kmCorregir) {
  try {
    const db = firebase.firestore();
    const vSnap = await db.collection('vehiculos').doc(patente).get();
    if (!vSnap.exists) {
      throw new Error(`El vehículo con patente ${patente} no existe.`);
    }
    
    const vData = vSnap.data();
    const odoActual = vData.kilometraje || vData.km || 0;
    
    const batch = db.batch();
    
    batch.update(db.collection('km_discrepancias').doc(id), {
      estado: 'revisada',
      justificacion: justificacion.trim(),
      revisado_por: revisadoPorEmail || 'admin'
    });
    
    const vRef = db.collection('vehiculos').doc(patente);
    batch.update(vRef, {
      kilometraje: kmCorregir,
      km: kmCorregir,
      historial_vehiculo: firebase.firestore.FieldValue.arrayUnion({
        fecha: new Date().toISOString(),
        km_final: kmCorregir,
        km_recorridos: kmCorregir - odoActual,
        conductor: "correccion_discrepancia",
        ajustado_por: revisadoPorEmail || 'admin',
        motivo: `Corrección por discrepancia de turno resuelta. ID: ${id}`
      })
    });
    
    await batch.commit();
    return { success: true, updatedFlota: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al resolver discrepancia con odómetro para ${id}:`, error);
    throw error;
  }
}

export async function deleteDiscrepancia(id) {
  try {
    const db = firebase.firestore();
    await db.collection('km_discrepancias').doc(id).delete();
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al eliminar discrepancia ${id}:`, error);
    throw error;
  }
}

// ── LOGÍSTICA INVERSA ───────────────────────────────────────────

export async function getInversaConfig() {
  try {
    const db = firebase.firestore();
    const snap = await db.collection('config_inversa').get();
    const docs = [];
    snap.forEach(d => {
      docs.push({ id: d.id, ...d.data() });
    });
    return docs;
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al obtener la configuración de logística inversa:", error);
    throw error;
  }
}

export async function agregarDistribuidorInversa(nombre, uid) {
  try {
    const db = firebase.firestore();
    
    const query = await db.collection('config_inversa').get();
    let exists = false;
    query.forEach(d => {
      if ((d.data().nombre || '').trim().toUpperCase() === nombre.toUpperCase()) {
        exists = true;
      }
    });
    
    if (exists) {
      throw new Error(`El distribuidor "${nombre}" ya está configurado.`);
    }
    
    await db.collection('config_inversa').add({
      nombre: nombre,
      activo: true,
      creado_por: uid || '',
      fecha: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al agregar distribuidor de logística inversa:", error);
    throw error;
  }
}

export async function toggleDistribuidorInversa(id, active) {
  try {
    const db = firebase.firestore();
    await db.collection('config_inversa').doc(id).update({ activo: active });
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al actualizar estado del distribuidor de logística inversa ${id}:`, error);
    throw error;
  }
}

export async function eliminarDistribuidorInversa(id) {
  try {
    const db = firebase.firestore();
    await db.collection('config_inversa').doc(id).delete();
    return { success: true };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error(`Error al eliminar el distribuidor de logística inversa ${id}:`, error);
    throw error;
  }
}

// ── DESPACHOS Y PRUEBAS DE ENTREGA ──────────────────────────────

export async function getAllDespachos() {
  try {
    const db = firebase.firestore();
    const snap = await db.collection('despachos').get();
    const docs = [];
    snap.forEach(d => {
      docs.push({ id: d.id, ...d.data() });
    });
    return docs;
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al obtener despachos:", error);
    throw error;
  }
}

export async function cleanOldDespachoPhotos() {
  try {
    const db = firebase.firestore();
    const storage = firebase.storage();
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const cutoffTS = firebase.firestore.Timestamp.fromDate(cutoff);
    
    const snap = await db.collection('despachos').where('fecha', '<', cutoffTS).get();
    let count = 0;
    
    for (const doc of snap.docs) {
      const d = doc.data();
      let updated = false;
      const updateData = {};
      
      if (d.pod_foto_url && d.pod_foto_url.startsWith('http') && !d.pod_foto_url.includes('Eliminado')) {
        try {
          const ref = storage.refFromURL(d.pod_foto_url);
          await ref.delete();
        } catch (se) {
          console.warn("Storage delete failed for POD photo:", se.message);
        }
        updateData.pod_foto_url = "Eliminado por antigüedad (+24 horas)";
        updated = true;
      }
      
      if (d.devolucion_foto_url && d.devolucion_foto_url.startsWith('http') && !d.devolucion_foto_url.includes('Eliminado')) {
        try {
          const ref = storage.refFromURL(d.devolucion_foto_url);
          await ref.delete();
        } catch (se) {
          console.warn("Storage delete failed for Dev photo:", se.message);
        }
        updateData.devolucion_foto_url = "Eliminado por antigüedad (+24 horas)";
        updated = true;
      }
      
      if (updated) {
        await db.collection('despachos').doc(doc.id).update(updateData);
        count++;
      }
    }
    return { success: true, count };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al limpiar fotos de despachos antiguas:", error);
    throw error;
  }
}

// ── ESTADÍSTICAS DEL RESUMEN EJECUTIVO (DASHBOARD) ──────────────

function calculateOTIF(turnosList, despachosList) {
  const despachosByTurno = {};
  despachosList.forEach(d => {
    if (!despachosByTurno[d.turno_id]) despachosByTurno[d.turno_id] = [];
    despachosByTurno[d.turno_id].push(d);
  });
  
  let totalClosed = 0;
  let otifCount = 0;
  
  turnosList.forEach(t => {
    const tDespachos = despachosByTurno[t._id] || [];
    if (tDespachos.length === 0) return;
    
    totalClosed++;
    
    const tClose = t.hora_cierre?.toDate ? t.hora_cierre.toDate() : (t.hora_cierre ? new Date(t.hora_cierre) : null);
    let onTime = true;
    if (tClose) {
      tDespachos.forEach(d => {
        if (d.estado === 'entregado' && d.pod_timestamp) {
          const dTime = d.pod_timestamp.toDate ? d.pod_timestamp.toDate() : new Date(d.pod_timestamp);
          if (dTime > tClose) {
            onTime = false;
          }
        }
      });
    }
    
    let inFull = true;
    tDespachos.forEach(d => {
      if (d.estado === 'devuelto') {
        inFull = false;
      }
    });
    
    if (onTime && inFull) {
      otifCount++;
    }
  });
  
  const pct = totalClosed > 0 ? Math.round((otifCount / totalClosed) * 100) : 100;
  return { pct, count: otifCount, total: totalClosed };
}

export async function getExecutiveStats(days) {
  try {
    const db = firebase.firestore();
    const now = new Date();
    const cutoff30 = new Date();
    cutoff30.setDate(now.getDate() - 30);
    const cutoff30TS = firebase.firestore.Timestamp.fromDate(cutoff30);

    const [tS, dS, gS, iS, mS, fS] = await Promise.all([
      db.collection('turnos').where('fecha', '>=', cutoff30TS).get(),
      db.collection('despachos').where('fecha', '>=', cutoff30TS).get(),
      db.collection('gastos_ruta').where('fecha', '>=', cutoff30TS).get(),
      db.collection('inventory').get(),
      db.collection('movimientos_bodega').where('fecha', '>=', cutoff30TS).get(),
      db.collection('prefacturas').get()
    ]);

    const turnos = [];
    const despachos = [];
    const gastos = [];
    const invItems = [];
    const movBodega = [];
    const facturas = [];

    tS.forEach(d => {
      const t = d.data();
      t._id = d.id;
      t._date = t.fecha?.toDate ? t.fecha.toDate() : null;
      turnos.push(t);
    });

    dS.forEach(d => {
      const dp = d.data();
      dp._date = dp.pod_timestamp?.toDate ? dp.pod_timestamp.toDate() : (dp.fecha?.toDate ? dp.fecha.toDate() : null);
      const t = turnos.find(x => x._id === dp.turno_id);
      if (t) {
        dp.patente = t.patente || 'N/A';
        dp.conductor_nombre = t.conductor_nombre || t.conductor_email || '—';
      } else {
        dp.patente = dp.patente || 'N/A';
        dp.conductor_nombre = dp.conductor_nombre || dp.conductor_email || '—';
      }
      despachos.push(dp);
    });

    gS.forEach(d => {
      const g = d.data();
      g._date = g.fecha?.toDate ? g.fecha.toDate() : null;
      gastos.push(g);
    });

    iS.forEach(d => invItems.push(d.data()));

    mS.forEach(d => {
      const m = d.data();
      m._date = m.fecha?.toDate ? m.fecha.toDate() : null;
      movBodega.push(m);
    });

    fS.forEach(d => facturas.push(d.data()));

    const cutoffPeriod = new Date();
    cutoffPeriod.setDate(now.getDate() - days);

    const tActive = turnos.filter(t => t._date && t._date >= cutoffPeriod);
    const dActive = despachos.filter(d => d._date && d._date >= cutoffPeriod);
    const gActive = gastos.filter(g => g._date && g._date >= cutoffPeriod);
    const mActive = movBodega.filter(m => m._date && m._date >= cutoffPeriod);

    const entregados = dActive.filter(d => d.estado === 'entregado');
    const devueltos = dActive.filter(d => d.estado === 'devuelto');
    const totalGastos = gActive.reduce((s, g) => s + (g.monto_clp || 0), 0);
    const otifRes = calculateOTIF(tActive, dActive);
    const otif = otifRes.pct;
    const totalFacturado = facturas.reduce((s, f) => s + (f.total || 0), 0);

    const entregasBuckets = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      
      const dayItems = dActive.filter(x => x._date && x._date >= d && x._date < next);
      const ok = dayItems.filter(x => x.estado === 'entregado').length;
      const fail = dayItems.filter(x => x.estado === 'devuelto').length;
      entregasBuckets.push({
        label: d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
        ok,
        fail,
        total: ok + fail
      });
    }

    const gastosBuckets = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const next = new Date(d);
      next.setDate(next.getDate() + 1);
      
      const total = gActive.filter(x => x._date && x._date >= d && x._date < next).reduce((s, g) => s + (g.monto_clp || 0), 0);
      gastosBuckets.push({
        label: d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short' }),
        value: total
      });
    }

    const turnosByVeh = {};
    tActive.forEach(t => {
      const v = t.patente || 'N/A';
      if (!turnosByVeh[v]) turnosByVeh[v] = [];
      turnosByVeh[v].push(t);
    });

    const despachosByVeh = {};
    dActive.forEach(d => {
      const v = d.patente || 'N/A';
      if (!despachosByVeh[v]) despachosByVeh[v] = [];
      despachosByVeh[v].push(d);
    });

    const vehiclesList = Array.from(new Set([...Object.keys(turnosByVeh), ...Object.keys(despachosByVeh)]));
    const vehResults = [];
    vehiclesList.forEach(v => {
      const vTurnos = turnosByVeh[v] || [];
      const vDespachos = despachosByVeh[v] || [];
      const otifResVeh = calculateOTIF(vTurnos, vDespachos);
      if (otifResVeh.total > 0) {
        vehResults.push({ vehicle: v, ...otifResVeh });
      }
    });
    vehResults.sort((a, b) => b.total - a.total).slice(0, 6);

    const invByStatus = {};
    invItems.forEach(i => {
      const s = i.status || 'disponible';
      invByStatus[s] = (invByStatus[s] || 0) + (i.qty || i.cantidad || 0);
    });
    const invTotal = Object.values(invByStatus).reduce((s, v) => s + v, 0) || 1;
    const lowStock = invItems.filter(i => (i.stock_minimo || 0) > 0 && (i.qty || i.cantidad || 0) <= (i.stock_minimo || 0)).length;

    const mByType = {};
    mActive.forEach(m => {
      const t = (m.tipo_movimiento || m.tipo || 'otro');
      mByType[t] = (mByType[t] || 0) + (m.cantidad || 1);
    });

    const turnosByDriver = {};
    tActive.forEach(t => {
      const name = t.conductor_nombre || t.conductor_email || '—';
      if (!turnosByDriver[name]) turnosByDriver[name] = [];
      turnosByDriver[name].push(t);
    });
    const despachosByDriver = {};
    dActive.forEach(d => {
      const name = d.conductor_nombre || d.conductor_email || '—';
      if (!despachosByDriver[name]) despachosByDriver[name] = [];
      despachosByDriver[name].push(d);
    });

    const byDriver = {};
    dActive.filter(d => d.estado === 'entregado').forEach(d => {
      const n = d.conductor_nombre || d.conductor_email || '—';
      if (!byDriver[n]) byDriver[n] = { entregas: 0, devoluciones: 0 };
      byDriver[n].entregas++;
    });
    dActive.filter(d => d.estado === 'devuelto').forEach(d => {
      const n = d.conductor_nombre || d.conductor_email || '—';
      if (!byDriver[n]) byDriver[n] = { entregas: 0, devoluciones: 0 };
      byDriver[n].devoluciones++;
    });

    const ranked = Object.entries(byDriver).map(([name, data]) => {
      const driverTurnos = turnosByDriver[name] || [];
      const driverDespachos = despachosByDriver[name] || [];
      const otifResDriver = calculateOTIF(driverTurnos, driverDespachos);
      return [name, {
        ...data,
        otif: otifResDriver.pct,
        count: otifResDriver.count,
        total: otifResDriver.total
      }];
    }).sort((a, b) => b[1].entregas - a[1].entregas).slice(0, 5);

    return {
      turnosCount: tActive.length,
      entregasCount: entregados.length,
      otif,
      totalGastos,
      totalFacturado,
      entregasBuckets,
      gastosBuckets,
      vehResults,
      invByStatus,
      invTotal,
      lowStock,
      invItemsCount: invItems.length,
      mByType,
      ranked
    };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al obtener estadísticas del resumen ejecutivo:", error);
    throw error;
  }
}

/**
 * Evalúa el estado de mantenimiento preventivo de una lista de vehículos.
 * Compara el kilometraje actual con el de la última mantención registrada.
 * @param {Array} datosVehiculos - Array de objetos vehículo desde Firestore.
 * @returns {Array} Lista de vehículos que requieren atención, con nivel de urgencia.
 */
export function evaluarMantenimientoFlota(datosVehiculos) {
  const UMBRAL_ALERTA_KM = 10000;   // km desde último servicio para alerta roja
  const UMBRAL_PREV_PCT  = 0.85;    // 85 % del umbral → alerta amarilla preventiva

  const enAlerta = [];

  (datosVehiculos || []).forEach(v => {
    const kmActual = parseFloat(v.kilometraje || v.km) || 0;
    const patente  = v.patente || v.id || '—';
    const estado   = v.estado  || 'Desconocido';

    // --- Buscar el último servicio registrado en historial_vehiculo ---
    let kmUltimaMantencion = null;
    let fechaUltimaMantencion = null;

    if (Array.isArray(v.historial_vehiculo) && v.historial_vehiculo.length > 0) {
      // Filtrar sólo entradas de tipo mantenimiento/servicio
      const servicios = v.historial_vehiculo.filter(h =>
        (h.motivo || '').toLowerCase().includes('mantenci') ||
        (h.motivo || '').toLowerCase().includes('servicio') ||
        (h.conductor || '').toLowerCase().includes('mantenci')
      );

      if (servicios.length > 0) {
        // Tomar el más reciente
        servicios.sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
        const ultimo = servicios[0];
        kmUltimaMantencion  = parseFloat(ultimo.km_final) || null;
        fechaUltimaMantencion = ultimo.fecha || null;
      }
    }

    // También verificar campo directo ultima_mantencion_km
    if (v.ultima_mantencion_km !== undefined && v.ultima_mantencion_km !== null) {
      kmUltimaMantencion = parseFloat(v.ultima_mantencion_km) || 0;
    }
    if (v.ultima_mantencion_fecha) {
      fechaUltimaMantencion = v.ultima_mantencion_fecha;
    }

    // --- Evaluar condición ---
    if (kmUltimaMantencion === null) {
      // Sin registro alguno → urgencia crítica
      enAlerta.push({
        patente,
        estado,
        kmActual,
        kmUltimaMantencion: null,
        fechaUltimaMantencion: null,
        kmDesdeServicio: null,
        urgencia: 'critico',
        mensaje: 'Sin registro de mantención en el sistema'
      });
      return;
    }

    const kmDesdeServicio = kmActual - kmUltimaMantencion;

    if (kmDesdeServicio >= UMBRAL_ALERTA_KM) {
      // Superó el umbral → urgencia alta (rojo)
      enAlerta.push({
        patente,
        estado,
        kmActual,
        kmUltimaMantencion,
        fechaUltimaMantencion,
        kmDesdeServicio,
        urgencia: 'alta',
        mensaje: `Supera ${UMBRAL_ALERTA_KM.toLocaleString('es-CL')} km desde el último servicio`
      });
    } else if (kmDesdeServicio >= UMBRAL_ALERTA_KM * UMBRAL_PREV_PCT) {
      // Dentro del margen preventivo → urgencia media (amarillo)
      const kmRestantes = UMBRAL_ALERTA_KM - kmDesdeServicio;
      enAlerta.push({
        patente,
        estado,
        kmActual,
        kmUltimaMantencion,
        fechaUltimaMantencion,
        kmDesdeServicio,
        urgencia: 'media',
        mensaje: `Faltan aprox. ${kmRestantes.toLocaleString('es-CL')} km para la próxima mantención`
      });
    }
  });

  // Ordenar: críticos primero, luego alta, luego media
  const orden = { critico: 0, alta: 1, media: 2 };
  enAlerta.sort((a, b) => (orden[a.urgencia] ?? 3) - (orden[b.urgencia] ?? 3));

  return enAlerta;
}

/**
 * Obtiene los contadores básicos de resumen para los KPIs del Dashboard.
 */
export async function getDashboardKPIs() {
  try {
    const db = firebase.firestore();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ts = firebase.firestore.Timestamp.fromDate(today);
    
    const pUsers = db.collection('users').get().then(snap => snap.size).catch(() => '?');
    const pVehicles = db.collection('vehiculos').get().then(snap => snap.size).catch(() => '?');
    const pChecklists = db.collection('chequeo_operacional').where('fecha_chequeo', '>=', ts).get().then(snap => snap.size).catch(() => '?');
    const pTasks = db.collection('tareas').where('estado', '==', 'pendiente').get().then(snap => snap.size).catch(() => '?');
    const pNotif = db.collection('notificaciones').where('leida', '==', false).get().then(snap => {
      let count = 0;
      snap.forEach(d => {
        const t = d.data().tipo;
        if (t === 'checklist' || t === 'tarea_completada') count++;
      });
      return count;
    }).catch(() => 0);
    
    const [usersCount, vehiclesCount, checklistsCount, tasksCount, notifCount] = await Promise.all([
      pUsers, pVehicles, pChecklists, pTasks, pNotif
    ]);
    
    return { usersCount, vehiclesCount, checklistsCount, tasksCount, notifCount };
  } catch (error) {
    logError(error, 'AdminFleet');
    console.error("Error al obtener los KPIs del Dashboard:", error);
    throw error;
  }
}
