# Modelo de datos MVP

Este documento describe el primer modelo relacional del MVP.

## Jerarquia industrial

```text
Empresa
-> Planta
-> Cliente
-> Pieza
-> Operacion
-> Modo de falla
```

## Registro operativo

```text
Operacion
-> Control
-> Fallas detectadas
```

## Usuarios

```text
Supabase Auth
-> profiles
-> company_members
-> companies
-> plants
```

# Entidades

## companies

- id UUID
- name
- active
- created_at
- updated_at

## plants

- id UUID
- company_id
- name
- active
- created_at
- updated_at

## customers

- id UUID
- company_id
- plant_id
- name
- active
- import_batch_id
- import_file_id
- source_sheet_name
- source_row_number
- mapping_id
- mapping_version
- source_record_status
- created_at
- updated_at

## products

- id UUID
- company_id
- plant_id
- customer_id
- code
- name
- active
- import_batch_id
- import_file_id
- source_sheet_name
- source_row_number
- source_cell_address
- mapping_id
- mapping_version
- source_record_status
- created_at
- updated_at

## operations

- id UUID
- company_id
- plant_id
- product_id
- code
- name
- import_batch_id
- import_file_id
- source_sheet_name
- source_row_number
- mapping_id
- mapping_version
- source_record_status
- created_at
- updated_at

## failure_modes

- id UUID
- company_id
- plant_id
- operation_id
- name
- active
- import_batch_id
- import_file_id
- source_sheet_name
- source_row_number
- source_cell_address
- mapping_id
- mapping_version
- source_record_status
- created_at
- updated_at

## controls

- id UUID
- company_id
- plant_id
- operation_id
- date
- shift
- operator
- inspected_quantity
- observations
- import_batch_id
- import_file_id
- source_sheet_name
- source_row_number
- mapping_id
- mapping_version
- source_record_status
- created_at
- updated_at

## control_failures

- id UUID
- control_id
- failure_mode_id
- company_id
- plant_id
- quantity
- import_batch_id
- import_file_id
- source_sheet_name
- source_row_number
- source_cell_address
- mapping_id
- mapping_version
- source_record_status
- created_at
- updated_at

## import_batches

- id UUID
- company_id
- plant_id opcional
- mapping_id
- mapping_version
- status
- source_record_status
- import_plan
- import_plan_hash
- created_at
- updated_at

## import_files

- id UUID
- import_batch_id
- company_id
- plant_id opcional
- file_name
- file_sha256
- storage_path
- mime_type
- file_size_bytes
- mapping_id
- mapping_version
- status
- received_at

## import_issues

- id UUID
- import_batch_id
- import_file_id opcional
- company_id
- plant_id opcional
- mapping_id
- mapping_version
- source_record_id
- source_id
- source_sheet_name
- source_row_number
- source_cell_address
- target_table
- target_record_id
- issue_code
- severity
- status
- message
- details
- created_at
- updated_at

## profiles

- id UUID relacionado con auth.users
- name
- role
- created_at
- updated_at

## company_members

- id UUID
- company_id UUID relacionado con companies
- user_id UUID relacionado con auth.users
- role: owner, engineer, operator
- active
- created_at
- updated_at

# Reglas

- No existe catalogo global de operaciones.
- Una operacion pertenece a una unica pieza.
- Los modos de falla pertenecen a una operacion.
- Cliente y pieza no se guardan en controles porque se derivan desde operacion.
- Un control puede existir sin fallas.
- Una falla no puede repetirse dentro del mismo control.
- Las entidades configurables utilizan active boolean.
- Los controles no utilizan active.
- La autorizacion por empresa usa company_members, no user_metadata.
- Las futuras tablas industriales deben pertenecer a company_id y, cuando corresponda, plant_id.
- Los registros importados conservan import_batch_id, import_file_id, origen de archivo/hoja/fila/celda, mapping_id y mapping_version.
- La propiedad del dato no se vincula directamente a user_id; el acceso se resuelve por company_members.

## Documentacion relacionada

- `docs/current/da-00-user-company-plant-model.md`
- `docs/current/da-01-import-persistence-contract.md`
- `docs/current/auth-setup.md`
- `supabase/migrations/002_da_00_user_company_plant_rls.sql`
- `supabase/migrations/003_da_01_romet_import_traceability.sql`
