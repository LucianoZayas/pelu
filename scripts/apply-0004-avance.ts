// Aplica la migration 0004 (avance-obra) en partes para evitar el bug de
// ALTER TYPE + transacción de drizzle-kit. Idempotente.

import postgres from 'postgres';

async function step1AddEnumValue() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
  try {
    await sql`ALTER TYPE "public"."tipo_parte" ADD VALUE IF NOT EXISTS 'cliente'`;
    console.log('1. ✓ cliente agregado al enum (o ya existía)');
  } finally {
    await sql.end();
  }
}

async function step2AddColumnsAndIndices() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
  try {
    await sql`ALTER TABLE item_presupuesto ADD COLUMN IF NOT EXISTS porcentaje_honorarios numeric(6, 2)`;
    await sql`ALTER TABLE item_presupuesto ADD COLUMN IF NOT EXISTS porcentaje_avance numeric(6, 2) NOT NULL DEFAULT '0'`;
    await sql`COMMENT ON COLUMN item_presupuesto.porcentaje_honorarios IS 'Override del % honorarios para este item (default = obra.porcentaje_honorarios).'`;
    await sql`COMMENT ON COLUMN item_presupuesto.porcentaje_avance IS 'Avance actual del item (0-100). Evoluciona conforme se completa el trabajo.'`;
    console.log('2. ✓ columnas porcentaje_honorarios + porcentaje_avance');

    await sql`DROP INDEX IF EXISTS parte_obra_uniq`;
    await sql`DROP INDEX IF EXISTS parte_cliente_uniq`;
    await sql`CREATE UNIQUE INDEX parte_obra_uniq ON parte (obra_id) WHERE obra_id IS NOT NULL AND tipo = 'obra'`;
    await sql`CREATE UNIQUE INDEX parte_cliente_uniq ON parte (obra_id) WHERE obra_id IS NOT NULL AND tipo = 'cliente'`;
    console.log('3. ✓ índices únicos parte_obra_uniq + parte_cliente_uniq');

    await sql`ALTER TABLE parte DROP CONSTRAINT IF EXISTS parte_obra_ref_check`;
    await sql`ALTER TABLE parte ADD CONSTRAINT parte_obra_ref_check CHECK (
      (tipo IN ('obra', 'cliente') AND obra_id IS NOT NULL) OR
      (tipo NOT IN ('obra', 'cliente') AND obra_id IS NULL)
    )`;
    console.log('4. ✓ CHECK parte_obra_ref_check actualizado');

    await sql`ALTER TABLE item_presupuesto DROP CONSTRAINT IF EXISTS item_porcentaje_avance_range`;
    await sql`ALTER TABLE item_presupuesto ADD CONSTRAINT item_porcentaje_avance_range CHECK (porcentaje_avance >= 0 AND porcentaje_avance <= 100)`;
    console.log('5. ✓ CHECK item_porcentaje_avance_range');
  } finally {
    await sql.end();
  }
}

async function main() {
  await step1AddEnumValue();
  await new Promise((r) => setTimeout(r, 500));
  await step2AddColumnsAndIndices();
}

main();
