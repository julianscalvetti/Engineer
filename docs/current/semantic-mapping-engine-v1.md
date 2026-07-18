# Semantic Mapping Engine v1

## Propósito

El Semantic Mapping Engine v1 valida que una configuración semántica pueda interpretar fuentes industriales seleccionadas sin convertir todavía los datos al modelo operativo.

Este componente queda ubicado entre:

```text
Technical Profiling -> Semantic Mapping -> Staging
```

En esta versión hace validación estructural, lectura del archivo fuente y preview de ejecución local. No ejecuta normalización definitiva, staging, Import Plan, inserts, commit, rollback, diagnóstico de granularidad, UI ni LLM.

## Separación motor/configuración

El motor es genérico. Recibe por argumentos:

- ruta del archivo fuente `.xlsx`;
- ruta de `source-selection.yaml`;
- ruta de `semantic-mapping.yaml`;
- opciones de ejecución.

No recibe nombres de empresa como parámetros funcionales y no contiene nombres reales de hojas, columnas, piezas, operaciones o valores especiales.

Las particularidades de cada empresa viven en:

```text
config/ingestion/companies/<empresa>/
├── source-selection.yaml
└── semantic-mapping.yaml
```

Una nueva empresa debe poder incorporarse creando una nueva carpeta de configuración, sin agregar condicionales por cliente al motor.

## Contrato del YAML

Campos principales:

- `mapping_version`: versión soportada del contrato. Valor actual: `semantic-mapping-v1`.
- `mapping_id`: identificador versionado del mapping.
- `source_file_name`: nombre esperado del archivo fuente.
- `source_file_sha256`: hash esperado del archivo fuente.
- `source_selection_path`: ruta al manifiesto de selección aprobado.
- `status`: `draft`, `approved` o `deprecated`.
- `company_context`: contexto descriptivo de la configuración.
- `assumptions`: supuestos declarados.
- `unresolved_decisions`: decisiones semánticas pendientes.
- `sources`: fuentes configuradas.

Cada fuente declara:

- `id`;
- `layout`;
- `sheet`;
- `header_row`;
- `data_range`;
- `depends_on`;
- `fields`;
- `column_header` y `cell_value` cuando aplica;
- `measurements` cuando una fila genera mediciones asociadas al control;
- `resolver` cuando aplica;
- `semantic_review_values` cuando aplica.

Cada campo puede declarar:

- `source_column`;
- `source_column_selector` para columnas duplicadas o no estables;
- `semantic_field`;
- `data_type`;
- `required`;
- `treatment`;
- `transformations`;
- `preserve_raw_value`;
- `regex` para transformaciones declarativas de extracción.

## Layouts soportados

### row_table

Una fila de origen representa un registro fuente.

Configuración típica:

```yaml
layout: row_table
sheet: "<nombre configurable>"
header_row: 1
data_range: "<rango configurable>"
```

### wide_columns_to_rows

Cada columna representa una entidad o relación y las celdas verticales se interpretan como filas.

Configuración típica:

```yaml
layout: wide_columns_to_rows
sheet: "<nombre configurable>"
header_row: 1
column_header:
  semantic_field: "<campo>"
cell_value:
  semantic_field: "<campo>"
```

Para layouts no soportados, el validator devuelve `UNSUPPORTED_SOURCE_LAYOUT`.

## Seleccion generica de columnas

El selector historico por encabezado sigue siendo:

```yaml
source_column: "<encabezado>"
```

Cuando una hoja tiene encabezados duplicados o se requiere una referencia estructural, el campo puede declarar:

```yaml
source_column_selector:
  header: "<encabezado>"
  occurrence: 2
```

o:

```yaml
source_column_selector:
  column_index: 7
```

o:

```yaml
source_column_selector:
  column_letter: G
```

La misma forma se puede usar dentro de `measurements.value` y `measurements.conformity_status`.

No debe usarse para codificar logica de una empresa; solo identifica columnas de forma generica dentro del rango seleccionado.

## Tratamientos soportados

- `direct`;
- `lookup`;
- `derived_ignore`;
- `pending`.

## Transformaciones soportadas

- `trim`;
- `normalize_whitespace`;
- `uppercase`;
- `lowercase`;
- `parse_integer`;
- `parse_decimal`;
- `parse_date`;
- `extract_regex`;
- `preserve_string`.

El YAML no puede ejecutar código arbitrario.

## Resolver soportado

### longest_catalog_prefix

Resuelve valores compuestos buscando el prefijo más largo dentro de un catálogo configurado.

Configuración:

```yaml
resolver:
  type: longest_catalog_prefix
  catalog_source: products
  catalog_field: product.external_code
  remainder_field: operation.external_code
```

El resultado posible es:

- `resolved`;
- `ambiguous`;
- `unresolved`.

El resolver conserva el valor original y no asume separadores específicos.

### pipeline

Permite encadenar pasos declarativos de resolución. Los pasos se ejecutan en orden y cada salida queda disponible para los pasos posteriores.

Pasos soportados:

- `longest_catalog_prefix`;
- `transform_value`;
- `scoped_catalog_lookup`.

El validator verifica que los inputs existan antes de usarse, que los outputs no se dupliquen de forma conflictiva y que los catálogos referenciados estén disponibles por dependencia.

### transform_value

Aplica transformaciones seguras sobre un valor ya disponible.

Transformación soportada:

- `regex_replace`, con `pattern`, `replacement` y `flags` opcionales validados.

No ejecuta código arbitrario desde YAML.

### scoped_catalog_lookup

Busca una coincidencia exacta en un catálogo, opcionalmente restringida por scope.

Resultado posible:

- `resolved`;
- `ambiguous`;
- `unresolved`;
- `skipped`.

El motor no elige una coincidencia si existen múltiples candidatos.

## Lookups declarativos

Un campo con `treatment: lookup` puede declarar:

```yaml
lookup:
  catalog_source: "<source id>"
  catalog_match_field: "<semantic field>"
  input_field: "<semantic field actual>"
  scope:
    - catalog_field: "<campo del catálogo>"
      value_field: "<campo disponible>"
  required: true
  on_unresolved: pending_review
  on_ambiguous: rejected
  preserve_input_value: true
```

Las políticas permitidas son:

- `on_unresolved`: `warning`, `pending_review`, `rejected`;
- `on_ambiguous`: `pending_review`, `rejected`.

## Measurement Model v1

Una fuente `row_table` puede declarar mediciones tecnicas generadas desde columnas de la misma fila.

La fila sigue representando el control fuente. Cada medicion se emite como entidad separada `control_measurement` dentro del preview del registro padre.

Contrato:

```yaml
measurements:
  - id: "<identificador local>"
    characteristic:
      external_code: "<codigo configurable>"
      name: "<nombre configurable>"
    value:
      source_column: "<columna fuente>"
      data_type: decimal
      required: false
      transformations:
        - parse_decimal
      preserve_raw_value: true
    unit: "<unidad opcional>"
    acceptance_criterion:
      external_code: "<criterio opcional>"
      min_value: 0
      max_value: 10
      unit: "<unidad opcional>"
    conformity_status:
      source_column: "<columna opcional>"
      transformations:
        - trim
        - preserve_string
```

Reglas:

- cada medicion debe declarar `characteristic.external_code` o `characteristic.name`;
- `typed_value` se obtiene desde `value.source_column`;
- `unit`, `acceptance_criterion` y `conformity_status` son opcionales;
- cada medicion conserva trazabilidad a columna, fila y celda fuente;
- el motor no contiene nombres de caracteristicas industriales concretas;
- `control`, `control_measurement` y `acceptance_criterion` permanecen separados en el preview.

`control.conformity_status` puede declararse como campo normal cuando la fila trae un estado general del control. No implica normalizacion definitiva de enums.

## Flujo de validación

La CLI genérica es:

```powershell
npm.cmd run ingestion:mapping:validate -- `
  --input "<archivo.xlsx>" `
  --selection "<source-selection.yaml>" `
  --mapping "<semantic-mapping.yaml>" `
  --output "<directorio>"
```

Genera:

- `mapping-validation.json`;
- `mapping-validation.md`.

El reporte incluye:

- archivo fuente y hash;
- `mapping_id` y versión;
- fuentes configuradas;
- layouts utilizados;
- campos semánticos;
- transformaciones;
- dependencias entre fuentes;
- columnas encontradas;
- columnas faltantes;
- resolvers configurados;
- errores;
- warnings;
- decisiones semánticas pendientes.

## Execution Preview

La CLI genérica de preview es:

```powershell
npm.cmd run ingestion:mapping:preview -- `
  --input "<archivo.xlsx>" `
  --selection "<source-selection.yaml>" `
  --mapping "<semantic-mapping.yaml>" `
  --output "<directorio>" `
  --samples masked
```

Opciones:

- `--max-records <n>`;
- `--source <source_id>`, repetible;
- `--samples none|masked|full`.

Genera:

- `mapping-preview.jsonl`;
- `mapping-preview-summary.json`;
- `mapping-preview-summary.md`.

Cada línea de `mapping-preview.jsonl` contiene un `MappedSourceRecord` con:

- valores semánticos;
- valores crudos;
- valores preservados;
- trazabilidad a hoja, fila y celda;
- transformaciones;
- resoluciones;
- issues;
- estado final.

Estados posibles:

- `valid`;
- `warning`;
- `pending_review`;
- `rejected`.

El preview construye catálogos temporales en memoria siguiendo el orden de dependencias. No persiste catálogos, staging ni datos operativos.

El límite `--max-records` es un límite de preview y queda registrado como truncamiento. No debe interpretarse como ejecución completa.

## Validaciones actuales

El validator verifica:

- existencia de archivos de entrada;
- YAML válido;
- versión soportada;
- fuentes duplicadas;
- campos semánticos duplicados dentro de una fuente;
- layouts soportados;
- transformaciones soportadas;
- existencia de hojas;
- consistencia con `source-selection.yaml`;
- columnas configuradas presentes;
- rangos válidos;
- referencias a catálogos existentes;
- dependencias circulares entre fuentes;
- campos obligatorios sin columna fuente en `row_table`;
- valores de enum inválidos.
- pipelines de resolver válidos;
- scopes con campos disponibles;
- expresiones `regex_replace` válidas;
- dependencias agregadas por lookups declarativos.
- configuración válida de `measurements` para fuentes `row_table`.

## Limitaciones actuales

No valida reglas industriales ni calidad de datos.

No normaliza el dataset.

No escribe staging ni tablas operativas.

No genera Import Plan.

No conecta con Supabase.

No usa LLM ni APIs externas.

## Cómo agregar una nueva empresa

1. Crear una carpeta bajo `config/ingestion/companies/<empresa>/`.
2. Agregar `source-selection.yaml` aprobado.
3. Agregar `semantic-mapping.yaml` con hojas, columnas, layouts, campos semánticos, transformaciones y resolvers.
4. Ejecutar la CLI pasando las rutas explícitas.
5. Revisar `mapping-validation.json` y `mapping-validation.md`.

No se debe modificar `src/ingestion/mapping` ni crear scripts por empresa para incorporar una configuración nueva.

## Documentación relacionada

- [Pipeline de Ingesta Industrial - Especificación Técnica v2.1](./ingestion-pipeline-v2.1.md)
- [Product Decisions](../../product/decisions.md)
- [MVP Scope](../../product/scope.md)
- [Ingestion Pipeline README](../../src/ingestion/README.md)
