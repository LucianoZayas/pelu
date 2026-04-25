CREATE TYPE "public"."accion_audit" AS ENUM('crear', 'editar', 'eliminar', 'firmar', 'cancelar', 'regenerar_token');--> statement-breakpoint
CREATE TYPE "public"."entidad_audit" AS ENUM('obra', 'presupuesto', 'item_presupuesto', 'usuario', 'cliente_token', 'rubro');--> statement-breakpoint
CREATE TYPE "public"."estado_obra" AS ENUM('borrador', 'activa', 'pausada', 'cerrada', 'cancelada');--> statement-breakpoint
CREATE TYPE "public"."estado_presupuesto" AS ENUM('borrador', 'firmado', 'cancelado');--> statement-breakpoint
CREATE TYPE "public"."moneda" AS ENUM('USD', 'ARS');--> statement-breakpoint
CREATE TYPE "public"."rol" AS ENUM('admin', 'operador');--> statement-breakpoint
CREATE TYPE "public"."tipo_movimiento" AS ENUM('entrada', 'salida');--> statement-breakpoint
CREATE TYPE "public"."tipo_presupuesto" AS ENUM('original', 'adicional');--> statement-breakpoint
CREATE TYPE "public"."unidad" AS ENUM('m2', 'm3', 'hs', 'gl', 'u', 'ml', 'kg');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entidad" "entidad_audit" NOT NULL,
	"entidad_id" uuid NOT NULL,
	"accion" "accion_audit" NOT NULL,
	"diff" jsonb,
	"descripcion_humana" text,
	"usuario_id" uuid NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cuenta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"moneda" "moneda" NOT NULL,
	"tipo" text NOT NULL,
	"activo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_presupuesto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"presupuesto_id" uuid NOT NULL,
	"rubro_id" uuid NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"descripcion" text NOT NULL,
	"unidad" "unidad" NOT NULL,
	"cantidad" numeric(18, 4) NOT NULL,
	"costo_unitario" numeric(18, 4) NOT NULL,
	"costo_unitario_moneda" "moneda" NOT NULL,
	"costo_unitario_base" numeric(18, 4) NOT NULL,
	"markup_porcentaje" numeric(6, 2),
	"markup_efectivo_porcentaje" numeric(6, 2) NOT NULL,
	"precio_unitario_cliente" numeric(18, 4) NOT NULL,
	"notas" text,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "movimiento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_movimiento" NOT NULL,
	"fecha" timestamp NOT NULL,
	"monto" numeric(18, 4) NOT NULL,
	"moneda" "moneda" NOT NULL,
	"cotizacion_usd" numeric(18, 4),
	"cuenta_id" uuid,
	"obra_id" uuid,
	"rubro_id" uuid,
	"proveedor_id" uuid,
	"descripcion" text,
	"comprobante_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid
);
--> statement-breakpoint
CREATE TABLE "obra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"cliente_nombre" text NOT NULL,
	"cliente_email" text,
	"cliente_telefono" text,
	"ubicacion" text,
	"superficie_m2" numeric(12, 2),
	"fecha_inicio" timestamp,
	"fecha_fin_estimada" timestamp,
	"fecha_fin_real" timestamp,
	"moneda_base" "moneda" DEFAULT 'USD' NOT NULL,
	"cotizacion_usd_inicial" numeric(18, 4),
	"porcentaje_honorarios" numeric(6, 2) DEFAULT '16' NOT NULL,
	"estado" "estado_obra" DEFAULT 'borrador' NOT NULL,
	"cliente_token" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "obra_codigo_unique" UNIQUE("codigo"),
	CONSTRAINT "obra_cliente_token_unique" UNIQUE("cliente_token")
);
--> statement-breakpoint
CREATE TABLE "presupuesto" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"obra_id" uuid NOT NULL,
	"tipo" "tipo_presupuesto" NOT NULL,
	"numero" integer NOT NULL,
	"descripcion" text,
	"fecha_emision" timestamp DEFAULT now() NOT NULL,
	"fecha_firma" timestamp,
	"estado" "estado_presupuesto" DEFAULT 'borrador' NOT NULL,
	"markup_default_porcentaje" numeric(6, 2) DEFAULT '30' NOT NULL,
	"cotizacion_usd" numeric(18, 4) NOT NULL,
	"template_version" integer DEFAULT 1 NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"total_cliente_calculado" numeric(18, 4),
	"total_costo_calculado" numeric(18, 4),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proveedor" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"cuit" text,
	"contacto" text,
	"es_contratista" boolean DEFAULT false NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rubro" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nombre" text NOT NULL,
	"id_padre" uuid,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"creado_por_importador" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"nombre" text NOT NULL,
	"rol" "rol" NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_presupuesto" ADD CONSTRAINT "item_presupuesto_presupuesto_id_presupuesto_id_fk" FOREIGN KEY ("presupuesto_id") REFERENCES "public"."presupuesto"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_presupuesto" ADD CONSTRAINT "item_presupuesto_rubro_id_rubro_id_fk" FOREIGN KEY ("rubro_id") REFERENCES "public"."rubro"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_cuenta_id_cuenta_id_fk" FOREIGN KEY ("cuenta_id") REFERENCES "public"."cuenta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_obra_id_obra_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_rubro_id_rubro_id_fk" FOREIGN KEY ("rubro_id") REFERENCES "public"."rubro"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_proveedor_id_proveedor_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_created_by_usuario_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obra" ADD CONSTRAINT "obra_created_by_usuario_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "obra" ADD CONSTRAINT "obra_updated_by_usuario_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto" ADD CONSTRAINT "presupuesto_obra_id_obra_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto" ADD CONSTRAINT "presupuesto_created_by_usuario_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "presupuesto" ADD CONSTRAINT "presupuesto_updated_by_usuario_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "obra_cliente_token_idx" ON "obra" USING btree ("cliente_token");--> statement-breakpoint
CREATE UNIQUE INDEX "presupuesto_obra_numero_idx" ON "presupuesto" USING btree ("obra_id","numero");