// Smoke test: el trigger debe permitir UPDATE porcentaje_avance en items
// firmados, y seguir bloqueando otras columnas.

import postgres from 'postgres';

async function main() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
  try {
    const [item] = await sql<{ id: string; porcentaje_avance: string; presupuesto_id: string; cantidad: string }[]>`
      SELECT ip.id, ip.porcentaje_avance, ip.presupuesto_id, ip.cantidad
      FROM item_presupuesto ip
      JOIN presupuesto p ON p.id = ip.presupuesto_id
      WHERE p.estado = 'firmado'
      LIMIT 1
    `;

    if (!item) {
      console.log('⚠️  no hay items en presupuesto firmado para testear');
      return;
    }

    console.log(`Item: ${item.id} (avance actual: ${item.porcentaje_avance})`);

    const nuevoAvance = item.porcentaje_avance === '50' ? '60' : '50';
    await sql`UPDATE item_presupuesto SET porcentaje_avance = ${nuevoAvance} WHERE id = ${item.id}`;
    console.log(`✓ porcentaje_avance actualizado a ${nuevoAvance} en item firmado`);

    try {
      await sql`UPDATE item_presupuesto SET cantidad = '999' WHERE id = ${item.id}`;
      console.error('✗ ERROR: el trigger NO bloqueó cambio de cantidad — bug');
      process.exit(1);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('No se puede modificar items de un presupuesto firmado')) {
        console.log('✓ trigger sigue bloqueando otras columnas (cantidad)');
      } else {
        console.error('✗ error inesperado:', msg);
        process.exit(1);
      }
    }

    await sql`UPDATE item_presupuesto SET porcentaje_avance = ${item.porcentaje_avance} WHERE id = ${item.id}`;
    console.log(`✓ restaurado porcentaje_avance a ${item.porcentaje_avance}`);
  } finally {
    await sql.end();
  }
}

main();
