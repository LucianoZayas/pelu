-- Certificaciones de avance: tablas + enum estado + extensiones audit.

CREATE TYPE "public"."estado_certificacion" AS ENUM ('borrador', 'emitida', 'cobrada', 'anulada');--> statement-breakpoint

-- Extensión de enums de audit log. Como con 0004, estos ALTER TYPE quedan
-- en transacción y puede ser que no se vean en la misma migration; pero
-- ningún CREATE INDEX / constraint en esta migration los usa como valor,
-- así que está OK.
ALTER TYPE "public"."entidad_audit" ADD VALUE IF NOT EXISTS 'certificacion';--> statement-breakpoint
ALTER TYPE "public"."entidad_audit" ADD VALUE IF NOT EXISTS 'avance_item';--> statement-breakpoint
ALTER TYPE "public"."accion_audit" ADD VALUE IF NOT EXISTS 'emitir';--> statement-breakpoint
ALTER TYPE "public"."accion_audit" ADD VALUE IF NOT EXISTS 'cobrar';--> statement-breakpoint

CREATE TABLE "certificacion" (
  "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "presupuesto_id"        uuid NOT NULL REFERENCES "presupuesto"("id"),
  "numero"                integer NOT NULL,
  "fecha"                 date NOT NULL DEFAULT current_date,
  "descripcion"           text,
  "estado"                "estado_certificacion" NOT NULL DEFAULT 'borrador',
  "total_neto"            numeric(18, 4) NOT NULL DEFAULT '0',
  "total_honorarios"      numeric(18, 4) NOT NULL DEFAULT '0',
  "total_general"         numeric(18, 4) NOT NULL DEFAULT '0',
  "moneda"                "moneda" NOT NULL,
  "fecha_emision"         timestamptz,
  "fecha_cobro"           timestamptz,
  "anulado_motivo"        text,
  "anulado_at"            timestamptz,
  "anulado_by"            uuid REFERENCES "usuario"("id"),
  "created_at"            timestamptz NOT NULL DEFAULT now(),
  "created_by"            uuid NOT NULL REFERENCES "usuario"("id"),
  "updated_at"            timestamptz NOT NULL DEFAULT now(),
  "updated_by"            uuid REFERENCES "usuario"("id"),
  CONSTRAINT "certificacion_presupuesto_numero_uniq" UNIQUE ("presupuesto_id", "numero")
);--> statement-breakpoint

CREATE INDEX "certificacion_presupuesto_idx" ON "certificacion" ("presupuesto_id");--> statement-breakpoint
CREATE INDEX "certificacion_estado_fecha_idx" ON "certificacion" ("estado", "fecha" DESC);--> statement-breakpoint

CREATE TABLE "avance_item" (
  "id"                            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "certificacion_id"              uuid NOT NULL REFERENCES "certificacion"("id") ON DELETE CASCADE,
  "item_presupuesto_id"           uuid NOT NULL REFERENCES "item_presupuesto"("id"),
  "porcentaje_acumulado"          numeric(6, 2) NOT NULL,
  "porcentaje_anterior"           numeric(6, 2) NOT NULL DEFAULT '0',
  "monto_neto_facturado"          numeric(18, 4) NOT NULL,
  "monto_honorarios_facturado"    numeric(18, 4) NOT NULL,
  "porcentaje_honorarios_aplicado" numeric(6, 2) NOT NULL,
  CONSTRAINT "avance_unico_por_cert" UNIQUE ("certificacion_id", "item_presupuesto_id"),
  CONSTRAINT "avance_porcentaje_range" CHECK (porcentaje_acumulado >= 0 AND porcentaje_acumulado <= 100)
);--> statement-breakpoint

CREATE INDEX "avance_item_cert_idx" ON "avance_item" ("certificacion_id");--> statement-breakpoint
CREATE INDEX "avance_item_item_idx" ON "avance_item" ("item_presupuesto_id");--> statement-breakpoint

-- Link movimiento → certificación (para anulación conjunta y auditoría).
ALTER TABLE "movimiento" ADD COLUMN "certificacion_id" uuid REFERENCES "certificacion"("id");--> statement-breakpoint
CREATE INDEX "movimiento_certificacion_idx" ON "movimiento" ("certificacion_id") WHERE certificacion_id IS NOT NULL;
