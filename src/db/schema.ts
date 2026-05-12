import {
  pgTable, uuid, text, timestamp, boolean, integer, decimal, jsonb, pgEnum, uniqueIndex, index,
} from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

export const rolEnum = pgEnum('rol', ['admin', 'operador']);
export const monedaEnum = pgEnum('moneda', ['USD', 'ARS']);
export const unidadEnum = pgEnum('unidad', ['m2', 'm3', 'hs', 'gl', 'u', 'ml', 'kg']);
export const estadoObraEnum = pgEnum('estado_obra', ['borrador', 'activa', 'pausada', 'cerrada', 'cancelada']);
export const tipoPresupuestoEnum = pgEnum('tipo_presupuesto', ['original', 'adicional']);
export const estadoPresupuestoEnum = pgEnum('estado_presupuesto', ['borrador', 'firmado', 'cancelado']);
export const entidadAuditEnum = pgEnum('entidad_audit', [
  'obra', 'presupuesto', 'item_presupuesto', 'usuario', 'cliente_token', 'rubro',
]);
export const accionAuditEnum = pgEnum('accion_audit', [
  'crear', 'editar', 'eliminar', 'firmar', 'cancelar', 'regenerar_token',
]);

export const usuario = pgTable('usuario', {
  id: uuid('id').primaryKey(), // mismo UUID que auth.users.id de Supabase
  email: text('email').notNull().unique(),
  nombre: text('nombre').notNull(),
  rol: rolEnum('rol').notNull(),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const obra = pgTable('obra', {
  id: uuid('id').primaryKey().defaultRandom(),
  codigo: text('codigo').notNull().unique(),
  nombre: text('nombre').notNull(),
  clienteNombre: text('cliente_nombre').notNull(),
  clienteEmail: text('cliente_email'),
  clienteTelefono: text('cliente_telefono'),
  ubicacion: text('ubicacion'),
  superficieM2: decimal('superficie_m2', { precision: 12, scale: 2 }),
  fechaInicio: timestamp('fecha_inicio', { mode: 'date' }),
  fechaFinEstimada: timestamp('fecha_fin_estimada', { mode: 'date' }),
  fechaFinReal: timestamp('fecha_fin_real', { mode: 'date' }),
  monedaBase: monedaEnum('moneda_base').notNull().default('USD'),
  cotizacionUsdInicial: decimal('cotizacion_usd_inicial', { precision: 18, scale: 4 }),
  porcentajeHonorarios: decimal('porcentaje_honorarios', { precision: 6, scale: 2 }).notNull().default('16'),
  estado: estadoObraEnum('estado').notNull().default('borrador'),
  clienteToken: text('cliente_token').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull().references(() => usuario.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').notNull().references(() => usuario.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  clienteTokenIdx: uniqueIndex('obra_cliente_token_idx').on(t.clienteToken),
}));

export const rubro = pgTable('rubro', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  idPadre: uuid('id_padre'),
  orden: integer('orden').notNull().default(0),
  activo: boolean('activo').notNull().default(true),
  creadoPorImportador: boolean('creado_por_importador').notNull().default(false),
});

export const rubroRelations = relations(rubro, ({ one, many }) => ({
  padre: one(rubro, { fields: [rubro.idPadre], references: [rubro.id], relationName: 'padre_hijos' }),
  hijos: many(rubro, { relationName: 'padre_hijos' }),
}));

export const presupuesto = pgTable('presupuesto', {
  id: uuid('id').primaryKey().defaultRandom(),
  obraId: uuid('obra_id').notNull().references(() => obra.id),
  tipo: tipoPresupuestoEnum('tipo').notNull(),
  numero: integer('numero').notNull(),
  descripcion: text('descripcion'),
  fechaEmision: timestamp('fecha_emision', { mode: 'date' }).notNull().defaultNow(),
  fechaFirma: timestamp('fecha_firma', { mode: 'date' }),
  estado: estadoPresupuestoEnum('estado').notNull().default('borrador'),
  markupDefaultPorcentaje: decimal('markup_default_porcentaje', { precision: 6, scale: 2 }).notNull().default('30'),
  cotizacionUsd: decimal('cotizacion_usd', { precision: 18, scale: 4 }).notNull(),
  templateVersion: integer('template_version').notNull().default(1),
  version: integer('version').notNull().default(1),
  importPendiente: boolean('import_pendiente').notNull().default(false),
  importMetadata: jsonb('import_metadata'),
  reemplazadoPorImportId: uuid('reemplazado_por_import_id'),
  totalClienteCalculado: decimal('total_cliente_calculado', { precision: 18, scale: 4 }),
  totalCostoCalculado: decimal('total_costo_calculado', { precision: 18, scale: 4 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').notNull().references(() => usuario.id),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: uuid('updated_by').notNull().references(() => usuario.id),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
}, (t) => ({
  obraNumeroIdx: uniqueIndex('presupuesto_obra_numero_idx').on(t.obraId, t.numero),
  importPendienteIdx: index('presupuesto_import_pendiente_idx').on(t.importPendiente).where(sql`import_pendiente = true`),
}));

export const itemPresupuesto = pgTable('item_presupuesto', {
  id: uuid('id').primaryKey().defaultRandom(),
  presupuestoId: uuid('presupuesto_id').notNull().references(() => presupuesto.id, { onDelete: 'cascade' }),
  rubroId: uuid('rubro_id').notNull().references(() => rubro.id),
  orden: integer('orden').notNull().default(0),
  descripcion: text('descripcion').notNull(),
  unidad: unidadEnum('unidad').notNull(),
  cantidad: decimal('cantidad', { precision: 18, scale: 4 }).notNull(),
  costoUnitario: decimal('costo_unitario', { precision: 18, scale: 4 }).notNull(),
  costoUnitarioMoneda: monedaEnum('costo_unitario_moneda').notNull(),
  costoUnitarioBase: decimal('costo_unitario_base', { precision: 18, scale: 4 }).notNull(),
  markupPorcentaje: decimal('markup_porcentaje', { precision: 6, scale: 2 }),
  markupEfectivoPorcentaje: decimal('markup_efectivo_porcentaje', { precision: 6, scale: 2 }).notNull(),
  precioUnitarioCliente: decimal('precio_unitario_cliente', { precision: 18, scale: 4 }).notNull(),
  notas: text('notas'),
  ubicacion: text('ubicacion'),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  entidad: entidadAuditEnum('entidad').notNull(),
  entidadId: uuid('entidad_id').notNull(),
  accion: accionAuditEnum('accion').notNull(),
  diff: jsonb('diff'),
  descripcionHumana: text('descripcion_humana'),
  usuarioId: uuid('usuario_id').notNull().references(() => usuario.id),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull().defaultNow(),
});

// Stubs F2 — sin UI, solo definición para evitar migración disruptiva.
export const tipoMovimientoEnum = pgEnum('tipo_movimiento', ['entrada', 'salida']);

export const proveedor = pgTable('proveedor', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  cuit: text('cuit'),
  contacto: text('contacto'),
  esContratista: boolean('es_contratista').notNull().default(false),
  activo: boolean('activo').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cuenta = pgTable('cuenta', {
  id: uuid('id').primaryKey().defaultRandom(),
  nombre: text('nombre').notNull(),
  moneda: monedaEnum('moneda').notNull(),
  tipo: text('tipo').notNull(), // 'caja' | 'banco'
  activo: boolean('activo').notNull().default(true),
});

export const movimiento = pgTable('movimiento', {
  id: uuid('id').primaryKey().defaultRandom(),
  tipo: tipoMovimientoEnum('tipo').notNull(),
  fecha: timestamp('fecha', { mode: 'date' }).notNull(),
  monto: decimal('monto', { precision: 18, scale: 4 }).notNull(),
  moneda: monedaEnum('moneda').notNull(),
  cotizacionUsd: decimal('cotizacion_usd', { precision: 18, scale: 4 }),
  cuentaId: uuid('cuenta_id').references(() => cuenta.id),
  obraId: uuid('obra_id').references(() => obra.id),
  rubroId: uuid('rubro_id').references(() => rubro.id),
  proveedorId: uuid('proveedor_id').references(() => proveedor.id),
  descripcion: text('descripcion'),
  comprobanteUrl: text('comprobante_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  createdBy: uuid('created_by').references(() => usuario.id),
});
