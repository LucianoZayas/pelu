# Macna — Sistema de Gestión de Obras

## Setup

1. Crear proyectos Supabase (`prod`, `dev`).
2. `cp .env.example .env.local` y completar.
3. `pnpm install`
4. `pnpm db:migrate` (aplica schema)
5. `pnpm db:seed` (rubros + primer admin)
6. `pnpm dev`

## Importador de Sheets

Convertir la planilla actual a CSV con columnas: `rubro,descripcion,unidad,cantidad,costo_unitario,moneda_costo,markup,notas`.

Ejemplo:

```bash
# Validar sin escribir
pnpm import-sheets ./mi-obra.csv --codigo-obra M-2026-005 --cotizacion 1200 --dry-run

# Importar
pnpm import-sheets ./mi-obra.csv --codigo-obra M-2026-005 --cotizacion 1200 --markup 30 \
  --nombre-obra "Casa Pérez" --cliente-nombre "Juan Pérez"
```

Notas:
- `unidad` ∈ {m2, m3, hs, gl, u, ml, kg}
- `moneda_costo` ∈ {USD, ARS}
- `markup` opcional (vacío = usa default del presupuesto)
- Idempotente: aborta si `codigo-obra` ya existe.
- Rubros nuevos se crean con flag `creado_por_importador=true` para revisión posterior.

## Tests

- `pnpm test:unit` — services, parsers, validators
- `pnpm test:integration` — DB + Server Actions (requiere Supabase test)
- `pnpm test:e2e` — Playwright (requiere app levantada + seed)
