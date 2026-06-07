// ══════════════════════════════════════════════
// CONSTANTS — SILOG SpA
// Enums y constantes globales reutilizables
// ══════════════════════════════════════════════

const VEH_ESTADO = Object.freeze({
  DISPONIBLE:     'Disponible',
  EN_RUTA:        'En Ruta',
  MANTENCION:     'Mantención',
  FUERA_SERVICIO: 'Fuera de Servicio',
});

const TURNO_ESTADO = Object.freeze({
  ABIERTO: 'abierto',
  CERRADO: 'cerrado',
});

const DESPACHO_ESTADO = Object.freeze({
  PENDIENTE:  'pendiente',
  ENTREGADO:  'entregado',
  DEVUELTO:   'devuelto',
  EN_CAMINO:  'en_camino',
});

const HOJA_ESTADO = Object.freeze({
  PENDIENTE:  'pendiente',
  APROBADA:   'aprobada',
  RECHAZADA:  'rechazada',
});

const GASTO_TIPOS = Object.freeze([
  'Peaje', 'Combustible', 'Estacionamiento', 'Alimentación', 'Otro',
]);

const ROLES = Object.freeze({
  ADMIN:                  'admin',
  ADMINISTRATIVO:         'administrativo',
  ADMIN_CONDUCTOR:        'administrativo.conductor',
  CONDUCTOR:              'conductor',
  BODEGUERO:              'bodeguero',
  FINANZAS:               'finanzas',
  GESTION:                'gestion',
});
