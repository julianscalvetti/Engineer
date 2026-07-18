# DA-01 - Esquema minimo trazable para importar ROMET

## Objetivo

DA-01 prepara la persistencia minima para una importacion real de ROMET sin ejecutar todavia la importacion completa y sin modificar el Motor de Perfilado y Diagnostico v1.

La autorizacion sigue resolviendose por:

```text
auth.users
-> profiles
-> company_members
-> companies
```

Los datos importados no son propiedad directa de `user_id`.

## Tablas reutilizadas

| Tabla | Uso en DA-01 |
| --- | --- |
| `companies` | Scope principal de empresa. |
| `plants` | Scope de planta para ROMET. |
| `customers` | Maestro reutilizado para cliente. |
| `products` | Maestro reutilizado para producto/pieza. |
| `operations` | Maestro reutilizado para operacion. |
| `failure_modes` | Maestro reutilizado para modo de falla. |
| `controls` | Registro operativo reutilizado. |
| `control_failures` | Detalle de fallas reutilizado. |

No se crean tablas paralelas para productos, operaciones, modos de falla, controles ni fallas.

## Tablas agregadas

| Tabla | Proposito |
| --- | --- |
| `import_batches` | Lote de importacion por empresa, mapping y estado. |
| `import_files` | Metadatos trazables del archivo fuente. |
| `import_issues` | Issues trazables por lote, archivo, hoja, fila y celda cuando aplica. |

## Tablas modificadas

DA-01 agrega `company_id` y `plant_id` directo donde corresponde:

| Tabla | `company_id` | `plant_id` |
| --- | --- | --- |
| `plants` | Existente | No aplica |
| `customers` | Agregado | Existente |
| `products` | Agregado | Agregado |
| `operations` | Agregado | Agregado |
| `failure_modes` | Agregado | Agregado |
| `controls` | Agregado | Agregado |
| `control_failures` | Agregado | Agregado |

DA-01 agrega columnas de trazabilidad a registros industriales importables:

- `import_batch_id`
- `import_file_id`
- `source_record_id`
- `source_id`
- `source_sheet_name`
- `source_row_number`
- `source_column_name`
- `source_cell_address`
- `mapping_id`
- `mapping_version`
- `source_record_status`

## Estados

`import_batches.status`:

- `draft`
- `ready`
- `approved`
- `committing`
- `committed`
- `failed`
- `rollback_pending`
- `rolled_back`

`import_files.status`:

- `received`
- `profiled`
- `mapped`
- `staged`
- `rejected`

`source_record_status`:

- `valid`
- `warning`
- `pending_review`
- `rejected`
- `imported`
- `skipped`
- `failed`

## RLS

DA-01 mantiene el aislamiento por `company_members`.

Las nuevas tablas tienen politicas `select` para usuarios autenticados con membership activo en `company_id`:

- `import_batches`
- `import_files`
- `import_issues`

Las tablas industriales siguen protegidas por las politicas DA-00. DA-01 reemplaza las funciones auxiliares para resolver acceso usando `company_id` directo donde ya existe.

## Unicidad y claves

DA-01 acota claves industriales por `company_id` y, cuando corresponde, `plant_id`:

- `customers(company_id, plant_id, name)`
- `products(company_id, plant_id, customer_id, code)`
- `operations(company_id, plant_id, product_id, code)`
- `failure_modes(company_id, plant_id, operation_id, name)`
- `control_failures(company_id, plant_id, control_id, failure_mode_id)`

Tambien agrega claves compuestas de consistencia para evitar que una fila relacione entidades de distinta empresa o planta.

## Contrato TypeScript

El contrato minimo vive en:

```text
src/ingestion/persistence/types.ts
```

Define que un `MappedSourceRecord` mas un `ImportPersistenceContext` se transforme en un `PersistenceDraft` con:

- `product`
- `operation`
- `failureMode`
- `control`
- `controlFailures`
- `importIssues`

El contrato no ejecuta inserts ni modifica el motor actual.

## Pruebas

El SQL de prueba posterior queda en:

```text
supabase/tests/da_01_import_traceability.sql
```

Valida:

- existencia de columnas `company_id` y `plant_id`;
- creacion de lote, archivo, issue y registros industriales trazables;
- acceso del owner a datos ROMET;
- bloqueo de otro usuario autenticado sin membership;
- bloqueo de usuario anonimo.

## Documentacion relacionada

- `docs/current/da-00-user-company-plant-model.md`
- `docs/current/ingestion-pipeline-v2.1.md`
- `docs/current/semantic-mapping-engine-v1.md`
- `src/ingestion/persistence/README.md`
- `supabase/migrations/003_da_01_romet_import_traceability.sql`
- `supabase/tests/da_01_import_traceability.sql`
