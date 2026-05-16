import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });

  const tables = await sql`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('certificacion', 'avance_item')
  `;
  console.log('Tablas:', (tables as unknown as Array<{ table_name: string }>).map((x) => x.table_name));

  const col = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'movimiento' AND column_name = 'certificacion_id'`;
  console.log('movimiento.certificacion_id exists:', col.length > 0);

  try {
    const enums = await sql`SELECT unnest(enum_range(NULL::estado_certificacion)) AS v`;
    console.log('estado_certificacion values:', (enums as unknown as Array<{ v: string }>).map((x) => x.v));
  } catch (e: any) {
    console.log('estado_certificacion enum: NOT FOUND', e.message);
  }

  const ent = await sql`SELECT unnest(enum_range(NULL::entidad_audit)) AS v`;
  console.log('entidad_audit values:', (ent as unknown as Array<{ v: string }>).map((x) => x.v));

  const acc = await sql`SELECT unnest(enum_range(NULL::accion_audit)) AS v`;
  console.log('accion_audit values:', (acc as unknown as Array<{ v: string }>).map((x) => x.v));

  await sql.end();
}
main();
