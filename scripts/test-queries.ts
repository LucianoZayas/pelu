// Smoke test directo de las queries del dashboard + movimientos + ABMs.
// Llama cada query y reporta éxito/fallo. Diseñado para correrse vía
// `pnpm exec dotenv -e .env.local -- pnpm exec tsx scripts/test-queries.ts`.

import { rangoDelPreset } from '../src/lib/format';

type Result = { name: string; ok: boolean; ms: number; error?: string; sample?: unknown };

async function timed(name: string, fn: () => Promise<unknown>): Promise<Result> {
  const start = Date.now();
  try {
    const v = await fn();
    return { name, ok: true, ms: Date.now() - start, sample: Array.isArray(v) ? `${(v as unknown[]).length} rows` : v };
  } catch (e: any) {
    return { name, ok: false, ms: Date.now() - start, error: e?.message ?? String(e) };
  }
}

async function main() {
  const tests: Result[] = [];

  const mes = rangoDelPreset('mes');
  const año = rangoDelPreset('anio');

  // --- Cuentas / Conceptos / Partes / Proveedores ---
  const cuentasQ = await import('../src/features/cuentas/queries');
  tests.push(await timed('listarCuentas', () => cuentasQ.listarCuentas()));
  tests.push(await timed('listarCuentasActivas', () => cuentasQ.listarCuentasActivas()));
  tests.push(await timed('listarCuentasConSaldo', () => cuentasQ.listarCuentasConSaldo()));

  const conceptosQ = await import('../src/features/conceptos-movimiento/queries');
  tests.push(await timed('listarConceptos', () => conceptosQ.listarConceptos()));
  tests.push(await timed('listarConceptosActivos', () => conceptosQ.listarConceptosActivos()));

  const partesQ = await import('../src/features/partes/queries');
  tests.push(await timed('listarPartes', () => partesQ.listarPartes()));
  tests.push(await timed('listarPartesActivas', () => partesQ.listarPartesActivas()));

  // --- Movimientos ---
  const movQ = await import('../src/features/movimientos/queries');
  tests.push(await timed('listarMovimientos (sin filtros)', () => movQ.listarMovimientos({})));
  tests.push(await timed('listarMovimientos (sin obra)', () => movQ.listarMovimientos({ obraId: '__sin_obra__' })));
  tests.push(await timed('contarMovimientos', () => movQ.contarMovimientos({})));
  tests.push(await timed('contarMovimientos (sin obra)', () => movQ.contarMovimientos({ obraId: '__sin_obra__' })));

  // --- Dashboard ---
  const dashQ = await import('../src/features/flujo-caja/queries');
  tests.push(await timed('obtenerKpisDelPeriodo (mes)', () => dashQ.obtenerKpisDelPeriodo(mes.desde, mes.hasta)));
  tests.push(await timed('obtenerKpisDelPeriodo (año)', () => dashQ.obtenerKpisDelPeriodo(año.desde, año.hasta)));
  tests.push(await timed('obtenerSaldosConDetalle (mes)', () => dashQ.obtenerSaldosConDetalle(mes.desde, mes.hasta)));
  tests.push(await timed('obtenerFlujoPorDia (mes)', () => dashQ.obtenerFlujoPorDia(mes.desde, mes.hasta)));
  tests.push(await timed('obtenerFlujoPorDia (año)', () => dashQ.obtenerFlujoPorDia(año.desde, año.hasta)));
  tests.push(await timed('obtenerBreakdownPorConcepto (mes)', () => dashQ.obtenerBreakdownPorConcepto(mes.desde, mes.hasta, 5)));
  tests.push(await timed('obtenerActividadReciente', () => dashQ.obtenerActividadReciente(10)));

  // --- Obras ---
  const obrasQ = await import('../src/features/obras/queries');
  tests.push(await timed('listarObras', () => obrasQ.listarObras()));

  // --- Print report ---
  console.log('\n=== Resultados ===\n');
  let ok = 0, fail = 0;
  for (const t of tests) {
    if (t.ok) {
      ok++;
      console.log(`  ✓ ${t.name.padEnd(45)} ${String(t.ms).padStart(5)}ms  ${t.sample ?? ''}`);
    } else {
      fail++;
      console.log(`  ✗ ${t.name.padEnd(45)} ${String(t.ms).padStart(5)}ms  ERROR: ${t.error}`);
    }
  }
  console.log(`\nTotal: ${ok} OK, ${fail} FAIL\n`);

  // Cerrar la conexión pg para que el script no se quede colgado
  const { pg } = await import('../src/db/client');
  await pg.end();

  process.exit(fail > 0 ? 1 : 0);
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2); });
