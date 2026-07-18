# Contrato v1 del Motor de Perfilado y Diagnostico

Fecha: 2026-07-17

Estado: Frozen

## Proposito

El Motor de Perfilado y Diagnostico v1 permite evaluar archivos Excel
industriales antes de staging, normalizacion, Import Plan o carga a Supabase.

El contrato v1 no corrige datos, no inventa catalogos y no ejecuta macros. Su
responsabilidad es perfilar, mapear por configuracion y producir diagnostico
trazable para revision humana.

## Herramientas

### Technical Profiler

Analiza archivos `.xlsx` en modo lectura y genera una radiografia tecnica del
archivo.

Entradas:

- archivo `.xlsx`;
- directorio de salida;
- configuracion opcional de profiling/source selection;
- politica de muestras: `none`, `masked` o `full`.

Salidas:

- `source-profile.json`;
- `source-profile.md`;
- `source-selection.yaml` cuando se solicita `--selection-output`.

El profiler detecta archivo, hojas, dimensiones, encabezados, columnas, tipos
tecnicos inferidos, muestras, formulas, celdas combinadas, filas vacias,
duplicados, posibles catalogos e issues tecnicos.

### Semantic Mapping & Diagnosis Engine

Valida y ejecuta previews de mapping semantico a partir de configuracion YAML.

Entradas:

- archivo `.xlsx`;
- `source-selection.yaml`;
- `semantic-mapping.yaml`;
- `source-profile.json` opcional para validacion contextual;
- directorio de salida;
- filtros opcionales de fuente, limite de registros y politica de muestras.

Salidas de validacion:

- `mapping-validation.json`;
- `mapping-validation.md`.

Salidas de preview:

- `mapping-preview.jsonl`;
- `mapping-preview-summary.json`;
- `mapping-preview-summary.md`.

## Layouts y primitivas soportadas

Layouts soportados:

- `row_table`: una fila fuente representa un registro tabular.
- `wide_columns_to_rows`: columnas dinamicas simples se transforman en filas
  cuando el encabezado de columna representa una categoria o entidad.

Primitivas soportadas:

- `source_column` por nombre de encabezado.
- `source_column_selector` por `header + occurrence`, `column_index` o
  `column_letter`.
- transformaciones declarativas de tipos.
- lookups contra catalogos configurados.
- resolucion encadenada mediante fuentes/catalogos declarados.
- politicas para unresolved y ambiguous.
- `measurements` para generar multiples `control_measurement` desde una fila
  fuente.
- `control.conformity_status` para estados generales de conformidad.
- `derived_ignore` para preservar o declarar campos fuera del modelo v1 sin
  convertirlos en entidades normalizadas.

## Trazabilidad

Todo registro diagnosticado debe conservar trazabilidad suficiente para volver
al origen:

- archivo fuente;
- hoja;
- fila;
- columna o celda cuando aplique;
- source id;
- mapping id y version;
- valores originales y transformados cuando el campo lo declare;
- resoluciones de lookup;
- issues y estado de diagnostico.

Las mediciones deben conservar trazabilidad a la columna/celda fuente que
produjo cada `typed_value`.

## Estados de diagnostico

Estados v1:

- `valid`: registro utilizable sin issues bloqueantes.
- `warning`: registro utilizable con advertencias no bloqueantes.
- `pending_review`: registro que requiere decision humana antes de usarse.
- `rejected`: registro no utilizable en el preview por errores bloqueantes.

El motor diagnostica; no corrige automaticamente datos fuente ni completa
catalogos faltantes.

## Estructuras fuera de alcance

Quedan fuera de v1:

- CSV y formatos distintos de `.xlsx`.
- Ejecucion de macros, VBA o codigo incrustado.
- Formularios Excel clave-valor.
- Dashboards, reportes agregados y pivots como eventos operativos.
- Hojas multi-bloque complejas.
- Matrices con contexto por fila o multi-encabezados no expresables con
  `wide_columns_to_rows` simple.
- Formulas como logica de negocio ejecutable.
- Texto libre, historiales y observaciones como entidades normalizadas.
- Staging, normalizacion definitiva, Import Plan, carga a Supabase, UI y
  aprobacion humana persistida.

## Criterios para incorporar una nueva empresa

Una empresa puede incorporarse en v1 si:

- entrega archivos `.xlsx` procesables en modo lectura;
- sus fuentes utiles pueden declararse como `row_table` o
  `wide_columns_to_rows` simple;
- las hojas, rangos y encabezados pueden definirse en `source-selection.yaml`;
- el mapping puede declararse en `semantic-mapping.yaml` sin cambiar codigo;
- los catalogos necesarios pueden proveerse como fuentes configuradas o aceptar
  diagnostico `pending_review`;
- las mediciones pueden expresarse con `measurements`;
- las estructuras fuera de alcance se excluyen o se preservan como derivadas.

No se debe incorporar una empresa mediante excepciones en el motor. Si una
brecha impide incorporar mas de un caso y no puede resolverse por configuracion,
debe tratarse como candidata a ampliacion generica posterior a v1.

## Contrato para una futura app

Una futura app debe consumir el motor como servicio de diagnostico, no como
carga directa a datos operativos.

Contrato minimo que debe consumir:

- perfiles tecnicos (`source-profile.json`) para mostrar estructura, riesgos y
  candidatos de fuente;
- validaciones de mapping (`mapping-validation.json`) para bloquear
  configuraciones invalidas;
- previews (`mapping-preview-summary.json` y `mapping-preview.jsonl`) para
  revisar registros, mediciones, resoluciones e issues;
- estados `valid`, `warning`, `pending_review`, `rejected`;
- trazabilidad a archivo, hoja, fila, columna/celda y mapping aplicado;
- artefactos Markdown como salida legible para auditoria humana.

La app no debe asumir que un preview inserta datos, corrige catalogos o aprueba
registros. La aprobacion, staging, Import Plan y commit son etapas posteriores.

## Documentacion relacionada

- [Evaluacion final del Motor de Perfilado y Diagnostico v1](./profiling-diagnosis-engine-v1-assessment.md)
- [Pipeline de Ingesta Industrial v2.1](./ingestion-pipeline-v2.1.md)
- [Semantic Mapping Engine v1](./semantic-mapping-engine-v1.md)
- [Evaluacion multiarchivo de arquitectura de ingesta](./multi-file-architecture-assessment.md)
- [Ingestion README](../../src/ingestion/README.md)
- [Product Decisions](../../product/decisions.md)
