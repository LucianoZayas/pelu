// Limpia las obras de test del feature certificaciones (las que tienen __TEST_CERT_ en el nombre).
import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
  try {
    // Encontrar obras de test
    const obras = await sql<Array<{ id: string; codigo: string; nombre: string }>>`
      SELECT id, codigo, nombre FROM obra WHERE nombre LIKE '__TEST_CERT_%'
    `;
    console.log(`Encontradas ${obras.length} obras de test`);

    for (const o of obras) {
      // Disable solo los triggers de "escrito en piedra" (no los system constraints)
      await sql`ALTER TABLE item_presupuesto DISABLE TRIGGER escrito_en_piedra_item`;
      await sql`ALTER TABLE presupuesto DISABLE TRIGGER escrito_en_piedra_presupuesto`;

      const presupuestos = await sql<Array<{ id: string }>>`
        SELECT id FROM presupuesto WHERE obra_id = ${o.id}
      `;
      for (const p of presupuestos) {
        // Cascade: avance_item, certificacion, item_presupuesto, presupuesto
        await sql`DELETE FROM movimiento WHERE obra_id = ${o.id}`;
        const certs = await sql<Array<{ id: string }>>`SELECT id FROM certificacion WHERE presupuesto_id = ${p.id}`;
        for (const c of certs) {
          await sql`DELETE FROM avance_item WHERE certificacion_id = ${c.id}`;
        }
        await sql`DELETE FROM certificacion WHERE presupuesto_id = ${p.id}`;
        await sql`DELETE FROM item_presupuesto WHERE presupuesto_id = ${p.id}`;
        await sql`DELETE FROM presupuesto WHERE id = ${p.id}`;
      }
      await sql`DELETE FROM parte WHERE obra_id = ${o.id}`;
      await sql`DELETE FROM obra WHERE id = ${o.id}`;

      await sql`ALTER TABLE item_presupuesto ENABLE TRIGGER escrito_en_piedra_item`;
      await sql`ALTER TABLE presupuesto ENABLE TRIGGER escrito_en_piedra_presupuesto`;

      console.log(`  ✓ obra ${o.codigo} (${o.nombre.slice(0, 30)}…) borrada`);
    }
  } finally {
    await sql.end();
  }
}
main();
