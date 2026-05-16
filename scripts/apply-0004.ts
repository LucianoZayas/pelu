// Workaround: aplicar 0004 en partes — el ALTER TYPE ADD VALUE necesita su propia
// transacción committed antes de poder usar el nuevo valor en CREATE INDEX WHERE.

import postgres from 'postgres';

async function step1AddEnumValue() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
  try {
    await sql`ALTER TYPE "public"."tipo_parte" ADD VALUE IF NOT EXISTS 'cliente'`;
    console.log('1. ✓ cliente agregado (o ya existía)');
  } finally {
    await sql.end();
  }
}

async function step2AddColumnAndIndices() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
  try {
    await sql`ALTER TABLE item_presupuesto ADD COLUMN IF NOT EXISTS porcentaje_honorarios numeric(6, 2)`;
    await sql`COMMENT ON COLUMN item_presupuesto.porcentaje_honorarios IS 'Override del porcentaje de honorarios para este item. Si NULL, usa obra.porcentaje_honorarios.'`;
    console.log('2. ✓ porcentaje_honorarios agregado');

    await sql`DROP INDEX IF EXISTS parte_obra_uniq`;
    await sql`DROP INDEX IF EXISTS parte_cliente_uniq`;
    await sql`CREATE UNIQUE INDEX parte_obra_uniq ON parte (obra_id) WHERE obra_id IS NOT NULL AND tipo = 'obra'`;
    await sql`CREATE UNIQUE INDEX parte_cliente_uniq ON parte (obra_id) WHERE obra_id IS NOT NULL AND tipo = 'cliente'`;
    console.log('3. ✓ índices únicos parte_obra_uniq y parte_cliente_uniq recreados');

    // El CHECK original (mig 0003) decía: tipo='obra' ↔ obra_id NOT NULL. Pero
    // ahora tipo='cliente' también puede tener obra_id. Lo relajamos.
    await sql`ALTER TABLE parte DROP CONSTRAINT IF EXISTS parte_obra_ref_check`;
    await sql`ALTER TABLE parte ADD CONSTRAINT parte_obra_ref_check CHECK (
      (tipo IN ('obra', 'cliente') AND obra_id IS NOT NULL) OR
      (tipo NOT IN ('obra', 'cliente') AND obra_id IS NULL)
    )`;
    console.log('4. ✓ CHECK parte_obra_ref_check actualizado para incluir cliente');

    const enums = await sql`SELECT unnest(enum_range(NULL::tipo_parte)) AS v`;
    console.log('Final tipo_parte values:', (enums as unknown as Array<{ v: string }>).map((x) => x.v));
  } finally {
    await sql.end();
  }
}

async function main() {
  await step1AddEnumValue();
  // Pequeño delay para asegurar que el commit del ALTER TYPE se propaga
  await new Promise((r) => setTimeout(r, 500));
  await step2AddColumnAndIndices();
}

main();
