import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { eq } from 'drizzle-orm';
import { ejecutarImport } from './ejecutor';
import { db } from '@/db/client';
import { usuario } from '@/db/schema';

interface CliArgs {
  csvPath?: string;
  codigoObra?: string;
  dryRun: boolean;
  cotizacion?: string;
  markup?: string;
  adminEmail?: string;
  nombreObra?: string;
  clienteNombre?: string;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const out: CliArgs = { dryRun: false, help: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (!out.csvPath && !a.startsWith('--')) out.csvPath = a;
    else if (a === '--dry-run') out.dryRun = true;
    else if (a === '--codigo-obra') out.codigoObra = argv[++i];
    else if (a === '--cotizacion') out.cotizacion = argv[++i];
    else if (a === '--markup') out.markup = argv[++i];
    else if (a === '--admin-email') out.adminEmail = argv[++i];
    else if (a === '--nombre-obra') out.nombreObra = argv[++i];
    else if (a === '--cliente-nombre') out.clienteNombre = argv[++i];
  }
  return out;
}

const USAGE = `Uso: pnpm import-sheets <csv> --codigo-obra M-2026-001 --cotizacion 1200 [--markup 30] [--dry-run]

Opciones:
  <csv>                  Ruta al archivo CSV con columnas: rubro,descripcion,unidad,cantidad,costo_unitario,moneda_costo,markup,notas
  --codigo-obra <code>   Código único de la obra (ej. M-2026-001). Idempotente.
  --cotizacion <num>     Cotización USD (ARS por dólar) usada para snapshots.
  --markup <num>         Markup default % del presupuesto (default: 30).
  --admin-email <email>  Email del usuario admin que ejecuta el import. Si se omite, usa SEED_ADMIN_EMAIL.
  --nombre-obra <str>    Nombre legible de la obra (default: usa el código).
  --cliente-nombre <str> Nombre del cliente (default: "Cliente importado").
  --dry-run              Reporta sin escribir nada.
  --help, -h             Muestra esta ayuda.`;

async function main() {
  const a = parseArgs(process.argv);
  if (a.help) {
    console.log(USAGE);
    process.exit(0);
  }
  if (!a.csvPath || !a.codigoObra) {
    console.error(USAGE);
    process.exit(2);
  }

  const adminEmail = a.adminEmail ?? process.env.SEED_ADMIN_EMAIL;
  if (!adminEmail) {
    console.error('Falta --admin-email o SEED_ADMIN_EMAIL en el entorno.');
    process.exit(2);
  }
  const [admin] = await db.select().from(usuario).where(eq(usuario.email, adminEmail));
  if (!admin) {
    console.error(`Admin ${adminEmail} no existe en tabla usuario.`);
    process.exit(2);
  }

  const buf = readFileSync(resolve(a.csvPath));
  const r = await ejecutarImport({
    buf,
    codigoObra: a.codigoObra,
    adminId: admin.id,
    dryRun: a.dryRun,
    cotizacionUsd: a.cotizacion ?? '1',
    markupDefault: a.markup ?? '30',
    nombreObra: a.nombreObra,
    clienteNombre: a.clienteNombre,
  });

  if (r.ok) {
    console.log(`✓ ${a.dryRun ? 'DRY-RUN: ' : ''}importados ${r.itemsImportados} items`);
    if ('obraId' in r && r.obraId) console.log(`  obra_id=${r.obraId}`);
    process.exit(0);
  } else {
    console.error('✗ Errores:');
    r.errores.forEach((e) => console.error(`  ${e}`));
    process.exit(1);
  }
}

main();
