-- Engineer MVP - initial multi-company schema for Supabase/Postgres.
-- Safe for a new project: it creates objects without dropping tables or data.

create extension if not exists pgcrypto;

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 120),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]*$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete restrict,
  full_name text,
  role text not null default 'member' check (role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, id)
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null check (length(trim(code)) between 1 and 50),
  name text not null check (length(trim(name)) between 1 and 150),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id)
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null check (length(trim(code)) between 1 and 50),
  name text not null check (length(trim(name)) between 1 and 150),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id)
);

create table if not exists public.operations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null check (length(trim(code)) between 1 and 50),
  name text not null check (length(trim(name)) between 1 and 150),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id)
);

create table if not exists public.areas (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null check (length(trim(code)) between 1 and 50),
  name text not null check (length(trim(name)) between 1 and 150),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id)
);

create table if not exists public.failure_modes (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  code text not null check (length(trim(code)) between 1 and 50),
  name text not null check (length(trim(name)) between 1 and 150),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, code),
  unique (company_id, id)
);

create table if not exists public.quality_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  record_date date not null,
  product_id uuid not null,
  client_id uuid not null,
  operation_id uuid not null,
  area_id uuid not null,
  failure_mode_id uuid not null,
  inspected_quantity integer not null check (inspected_quantity >= 0),
  defective_quantity integer not null check (defective_quantity >= 0 and defective_quantity <= inspected_quantity),
  scrap_quantity integer not null check (scrap_quantity >= 0 and scrap_quantity <= inspected_quantity),
  observations text,
  responsible_user_id uuid not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quality_records_product_fk foreign key (company_id, product_id) references public.products(company_id, id),
  constraint quality_records_client_fk foreign key (company_id, client_id) references public.clients(company_id, id),
  constraint quality_records_operation_fk foreign key (company_id, operation_id) references public.operations(company_id, id),
  constraint quality_records_area_fk foreign key (company_id, area_id) references public.areas(company_id, id),
  constraint quality_records_failure_mode_fk foreign key (company_id, failure_mode_id) references public.failure_modes(company_id, id),
  constraint quality_records_responsible_fk foreign key (company_id, responsible_user_id) references public.profiles(company_id, id),
  constraint quality_records_creator_fk foreign key (company_id, created_by) references public.profiles(company_id, id)
);

create index if not exists profiles_company_id_idx on public.profiles(company_id);
create index if not exists clients_company_id_idx on public.clients(company_id);
create index if not exists products_company_id_idx on public.products(company_id);
create index if not exists operations_company_id_idx on public.operations(company_id);
create index if not exists areas_company_id_idx on public.areas(company_id);
create index if not exists failure_modes_company_id_idx on public.failure_modes(company_id);
create index if not exists quality_records_company_date_idx on public.quality_records(company_id, record_date desc);
create index if not exists quality_records_product_idx on public.quality_records(company_id, product_id);
create index if not exists quality_records_failure_mode_idx on public.quality_records(company_id, failure_mode_id);
create index if not exists quality_records_area_idx on public.quality_records(company_id, area_id);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'companies', 'profiles', 'clients', 'products', 'operations',
    'areas', 'failure_modes', 'quality_records'
  ] loop
    execute format('drop trigger if exists set_updated_at on public.%I', table_name);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()',
      table_name
    );
  end loop;
end;
$$;

-- SECURITY DEFINER avoids recursive RLS checks when policies resolve membership.
create or replace function public.current_company_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.company_id from public.profiles p where p.id = (select auth.uid());
$$;

revoke all on function public.current_company_id() from public;
grant execute on function public.current_company_id() to authenticated;

-- Creates the first company for an authenticated user who has no profile yet.
create or replace function public.bootstrap_company(company_name text, full_name text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_company_id uuid;
  clean_name text := trim(company_name);
  new_slug text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'User already belongs to a company';
  end if;
  if length(clean_name) < 2 or length(clean_name) > 120 then
    raise exception 'Company name must contain between 2 and 120 characters';
  end if;

  new_slug := trim(both '-' from regexp_replace(lower(clean_name), '[^a-z0-9]+', '-', 'g'));
  if new_slug = '' then new_slug := 'company'; end if;
  new_slug := left(new_slug, 80) || '-' || left(gen_random_uuid()::text, 8);

  insert into public.companies (name, slug)
  values (clean_name, new_slug)
  returning id into new_company_id;

  insert into public.profiles (id, company_id, full_name, role)
  values (auth.uid(), new_company_id, nullif(trim(full_name), ''), 'admin');

  return new_company_id;
end;
$$;

revoke all on function public.bootstrap_company(text, text) from public;
grant execute on function public.bootstrap_company(text, text) to authenticated;

-- New sign-ups created by this app include company_name in user metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  company_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'company_name', '')), '');
  person_name text := nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), '');
  company_id uuid;
  company_slug text;
begin
  if company_name is null then
    return new;
  end if;

  company_slug := trim(both '-' from regexp_replace(lower(company_name), '[^a-z0-9]+', '-', 'g'));
  if company_slug = '' then company_slug := 'company'; end if;
  company_slug := left(company_slug, 80) || '-' || left(gen_random_uuid()::text, 8);

  insert into public.companies (name, slug)
  values (company_name, company_slug)
  returning id into company_id;

  insert into public.profiles (id, company_id, full_name, role)
  values (new.id, company_id, person_name, 'admin');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.companies enable row level security;
alter table public.profiles enable row level security;
alter table public.clients enable row level security;
alter table public.products enable row level security;
alter table public.operations enable row level security;
alter table public.areas enable row level security;
alter table public.failure_modes enable row level security;
alter table public.quality_records enable row level security;

drop policy if exists "members can view their company" on public.companies;
create policy "members can view their company"
  on public.companies for select to authenticated
  using (id = (select public.current_company_id()));

drop policy if exists "members can view company profiles" on public.profiles;
create policy "members can view company profiles"
  on public.profiles for select to authenticated
  using (company_id = (select public.current_company_id()));

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'clients', 'products', 'operations', 'areas', 'failure_modes', 'quality_records'
  ] loop
    execute format('drop policy if exists "company members can select" on public.%I', table_name);
    execute format('drop policy if exists "company members can insert" on public.%I', table_name);
    execute format('drop policy if exists "company members can update" on public.%I', table_name);
    execute format('drop policy if exists "company members can delete" on public.%I', table_name);
    execute format(
      'create policy "company members can select" on public.%I for select to authenticated using (company_id = (select public.current_company_id()))',
      table_name
    );
    execute format(
      'create policy "company members can insert" on public.%I for insert to authenticated with check (company_id = (select public.current_company_id()))',
      table_name
    );
    execute format(
      'create policy "company members can update" on public.%I for update to authenticated using (company_id = (select public.current_company_id())) with check (company_id = (select public.current_company_id()))',
      table_name
    );
    execute format(
      'create policy "company members can delete" on public.%I for delete to authenticated using (company_id = (select public.current_company_id()))',
      table_name
    );
  end loop;
end;
$$;

revoke all on all tables in schema public from anon;
grant select on public.companies, public.profiles to authenticated;
grant select, insert, update, delete on
  public.clients, public.products, public.operations, public.areas,
  public.failure_modes, public.quality_records
to authenticated;
