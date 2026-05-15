CREATE TYPE "public"."estado_movimiento" AS ENUM('previsto', 'confirmado', 'anulado');--> statement-breakpoint
CREATE TYPE "public"."tipo_concepto" AS ENUM('ingreso', 'egreso', 'transferencia');--> statement-breakpoint
CREATE TYPE "public"."tipo_parte" AS ENUM('empresa', 'obra', 'socio', 'empleado', 'proveedor', 'externo');--> statement-breakpoint
ALTER TYPE "public"."accion_audit" ADD VALUE 'anular';--> statement-breakpoint
ALTER TYPE "public"."accion_audit" ADD VALUE 'restaurar';--> statement-breakpoint
ALTER TYPE "public"."entidad_audit" ADD VALUE 'movimiento';--> statement-breakpoint
ALTER TYPE "public"."entidad_audit" ADD VALUE 'cuenta';--> statement-breakpoint
ALTER TYPE "public"."entidad_audit" ADD VALUE 'concepto_movimiento';--> statement-breakpoint
ALTER TYPE "public"."entidad_audit" ADD VALUE 'parte';--> statement-breakpoint
ALTER TYPE "public"."entidad_audit" ADD VALUE 'proveedor';--> statement-breakpoint
ALTER TYPE "public"."tipo_movimiento" ADD VALUE 'transferencia';--> statement-breakpoint
CREATE TABLE "concepto_movimiento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"codigo" text NOT NULL,
	"nombre" text NOT NULL,
	"tipo" "tipo_concepto" NOT NULL,
	"requiere_obra" boolean DEFAULT false NOT NULL,
	"requiere_proveedor" boolean DEFAULT false NOT NULL,
	"es_no_recuperable" boolean DEFAULT false NOT NULL,
	"orden" integer DEFAULT 0 NOT NULL,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "concepto_movimiento_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "parte" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" "tipo_parte" NOT NULL,
	"nombre" text NOT NULL,
	"obra_id" uuid,
	"proveedor_id" uuid,
	"datos" jsonb,
	"activo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cuenta" ADD COLUMN "orden" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "cuenta" ADD COLUMN "notas" text;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "concepto_id" uuid;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "monto_destino" numeric(18, 4);--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "cuenta_destino_id" uuid;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "parte_origen_id" uuid;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "parte_destino_id" uuid;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "numero_comprobante" text;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "es_no_recuperable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "estado" "estado_movimiento" DEFAULT 'confirmado' NOT NULL;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "anulado_motivo" text;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "anulado_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "anulado_by" uuid;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "version" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "movimiento" ADD COLUMN "updated_by" uuid;--> statement-breakpoint
ALTER TABLE "parte" ADD CONSTRAINT "parte_obra_id_obra_id_fk" FOREIGN KEY ("obra_id") REFERENCES "public"."obra"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parte" ADD CONSTRAINT "parte_proveedor_id_proveedor_id_fk" FOREIGN KEY ("proveedor_id") REFERENCES "public"."proveedor"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "concepto_movimiento_activo_orden_idx" ON "concepto_movimiento" USING btree ("activo","orden");--> statement-breakpoint
CREATE INDEX "parte_tipo_activo_idx" ON "parte" USING btree ("tipo") WHERE activo = true;--> statement-breakpoint
CREATE UNIQUE INDEX "parte_obra_uniq" ON "parte" USING btree ("obra_id") WHERE obra_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "parte_proveedor_uniq" ON "parte" USING btree ("proveedor_id") WHERE proveedor_id IS NOT NULL;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_concepto_id_concepto_movimiento_id_fk" FOREIGN KEY ("concepto_id") REFERENCES "public"."concepto_movimiento"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_cuenta_destino_id_cuenta_id_fk" FOREIGN KEY ("cuenta_destino_id") REFERENCES "public"."cuenta"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_parte_origen_id_parte_id_fk" FOREIGN KEY ("parte_origen_id") REFERENCES "public"."parte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_parte_destino_id_parte_id_fk" FOREIGN KEY ("parte_destino_id") REFERENCES "public"."parte"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_anulado_by_usuario_id_fk" FOREIGN KEY ("anulado_by") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_updated_by_usuario_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."usuario"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "movimiento_obra_fecha_idx" ON "movimiento" USING btree ("obra_id","fecha");--> statement-breakpoint
CREATE INDEX "movimiento_cuenta_fecha_idx" ON "movimiento" USING btree ("cuenta_id","fecha");--> statement-breakpoint
CREATE INDEX "movimiento_cuenta_destino_fecha_idx" ON "movimiento" USING btree ("cuenta_destino_id","fecha") WHERE cuenta_destino_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "movimiento_concepto_fecha_idx" ON "movimiento" USING btree ("concepto_id","fecha");--> statement-breakpoint
CREATE INDEX "movimiento_parte_origen_fecha_idx" ON "movimiento" USING btree ("parte_origen_id","fecha") WHERE parte_origen_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "movimiento_parte_destino_fecha_idx" ON "movimiento" USING btree ("parte_destino_id","fecha") WHERE parte_destino_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "movimiento_estado_idx" ON "movimiento" USING btree ("estado") WHERE estado != 'confirmado';--> statement-breakpoint
ALTER TABLE "parte" ADD CONSTRAINT "parte_obra_ref_check" CHECK (
  (tipo = 'obra' AND obra_id IS NOT NULL) OR (tipo != 'obra' AND obra_id IS NULL)
);--> statement-breakpoint
ALTER TABLE "parte" ADD CONSTRAINT "parte_proveedor_ref_check" CHECK (
  (tipo = 'proveedor' AND proveedor_id IS NOT NULL) OR (tipo != 'proveedor' AND proveedor_id IS NULL)
);--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_transferencia_cuentas_check" CHECK (
  tipo::text != 'transferencia' OR (cuenta_id IS NOT NULL AND cuenta_destino_id IS NOT NULL)
);--> statement-breakpoint
ALTER TABLE "movimiento" ADD CONSTRAINT "movimiento_cuentas_distintas_check" CHECK (
  cuenta_destino_id IS NULL OR cuenta_destino_id != cuenta_id
);
