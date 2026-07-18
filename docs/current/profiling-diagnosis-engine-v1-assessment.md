# Evaluacion final del Motor de Perfilado y Diagnostico v1

Fecha: 2026-07-17

## Alcance

Este documento consolida la evaluacion MP-07 sobre cinco casos industriales:
ROMET, Alimentos, Forja, Neon y Tambo.

La evaluacion usa artefactos existentes de Technical Profiler, validacion de
mapping y Mapping Execution Preview. No modifica `src/`, `scripts/` ni
configuraciones existentes.

El alcance de v1 evaluado es:

- Technical Profiler para archivos Excel `.xlsx` en modo lectura.
- Semantic Mapping & Diagnosis Engine basado en configuracion YAML.
- Diagnostico previo a staging/importacion mediante estados `valid`, `warning`,
  `pending_review` y `rejected`.

Quedan fuera de esta evaluacion: staging persistente, normalizacion definitiva,
Import Plan, carga a base de datos, interfaz web y ejecucion de macros.

## Matriz comparativa

| Industria / caso | Fuentes procesadas | Layouts utilizados | Catalogos | Controles | Mediciones | Selectors especiales | Ejecucion solo mediante configuracion | Problemas de datos detectados | Limitaciones del motor |
|---|---|---|---:|---:|---:|---|---|---|---|
| ROMET / metalmecanica | `products`, `operations`, `failure_modes`, `controls` | `row_table`, `wide_columns_to_rows` | 18 productos, 37 operaciones, 380 modos de falla | 2.000 controles procesados de 20.131 disponibles | 0 | No requiere `source_column_selector`; usa resolucion de encabezados en `wide_columns_to_rows` | Si, para las fuentes seleccionadas | 1 producto con campo opcional faltante; 61 modos de falla en revision semantica; 99 lookups no resueltos en controles limitados | Formularios, dashboards, pivots, reportes agregados, hojas multi-bloque y matrices con contexto por fila quedan fuera de v1 |
| Alimentos | `products`, `controls` en preview disponible; `deviations` configurado pero no incluido en el preview evaluado | `row_table`, `measurements`, lookups | 2 recetas/productos | 20 controles procesados de 2.000 disponibles en preview limitado | 40 | Ninguno | Si, para el subconjunto ejecutado | 12 lookups de producto no resueltos por catalogo incompleto | Dashboard agregado excluido; litros queda como cantidad de proceso pendiente; costos/formulas se preservan como derivados o excluidos |
| Forja | `products`, `controls` | `row_table`, `measurements`, lookups | 2 piezas | 2.000 controles | 5.987 | Ninguno | Si | 1.533 lookups no resueltos; 13 decimales invalidos; celdas combinadas y tipo mixto detectados por profiler | Fecha/observaciones fuera del bloque tabular seleccionado no entran en el modelo v1; no hay campo canonico para notas libres |
| Neon | `components`, `controls`; reporte mensual excluido | `row_table`, `measurements`, selectors por columna, transformaciones | 4 componentes | 4.000 controles | 7.908 | `header + occurrence` para `DEFECTO_ELECTRONICO` duplicado | Si en MP-06; requirio previamente la capacidad generica de selector de columna de MP-05 | 46 decimales invalidos; 22 fechas invalidas; 31 campos requeridos faltantes | Reporte mensual agregado, formulas de costo y notas libres no son conceptos operativos normalizados en v1 |
| Tambo | `animals`, `controls` | `row_table`, `measurements`, lookups, selectors por columna | 3 animales | 5.000 controles | 28.132 | `column_letter` para `CONDUCTIVIDAD_MS` duplicado | Si en MP-06; requirio previamente la capacidad generica de selector de columna de MP-05 | 4.798 lookups no resueltos; 96 ambiguos; 126 decimales invalidos; 50 fechas invalidas; 91 campos requeridos faltantes | Historico medico, observaciones libres y formulas quedan como derivados/no normalizados; catalogo duplicado o incompleto requiere revision humana |

## Capacidades del Technical Profiler

El Technical Profiler cubre archivos Excel `.xlsx` en modo lectura. La evidencia
de los cinco casos muestra que puede:

- Registrar metadatos de archivo: nombre, extension, tamano, hash y conteo de
  hojas.
- Detectar hojas, dimensiones, fila probable de encabezado, columnas, filas
  vacias/no vacias, celdas combinadas y formulas.
- Inferir tipos tecnicos preliminares por columna.
- Detectar encabezados duplicados, tipos mixtos y estructuras que requieren
  revision.
- Producir `source-profile.json` y `source-profile.md` como radiografia previa
  al mapping.

Evidencia relevante:

- ROMET: 14 hojas, incluyendo formularios, base transaccional, catalogos,
  matrices y reportes con miles de formulas.
- Forja: tabla desplazada con encabezado en fila 2, celdas combinadas y tipo
  mixto.
- Neon: encabezado en fila 6, formulas y duplicado `DEFECTO_ELECTRONICO`.
- Tambo: encabezado en fila 4, formulas, celdas combinadas y duplicado
  `CONDUCTIVIDAD_MS`.
- Alimentos: registro diario, maestro, desvios y dashboard agregado.

El profiler no interpreta significado industrial ni decide que cargar. Su valor
en v1 es separar estructura fisica, riesgos tecnicos y candidatos de fuente
antes del mapping.

## Capacidades del Semantic Mapping & Diagnosis Engine

El motor semantico cubre fuentes tabulares configurables y genera diagnostico
previo a importacion. En los casos evaluados absorbe por YAML:

- Seleccion de hoja, rango, fila de encabezado y layout.
- Mapeo de columnas a entidades y campos semanticos.
- Transformaciones tecnicas como fechas, enteros, decimales y texto.
- Lookups contra catalogos configurados.
- Politicas para valores no resueltos o ambiguos.
- Generacion de multiples `control_measurement` desde una misma fila fuente.
- Trazabilidad de registros y mediciones a la fuente.
- Selectores genericos para columnas duplicadas por `header + occurrence`,
  `column_index` o `column_letter`.
- Estados de diagnostico: `valid`, `warning`, `pending_review`, `rejected`.

Los conteos consolidados de preview son:

| Caso | Valid | Warning | Pending review | Rejected | Issues principales |
|---|---:|---:|---:|---:|---|
| ROMET catalogos | 373 | 1 | 61 | 0 | `OPTIONAL_FIELD_MISSING`, `SEMANTIC_REVIEW_VALUE` |
| ROMET controles limitados | 2.274 | 1 | 160 | 0 | `OPTIONAL_FIELD_MISSING`, `SEMANTIC_REVIEW_VALUE`, `LOOKUP_UNRESOLVED` |
| Alimentos preview limitado | 10 | 0 | 12 | 0 | `LOOKUP_UNRESOLVED` |
| Forja | 465 | 0 | 1.524 | 13 | `LOOKUP_UNRESOLVED`, `INVALID_DECIMAL` |
| Neon | 3.927 | 0 | 0 | 77 | `INVALID_DECIMAL`, `INVALID_DATE`, `REQUIRED_FIELD_MISSING` |
| Tambo | 107 | 0 | 4.640 | 256 | `LOOKUP_UNRESOLVED`, `LOOKUP_AMBIGUOUS`, `INVALID_DECIMAL`, `INVALID_DATE`, `REQUIRED_FIELD_MISSING` |

La evidencia indica que el motor no necesita reglas especificas por industria
para cubrir controles industriales tabulares, catalogos simples, mediciones y
diagnostico de calidad. Las diferencias principales se resolvieron con
configuracion.

## Problemas de calidad de datos

Los problemas observados pertenecen mayoritariamente a calidad de datos, no a
fallas estructurales del motor:

- Catalogos incompletos: productos, piezas o animales inexistentes para algunos
  controles.
- Catalogos ambiguos o duplicados: caso Tambo con referencias que no resuelven
  de forma unica.
- Valores invalidos: decimales y fechas no parseables.
- Campos requeridos faltantes.
- Valores que requieren revision semantica antes de usarse como catalogo
  operativo.
- Encabezados duplicados en hojas de control.
- Formulas, notas libres, observaciones e historicos no normalizados.

Estas situaciones requieren revision humana cuando afectan identidad,
trazabilidad, catalogos, conformidad o valores numericos de medicion. El motor
puede diagnosticarlas y separarlas en `pending_review` o `rejected`, pero no
debe inventar datos ni corregir catalogos automaticamente en v1.

## Estructuras fuera del alcance v1

Las siguientes estructuras fueron detectadas y quedan deliberadamente fuera de
v1:

- Formularios Excel con celdas clave-valor, instrucciones, macros o controles
  visuales.
- Dashboards, reportes agregados y pivots.
- Hojas multi-bloque donde varias tablas distintas conviven en la misma hoja.
- Matrices con contexto por fila y multi-encabezados que no puedan expresarse
  como `wide_columns_to_rows` simple.
- Formulas como logica de negocio ejecutable.
- Texto libre, historiales y observaciones como entidades normalizadas.
- Reportes agregados que no representan eventos fuente.
- CSV y otros formatos no Excel.

Estas estructuras no bloquean v1 porque no forman parte del contrato actual del
pipeline. Deben excluirse, preservarse como derivados o quedar para revision
humana segun configuracion.

## Respuestas MP-07

Tipos de archivos cubiertos:

- Cubierto: Excel `.xlsx` en modo lectura, sin ejecucion de macros.
- No cubierto: CSV, `.xls`, archivos con macros ejecutables, bases de datos,
  PDFs, imagenes, dashboards como fuente semantica y reportes agregados como
  eventos operativos.

Diferencias absorbidas por configuracion:

- Nombres de hojas, rangos y filas de encabezado.
- Bloques tabulares desplazados.
- Nombres y orden de columnas.
- Encabezados duplicados mediante selectores genericos.
- Catalogos, lookups, politicas de unresolved/ambiguous y scopes.
- Transformaciones tecnicas de tipos.
- Mediciones por fila fuente.
- Estados generales de conformidad.
- Exclusion de dashboards, formulas, notas o reportes derivados.

Situaciones que requieren revision humana:

- Lookups no resueltos o ambiguos.
- Catalogos incompletos, duplicados o con valores semanticamente dudosos.
- Fechas, decimales o campos requeridos invalidos.
- Hojas con varios bloques candidatos.
- Seleccion de si una formula/reporte representa dato fuente o salida derivada.
- Campos libres que podrian contener informacion operativa pero no tienen
  contrato semantico v1.

Estructuras no cubiertas por v1:

- Formularios, reportes agregados, dashboards, pivots, multi-bloques complejos,
  matrices con contexto por fila, macros, formulas ejecutables y texto libre
  normalizado.

Evidencia de generalizacion multiindustria:

- Si existe evidencia suficiente para congelar v1 como motor generico para
  perfilado tecnico y diagnostico semantico de controles tabulares industriales.
- La evidencia cubre cinco dominios con diferencias reales de estructura:
  metalmecanica/ROMET, alimentos, forja, neon y tambo.
- La generalizacion aplica al contrato v1: Excel `.xlsx`, fuentes tabulares,
  catalogos simples, lookups configurables, mediciones y diagnostico.
- La evidencia no demuestra cobertura universal de cualquier Excel industrial;
  demuestra cobertura del subconjunto tabular definido por v1.

## Recomendacion

Recomendacion explicita: congelar v1.

No hay una correccion bloqueante pendiente antes de congelar. Las limitaciones
restantes corresponden a estructuras fuera del alcance v1 o a problemas de
calidad de datos que el motor ya diagnostica sin hardcoding por industria.

## Documentacion relacionada

- [Pipeline de Ingesta Industrial v2.1](./ingestion-pipeline-v2.1.md)
- [Semantic Mapping Engine v1](./semantic-mapping-engine-v1.md)
- [Evaluacion multiarchivo de arquitectura de ingesta](./multi-file-architecture-assessment.md)
- [Ingestion README](../../src/ingestion/README.md)
- [Product Decisions](../../product/decisions.md)
