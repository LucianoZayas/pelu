// Workaround: drizzle-kit no aplica esta migration por el issue con
// ALTER TYPE en transacción + pooler. Aplica el SQL completo en partes.

import postgres from 'postgres';

async function step1AddEnumValues() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
  try {
    await sql`ALTER TYPE "public"."entidad_audit" ADD VALUE IF NOT EXISTS 'certificacion'`;
    await sql`ALTER TYPE "public"."entidad_audit" ADD VALUE IF NOT EXISTS 'avance_item'`;
    await sql`ALTER TYPE "public"."accion_audit" ADD VALUE IF NOT EXISTS 'emitir'`;
    await sql`ALTER TYPE "public"."accion_audit" ADD VALUE IF NOT EXISTS 'cobrar'`;
    console.log('1. ✓ enum audit extendido');
  } finally {
    await sql.end();
  }
}

async function step2CreateTablesAndType() {
  const sql = postgres(process.env.DIRECT_URL!, { max: 1 });
  try {
    // Crear enum nuevo (idempotente vía DO block)
    await sql.unsafe(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'estado_certificacion') THEN
          CREATE TYPE "public"."estado_certificacion" AS ENUM ('borrador', 'emitida', 'cobrada', 'anulada');
        END IF;
      END $$;
    `);
    console.log('2. ✓ enum estado_certificacion');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "certificacion" (
        "id"                    uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "presupuesto_id"        uuid NOT NULL REFERENCES "presupuesto"("id"),
        "numero"                integer NOT NULL,
        "fecha"                 date NOT NULL DEFAULT current_date,
        "descripcion"           text,
        "estado"                "estado_certificacion" NOT NULL DEFAULT 'borrador',
        "total_neto"            numeric(18, 4) NOT NULL DEFAULT '0',
        "total_honorarios"      numeric(18, 4) NOT NULL DEFAULT '0',
        "total_general"         numeric(18, 4) NOT NULL DEFAULT '0',
        "moneda"                "moneda" NOT NULL,
        "fecha_emision"         timestamptz,
        "fecha_cobro"           timestamptz,
        "anulado_motivo"        text,
        "anulado_at"            timestamptz,
        "anulado_by"            uuid REFERENCES "usuario"("id"),
        "created_at"            timestamptz NOT NULL DEFAULT now(),
        "created_by"            uuid NOT NULL REFERENCES "usuario"("id"),
        "updated_at"            timestamptz NOT NULL DEFAULT now(),
        "updated_by"            uuid REFERENCES "usuario"("id"),
        CONSTRAINT "certificacion_presupuesto_numero_uniq" UNIQUE ("presupuesto_id", "numero")
      );
    `);
    await sql`CREATE INDEX IF NOT EXISTS "certificacion_presupuesto_idx" ON "certificacion" ("presupuesto_id")`;
    await sql.unsafe(`CREATE INDEX IF NOT EXISTS "certificacion_estado_fecha_idx" ON "certificacion" ("estado", "fecha" DESC)`);
    console.log('3. ✓ tabla certificacion');

    await sql.unsafe(`
      CREATE TABLE IF NOT EXISTS "avance_item" (
        "id"                            uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        "certificacion_id"              uuid NOT NULL REFERENCES "certificacion"("id") ON DELETE CASCADE,
        "item_presupuesto_id"           uuid NOT NULL REFERENCES "item_presupuesto"("id"),
        "porcentaje_acumulado"          numeric(6, 2) NOT NULL,
        "porcentaje_anterior"           numeric(6, 2) NOT NULL DEFAULT '0',
        "monto_neto_facturado"          numeric(18, 4) NOT NULL,
        "monto_honorarios_facturado"    numeric(18, 4) NOT NULL,
        "porcentaje_honorarios_aplicado" numeric(6, 2) NOT NULL,
        CONSTRAINT "avance_unico_por_cert" UNIQUE ("certificacion_id", "item_presupuesto_id"),
        CONSTRAINT "avance_porcentaje_range" CHECK (porcentaje_acumulado >= 0 AND porcentaje_acumulado <= 100)
      );
    `);
    await sql`CREATE INDEX IF NOT EXISTS "avance_item_cert_idx" ON "avance_item" ("certificacion_id")`;
    await sql`CREATE INDEX IF NOT EXISTS "avance_item_item_idx" ON "avance_item" ("item_presupuesto_id")`;
    console.log('4. ✓ tabla avance_item');

    await sql`ALTER TABLE "movimiento" ADD COLUMN IF NOT EXISTS "certificacion_id" uuid REFERENCES "certificacion"("id")`;
    await sql`CREATE INDEX IF NOT EXISTS "movimiento_certificacion_idx" ON "movimiento" ("certificacion_id") WHERE certificacion_id IS NOT NULL`;
    console.log('5. ✓ movimiento.certificacion_id agregado');
  } finally {
    await sql.end();
  }
}

async function main() {
  await step1AddEnumValues();
  await new Promise((r) => setTimeout(r, 500));
  await step2CreateTablesAndType();
}

main();
