create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint companies_name_key unique (name)
);

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plants_company_id_name_key unique (company_id, name)
);

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_plant_id_name_key unique (plant_id, name)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id),
  code text not null,
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_customer_id_code_key unique (customer_id, code)
);

create table public.operations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id),
  code text not null,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operations_product_id_code_key unique (product_id, code)
);

create table public.failure_modes (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id),
  name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint failure_modes_operation_id_name_key unique (operation_id, name)
);

create table public.controls (
  id uuid primary key default gen_random_uuid(),
  operation_id uuid not null references public.operations (id),
  date date not null,
  shift text not null,
  "operator" text not null,
  inspected_quantity integer not null,
  observations text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint controls_inspected_quantity_check check (inspected_quantity > 0)
);

create table public.control_failures (
  id uuid primary key default gen_random_uuid(),
  control_id uuid not null references public.controls (id),
  failure_mode_id uuid not null references public.failure_modes (id),
  quantity integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint control_failures_quantity_check check (quantity > 0),
  constraint control_failures_control_id_failure_mode_id_key unique (control_id, failure_mode_id)
);

create table public.profiles (
  id uuid primary key references auth.users (id),
  name text not null,
  role text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger set_companies_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

create trigger set_plants_updated_at
before update on public.plants
for each row execute function public.set_updated_at();

create trigger set_customers_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create trigger set_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger set_operations_updated_at
before update on public.operations
for each row execute function public.set_updated_at();

create trigger set_failure_modes_updated_at
before update on public.failure_modes
for each row execute function public.set_updated_at();

create trigger set_controls_updated_at
before update on public.controls
for each row execute function public.set_updated_at();

create trigger set_control_failures_updated_at
before update on public.control_failures
for each row execute function public.set_updated_at();

create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();
