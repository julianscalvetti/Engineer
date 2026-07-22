with company as (
  insert into public.companies (name)
  values ('Engineer Demo')
  returning id
),
plant as (
  insert into public.plants (company_id, name)
  select id, 'Planta Principal'
  from company
  returning id
),
customer as (
  insert into public.customers (plant_id, name)
  select id, 'Cliente Demo'
  from plant
  returning id
),
product as (
  insert into public.products (customer_id, code, name)
  select id, 'PIEZA-001', 'Soporte delantero'
  from customer
  returning id
),
operation as (
  insert into public.operations (product_id, code, name)
  select id, 'OP-20', 'Soldadura'
  from product
  returning id
),
failure_modes as (
  insert into public.failure_modes (operation_id, name)
  select operation.id, failure_mode.name
  from operation
  cross join (
    values
      ('Cordón desviado'),
      ('Spatter'),
      ('Soldadura no OK')
  ) as failure_mode(name)
  returning id, name
),
control_1 as (
  insert into public.controls (
    operation_id,
    date,
    shift,
    "operator",
    inspected_quantity
  )
  select
    id,
    date '2026-07-15',
    'Mañana',
    'Juan',
    300
  from operation
  returning id
),
control_2 as (
  insert into public.controls (
    operation_id,
    date,
    shift,
    "operator",
    inspected_quantity
  )
  select
    id,
    date '2026-07-16',
    'Mañana',
    'Pedro',
    300
  from operation
  returning id
)
insert into public.control_failures (control_id, failure_mode_id, quantity)
select control_2.id, failure_modes.id, failure.quantity
from control_2
join (
  values
    ('Spatter', 8),
    ('Cordón desviado', 3)
) as failure(name, quantity)
  on true
join failure_modes
  on failure_modes.name = failure.name;
