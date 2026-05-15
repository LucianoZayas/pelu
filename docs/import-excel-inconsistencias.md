# Inconsistencias detectadas en el Excel de Macna

> **Propósito**: Anotar acá cada inconsistencia / patrón ambiguo encontrado al parsear el Excel real de Macna (`MACNA ADMINISTRACION - Lucho (1).xlsx`, hoja `Copia de JUNCAL 3706`). Cuando lleguen otros Excel similares (otras obras), revalidar contra esta lista para decidir: **(a)** corregir el formato de entrada en Sheets, **(b)** agregar lógica al parser, o **(c)** introducir UI dinámica (mapeo manual de columnas, buscador, etc.).
>
> **Fecha base**: 2026-05-15. **Archivo de referencia**: el XLSX subido por el usuario el 2026-05-15 a `~/Desktop/Pelu/MACNA ADMINISTRACION - Lucho (1).xlsx`.

---

## 1. Headers de columnas repetidos (col 5 y col 15 ambos = "COSTO PARCIAL")

**Qué**: La fila 6 (header) tiene `COSTO  PARCIAL` (con doble espacio) en col 5 **y** otra `COSTO  PARCIAL` en col 15. Misma label, dos columnas.

**Por qué importa**: el parser actual matchea el primer hit izquierda-a-derecha, así que `COSTO_PARCIAL=5`. La col 15 queda invisible.

**Qué hay en col 15**: para items normales (R107-R114) está vacía. Para items MUEBLES DE OBRA (R124-R126) tiene fórmulas tipo `=O_n * 1.0654` que dan valores **distintos** a col 12 (MO parcial). Ejemplos:
- R124 (Mueble cocina): col 12 = $4.66M, col 15 = $5.59M.
- R125 (Mueble Vanitory): col 12 = $0.31M, col 15 = $0.62M.

**Interpretaciones posibles**:
- Col 12 = costo de fabricación, col 15 = precio cliente con margen → estaríamos perdiendo el precio final.
- Col 15 = USD-equivalente del costo (cotización aplicada) → es informativa, no perdemos data.
- Patrón específico del template MUEBLES que no aplica al resto → ignorar.

**Acción pendiente**: pedirle al usuario que confirme qué representa col 15 en MUEBLES + comparar con otros XLSX cuando lleguen.

---

## 2. Sección MARMOLERIA con dos opciones de costo ("opcion 1" / "opcion 2")

**Qué**: Fila R135 funciona como header secundario con `c5="opcon 1"` y `c6="opcion2"`. Las filas siguientes (R136-R138) tienen:
- col 5 (parcial / opcion 1) = costo de material
- col 6 (total) = vacío (la opción 2 no se eligió)
- col 12 (MO parcial) = costo mano de obra
- col 13 (MO total) = igual al MO parcial

**Por qué importa**: el header genérico dice "COSTO TOTAL" para col 6, pero acá col 6 representa "opcion 2 de costo" — no un total. El parser, gracias al fallback de PARCIAL, recupera el material (col 5), así que en este caso no perdemos data, pero es **un uso semántico distinto del mismo template**.

**Acción pendiente**: confirmar si este patrón "comparar 2 cotizaciones" se repite en otras obras. Si sí, agregar UI para "elegir opción" antes de importar.

---

## 3. Filas "MANO DE OBRA - MATERIALES Y MANO DE OBRA" como sub-headers numerados

**Qué**: R135 (`rub="4"`, `det="MARMOLERIA - MANO DE OBRA Y MATERIALES - OPCIONES"`), R145 (`rub="5"`, `det="ESPEJOS Y MAMPARAS - MANO DE OBRA Y MATERIALES"`), R153 (`rub="6"`), R163 (`rub="7"`), R171 (`rub="8"`), R188 (`rub="9"`), R198 (`rub="10"`), R203 (`rub="11"`).

**Patrón**: el `rub` es un número, el `det` es un título de bloque. No son items de presupuesto, son separadores de sección numerados.

**Acción tomada**: el parser los detecta como `marcador numerado de sección` y los manda a descartes con categoría `estructural` (no se cuentan como warnings).

---

## 4. Filas "ADICIONALES" repetidas bajo cada rubro

**Qué**: 8 filas con `rub="ADICIONALES"`, `det=""`, `c12="ADICIONALES"` aparecen bajo cada gran sección (R117, R141, R149, R159, R167, R184, R194, R209). Son placeholders donde el usuario podría agregar items adicionales pero no agregó nada en esta obra.

**Acción tomada**: descarte categoría `estructural`, razón "Placeholder ADICIONALES".

**Acción pendiente**: si en otra obra el usuario SÍ pone items debajo de "ADICIONALES", esos items se importan normales (el placeholder vacío se descarta, los siguientes con detalle entran). Validar.

---

## 5. Costos "huérfanos" (en col COSTO TOTAL pero sin DETALLE)

**Qué**: 2 filas con cost > 0 pero detalle vacío:
- R140: `c6=2500000` sin descripción.
- R185: `c12=250000` sin descripción.

**Por qué importa**: son potenciales pérdidas de data. El usuario probablemente borró el detalle pero dejó el costo, o lo tipeó en la fila equivocada.

**Acción tomada**: marcar como `warning` con razón "Costo huérfano sin descripción ($X)" — el usuario los ve prominentes al importar.

---

## 6. INSUMOS con #REF! masivo

**Qué**: R238-R245 (8 filas tipo `INS - TERMINACIONES`, `INS - SANITARIOS`, etc.) tienen `#REF!` en col 6 (COSTO TOTAL). Las fórmulas referencian un archivo externo `[1]INSUMOS` que ya no existe.

**Por qué importa**: si los insumos son una sub-tabla relevante, estamos perdiendo data. Pero al ser #REF! la data ya está perdida en el origen — el usuario debe arreglar el Excel antes.

**Acción tomada**: marcar como `warning` con razón "Fórmula rota (#REF!) en el Excel — revisar".

**Acción pendiente**: confirmar con el usuario si los INSUMOS son una sub-tabla que conviene importar como tabla separada (planilla aparte) o si son agregados que ya están reflejados en otra parte.

---

## 7. Sub-tablas al final del documento (PLANILLA DE INSUMOS, PLANILLA DE ELECTRODOMESTICOS)

**Qué**: Después de R214 (fin del presupuesto principal) hay dos sub-tablas con sus propios headers ITEM/UBICACIÓN/DETALLE:
- R230-R246: "PLANILLA DE INSUMOS" (con #REF! en todas las filas — ver punto 6).
- R247-R250: "PLANILLA DE ELECTRODOMESTICOS Y EQUIPAMIENTO".

**Acción tomada**: detectar los headers repetidos (`ITEM | UBICACIÓN | DETALLE`) como sub-table headers y mandarlos a descartes `estructural`.

**Acción pendiente**: si los electrodomésticos / insumos deberían entrar como items del presupuesto, agregar un segundo pass que parsee las sub-tablas. Por ahora se ignoran.

---

## 8. R106 "TOTAL MANO DE OBRA" con valores aparentemente bajos ($12K + $10K)

**Qué**: La fila R106 consolidada para 6 rubros de mano de obra (DEMO + ALB + COLOC + SANIT + ELEC + PINTURA) tiene `c6=12000`, `c13=10000`. Comparado con los $10M de materiales de las filas siguientes, suena muy bajo para una obra Macna real.

**Hipótesis**: el archivo es un template parcialmente lleno (test data del usuario), no la versión final. O las fórmulas no se recalcularon al abrir.

**Acción tomada**: el parser importa el valor que ve. Si está mal en el Excel, está mal en el sistema — el usuario lo corrige en el editor post-import.

**Acción pendiente**: validar con un Excel "completo" de otra obra.

---

## 9. Ubicación con placeholder text "rubro"

**Qué**: Algunas filas tienen `c3="rubro"` literal (R8, R9). Es un placeholder de template que el usuario nunca reemplazó por la ubicación real.

**Acción tomada**: el parser detecta `/^rubro$/i` como placeholder y lo omite del label de la descripción en la consolidación MO.

---

## 10. Casing y espacios inconsistentes en RUBRO

**Qué**: Algunos rubros aparecen como:
- `DEMOLICION` (sin tilde)
- `DEMOLICIÓN Y ALBAÑILERÍA` (con tildes)
- `ALBAÑILERIA` (sin tilde en R25)
- `ALBAÑILERÍA` (con tilde)
- `ESTURCTURA` (typo: ESTRUCTURA)
- `MARMOLERIA` / `MARMOLERÍA` (mismo rubro, dos formas)
- `Pisos de madera` (mixed case)

**Por qué importa**: en el sistema, cada string distinto crea un rubro distinto. Sin normalización, queda fragmentado.

**Acción pendiente**: ver `[[normalizar-rubros]]` — task 5 del plan actual: trim + uppercase + corrección de typos básicos al crear/editar rubro.

---

## Cómo usar este doc

- Cuando llegue un Excel nuevo de Macna (u otra empresa), correr el parser y comparar la salida con los puntos 1-10.
- Si una inconsistencia es **única** del archivo de prueba → ignorar.
- Si una inconsistencia es **recurrente** → decidir: (a) ajustar Sheets de Macna, (b) agregar lógica al parser, (c) UI dinámica (mapeo manual de columnas).
