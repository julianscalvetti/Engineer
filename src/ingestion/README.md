# Ingestion Pipeline

Este modulo contiene el pipeline de ingesta industrial de Engineer.

Su proposito es incorporar datos industriales existentes sin modificar el
origen, perfilarlos tecnicamente, seleccionar el alcance fisico aprobado,
interpretarlos mediante mapping semantico configurable y preparar un dry-run de
persistencia antes de cualquier commit real.

## Estado vigente

La etapa Profiler-Mapping queda cerrada al 2026-07-22 para el contrato actual:

- Technical Profiler de archivos `.xlsx` en modo lectura.
- Source Selection por YAML.
- Contrato `ApprovedSourceSelection` entre seleccion fisica y mapping.
- Semantic Mapping & Diagnosis Engine basado en YAML.
- Mapping Execution Preview con diagnostico trazable.
- Import Dry Run local sin escritura en Supabase.
- Estados `valid`, `warning`, `pending_review` y `rejected`.

No forman parte del cierre actual: ejecucion de macros, OCR, CSV como flujo
central, UI de revision, commit automatico, integracion directa con Supabase,
rollback operativo ni LLM.

## Flujo vigente

```text
XLSX
-> Technical Profiler
-> Source Profile
-> Source Selection
-> ApprovedSourceSelection
-> Semantic Mapping
-> Mapping Preview
-> Import Dry Run
-> Commit opcional
```

Responsabilidades:

- Profiler observa.
- Source Selection autoriza el alcance fisico.
- Semantic Mapping interpreta.
- Executor procesa.
- Preview diagnostica.
- Dry Run prepara persistencia.

## Contrato tipado

`ApprovedSourceSelection` es el contrato ejecutable construido a partir de:

- `SourceSelectionConfig`;
- `SemanticMappingConfig`.

`Source Selection` es autoridad sobre:

- `sourceId`;
- `sheet`;
- `headerRow`;
- `finalRange`.

`Semantic Mapping` es autoridad sobre:

- `layout`;
- campos;
- transformaciones;
- lookups;
- resolvers;
- measurements;
- `mappingId`;
- `mappingVersion`.

La ubicacion fisica autorizada usada por los executors debe provenir del
contrato aprobado. No debe haber duplicacion de autoridad fisica entre
`source-selection.yaml`, `semantic-mapping.yaml` y los executors.

Las inconsistencias fisicas conocidas se validan antes de ejecutar:

- fuente ausente;
- fuente no aprobada;
- hoja diferente;
- `headerRow` diferente;
- `finalRange` / `dataRange` diferente.

## Politica de estados

Prioridad de estado:

```text
rejected
> pending_review
> warning
> valid
```

Reglas:

- `valid` y `warning` pueden avanzar al Import Dry Run.
- `pending_review` y `rejected` quedan excluidos del dry-run.
- Los errores de validacion bloquean la ejecucion cuando
  `failOnValidationErrors=true`.
- `failOnValidationErrors=false` es solo diagnostico exploratorio.
- El motor no corrige datos fuente ni inventa catalogos.
- Las decisiones industriales aprobadas deben declararse por configuracion o
  por primitivas genericas, no como excepciones hardcodeadas por empresa.

## Implementado

- Lectura `.xlsx` con `exceljs`.
- Calculo de SHA-256.
- Deteccion de hojas, dimensiones, encabezados, celdas combinadas, formulas,
  filas vacias y columnas.
- Inferencia preliminar de tipos tecnicos.
- Generacion local de `source-profile.json` y `source-profile.md`.
- Generacion opcional de `source-selection.generated.yaml`.
- Validacion de mapping semantico.
- Construccion de `ApprovedSourceSelection`.
- Layouts `row_table` y `wide_columns_to_rows`.
- Transformaciones declarativas de tipos y texto.
- Lookups exactos con scope.
- Resolvers declarativos.
- Overrides configurables de lookup para decisiones industriales aprobadas.
- Measurement Model v1.
- Preview local con `mapping-preview.jsonl`,
  `mapping-preview-summary.json` y `mapping-preview-summary.md`.
- Import Dry Run local con plan y resumen de persistencia.
- Selectores genericos de columna por encabezado, ocurrencia, indice o letra.

## Uso del Technical Profiler

```bash
npm.cmd run ingestion:profile -- --input data/raw/example.xlsx --output data/reports/example --samples masked
```

Con salida de seleccion:

```bash
npm.cmd run ingestion:profile -- --input data/raw/example.xlsx --output data/reports/example --samples masked --selection-output config/ingestion/companies/example/source-selection.yaml
```

El profiler recibe:

- ruta del archivo `.xlsx`;
- directorio de salida;
- opciones de profiling;
- politica de muestras: `none`, `masked` o `full`.

El profiler no ejecuta macros, VBA ni codigo incrustado.

## Uso del Semantic Mapping & Diagnosis Engine

Validacion:

```bash
npm.cmd run ingestion:mapping:validate -- --input data/raw/example.xlsx --selection config/ingestion/companies/example/source-selection.yaml --mapping config/ingestion/companies/example/semantic-mapping.yaml --profile data/reports/example/source-profile.json --output data/reports/example/mapping-validation
```

Preview:

```bash
npm.cmd run ingestion:mapping:preview -- --input data/raw/example.xlsx --selection config/ingestion/companies/example/source-selection.yaml --mapping config/ingestion/companies/example/semantic-mapping.yaml --output data/reports/example/mapping-preview --samples masked
```

Opciones frecuentes:

- `--max-records <numero>` limita registros procesados por fuente.
- `--source <source_id>` ejecuta una fuente especifica y sus dependencias.
- `--samples none|masked|full` controla muestras en artefactos.
- `--no-fail-on-validation-errors` permite generar preview aun con errores de
  validacion, solo para diagnostico.

## Uso del Import Dry Run

```bash
npm.cmd exec tsx scripts/import-dry-run.ts -- --preview-jsonl data/reports/example/mapping-preview/mapping-preview.jsonl --preview-summary data/reports/example/mapping-preview/mapping-preview-summary.json --output data/reports/example/import-dry-run
```

El dry-run:

- no escribe en Supabase;
- produce `commit_allowed=false`;
- genera `import-dry-run-plan.json`;
- genera `import-dry-run-summary.json`;
- genera `import-dry-run-summary.md`;
- excluye registros `pending_review` y `rejected`.

El commit real es una etapa posterior y debe ejecutarse explicitamente mediante
`import-commit`, con credenciales y aprobaciones controladas.

## Configuraciones requeridas

Por empresa, el contrato espera:

```text
config/ingestion/companies/<empresa>/
  source-selection.yaml
  semantic-mapping.yaml
```

`source-selection.yaml` define hojas, rangos, filas de encabezado y fuentes
utiles. `semantic-mapping.yaml` define layout, campos, transformaciones,
lookups, resolvers, measurements, politicas de diagnostico y decisiones
industriales configuradas.

La logica central del pipeline no debe asumir nombres reales de hojas, columnas
ni equivalencias de una empresa concreta.

## ROMET vigente

Configuracion vigente:

```text
config/ingestion/companies/romet/source-selection.yaml
config/ingestion/companies/romet/semantic-mapping.yaml
```

Identidad vigente:

```text
mapping_id: romet-semantic-mapping-v2-industrial-decisions
mapping_version: semantic-mapping-v1
```

Resultado final de validacion ROMET:

```text
Preview total: 20.566
valid: 20.037
warning: 320
pending_review: 209
rejected: 0

dry-run incluidos: 20.357
dry-run excluidos: 209

LOOKUP_UNRESOLVED restante: 148
reduccion de pending_review: 558
```

Decisiones industriales aplicadas:

- alias scoped de `OP_100 - CONTROL FINAL` a
  `OP_100 - CONTROL FINAL INSPECTOR` para `_A9076804902`;
- exclusion scoped de `_A9076804902 / OP_50 / CORDON DESPLAZADO`;
- exclusion scoped de `_MB3B_2104545_EG / OP_50 / SOLDADURA NO OK`;
- exclusion scoped de
  `_MB3B_2104545_EG / OP_50 / POSICION SOPORTE STEREO`;
- exclusion scoped de `_MB3B_2104545_EG / OP_50 / SPATTER EN ORIFICIOS`;
- `SIN DEFECTO` y `PUNZONADO OK` se tratan como controles conformes;
- `OTROS *` se mantiene en `pending_review`.

Efectos confirmados:

- los controles se conservan;
- la trazabilidad del valor original se conserva;
- las exclusiones aprobadas no generan `control_failure`;
- los controles conformes no generan `failure_mode` ni `control_failure`;
- no se escribieron datos en Supabase;
- el long tail de 209 registros queda pendiente de futuras decisiones
  industriales.

La arquitectura fue validada end-to-end con:

- `npm.cmd run typecheck`;
- `npm.cmd run lint`;
- `npm.cmd test`;
- `git diff --check`.

## Artefactos generados

Technical Profiler:

- `source-profile.json`
- `source-profile.md`
- `source-selection.generated.yaml` cuando se solicita
  `--selection-output`

Validacion de mapping:

- `mapping-validation.json`
- `mapping-validation.md`

Mapping Preview:

- `mapping-preview.jsonl`
- `mapping-preview-summary.json`
- `mapping-preview-summary.md`

Import Dry Run:

- `import-dry-run-plan.json`
- `import-dry-run-summary.json`
- `import-dry-run-summary.md`

`data/reports/` esta ignorado por Git. Los reportes locales no son fuente de
verdad del repositorio y pueden regenerarse con los comandos anteriores.

## Politica de archivos canonicos

- Una unica version vigente por documento.
- Las actualizaciones reemplazan contenido anterior.
- No mantener copias manuales `v1`, `v2`, `old`, `backup`, `final`,
  `final-new`, `draft` o similares.
- Git es el historial de versiones.
- Conservar migraciones, pruebas vigentes y configuraciones activas.
- No agregar artefactos generados ni datos industriales reales al repositorio.

## Datos industriales reales

No se deben guardar archivos industriales reales en Git.

Los directorios locales para datos RAW, staging, curados, rechazados y reportes
estan ignorados por `.gitignore`.

## Documentacion relacionada

- [Contrato v1 del Motor de Perfilado y Diagnostico](../../docs/current/profiling-diagnosis-engine-v1-contract.md)
- [Evaluacion final del Motor de Perfilado y Diagnostico v1](../../docs/current/profiling-diagnosis-engine-v1-assessment.md)
- [Pipeline de Ingesta Industrial v2.1](../../docs/current/ingestion-pipeline-v2.1.md)
- [Semantic Mapping Engine v1](../../docs/current/semantic-mapping-engine-v1.md)
- [Product Decisions](../../product/decisions.md)
