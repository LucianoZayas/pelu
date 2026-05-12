ALTER TABLE "item_presupuesto" ADD COLUMN "ubicacion" text;--> statement-breakpoint
ALTER TABLE "presupuesto" ADD COLUMN "import_pendiente" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "presupuesto" ADD COLUMN "import_metadata" jsonb;--> statement-breakpoint
ALTER TABLE "presupuesto" ADD COLUMN "reemplazado_por_import_id" uuid;--> statement-breakpoint
CREATE INDEX "presupuesto_import_pendiente_idx" ON "presupuesto" USING btree ("import_pendiente") WHERE import_pendiente = true;