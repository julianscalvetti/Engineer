do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'company_member_role'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.company_member_role as enum ('owner', 'engineer', 'operator');
  end if;
end;
$$;

create table if not exists public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.company_member_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint company_members_company_id_user_id_key unique (company_id, user_id)
);

drop trigger if exists set_company_members_updated_at on public.company_members;
create trigger set_company_members_updated_at
before update on public.company_members
for each row execute function public.set_updated_at();

create index if not exists company_members_company_id_idx
  on public.company_members (company_id);

create index if not exists company_members_user_id_idx
  on public.company_members (user_id);

create index if not exists company_members_user_id_company_id_active_idx
  on public.company_members (user_id, company_id, active);

create index if not exists company_members_company_id_role_active_idx
  on public.company_members (company_id, role, active);

create index if not exists profiles_role_idx
  on public.profiles (role);

create index if not exists companies_active_idx
  on public.companies (active);

create index if not exists plants_company_id_idx
  on public.plants (company_id);

create index if not exists customers_plant_id_idx
  on public.customers (plant_id);

create index if not exists products_customer_id_idx
  on public.products (customer_id);

create index if not exists operations_product_id_idx
  on public.operations (product_id);

create index if not exists failure_modes_operation_id_idx
  on public.failure_modes (operation_id);

create index if not exists controls_operation_id_idx
  on public.controls (operation_id);

create index if not exists control_failures_control_id_idx
  on public.control_failures (control_id);

create index if not exists control_failures_failure_mode_id_idx
  on public.control_failures (failure_mode_id);

grant usage on type public.company_member_role to authenticated;

grant select on
  public.profiles,
  public.companies,
  public.company_members,
  public.plants,
  public.customers,
  public.products,
  public.operations,
  public.failure_modes,
  public.controls,
  public.control_failures
to authenticated;

create or replace function public.user_can_access_company(target_company_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_company_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.company_members company_member
      where company_member.company_id = target_company_id
        and company_member.user_id = auth.uid()
        and company_member.active = true
    );
$$;

create or replace function public.user_can_access_plant(target_plant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_plant_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.plants plant
      join public.company_members company_member
        on company_member.company_id = plant.company_id
      where plant.id = target_plant_id
        and company_member.user_id = auth.uid()
        and company_member.active = true
    );
$$;

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
      join public.plants plant
        on plant.id = customer.plant_id
      join public.company_members company_member
        on company_member.company_id = plant.company_id
      where customer.id = target_customer_id
        and company_member.user_id = auth.uid()
        and company_member.active = true
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
      join public.customers customer
        on customer.id = product.customer_id
      join public.plants plant
        on plant.id = customer.plant_id
      join public.company_members company_member
        on company_member.company_id = plant.company_id
      where product.id = target_product_id
        and company_member.user_id = auth.uid()
        and company_member.active = true
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
      join public.products product
        on product.id = op.product_id
      join public.customers customer
        on customer.id = product.customer_id
      join public.plants plant
        on plant.id = customer.plant_id
      join public.company_members company_member
        on company_member.company_id = plant.company_id
      where op.id = target_operation_id
        and company_member.user_id = auth.uid()
        and company_member.active = true
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
      join public.operations op
        on op.id = failure_mode.operation_id
      join public.products product
        on product.id = op.product_id
      join public.customers customer
        on customer.id = product.customer_id
      join public.plants plant
        on plant.id = customer.plant_id
      join public.company_members company_member
        on company_member.company_id = plant.company_id
      where failure_mode.id = target_failure_mode_id
        and company_member.user_id = auth.uid()
        and company_member.active = true
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
      join public.operations op
        on op.id = ctrl.operation_id
      join public.products product
        on product.id = op.product_id
      join public.customers customer
        on customer.id = product.customer_id
      join public.plants plant
        on plant.id = customer.plant_id
      join public.company_members company_member
        on company_member.company_id = plant.company_id
      where ctrl.id = target_control_id
        and company_member.user_id = auth.uid()
        and company_member.active = true
    );
$$;

create or replace function public.user_shares_company_with_profile(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select target_user_id is not null
    and auth.uid() is not null
    and exists (
      select 1
      from public.company_members current_member
      join public.company_members target_member
        on target_member.company_id = current_member.company_id
      where current_member.user_id = auth.uid()
        and target_member.user_id = target_user_id
        and current_member.active = true
        and target_member.active = true
    );
$$;

create or replace function public.bootstrap_romet_owner(
  target_user_id uuid,
  target_profile_name text default null
)
returns table (
  user_id uuid,
  profile_id uuid,
  company_id uuid,
  plant_id uuid,
  membership_role public.company_member_role
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  boot_profile_id uuid;
  boot_company_id uuid;
  boot_plant_id uuid;
begin
  if target_user_id is null then
    raise exception 'target_user_id is required';
  end if;

  if not exists (
    select 1
    from auth.users auth_user
    where auth_user.id = target_user_id
  ) then
    raise exception 'auth user % does not exist', target_user_id;
  end if;

  insert into public.profiles (id, name, role)
  values (
    target_user_id,
    coalesce(nullif(target_profile_name, ''), 'ROMET Owner'),
    'ingeniero'
  )
  on conflict (id) do update
    set name = coalesce(nullif(target_profile_name, ''), public.profiles.name),
        role = 'ingeniero'
  returning id into boot_profile_id;

  insert into public.companies (name, active)
  values ('ROMET', true)
  on conflict (name) do update
    set active = true
  returning id into boot_company_id;

  insert into public.plants (company_id, name, active)
  values (boot_company_id, 'Planta Principal', true)
  on conflict (company_id, name) do update
    set active = true
  returning id into boot_plant_id;

  insert into public.company_members (company_id, user_id, role, active)
  values (boot_company_id, target_user_id, 'owner', true)
  on conflict (company_id, user_id) do update
    set role = 'owner',
        active = true;

  return query
    select
      target_user_id,
      boot_profile_id,
      boot_company_id,
      boot_plant_id,
      'owner'::public.company_member_role;
end;
$$;

revoke all on function public.bootstrap_romet_owner(uuid, text) from public;
revoke execute on function public.bootstrap_romet_owner(uuid, text) from anon;
revoke execute on function public.bootstrap_romet_owner(uuid, text) from authenticated;

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.plants enable row level security;
alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.operations enable row level security;
alter table public.failure_modes enable row level security;
alter table public.controls enable row level security;
alter table public.control_failures enable row level security;

drop policy if exists profiles_select_self_or_company on public.profiles;
create policy profiles_select_self_or_company
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.user_shares_company_with_profile(id)
);

drop policy if exists companies_select_members on public.companies;
create policy companies_select_members
on public.companies
for select
to authenticated
using (public.user_can_access_company(id));

drop policy if exists company_members_select_company_members on public.company_members;
create policy company_members_select_company_members
on public.company_members
for select
to authenticated
using (public.user_can_access_company(company_id));

drop policy if exists plants_select_company_members on public.plants;
create policy plants_select_company_members
on public.plants
for select
to authenticated
using (public.user_can_access_company(company_id));

drop policy if exists customers_select_company_members on public.customers;
create policy customers_select_company_members
on public.customers
for select
to authenticated
using (public.user_can_access_plant(plant_id));

drop policy if exists products_select_company_members on public.products;
create policy products_select_company_members
on public.products
for select
to authenticated
using (public.user_can_access_customer(customer_id));

drop policy if exists operations_select_company_members on public.operations;
create policy operations_select_company_members
on public.operations
for select
to authenticated
using (public.user_can_access_product(product_id));

drop policy if exists failure_modes_select_company_members on public.failure_modes;
create policy failure_modes_select_company_members
on public.failure_modes
for select
to authenticated
using (public.user_can_access_operation(operation_id));

drop policy if exists controls_select_company_members on public.controls;
create policy controls_select_company_members
on public.controls
for select
to authenticated
using (public.user_can_access_operation(operation_id));

drop policy if exists control_failures_select_company_members on public.control_failures;
create policy control_failures_select_company_members
on public.control_failures
for select
to authenticated
using (public.user_can_access_control(control_id));

comment on table public.company_members is
  'Company-scoped user membership. This is the authorization source for company data access.';

comment on function public.bootstrap_romet_owner(uuid, text) is
  'Controlled admin bootstrap for DA-00. Associates an existing auth.users row with ROMET, Planta Principal, and owner membership. Not executable by anon or authenticated frontend clients.';
