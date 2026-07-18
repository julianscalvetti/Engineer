-- DA-00 RLS access proof.
-- Run against a Supabase database after applying migrations 001 and 002.
-- The transaction rolls back all test users/profile/membership changes.

begin;

create temp table da_00_test_context (
  owner_id uuid not null default gen_random_uuid(),
  outsider_id uuid not null default gen_random_uuid()
);

insert into da_00_test_context default values;

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
  'da-00-owner-' || owner_id::text || '@example.test',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
from da_00_test_context
union all
select
  outsider_id,
  'authenticated',
  'authenticated',
  'da-00-outsider-' || outsider_id::text || '@example.test',
  '',
  now(),
  now(),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
from da_00_test_context;

select public.bootstrap_romet_owner(owner_id, 'DA-00 Owner')
from da_00_test_context;

insert into public.profiles (id, name, role)
select outsider_id, 'DA-00 Outsider', 'ingeniero'
from da_00_test_context;

select set_config(
  'request.jwt.claim.sub',
  (select owner_id::text from da_00_test_context),
  true
);

set local role authenticated;

do $$
begin
  if not exists (
    select 1
    from public.companies
    where name = 'ROMET'
  ) then
    raise exception 'DA-00 failed: owner cannot read ROMET';
  end if;

  if not exists (
    select 1
    from public.plants
    where name = 'Planta Principal'
  ) then
    raise exception 'DA-00 failed: owner cannot read ROMET plant';
  end if;
end;
$$;

reset role;

select set_config(
  'request.jwt.claim.sub',
  (select outsider_id::text from da_00_test_context),
  true
);

set local role authenticated;

do $$
begin
  if exists (
    select 1
    from public.companies
    where name = 'ROMET'
  ) then
    raise exception 'DA-00 failed: outsider can read ROMET';
  end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '', true);
set local role anon;

do $$
begin
  if exists (
    select 1
    from public.companies
    where name = 'ROMET'
  ) then
    raise exception 'DA-00 failed: anonymous user can read ROMET';
  end if;
end;
$$;

rollback;
