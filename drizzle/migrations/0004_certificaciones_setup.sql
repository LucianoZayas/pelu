-- Setup previo a las tablas de certificaciones (mig 0005).
-- Acá agregamos:
-- 1. Nuevo valor 'cliente' al enum tipo_parte (no se puede combinar con uso en CHECK
--    en la misma transacción, por eso queda en migration aparte).
-- 2. Override de porcentaje de honorarios por item del presupuesto.

ALTER TYPE "public"."tipo_parte" ADD VALUE 'cliente';--> statement-breakpoint

ALTER TABLE "item_presupuesto" ADD COLUMN "porcentaje_honorarios" numeric(6, 2);--> statement-breakpoint

COMMENT ON COLUMN "item_presupuesto"."porcentaje_honorarios" IS
  'Override del porcentaje de honorarios para este item. Si NULL, usa obra.porcentaje_honorarios.';--> statement-breakpoint

-- El índice parte_obra_uniq actual previene 2 partes con el mismo obra_id, pero ahora
-- necesitamos permitir una parte tipo='obra' Y una parte tipo='cliente' para la misma
-- obra. Lo recreamos diferenciado por tipo. Cast a text para no chocar con el valor de
-- enum recién agregado en la misma transacción.

DROP INDEX IF EXISTS "parte_obra_uniq";--> statement-breakpoint

CREATE UNIQUE INDEX "parte_obra_uniq"
  ON "parte" ("obra_id")
  WHERE obra_id IS NOT NULL AND tipo::text = 'obra';--> statement-breakpoint

CREATE UNIQUE INDEX "parte_cliente_uniq"
  ON "parte" ("obra_id")
  WHERE obra_id IS NOT NULL AND tipo::text = 'cliente';

