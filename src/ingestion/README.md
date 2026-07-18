# Ingestion Pipeline

Este modulo contiene el pipeline de ingesta industrial de Engineer.

Su proposito es incorporar datos industriales existentes sin modificar el
origen, perfilarlos tecnicamente y diagnosticarlos mediante mapping semantico
configurable antes de cualquier staging, normalizacion, Import Plan o carga al
Industrial Context Layer.

## Estado v1 congelado

El Motor de Perfilado y Diagnostico v1 esta congelado para:

- Technical Profiler de archivos `.xlsx` en modo lectura;
- Semantic Mapping & Diagnosis Engine basado en YAML;
- Mapping Execution Preview con diagnostico trazable;
- estados `valid`, `warning`, `pending_review` y `rejected`.

No forman parte de v1: staging persistente, normalizacion definitiva, Import
Plan, carga a Supabase, UI, soporte CSV ni ejecucion de macros.

## Flujo v1

1. Recibir archivo RAW `.xlsx` sin modificarlo.
2. Ejecutar Technical Profiler.
3. Revisar `source-profile.json` y `source-profile.md`.
4. Definir o ajustar `source-selection.yaml`.
5. Definir o ajustar `semantic-mapping.yaml`.
6. Validar el mapping.
7. Ejecutar Mapping Execution Preview.
8. Revisar conteos, issues, mediciones, lookups y trazabilidad.

El flujo v1 termina en diagnostico. No inserta datos operativos.

## Flujo general futuro

1. RAW inmutable.
2. Technical Profiling.
3. Semantic Mapping.
4. Staging persistente.
5. Normalization.
6. Validation / Curation.
7. Import Plan.
8. Review & Approval.
9. Transactional Revalidation.
10. Atomic Commit.
11. Audit.
12. Controlled Rollback.

## Profiling tecnico vs mapping semantico

El profiling tecnico analiza la estructura fisica del archivo: hojas,
dimensiones, encabezados, tipos inferidos, nulos, formulas, duplicados,
cardinalidad, rangos y errores de formato.

El mapping semantico traduce columnas y valores del lenguaje de la empresa al
modelo Engineer. Debe ser configurable, versionado y revisable por humanos. No
debe quedar hardcodeado por empresa.

## Implementado en v1

- Estructura modular inicial.
- Technical Profiler funcional para archivos `.xlsx`.
- Lectura segura con `exceljs` en modo de perfilado.
- Calculo de SHA-256.
- Deteccion de hojas, dimensiones, encabezados, celdas combinadas, formulas,
  filas vacias y columnas.
- Inferencia preliminar de tipos tecnicos: string, integer, decimal, boolean,
  date, datetime, formula, mixed, empty y unknown.
- Generacion local de `source-profile.json` y `source-profile.md`.
- Configuracion de ejemplo sin datos reales.
- Semantic Mapping Engine v1 para validar configuraciones YAML genericas.
- Generacion local de `mapping-validation.json` y `mapping-validation.md`.
- Measurement Model v1 para que una fila fuente genere mediciones configuradas
  como `control_measurement`.
- Mapping Execution Preview local con `mapping-preview.jsonl`,
  `mapping-preview-summary.json` y `mapping-preview-summary.md`.
- Selectores genericos de columna por encabezado, ocurrencia, indice o letra.

## Uso del Technical Profiler

CLI:

```bash
npm.cmd run ingestion:profile -- --input data/raw/example.xlsx --output data/reports/example --config config/ingestion/examples/romet-source.example.yaml
```

Con salida de seleccion:

```bash
npm.cmd run ingestion:profile -- --input data/raw/example.xlsx --output data/reports/example --config config/ingestion/examples/romet-source.example.yaml --selection-output config/ingestion/companies/example/source-selection.yaml
```

Cuando el YAML declara `source.sheets[].header_row`, esa fila se usa con
prioridad para la hoja indicada. Si no hay configuracion aplicable, el profiler
propone una fila de encabezado por senales tecnicas.

```ts
import { profileXlsxFile } from "@/src/ingestion";

await profileXlsxFile("data/raw/example.xlsx", "data/reports/example", {
  companyId: "company-id",
  relativePathRoot: process.cwd(),
  sampleValuesLimit: 10,
  inspectFormulas: true,
  sheets: {
    Sheet1: {
      headerRow: 1,
    },
  },
});
```

El profiler recibe:

- ruta del archivo `.xlsx`;
- directorio de salida;
- opciones de profiling.

## Uso del Semantic Mapping & Diagnosis Engine

Validacion de mapping:

```bash
npm.cmd run ingestion:mapping:validate -- --input data/raw/example.xlsx --selection config/ingestion/companies/example/source-selection.yaml --mapping config/ingestion/companies/example/semantic-mapping.yaml --profile data/reports/example/source-profile.json --output data/reports/example/mapping-validation
```

Mapping Execution Preview:

```bash
npm.cmd run ingestion:mapping:preview -- --input data/raw/example.xlsx --selection config/ingestion/companies/example/source-selection.yaml --mapping config/ingestion/companies/example/semantic-mapping.yaml --output data/reports/example/mapping-preview --samples masked
```

Opciones frecuentes:

- `--max-records <numero>` limita registros procesados por fuente.
- `--source <source_id>` ejecuta una fuente especifica y sus dependencias.
- `--samples none|masked|full` controla muestras en artefactos.
- `--no-fail-on-validation-errors` permite generar preview aun con errores de
  validacion, solo cuando se necesita diagnostico exploratorio.

## Configuraciones requeridas

Por empresa, el contrato v1 espera:

```text
config/ingestion/companies/<empresa>/
  source-selection.yaml
  semantic-mapping.yaml
```

`source-selection.yaml` define hojas, rangos, filas de encabezado y fuentes
utiles. `semantic-mapping.yaml` define layout, entidad semantica, campos,
transformaciones, lookups, mediciones, politicas de diagnostico y exclusiones.

La logica central del pipeline no debe asumir nombres reales de hojas, columnas
ni equivalencias de una empresa concreta.

## Artefactos generados

Technical Profiler:

- `source-profile.json`
- `source-profile.md`
- `source-selection.yaml` cuando se solicita `--selection-output`

Validacion de mapping:

- `mapping-validation.json`
- `mapping-validation.md`

Mapping Execution Preview:

- `mapping-preview.jsonl`
- `mapping-preview-summary.json`
- `mapping-preview-summary.md`

## Seguridad de lectura Excel

La dependencia usada para leer `.xlsx` es `exceljs`.

El profiler:

- procesa archivos en modo lectura;
- no ejecuta macros, VBA ni codigo incrustado;
- rechaza formatos distintos de `.xlsx` en esta etapa;
- puede registrar metadatos o warnings relacionados con macros si el formato lo
  expone, pero nunca ejecutarlas.

## Pendiente fuera de v1

- Soporte CSV.
- Staging en Supabase.
- Normalizacion operativa.
- Validacion y curado persistidos.
- Import Plan persistido.
- Aprobacion humana.
- RPC de commit.
- Rollback.
- Interfaz web.

## Configuracion por empresa

Cada caso debe incorporarse mediante archivos de configuracion, catalogos o
reglas versionadas fuera del codigo central.

Las configuraciones por empresa viven en:

```text
config/ingestion/companies/<empresa>/
```

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
