import {
  pgTable, uuid, text, timestamp, boolean, integer, decimal, jsonb, pgEnum, uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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
