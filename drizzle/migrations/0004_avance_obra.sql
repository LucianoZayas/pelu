-- Avances de obra: dashboard evolutivo por item del presupuesto firmado.
-- También trae:
-- - Nuevo valor 'cliente' al enum tipo_parte (parte espejo del cliente al firmar).
-- - Override de % honorarios por item del presupuesto (para que el cliente vea
--   el desglose con un porcentaje configurable).
-- - Nueva columna porcentaje_avance en item_presupuesto (0-100, default 0).
--
-- IMPORTANTE: drizzle-kit migrate envuelve todo en transacción y el valor de
-- enum recién agregado no es visible en la misma tx. Si esta migration no se
-- aplica vía drizzle-kit, correr scripts/apply-0004.ts (idempotente).

ALTER TYPE "public"."tipo_parte" ADD VALUE IF NOT EXISTS 'cliente';--> statement-breakpoint

ALTER TABLE "item_presupuesto" ADD COLUMN IF NOT EXISTS "porcentaje_honorarios" numeric(6, 2);--> statement-breakpoint

ALTER TABLE "item_presupuesto" ADD COLUMN IF NOT EXISTS "porcentaje_avance" numeric(6, 2) NOT NULL DEFAULT '0';--> statement-breakpoint

COMMENT ON COLUMN "item_presupuesto"."porcentaje_honorarios" IS
  'Override del % honorarios para este item (default = obra.porcentaje_honorarios).';--> statement-breakpoint

COMMENT ON COLUMN "item_presupuesto"."porcentaje_avance" IS
  'Avance actual del item (0-100). Se va actualizando conforme se completa el trabajo.';--> statement-breakpoint

DROP INDEX IF EXISTS "parte_obra_uniq";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "parte_obra_uniq"
  ON "parte" ("obra_id")
  WHERE obra_id IS NOT NULL AND tipo = 'obra';--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "parte_cliente_uniq"
  ON "parte" ("obra_id")
  WHERE obra_id IS NOT NULL AND tipo = 'cliente';--> statement-breakpoint

-- Relajar CHECK existente: 'cliente' también puede tener obra_id (espejo).
ALTER TABLE "parte" DROP CONSTRAINT IF EXISTS "parte_obra_ref_check";--> statement-breakpoint

ALTER TABLE "parte" ADD CONSTRAINT "parte_obra_ref_check" CHECK (
  (tipo IN ('obra', 'cliente') AND obra_id IS NOT NULL) OR
  (tipo NOT IN ('obra', 'cliente') AND obra_id IS NULL)
);--> statement-breakpoint

-- CHECK del rango de porcentaje_avance.
ALTER TABLE "item_presupuesto" DROP CONSTRAINT IF EXISTS "item_porcentaje_avance_range";--> statement-breakpoint

ALTER TABLE "item_presupuesto" ADD CONSTRAINT "item_porcentaje_avance_range"
  CHECK (porcentaje_avance >= 0 AND porcentaje_avance <= 100);
