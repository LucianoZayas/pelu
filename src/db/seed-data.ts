export const RUBROS_BASE = [
  { nombre: 'Trabajos preliminares', orden: 1 },
  { nombre: 'Demoliciones', orden: 2 },
  { nombre: 'Excavaciones', orden: 3 },
  { nombre: 'Albañilería', orden: 4 },
  { nombre: 'Hormigón armado', orden: 5 },
  { nombre: 'Cubiertas', orden: 6 },
  { nombre: 'Aislaciones', orden: 7 },
  { nombre: 'Revoques', orden: 8 },
  { nombre: 'Contrapisos y carpetas', orden: 9 },
  { nombre: 'Revestimientos', orden: 10 },
  { nombre: 'Pisos', orden: 11 },
  { nombre: 'Cielorrasos', orden: 12 },
  { nombre: 'Carpinterías', orden: 13 },
  { nombre: 'Pinturas', orden: 14 },
  { nombre: 'Instalaciones', orden: 15, hijos: [
    { nombre: 'Sanitarias', orden: 1 },
    { nombre: 'Gas', orden: 2 },
    { nombre: 'Eléctrica', orden: 3 },
    { nombre: 'Termomecánica', orden: 4 },
  ]},
  { nombre: 'Equipamiento', orden: 16 },
  { nombre: 'Limpieza final', orden: 17 },
];

// ---- Flujo de Caja ----
// Cuentas iniciales de Macna. Los nombres de "Cris" y "Frank" identifican
// a los socios — confirmar contra el listado real al primer seed prod.

export const CUENTAS_BASE = [
  { nombre: 'Caja USD',        moneda: 'USD' as const, tipo: 'caja',  orden: 1 },
  { nombre: 'Caja Física ARS', moneda: 'ARS' as const, tipo: 'caja',  orden: 2 },
  { nombre: 'Banco Cris',      moneda: 'ARS' as const, tipo: 'banco', orden: 3 },
  { nombre: 'Banco Frank',     moneda: 'ARS' as const, tipo: 'banco', orden: 4 },
];

export const CONCEPTOS_BASE = [
  // Ingresos
  { codigo: 'HO',                       nombre: 'Honorarios de Obra (16%)', tipo: 'ingreso' as const,      requiereObra: true,  orden: 1 },
  { codigo: 'MO_BENEFICIO',             nombre: 'Mano de Obra · Beneficio', tipo: 'ingreso' as const,      requiereObra: true,  orden: 2 },
  { codigo: 'MAT_BENEFICIO',            nombre: 'Materiales · Beneficio',   tipo: 'ingreso' as const,      requiereObra: true,  orden: 3 },
  { codigo: 'HP',                       nombre: 'Honorarios de Proyecto',   tipo: 'ingreso' as const,      requiereObra: false, orden: 4 },
  { codigo: 'COMISION',                 nombre: 'Comisión',                 tipo: 'ingreso' as const,      requiereObra: false, orden: 5 },
  { codigo: 'RECUPERO',                 nombre: 'Recupero',                 tipo: 'ingreso' as const,      requiereObra: true,  orden: 6 },
  { codigo: 'COBRO_CERTIFICACION',      nombre: 'Cobro de certificación',   tipo: 'ingreso' as const,      requiereObra: true,  orden: 7 },
  // Egresos
  { codigo: 'COBRO_SOCIO',              nombre: 'Cobro de Socio',           tipo: 'egreso' as const,       requiereObra: false, orden: 10 },
  { codigo: 'SUELDO',                   nombre: 'Sueldo',                   tipo: 'egreso' as const,       requiereObra: false, orden: 11 },
  { codigo: 'PAGOS_CONSULTORA',         nombre: 'Pagos Consultora',         tipo: 'egreso' as const,       requiereObra: false, orden: 12 },
  { codigo: 'MARKETING',                nombre: 'Marketing',                tipo: 'egreso' as const,       requiereObra: false, orden: 13 },
  { codigo: 'GASTO_VARIO',              nombre: 'Gasto Vario',              tipo: 'egreso' as const,       requiereObra: false, orden: 14 },
  { codigo: 'GASTO_NO_RECUPERABLE',     nombre: 'Gasto No Recuperable',     tipo: 'egreso' as const,       requiereObra: true,  esNoRecuperable: true, orden: 15 },
  // Transferencia
  { codigo: 'MOVIMIENTO_ENTRE_CUENTAS', nombre: 'Movimiento entre Cuentas', tipo: 'transferencia' as const, requiereObra: false, orden: 20 },
];

// Partes fijas. Las de tipo obra/proveedor se autogeneran al crear obra/proveedor.
export const PARTES_BASE = [
  { tipo: 'empresa' as const,  nombre: 'Macna' },
  { tipo: 'socio' as const,    nombre: 'Cris' },
  { tipo: 'socio' as const,    nombre: 'Frank' },
  { tipo: 'empleado' as const, nombre: 'Dani' },
  { tipo: 'externo' as const,  nombre: 'Financiera' },
  { tipo: 'externo' as const,  nombre: 'Consultora' },
];
