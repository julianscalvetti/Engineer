-- DA-01 import traceability proof.
-- Run after migrations 001, 002 and 003.
-- This test creates a minimal traceable import shape and rolls it back.

begin;

create temp table da_01_test_context (
  owner_id uuid not null default gen_random_uuid(),
  outsider_id uuid not null default gen_random_uuid(),
  company_id uuid,
  plant_id uuid,
  import_batch_id uuid,
  import_file_id uuid,
  customer_id uuid,
  product_id uuid,
  operation_id uuid,
  failure_mode_id uuid,
  control_id uuid
);

insert into da_01_test_context default values;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  raw_app_meta_data,
  raw_user_meta_data
)
select
  owner_id,
  'authenticated',
  'authenticated',
  'da-01-owner-' || owner_id::text || '@example.test',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
from da_01_test_context
union all
select
  outsider_id,
  'authenticated',
  'authenticated',
  'da-01-outsider-' || outsider_id::text || '@example.test',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
from da_01_test_context;

select public.bootstrap_romet_owner(owner_id, 'DA-01 Owner')
from da_01_test_context;

insert into public.profiles (id, name, role)
select outsider_id, 'DA-01 Outsider', 'ingeniero'
from da_01_test_context;

update da_01_test_context
set company_id = company.id,
    plant_id = plant.id
from public.companies company
join public.plants plant
  on plant.company_id = company.id
where company.name = 'ROMET'
  and plant.name = 'Planta Principal';

do $$
declare
  missing_columns text[];
begin
  select array_agg(required.table_name || '.' || required.column_name order by required.table_name, required.column_name)
  into missing_columns
  from (
    values
      ('customers', 'company_id'),
      ('customers', 'plant_id'),
      ('products', 'company_id'),
      ('products', 'plant_id'),
      ('operations', 'company_id'),
      ('operations', 'plant_id'),
      ('failure_modes', 'company_id'),
      ('failure_modes', 'plant_id'),
      ('controls', 'company_id'),
      ('controls', 'plant_id'),
      ('control_failures', 'company_id'),
      ('control_failures', 'plant_id'),
      ('import_batches', 'company_id'),
      ('import_files', 'company_id'),
      ('import_issues', 'company_id')
  ) as required(table_name, column_name)
  left join information_schema.columns column_info
    on column_info.table_schema = 'public'
    and column_info.table_name = required.table_name
    and column_info.column_name = required.column_name
  where column_info.column_name is null;

  if missing_columns is not null then
    raise exception 'DA-01 failed: missing required columns %', missing_columns;
  end if;
end;
$$;

with inserted_batch as (
  insert into public.import_batches (
    company_id,
    plant_id,
    mapping_id,
    mapping_version,
    status,
    source_record_status,
    source_file_count,
    source_record_count
  )
  select
    company_id,
    plant_id,
    'romet-semantic-mapping-v1-draft',
    'semantic-mapping-v1',
    'committed',
    'imported',
    1,
    1
  from da_01_test_context
  returning id
)
update da_01_test_context
set import_batch_id = inserted_batch.id
from inserted_batch;

with inserted_file as (
  insert into public.import_files (
    import_batch_id,
    company_id,
    plant_id,
    file_name,
    file_sha256,
    mime_type,
    mapping_id,
    mapping_version,
    status
  )
  select
    import_batch_id,
    company_id,
    plant_id,
    'Registro Control Final ROMET - Profiling .xlsx',
    repeat('a', 64),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'romet-semantic-mapping-v1-draft',
    'semantic-mapping-v1',
    'mapped'
  from da_01_test_context
  returning id
)
update da_01_test_context
set import_file_id = inserted_file.id
from inserted_file;

with inserted_customer as (
  insert into public.customers (
    company_id,
    plant_id,
    name,
    import_batch_id,
    import_file_id,
    source_record_id,
    source_id,
    source_sheet_name,
    source_row_number,
    mapping_id,
    mapping_version,
    source_record_status
  )
  select
    company_id,
    plant_id,
    'DA-01 Cliente',
    import_batch_id,
    import_file_id,
    'record-1',
    'romet-customers',
    'PRODUCTOS',
    3,
    'romet-semantic-mapping-v1-draft',
    'semantic-mapping-v1',
    'imported'
  from da_01_test_context
  returning id
)
update da_01_test_context
set customer_id = inserted_customer.id
from inserted_customer;

with inserted_product as (
  insert into public.products (
    company_id,
    plant_id,
    customer_id,
    code,
    name,
    import_batch_id,
    import_file_id,
    source_record_id,
    source_id,
    source_sheet_name,
    source_row_number,
    source_cell_address,
    mapping_id,
    mapping_version,
    source_record_status
  )
  select
    company_id,
    plant_id,
    customer_id,
    'DA01-PIEZA',
    'Pieza DA-01',
    import_batch_id,
    import_file_id,
    'record-1',
    'romet-products',
    'PRODUCTOS',
    3,
    'A3',
    'romet-semantic-mapping-v1-draft',
    'semantic-mapping-v1',
    'imported'
  from da_01_test_context
  returning id
)
update da_01_test_context
set product_id = inserted_product.id
from inserted_product;

with inserted_operation as (
  insert into public.operations (
    company_id,
    plant_id,
    product_id,
    code,
    name,
    import_batch_id,
    import_file_id,
    source_record_id,
    source_id,
    source_sheet_name,
    source_row_number,
    mapping_id,
    mapping_version,
    source_record_status
  )
  select
    company_id,
    plant_id,
    product_id,
    'OP-DA01',
    'Operacion DA-01',
    import_batch_id,
    import_file_id,
    'record-1',
    'romet-operations',
    'OPERACIONES',
    2,
    'romet-semantic-mapping-v1-draft',
    'semantic-mapping-v1',
    'imported'
  from da_01_test_context
  returning id
)
update da_01_test_context
set operation_id = inserted_operation.id
from inserted_operation;

with inserted_failure_mode as (
  insert into public.failure_modes (
    company_id,
    plant_id,
    operation_id,
    name,
    import_batch_id,
    import_file_id,
    source_record_id,
    source_id,
    source_sheet_name,
    source_row_number,
    source_cell_address,
    mapping_id,
    mapping_version,
    source_record_status
  )
  select
    company_id,
    plant_id,
    operation_id,
    'Falla DA-01',
    import_batch_id,
    import_file_id,
    'record-1',
    'romet-failure-modes',
    'MODO DE FALLA',
    15,
    'P15',
    'romet-semantic-mapping-v1-draft',
    'semantic-mapping-v1',
    'imported'
  from da_01_test_context
  returning id
)
update da_01_test_context
set failure_mode_id = inserted_failure_mode.id
from inserted_failure_mode;

with inserted_control as (
  insert into public.controls (
    company_id,
    plant_id,
    operation_id,
    date,
    shift,
    "operator",
    inspected_quantity,
    import_batch_id,
    import_file_id,
    source_record_id,
    source_id,
    source_sheet_name,
    source_row_number,
    mapping_id,
    mapping_version,
    source_record_status
  )
  select
    company_id,
    plant_id,
    operation_id,
    date '2026-07-17',
    'Manana',
    'Operario DA-01',
    10,
    import_batch_id,
    import_file_id,
    'record-1',
    'romet-controls',
    'BASE DE REGISTRO',
    2,
    'romet-semantic-mapping-v1-draft',
    'semantic-mapping-v1',
    'imported'
  from da_01_test_context
  returning id
)
update da_01_test_context
set control_id = inserted_control.id
from inserted_control;

insert into public.control_failures (
  company_id,
  plant_id,
  control_id,
  failure_mode_id,
  quantity,
  import_batch_id,
  import_file_id,
  source_record_id,
  source_id,
  source_sheet_name,
  source_row_number,
  source_cell_address,
  mapping_id,
  mapping_version,
  source_record_status
)
select
  company_id,
  plant_id,
  control_id,
  failure_mode_id,
  1,
  import_batch_id,
  import_file_id,
  'record-1',
  'romet-controls',
  'BASE DE REGISTRO',
  2,
  'R2',
  'romet-semantic-mapping-v1-draft',
  'semantic-mapping-v1',
  'imported'
from da_01_test_context;

insert into public.import_issues (
  import_batch_id,
  import_file_id,
  company_id,
  plant_id,
  mapping_id,
  mapping_version,
  source_record_id,
  source_id,
  source_sheet_name,
  source_row_number,
  source_cell_address,
  target_table,
  issue_code,
  severity,
  message
)
select
  import_batch_id,
  import_file_id,
  company_id,
  plant_id,
  'romet-semantic-mapping-v1-draft',
  'semantic-mapping-v1',
  'record-1',
  'romet-controls',
  'BASE DE REGISTRO',
  2,
  'R2',
  'control_failures',
  'DA_01_TRACE_TEST',
  'informational',
  'Traceability test issue'
from da_01_test_context;

select set_config(
  'request.jwt.claim.sub',
  (select owner_id::text from da_01_test_context),
  true
);
set local role authenticated;

do $$
begin
  if not exists (select 1 from public.import_batches where mapping_id = 'romet-semantic-mapping-v1-draft') then
    raise exception 'DA-01 failed: owner cannot read import batch';
  end if;

  if not exists (select 1 from public.import_files where file_name like 'Registro Control Final ROMET%') then
    raise exception 'DA-01 failed: owner cannot read import file';
  end if;

  if not exists (select 1 from public.import_issues where issue_code = 'DA_01_TRACE_TEST') then
    raise exception 'DA-01 failed: owner cannot read import issue';
  end if;

  if not exists (select 1 from public.controls where source_record_id = 'record-1') then
    raise exception 'DA-01 failed: owner cannot read imported control';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  (select outsider_id::text from da_01_test_context),
  true
);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.import_batches where mapping_id = 'romet-semantic-mapping-v1-draft') then
    raise exception 'DA-01 failed: outsider can read import batch';
  end if;

  if exists (select 1 from public.controls where source_record_id = 'record-1') then
    raise exception 'DA-01 failed: outsider can read imported control';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
begin
  if exists (select 1 from public.import_batches where mapping_id = 'romet-semantic-mapping-v1-draft') then
    raise exception 'DA-01 failed: anonymous user can read import batch';
  end if;
end;
$$;

rollback;
