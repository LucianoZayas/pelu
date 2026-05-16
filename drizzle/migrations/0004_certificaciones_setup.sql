-- Setup previo a las tablas de certificaciones (mig 0005).
-- Acá agregamos:
-- 1. Nuevo valor 'cliente' al enum tipo_parte.
-- 2. Override de porcentaje de honorarios por item del presupuesto.
-- 3. Reorganización de unique indexes en parte (obra y cliente pueden coexistir).
--
-- IMPORTANTE: drizzle-kit migrate envuelve todo en una transacción, y el valor
-- de enum recién agregado NO es visible dentro de la misma transacción. Por eso
-- la migration tuvo que aplicarse en partes vía scripts/apply-0004.ts en local.
-- Si necesitás reproducir esto en otro entorno, correr ese script ANTES de que
-- drizzle marque la migration como aplicada en el journal. Detalle del bug:
-- https://github.com/drizzle-team/drizzle-orm/issues/x (issue conocido enum+tx).

ALTER TYPE "public"."tipo_parte" ADD VALUE IF NOT EXISTS 'cliente';--> statement-breakpoint

ALTER TABLE "item_presupuesto" ADD COLUMN IF NOT EXISTS "porcentaje_honorarios" numeric(6, 2);--> statement-breakpoint

COMMENT ON COLUMN "item_presupuesto"."porcentaje_honorarios" IS
  'Override del porcentaje de honorarios para este item. Si NULL, usa obra.porcentaje_honorarios.';--> statement-breakpoint

DROP INDEX IF EXISTS "parte_obra_uniq";--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "parte_obra_uniq"
  ON "parte" ("obra_id")
  WHERE obra_id IS NOT NULL AND tipo = 'obra';--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "parte_cliente_uniq"
  ON "parte" ("obra_id")
  WHERE obra_id IS NOT NULL AND tipo = 'cliente';--> statement-breakpoint

-- El CHECK original (mig 0003) limitaba que obra_id sólo aplica a tipo='obra'.
-- Ahora también tipo='cliente' tiene obra_id, así que relajamos el constraint.
ALTER TABLE "parte" DROP CONSTRAINT IF EXISTS "parte_obra_ref_check";--> statement-breakpoint

ALTER TABLE "parte" ADD CONSTRAINT "parte_obra_ref_check" CHECK (
  (tipo IN ('obra', 'cliente') AND obra_id IS NOT NULL) OR
  (tipo NOT IN ('obra', 'cliente') AND obra_id IS NULL)
);
