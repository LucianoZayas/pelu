# Plan de cutover — Obra piloto

## Objetivo
Validar que el sistema reemplaza la planilla de Sheets sin pérdida de datos ni errores de cálculo, antes de migrar el resto de obras.

## Pasos
1. Elegir 1 obra activa cuyos datos ya estén estabilizados en Sheets.
2. Exportar la planilla a CSV con el formato del importador (ver README).
3. Importar al sistema:
   ```
   pnpm import-sheets obra-piloto.csv --codigo-obra M-2026-XXX --cotizacion <TC> --markup <X>
   ```
4. Verificar manual: el total cliente del sistema coincide con el de Sheets en la fecha del corte. Diferencias > $0.01 deben investigarse.
5. **Operar en paralelo** durante 3 cierres semanales:
   - Cargar movimientos en Sheets como hasta ahora.
   - **Adicionalmente**, cargar los mismos datos en el sistema.
6. **Criterio de promoción**: 3 cierres consecutivos donde:
   - Total cliente del presupuesto coincida.
   - Total costo coincida.
   - Si hay adicionales firmados, también coinciden.
7. Una vez promovido: la planilla queda como histórico de solo lectura. La siguiente obra se carga directo en el sistema, sin paralelo.

## Rollback
- App: rollback con un click desde Vercel.
- DB: PITR en Supabase Pro (7 días).
- Si la obra en el sistema queda inservible: `eliminar` la obra (soft delete) y reimportar.
