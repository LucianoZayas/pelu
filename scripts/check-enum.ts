import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });

  const enums = await sql`SELECT unnest(enum_range(NULL::tipo_parte)) AS v`;
  console.log('tipo_parte values:', (enums as unknown as Array<{ v: string }>).map((x) => x.v));

  const col = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'item_presupuesto' AND column_name = 'porcentaje_honorarios'`;
  console.log('item_presupuesto.porcentaje_honorarios exists:', col.length > 0);

  const indices = await sql`SELECT indexname FROM pg_indexes WHERE tablename = 'parte' ORDER BY indexname`;
  console.log('Indices on parte:', (indices as unknown as Array<{ indexname: string }>).map((x) => x.indexname));

  await sql.end();
}
main();
