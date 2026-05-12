# Fixtures del importer

- `juncal-3706-real.xlsx` — XLSX real entregado por Macna 2026-05-12 (anonimizado en cuanto a PII porque no contiene datos personales). Hoja útil: `Copia de JUNCAL 3706` (253 filas × 31 cols). Usado para test end-to-end (`tests/unit/import-fixture-juncal.test.ts`).
- `synthetic-small.xlsx` — Fixture chico generado a mano para tests rápidos del parser (5 items, 1 hoja, cubre forward-fill + regex blocklist + costo material/MO).
