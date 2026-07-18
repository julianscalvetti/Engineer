do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'import_batch_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.import_batch_status as enum (
      'draft',
      'ready',
      'approved',
      'committing',
      'committed',
      'failed',
      'rollback_pending',
      'rolled_back'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'import_file_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.import_file_status as enum (
      'received',
      'profiled',
      'mapped',
      'staged',
      'rejected'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'import_issue_severity'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.import_issue_severity as enum (
      'informational',
      'warning',
      'error'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'import_issue_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.import_issue_status as enum (
      'open',
      'accepted',
      'resolved',
      'rejected'
    );
  end if;

  if not exists (
    select 1
    from pg_type
    where typname = 'import_source_record_status'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.import_source_record_status as enum (
      'valid',
      'warning',
      'pending_review',
      'rejected',
      'imported',
      'skipped',
      'failed'
    );
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'plants_id_company_id_key'
      and conrelid = 'public.plants'::regclass
  ) then
    alter table public.plants
      add constraint plants_id_company_id_key unique (id, company_id);
  end if;
end;
$$;

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  plant_id uuid references public.plants (id),
  mapping_id text not null,
  mapping_version text not null,
  status public.import_batch_status not null default 'draft',
  source_record_status public.import_source_record_status,
  source_file_count integer not null default 0,
  source_record_count integer not null default 0,
  issue_count integer not null default 0,
  import_plan jsonb,
  import_plan_hash text,
  notes text,
  committed_at timestamptz,
  rolled_back_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_batches_source_file_count_check check (source_file_count >= 0),
  constraint import_batches_source_record_count_check check (source_record_count >= 0),
  constraint import_batches_issue_count_check check (issue_count >= 0),
  constraint import_batches_mapping_id_not_blank_check check (length(trim(mapping_id)) > 0),
  constraint import_batches_mapping_version_not_blank_check check (length(trim(mapping_version)) > 0),
  constraint import_batches_id_company_id_key unique (id, company_id),
  constraint import_batches_plant_company_fk foreign key (plant_id, company_id)
    references public.plants (id, company_id)
);

drop trigger if exists set_import_batches_updated_at on public.import_batches;
create trigger set_import_batches_updated_at
before update on public.import_batches
for each row execute function public.set_updated_at();

create table if not exists public.import_files (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  plant_id uuid references public.plants (id),
  file_name text not null,
  file_sha256 text not null,
  storage_path text,
  mime_type text,
  file_size_bytes bigint,
  sheet_count integer,
  mapping_id text not null,
  mapping_version text not null,
  status public.import_file_status not null default 'received',
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint import_files_file_name_not_blank_check check (length(trim(file_name)) > 0),
  constraint import_files_file_sha256_not_blank_check check (length(trim(file_sha256)) > 0),
  constraint import_files_file_size_bytes_check check (file_size_bytes is null or file_size_bytes >= 0),
  constraint import_files_sheet_count_check check (sheet_count is null or sheet_count >= 0),
  constraint import_files_mapping_id_not_blank_check check (length(trim(mapping_id)) > 0),
  constraint import_files_mapping_version_not_blank_check check (length(trim(mapping_version)) > 0),
  constraint import_files_id_company_id_key unique (id, company_id),
  constraint import_files_batch_company_fk foreign key (import_batch_id, company_id)
    references public.import_batches (id, company_id),
  constraint import_files_plant_company_fk foreign key (plant_id, company_id)
    references public.plants (id, company_id),
  constraint import_files_company_batch_sha256_key unique (company_id, import_batch_id, file_sha256)
);

drop trigger if exists set_import_files_updated_at on public.import_files;
create trigger set_import_files_updated_at
before update on public.import_files
for each row execute function public.set_updated_at();

create table if not exists public.import_issues (
  id uuid primary key default gen_random_uuid(),
  import_batch_id uuid not null references public.import_batches (id) on delete cascade,
  import_file_id uuid references public.import_files (id) on delete cascade,
  company_id uuid not null references public.companies (id),
  plant_id uuid references public.plants (id),
  mapping_id text not null,
  mapping_version text not null,
  source_record_id text,
  source_id text,
  source_sheet_name text,
  source_row_number integer,
  source_column_name text,
  source_cell_address text,
  target_table text,
  target_record_id uuid,
  issue_code text not null,
  severity public.import_issue_severity not null,
  status public.import_issue_status not null default 'open',
  message text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  constraint import_issues_source_row_number_check check (source_row_number is null or source_row_number > 0),
  constraint import_issues_issue_code_not_blank_check check (length(trim(issue_code)) > 0),
  constraint import_issues_message_not_blank_check check (length(trim(message)) > 0),
  constraint import_issues_mapping_id_not_blank_check check (length(trim(mapping_id)) > 0),
  constraint import_issues_mapping_version_not_blank_check check (length(trim(mapping_version)) > 0),
  constraint import_issues_batch_company_fk foreign key (import_batch_id, company_id)
    references public.import_batches (id, company_id),
  constraint import_issues_file_company_fk foreign key (import_file_id, company_id)
    references public.import_files (id, company_id),
  constraint import_issues_plant_company_fk foreign key (plant_id, company_id)
    references public.plants (id, company_id)
);

drop trigger if exists set_import_issues_updated_at on public.import_issues;
create trigger set_import_issues_updated_at
before update on public.import_issues
for each row execute function public.set_updated_at();

alter table public.customers
  add column if not exists company_id uuid,
  add column if not exists import_batch_id uuid references public.import_batches (id),
  add column if not exists import_file_id uuid references public.import_files (id),
  add column if not exists source_record_id text,
  add column if not exists source_id text,
  add column if not exists source_sheet_name text,
  add column if not exists source_row_number integer,
  add column if not exists source_column_name text,
  add column if not exists source_cell_address text,
  add column if not exists mapping_id text,
  add column if not exists mapping_version text,
  add column if not exists source_record_status public.import_source_record_status;

alter table public.products
  add column if not exists company_id uuid,
  add column if not exists plant_id uuid,
  add column if not exists import_batch_id uuid references public.import_batches (id),
  add column if not exists import_file_id uuid references public.import_files (id),
  add column if not exists source_record_id text,
  add column if not exists source_id text,
  add column if not exists source_sheet_name text,
  add column if not exists source_row_number integer,
  add column if not exists source_column_name text,
  add column if not exists source_cell_address text,
  add column if not exists mapping_id text,
  add column if not exists mapping_version text,
  add column if not exists source_record_status public.import_source_record_status;

alter table public.operations
  add column if not exists company_id uuid,
  add column if not exists plant_id uuid,
  add column if not exists import_batch_id uuid references public.import_batches (id),
  add column if not exists import_file_id uuid references public.import_files (id),
  add column if not exists source_record_id text,
  add column if not exists source_id text,
  add column if not exists source_sheet_name text,
  add column if not exists source_row_number integer,
  add column if not exists source_column_name text,
  add column if not exists source_cell_address text,
  add column if not exists mapping_id text,
  add column if not exists mapping_version text,
  add column if not exists source_record_status public.import_source_record_status;

alter table public.failure_modes
  add column if not exists company_id uuid,
  add column if not exists plant_id uuid,
  add column if not exists import_batch_id uuid references public.import_batches (id),
  add column if not exists import_file_id uuid references public.import_files (id),
  add column if not exists source_record_id text,
  add column if not exists source_id text,
  add column if not exists source_sheet_name text,
  add column if not exists source_row_number integer,
  add column if not exists source_column_name text,
  add column if not exists source_cell_address text,
  add column if not exists mapping_id text,
  add column if not exists mapping_version text,
  add column if not exists source_record_status public.import_source_record_status;

alter table public.controls
  add column if not exists company_id uuid,
  add column if not exists plant_id uuid,
  add column if not exists import_batch_id uuid references public.import_batches (id),
  add column if not exists import_file_id uuid references public.import_files (id),
  add column if not exists source_record_id text,
  add column if not exists source_id text,
  add column if not exists source_sheet_name text,
  add column if not exists source_row_number integer,
  add column if not exists source_column_name text,
  add column if not exists source_cell_address text,
  add column if not exists mapping_id text,
  add column if not exists mapping_version text,
  add column if not exists source_record_status public.import_source_record_status;

alter table public.control_failures
  add column if not exists company_id uuid,
  add column if not exists plant_id uuid,
  add column if not exists import_batch_id uuid references public.import_batches (id),
  add column if not exists import_file_id uuid references public.import_files (id),
  add column if not exists source_record_id text,
  add column if not exists source_id text,
  add column if not exists source_sheet_name text,
  add column if not exists source_row_number integer,
  add column if not exists source_column_name text,
  add column if not exists source_cell_address text,
  add column if not exists mapping_id text,
  add column if not exists mapping_version text,
  add column if not exists source_record_status public.import_source_record_status;

update public.customers customer
set company_id = plant.company_id
from public.plants plant
where customer.plant_id = plant.id
  and customer.company_id is null;

update public.products product
set company_id = customer.company_id,
    plant_id = customer.plant_id
from public.customers customer
where product.customer_id = customer.id
  and (product.company_id is null or product.plant_id is null);

update public.operations op
set company_id = product.company_id,
    plant_id = product.plant_id
from public.products product
where op.product_id = product.id
  and (op.company_id is null or op.plant_id is null);

update public.failure_modes failure_mode
set company_id = op.company_id,
    plant_id = op.plant_id
from public.operations op
where failure_mode.operation_id = op.id
  and (failure_mode.company_id is null or failure_mode.plant_id is null);

update public.controls ctrl
set company_id = op.company_id,
    plant_id = op.plant_id
from public.operations op
where ctrl.operation_id = op.id
  and (ctrl.company_id is null or ctrl.plant_id is null);

update public.control_failures control_failure
set company_id = ctrl.company_id,
    plant_id = ctrl.plant_id
from public.controls ctrl
where control_failure.control_id = ctrl.id
  and (control_failure.company_id is null or control_failure.plant_id is null);

alter table public.customers
  alter column company_id set not null;

alter table public.products
  alter column company_id set not null,
  alter column plant_id set not null;

alter table public.operations
  alter column company_id set not null,
  alter column plant_id set not null;

alter table public.failure_modes
  alter column company_id set not null,
  alter column plant_id set not null;

alter table public.controls
  alter column company_id set not null,
  alter column plant_id set not null;

alter table public.control_failures
  alter column company_id set not null,
  alter column plant_id set not null;

alter table public.customers drop constraint if exists customers_plant_id_name_key;
alter table public.products drop constraint if exists products_customer_id_code_key;
alter table public.operations drop constraint if exists operations_product_id_code_key;
alter table public.failure_modes drop constraint if exists failure_modes_operation_id_name_key;
alter table public.control_failures drop constraint if exists control_failures_control_id_failure_mode_id_key;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_id_company_id_plant_id_key'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_id_company_id_plant_id_key unique (id, company_id, plant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_id_company_id_plant_id_key'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_id_company_id_plant_id_key unique (id, company_id, plant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operations_id_company_id_plant_id_key'
      and conrelid = 'public.operations'::regclass
  ) then
    alter table public.operations
      add constraint operations_id_company_id_plant_id_key unique (id, company_id, plant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'failure_modes_id_company_id_plant_id_key'
      and conrelid = 'public.failure_modes'::regclass
  ) then
    alter table public.failure_modes
      add constraint failure_modes_id_company_id_plant_id_key unique (id, company_id, plant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'controls_id_company_id_plant_id_key'
      and conrelid = 'public.controls'::regclass
  ) then
    alter table public.controls
      add constraint controls_id_company_id_plant_id_key unique (id, company_id, plant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_company_plant_name_key'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_company_plant_name_key unique (company_id, plant_id, name);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_company_plant_customer_code_key'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_company_plant_customer_code_key unique (company_id, plant_id, customer_id, code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operations_company_plant_product_code_key'
      and conrelid = 'public.operations'::regclass
  ) then
    alter table public.operations
      add constraint operations_company_plant_product_code_key unique (company_id, plant_id, product_id, code);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'failure_modes_company_plant_operation_name_key'
      and conrelid = 'public.failure_modes'::regclass
  ) then
    alter table public.failure_modes
      add constraint failure_modes_company_plant_operation_name_key unique (company_id, plant_id, operation_id, name);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'control_failures_company_plant_control_failure_mode_key'
      and conrelid = 'public.control_failures'::regclass
  ) then
    alter table public.control_failures
      add constraint control_failures_company_plant_control_failure_mode_key unique (company_id, plant_id, control_id, failure_mode_id);
  end if;
end;
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_company_id_fkey'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_company_id_fkey foreign key (company_id)
      references public.companies (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'customers_plant_company_fk'
      and conrelid = 'public.customers'::regclass
  ) then
    alter table public.customers
      add constraint customers_plant_company_fk foreign key (plant_id, company_id)
      references public.plants (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_company_id_fkey'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_company_id_fkey foreign key (company_id)
      references public.companies (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_plant_company_fk'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_plant_company_fk foreign key (plant_id, company_id)
      references public.plants (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'products_customer_scope_fk'
      and conrelid = 'public.products'::regclass
  ) then
    alter table public.products
      add constraint products_customer_scope_fk foreign key (customer_id, company_id, plant_id)
      references public.customers (id, company_id, plant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operations_company_id_fkey'
      and conrelid = 'public.operations'::regclass
  ) then
    alter table public.operations
      add constraint operations_company_id_fkey foreign key (company_id)
      references public.companies (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operations_plant_company_fk'
      and conrelid = 'public.operations'::regclass
  ) then
    alter table public.operations
      add constraint operations_plant_company_fk foreign key (plant_id, company_id)
      references public.plants (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'operations_product_scope_fk'
      and conrelid = 'public.operations'::regclass
  ) then
    alter table public.operations
      add constraint operations_product_scope_fk foreign key (product_id, company_id, plant_id)
      references public.products (id, company_id, plant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'failure_modes_company_id_fkey'
      and conrelid = 'public.failure_modes'::regclass
  ) then
    alter table public.failure_modes
      add constraint failure_modes_company_id_fkey foreign key (company_id)
      references public.companies (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'failure_modes_plant_company_fk'
      and conrelid = 'public.failure_modes'::regclass
  ) then
    alter table public.failure_modes
      add constraint failure_modes_plant_company_fk foreign key (plant_id, company_id)
      references public.plants (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'failure_modes_operation_scope_fk'
      and conrelid = 'public.failure_modes'::regclass
  ) then
    alter table public.failure_modes
      add constraint failure_modes_operation_scope_fk foreign key (operation_id, company_id, plant_id)
      references public.operations (id, company_id, plant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'controls_company_id_fkey'
      and conrelid = 'public.controls'::regclass
  ) then
    alter table public.controls
      add constraint controls_company_id_fkey foreign key (company_id)
      references public.companies (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'controls_plant_company_fk'
      and conrelid = 'public.controls'::regclass
  ) then
    alter table public.controls
      add constraint controls_plant_company_fk foreign key (plant_id, company_id)
      references public.plants (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'controls_operation_scope_fk'
      and conrelid = 'public.controls'::regclass
  ) then
    alter table public.controls
      add constraint controls_operation_scope_fk foreign key (operation_id, company_id, plant_id)
      references public.operations (id, company_id, plant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'control_failures_company_id_fkey'
      and conrelid = 'public.control_failures'::regclass
  ) then
    alter table public.control_failures
      add constraint control_failures_company_id_fkey foreign key (company_id)
      references public.companies (id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'control_failures_plant_company_fk'
      and conrelid = 'public.control_failures'::regclass
  ) then
    alter table public.control_failures
      add constraint control_failures_plant_company_fk foreign key (plant_id, company_id)
      references public.plants (id, company_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'control_failures_control_scope_fk'
      and conrelid = 'public.control_failures'::regclass
  ) then
    alter table public.control_failures
      add constraint control_failures_control_scope_fk foreign key (control_id, company_id, plant_id)
      references public.controls (id, company_id, plant_id);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'control_failures_failure_mode_scope_fk'
      and conrelid = 'public.control_failures'::regclass
  ) then
    alter table public.control_failures
      add constraint control_failures_failure_mode_scope_fk foreign key (failure_mode_id, company_id, plant_id)
      references public.failure_modes (id, company_id, plant_id);
  end if;
end;
$$;

create index if not exists import_batches_company_id_idx
  on public.import_batches (company_id);
create index if not exists import_batches_plant_id_idx
  on public.import_batches (plant_id);
create index if not exists import_batches_company_status_idx
  on public.import_batches (company_id, status);
create index if not exists import_batches_mapping_idx
  on public.import_batches (mapping_id, mapping_version);

create index if not exists import_files_import_batch_id_idx
  on public.import_files (import_batch_id);
create index if not exists import_files_company_id_idx
  on public.import_files (company_id);
create index if not exists import_files_plant_id_idx
  on public.import_files (plant_id);
create index if not exists import_files_company_status_idx
  on public.import_files (company_id, status);
create index if not exists import_files_mapping_idx
  on public.import_files (mapping_id, mapping_version);

create index if not exists import_issues_import_batch_id_idx
  on public.import_issues (import_batch_id);
create index if not exists import_issues_import_file_id_idx
  on public.import_issues (import_file_id);
create index if not exists import_issues_company_id_idx
  on public.import_issues (company_id);
create index if not exists import_issues_plant_id_idx
  on public.import_issues (plant_id);
create index if not exists import_issues_company_status_idx
  on public.import_issues (company_id, status);
create index if not exists import_issues_company_severity_idx
  on public.import_issues (company_id, severity);
create index if not exists import_issues_source_locator_idx
  on public.import_issues (company_id, source_sheet_name, source_row_number, source_cell_address);
create index if not exists import_issues_mapping_idx
  on public.import_issues (mapping_id, mapping_version);

create index if not exists customers_company_id_idx
  on public.customers (company_id);
create index if not exists customers_company_id_plant_id_idx
  on public.customers (company_id, plant_id);
create index if not exists customers_import_batch_id_idx
  on public.customers (import_batch_id);

create index if not exists products_company_id_idx
  on public.products (company_id);
create index if not exists products_plant_id_idx
  on public.products (plant_id);
create index if not exists products_company_id_plant_id_idx
  on public.products (company_id, plant_id);
create index if not exists products_import_batch_id_idx
  on public.products (import_batch_id);

create index if not exists operations_company_id_idx
  on public.operations (company_id);
create index if not exists operations_plant_id_idx
  on public.operations (plant_id);
create index if not exists operations_company_id_plant_id_idx
  on public.operations (company_id, plant_id);
create index if not exists operations_import_batch_id_idx
  on public.operations (import_batch_id);

create index if not exists failure_modes_company_id_idx
  on public.failure_modes (company_id);
create index if not exists failure_modes_plant_id_idx
  on public.failure_modes (plant_id);
create index if not exists failure_modes_company_id_plant_id_idx
  on public.failure_modes (company_id, plant_id);
create index if not exists failure_modes_import_batch_id_idx
  on public.failure_modes (import_batch_id);

create index if not exists controls_company_id_idx
  on public.controls (company_id);
create index if not exists controls_plant_id_idx
  on public.controls (plant_id);
create index if not exists controls_company_id_plant_id_idx
  on public.controls (company_id, plant_id);
create index if not exists controls_import_batch_id_idx
  on public.controls (import_batch_id);
create index if not exists controls_source_locator_idx
  on public.controls (company_id, source_sheet_name, source_row_number);

create index if not exists control_failures_company_id_idx
  on public.control_failures (company_id);
create index if not exists control_failures_plant_id_idx
  on public.control_failures (plant_id);
create index if not exists control_failures_company_id_plant_id_idx
  on public.control_failures (company_id, plant_id);
create index if not exists control_failures_import_batch_id_idx
  on public.control_failures (import_batch_id);
create index if not exists control_failures_source_locator_idx
  on public.control_failures (company_id, source_sheet_name, source_row_number, source_cell_address);

create or replace function public.user_can_access_customer(target_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_customer_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.customers customer
      where customer.id = target_customer_id
        and public.user_can_access_company(customer.company_id)
    );
$$;

create or replace function public.user_can_access_product(target_product_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_product_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.products product
      where product.id = target_product_id
        and public.user_can_access_company(product.company_id)
    );
$$;

create or replace function public.user_can_access_operation(target_operation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_operation_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.operations op
      where op.id = target_operation_id
        and public.user_can_access_company(op.company_id)
    );
$$;

create or replace function public.user_can_access_failure_mode(target_failure_mode_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_failure_mode_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.failure_modes failure_mode
      where failure_mode.id = target_failure_mode_id
        and public.user_can_access_company(failure_mode.company_id)
    );
$$;

create or replace function public.user_can_access_control(target_control_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_control_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.controls ctrl
      where ctrl.id = target_control_id
        and public.user_can_access_company(ctrl.company_id)
    );
$$;

grant usage on type
  public.import_batch_status,
  public.import_file_status,
  public.import_issue_severity,
  public.import_issue_status,
  public.import_source_record_status
to authenticated;

grant select on
  public.import_batches,
  public.import_files,
  public.import_issues
to authenticated;

alter table public.import_batches enable row level security;
alter table public.import_files enable row level security;
alter table public.import_issues enable row level security;

drop policy if exists import_batches_select_company_members on public.import_batches;
create policy import_batches_select_company_members
on public.import_batches
for select
to authenticated
using (public.user_can_access_company(company_id));

drop policy if exists import_files_select_company_members on public.import_files;
create policy import_files_select_company_members
on public.import_files
for select
to authenticated
using (public.user_can_access_company(company_id));

drop policy if exists import_issues_select_company_members on public.import_issues;
create policy import_issues_select_company_members
on public.import_issues
for select
to authenticated
using (public.user_can_access_company(company_id));

comment on table public.import_batches is
  'Import batch audit header scoped to company membership. It does not own data by user_id.';
comment on table public.import_files is
  'Immutable source file metadata for an import batch.';
comment on table public.import_issues is
  'Traceable import issue log with file, sheet, row and optional cell location.';

comment on column public.import_batches.mapping_id is
  'Semantic mapping identifier used to prepare the batch.';
comment on column public.import_batches.mapping_version is
  'Semantic mapping contract version used to prepare the batch.';
comment on column public.import_issues.source_cell_address is
  'Spreadsheet cell address when the issue can be traced to a single cell.';
