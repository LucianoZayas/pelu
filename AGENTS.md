<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:docs-sync-rules -->
# Documentación de estado del proyecto: mantener sincronizada

Este repo usa tres documentos como fuente de verdad del estado del proyecto. Es **obligatorio** mantenerlos al día — son lo que permite que sesiones futuras (sin memoria de la actual) retomen el trabajo sin reconstruir contexto.

**Documentos a sincronizar:**
1. **`docs/ROADMAP.md`** — backlog completo post-piloto, agrupado por bloques y prioridades (P0–P3). Cada ítem está en uno de estos estados: pendiente / en curso / hecho.
2. **`SETUP_PENDIENTE.md`** — acciones externas (cosas que solo el humano puede hacer: configurar OAuth, crear cuentas, compartir archivos, etc.) y estado de cada bloqueante del piloto.
3. **`docs/superpowers/specs/`** y **`docs/superpowers/plans/`** — specs y planes congelados de las fases ya cerradas. Solo se tocan si se descubre un error histórico, no para reflejar nuevo trabajo.

## Al iniciar una conversación (validación de entrada)

Antes de empezar a trabajar sobre cualquier tarea no trivial del proyecto:

1. Leer `docs/ROADMAP.md` y `SETUP_PENDIENTE.md` para conocer el estado registrado.
2. **Verificar que el estado registrado coincide con la realidad del repo** (git log reciente, archivos nuevos, schema actualizado, etc.). Si encontrás algo que está hecho en el código pero figura como pendiente en los docs — o al revés — la conversación anterior **olvidó actualizar la documentación**. Avisarlo al usuario al principio y ofrecer ponerlo al día antes de continuar con la nueva tarea.
3. Si el desfase es chico (ej. un ítem marcado pendiente que ya está hecho), corregirlo en el mismo turno.
4. Si el desfase es grande (varios ítems o bloques enteros), tratarlo como una sub-tarea explícita antes de la tarea original.

## Al cerrar una conversación (actualización de salida)

Antes de dar una tarea por terminada, verificar:

- ¿Se completó algún ítem del ROADMAP? → marcarlo como hecho o moverlo a una sección "Hecho" en `docs/ROADMAP.md`.
- ¿Se desbloqueó / cambió un pendiente externo? → actualizar `SETUP_PENDIENTE.md`.
- ¿Aparecieron nuevos pendientes durante el trabajo (deuda técnica, gaps descubiertos, decisiones diferidas)? → agregarlos al ROADMAP en el bloque y prioridad que corresponda.
- ¿Se tomaron decisiones de diseño nuevas que afecten conversaciones futuras? → registrarlas (en el ROADMAP si son backlog, en una memoria si son convenciones durables, en un ADR corto si son arquitectónicas).

**El cierre de turno final del asistente debe incluir explícitamente** una línea por cada doc tocado (o "Sin cambios en docs" si efectivamente no hubo nada que actualizar). Esto deja un rastro visible en el historial de chat.

## Por qué este rito existe

Sin esta disciplina, los docs envejecen rápido (memorias auto-generadas con timestamps lo hacen explícito) y la siguiente conversación arranca con información falsa. El costo de actualizar 2 archivos al cerrar es mucho menor que el costo de reconstruir contexto cada vez.

**No** mover esto a un hook ni a un workflow automático: la actualización requiere juicio (qué entra al ROADMAP, qué se descarta, qué prioridad). Hacerlo a mano al cierre es parte del trabajo.
<!-- END:docs-sync-rules -->
