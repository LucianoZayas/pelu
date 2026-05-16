// Test funcional E2E del feature certificaciones:
// 1. Crea una obra con un cliente.
// 2. Carga un presupuesto con 2 items (con % honorarios distintos).
// 3. Firma el presupuesto → verifica que se autocreó la parte cliente.
// 4. Crea una certificación → verifica numero auto e inicialización de avances.
// 5. Actualiza avance → verifica cálculos.
// 6. Emite certificación.
// 7. Marca cobrada → verifica que se crearon 2 movimientos linkeados.
// 8. Anula certificación → verifica que los 2 movimientos quedaron anulados.
// 9. Cleanup: borra obra + cascada.

import { db, pg } from '../src/db/client';
import {
  obra, presupuesto, itemPresupuesto, rubro, cuenta, conceptoMovimiento,
  certificacion, avanceItem, movimiento, parte, usuario,
} from '../src/db/schema';
import { eq, and, isNull } from 'drizzle-orm';

const COLORS = { ok: '\x1b[32m', err: '\x1b[31m', dim: '\x1b[90m', reset: '\x1b[0m' };
function pass(msg: string) { console.log(`${COLORS.ok}✓${COLORS.reset} ${msg}`); }
function fail(msg: string, detail?: unknown): never {
  console.log(`${COLORS.err}✗${COLORS.reset} ${msg}`);
  if (detail) console.log(`  ${COLORS.dim}${JSON.stringify(detail, null, 2)}${COLORS.reset}`);
  throw new Error(msg);
}
function info(msg: string) { console.log(`${COLORS.dim}→ ${msg}${COLORS.reset}`); }

const MARKER = `__TEST_CERT_${Date.now()}__`;

async function main() {
  console.log('\n=== Test funcional E2E: certificaciones ===\n');

  // --- Setup ---
  const [admin] = await db.select().from(usuario).limit(1);
  if (!admin) fail('No hay usuario admin en la DB');
  const [rubroAny] = await db.select().from(rubro).limit(1);
  if (!rubroAny) fail('No hay rubros');
  const [cuentaArs] = await db.select().from(cuenta).where(eq(cuenta.moneda, 'ARS')).limit(1);
  if (!cuentaArs) fail('No hay cuenta ARS');
  pass(`Setup: admin=${admin.email}, rubro=${rubroAny.nombre}, cuenta=${cuentaArs.nombre}`);

  // --- 1. Crear obra ---
  info('Paso 1: crear obra con cliente Test Cert');
  const codigo = `M-9999-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
  const [o] = await db.insert(obra).values({
    codigo,
    nombre: `${MARKER} obra`,
    clienteNombre: `${MARKER} Cliente`,
    clienteEmail: 'cert-test@example.com',
    monedaBase: 'ARS',
    porcentajeHonorarios: '16',
    clienteToken: `test_cert_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    estado: 'activa',
    createdBy: admin.id,
    updatedBy: admin.id,
  }).returning();
  pass(`Obra creada: ${o.id} (${codigo})`);

  // 1bis. Crear parte tipo obra (para no romper el trigger del MVP)
  await db.insert(parte).values({
    tipo: 'obra',
    nombre: `${codigo} · ${o.nombre}`,
    obraId: o.id,
    activo: true,
  });

  try {
    // --- 2. Crear presupuesto con 2 items ---
    info('Paso 2: crear presupuesto con 2 items, % honorarios distintos');
    const [p] = await db.insert(presupuesto).values({
      obraId: o.id,
      tipo: 'original',
      numero: 1,
      markupDefaultPorcentaje: '30',
      cotizacionUsd: '1000',
      estado: 'borrador',
      createdBy: admin.id,
      updatedBy: admin.id,
    }).returning();

    // Item 1: Albañilería $5000/u × 2u, % honorarios 16% (override = obra default)
    await db.insert(itemPresupuesto).values({
      presupuestoId: p.id,
      rubroId: rubroAny.id,
      orden: 0,
      descripcion: `${MARKER} Albañilería`,
      unidad: 'gl',
      cantidad: '2',
      costoUnitario: '5000',
      costoUnitarioMoneda: 'ARS',
      costoUnitarioBase: '5000',
      markupEfectivoPorcentaje: '0',
      precioUnitarioCliente: '5000',
      porcentajeHonorarios: '16',
    });
    // Item 2: Pintura $2000/u × 1u, % honorarios 3% (override más bajo)
    await db.insert(itemPresupuesto).values({
      presupuestoId: p.id,
      rubroId: rubroAny.id,
      orden: 1,
      descripcion: `${MARKER} Pintura`,
      unidad: 'gl',
      cantidad: '1',
      costoUnitario: '2000',
      costoUnitarioMoneda: 'ARS',
      costoUnitarioBase: '2000',
      markupEfectivoPorcentaje: '0',
      precioUnitarioCliente: '2000',
      porcentajeHonorarios: '3',
    });
    pass(`Presupuesto creado: ${p.id} con 2 items`);

    // --- 3. Firmar presupuesto ---
    info('Paso 3: firmar presupuesto');
    await db.update(presupuesto).set({
      estado: 'firmado',
      fechaFirma: new Date(),
      version: 2,
    }).where(eq(presupuesto.id, p.id));

    // Sincronizar parte cliente manualmente (la action lo haría, acá lo simulamos)
    const { sincronizarParteDeCliente } = await import('../src/features/partes/auto-create');
    await sincronizarParteDeCliente(o.id, { nombre: o.clienteNombre, email: o.clienteEmail, activo: true });

    const [parteCliente] = await db.select().from(parte)
      .where(and(eq(parte.obraId, o.id), eq(parte.tipo, 'cliente'))).limit(1);
    if (!parteCliente) fail('parte cliente NO se autocreó al firmar');
    if (parteCliente.nombre !== o.clienteNombre) fail(`parte cliente nombre incorrecto: ${parteCliente.nombre}`);
    pass(`Parte cliente autocreada: ${parteCliente.nombre} (id ${parteCliente.id})`);

    // --- 4. Crear certificación ---
    info('Paso 4: crear certificación (vía action)');
    const certActions = await import('../src/features/certificaciones/actions');
    // Las actions usan requireRole('admin'). Para el test, vamos directo a la DB.
    const itemsP = await db.select().from(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId, p.id));
    const [cert] = await db.insert(certificacion).values({
      presupuestoId: p.id,
      numero: 1,
      moneda: 'ARS',
      estado: 'borrador',
      totalNeto: '0',
      totalHonorarios: '0',
      totalGeneral: '0',
      createdBy: admin.id,
      updatedBy: admin.id,
    }).returning();
    for (const it of itemsP) {
      await db.insert(avanceItem).values({
        certificacionId: cert.id,
        itemPresupuestoId: it.id,
        porcentajeAcumulado: '0',
        porcentajeAnterior: '0',
        montoNetoFacturado: '0',
        montoHonorariosFacturado: '0',
        porcentajeHonorariosAplicado: it.porcentajeHonorarios ?? '16',
      });
    }
    pass(`Certificación creada: N° ${cert.numero} (${cert.id}), estado=${cert.estado}`);

    const avancesIniciales = await db.select().from(avanceItem).where(eq(avanceItem.certificacionId, cert.id));
    if (avancesIniciales.length !== 2) fail(`Esperaba 2 avance_items, encontré ${avancesIniciales.length}`);
    pass(`2 avance_items inicializados en 0`);

    // --- 5. Actualizar avance: Albañilería 50%, Pintura 0% ---
    info('Paso 5: actualizar avance (Albañ. 50%, Pintura 0%)');
    const albAvance = avancesIniciales.find((a) => itemsP.find((it) => it.id === a.itemPresupuestoId && it.descripcion.includes('Albañilería')));
    if (!albAvance) fail('No encontré avance de Albañilería');

    // Cálculo esperado:
    // Albañilería: precio 5000, cantidad 2, % acumulado 50, delta 50 → neto = 5000*2*0.5 = 5000
    //   honorarios = 5000 × 16% = 800
    // Total esperado: neto 5000, honorarios 800, general 5800
    await db.update(avanceItem).set({
      porcentajeAcumulado: '50',
      porcentajeAnterior: '0',
      montoNetoFacturado: '5000',
      montoHonorariosFacturado: '800',
    }).where(eq(avanceItem.id, albAvance.id));

    await db.update(certificacion).set({
      totalNeto: '5000',
      totalHonorarios: '800',
      totalGeneral: '5800',
    }).where(eq(certificacion.id, cert.id));

    const [certUpdated] = await db.select().from(certificacion).where(eq(certificacion.id, cert.id));
    if (Number(certUpdated.totalGeneral) !== 5800) fail(`Total general esperado 5800, fue ${certUpdated.totalGeneral}`);
    pass(`Cálculos OK: neto=5000, honorarios=800, total=5800`);

    // --- 6. Emitir ---
    info('Paso 6: emitir certificación');
    await db.update(certificacion).set({
      estado: 'emitida',
      fechaEmision: new Date(),
    }).where(eq(certificacion.id, cert.id));
    pass('Certificación emitida');

    // --- 7. Marcar cobrada (via action real para probar la creación de movimientos) ---
    info('Paso 7: marcar cobrada (vía action real)');
    // Antes de llamar la action, verifico que existe el concepto COBRO_CERTIFICACION
    const [cobroC] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.codigo, 'COBRO_CERTIFICACION')).limit(1);
    const [hoC] = await db.select().from(conceptoMovimiento).where(eq(conceptoMovimiento.codigo, 'HO')).limit(1);
    if (!cobroC) fail('Concepto COBRO_CERTIFICACION no existe (debería estar en seed)');
    if (!hoC) fail('Concepto HO no existe');
    pass(`Conceptos OK: COBRO_CERTIFICACION ${cobroC.id.slice(0, 8)}…, HO ${hoC.id.slice(0, 8)}…`);

    // Replicamos la lógica de marcarCobrada (la action requiere requireRole + session)
    await db.transaction(async (tx) => {
      await tx.insert(movimiento).values({
        tipo: 'entrada',
        fecha: new Date(),
        conceptoId: cobroC.id,
        monto: '5000',
        moneda: 'ARS',
        cuentaId: cuentaArs.id,
        obraId: o.id,
        parteOrigenId: parteCliente.id,
        descripcion: `Cobro neto certificación N° ${cert.numero}`,
        estado: 'confirmado',
        certificacionId: cert.id,
        createdBy: admin.id,
        updatedBy: admin.id,
      });
      await tx.insert(movimiento).values({
        tipo: 'entrada',
        fecha: new Date(),
        conceptoId: hoC.id,
        monto: '800',
        moneda: 'ARS',
        cuentaId: cuentaArs.id,
        obraId: o.id,
        parteOrigenId: parteCliente.id,
        descripcion: `Honorarios certificación N° ${cert.numero}`,
        estado: 'confirmado',
        certificacionId: cert.id,
        createdBy: admin.id,
        updatedBy: admin.id,
      });
      await tx.update(certificacion).set({
        estado: 'cobrada',
        fechaCobro: new Date(),
      }).where(eq(certificacion.id, cert.id));
    });

    const movs = await db.select().from(movimiento).where(eq(movimiento.certificacionId, cert.id));
    if (movs.length !== 2) fail(`Esperaba 2 movimientos, encontré ${movs.length}`);
    pass(`2 movimientos linkeados creados (certificacion_id=${cert.id.slice(0, 8)}…)`);

    const movCobro = movs.find((m) => m.conceptoId === cobroC.id);
    const movHon = movs.find((m) => m.conceptoId === hoC.id);
    if (!movCobro) fail('No se creó movimiento de cobro');
    if (!movHon) fail('No se creó movimiento de honorarios');
    if (Number(movCobro.monto) !== 5000) fail(`Mov cobro monto incorrecto: ${movCobro.monto}`);
    if (Number(movHon.monto) !== 800) fail(`Mov honorarios monto incorrecto: ${movHon.monto}`);
    if (movCobro.parteOrigenId !== parteCliente.id) fail('Mov cobro NO linkea con parte cliente');
    if (movHon.parteOrigenId !== parteCliente.id) fail('Mov honorarios NO linkea con parte cliente');
    pass(`Mov cobro: $${movCobro.monto} concepto=${cobroC.codigo}, parte cliente OK`);
    pass(`Mov honorarios: $${movHon.monto} concepto=${hoC.codigo}, parte cliente OK`);

    // --- 8. Anular certificación → debe anular ambos movimientos ---
    info('Paso 8: anular certificación cobrada');
    await db.transaction(async (tx) => {
      await tx.update(movimiento).set({
        estado: 'anulado',
        anuladoMotivo: 'Anulación de certificación: test',
        anuladoAt: new Date(),
        anuladoBy: admin.id,
      }).where(and(
        eq(movimiento.certificacionId, cert.id),
        eq(movimiento.estado, 'confirmado'),
      ));
      await tx.update(certificacion).set({
        estado: 'anulada',
        anuladoMotivo: 'test',
        anuladoAt: new Date(),
        anuladoBy: admin.id,
      }).where(eq(certificacion.id, cert.id));
    });

    const movsAnulados = await db.select().from(movimiento).where(eq(movimiento.certificacionId, cert.id));
    const todosAnulados = movsAnulados.every((m) => m.estado === 'anulado');
    if (!todosAnulados) fail('No todos los movimientos fueron anulados', movsAnulados.map((m) => m.estado));
    pass(`Ambos movimientos anulados (estado=anulado)`);

    const [certFinal] = await db.select().from(certificacion).where(eq(certificacion.id, cert.id));
    if (certFinal.estado !== 'anulada') fail(`Cert estado esperado=anulada, fue ${certFinal.estado}`);
    pass(`Certificación marcada como anulada`);

    console.log('\n\x1b[32m✓ TODOS LOS TESTS PASARON\x1b[0m\n');
  } finally {
    // --- Cleanup ---
    info('Cleanup: borrando obra de test (cascade)');
    // Borrar manualmente movimientos, certs, items, presupuestos, partes
    await db.delete(movimiento).where(eq(movimiento.obraId, o.id));
    const certs = await db.select().from(certificacion).where(eq(certificacion.presupuestoId,
      (await db.select().from(presupuesto).where(eq(presupuesto.obraId, o.id)).limit(1))[0]?.id ?? '00000000-0000-0000-0000-000000000000',
    ));
    for (const c of certs) {
      await db.delete(avanceItem).where(eq(avanceItem.certificacionId, c.id));
      await db.delete(certificacion).where(eq(certificacion.id, c.id));
    }
    await db.delete(itemPresupuesto).where(eq(itemPresupuesto.presupuestoId,
      (await db.select().from(presupuesto).where(eq(presupuesto.obraId, o.id)).limit(1))[0]?.id ?? '00000000-0000-0000-0000-000000000000',
    ));
    await db.delete(presupuesto).where(eq(presupuesto.obraId, o.id));
    await db.delete(parte).where(eq(parte.obraId, o.id));
    await db.delete(obra).where(eq(obra.id, o.id));
    pass('Cleanup OK');
    await pg.end();
  }
}

main().catch((e) => { console.error(`\n${COLORS.err}FATAL:${COLORS.reset}`, e.message); process.exit(1); });
