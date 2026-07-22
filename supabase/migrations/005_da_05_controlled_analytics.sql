/*
DA-05 controlled analytics RPC.

Security strategy:
- The RPC is security definer only to centralize bounded analytics and avoid exposing arbitrary SQL.
- Tenant access is validated against company_members using auth.uid().
- The caller supplies no SQL identifiers, table names, column names or expressions.
- Measures, dimensions, order fields and directions are validated against closed allowlists.
- Filters are passed as typed parameters.
- The query uses fixed joins over the industrial quality tables and imported records only.
*/

create index if not exists controls_da05_scope_date_idx
  on public.controls (company_id, plant_id, date, operation_id, id)
  where source_record_status = 'imported';

create index if not exists control_failures_da05_scope_control_mode_idx
  on public.control_failures (company_id, plant_id, control_id, failure_mode_id)
  where source_record_status = 'imported';

create or replace function public.da_05_controlled_quality_analysis(
  target_company_id uuid,
  target_plant_id uuid,
  target_date_from date default null,
  target_date_to date default null,
  target_measures text[] default array['controls', 'inspected_quantity', 'defects', 'dpu'],
  target_group_by text[] default array[]::text[],
  target_customer_ids uuid[] default null,
  target_product_ids uuid[] default null,
  target_operation_ids uuid[] default null,
  target_failure_mode_ids uuid[] default null,
  target_order_measure text default 'defects',
  target_order_direction text default 'desc',
  target_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean;
  measures text[] := coalesce(target_measures, array[]::text[]);
  group_by text[] := coalesce(target_group_by, array[]::text[]);
  allowed_measures constant text[] := array['controls', 'inspected_quantity', 'defects', 'dpu'];
  allowed_dimensions constant text[] := array['customer', 'product', 'operation', 'failure_mode'];
  order_measure text := coalesce(target_order_measure, 'defects');
  order_direction text := coalesce(target_order_direction, 'desc');
  row_limit integer := least(greatest(coalesce(target_limit, 50), 1), 100);
  has_failure_dimension boolean := 'failure_mode' = any(group_by);
  output jsonb;
begin
  if cardinality(measures) = 0 then
    raise exception 'DA-05 requires at least one measure.';
  end if;

  if exists (select 1 from unnest(measures) measure where measure <> all(allowed_measures)) then
    raise exception 'DA-05 received an unsupported measure.';
  end if;

  if cardinality(group_by) > 2 then
    raise exception 'DA-05 supports at most two dimensions.';
  end if;

  if exists (select 1 from unnest(group_by) dimension where dimension <> all(allowed_dimensions)) then
    raise exception 'DA-05 received an unsupported dimension.';
  end if;

  if cardinality(group_by) <> (select count(distinct dimension) from unnest(group_by) dimension) then
    raise exception 'DA-05 does not allow repeated dimensions.';
  end if;

  if order_measure <> all(allowed_measures) then
    raise exception 'DA-05 received an unsupported order measure.';
  end if;

  if order_direction not in ('asc', 'desc') then
    raise exception 'DA-05 received an unsupported order direction.';
  end if;

  select exists (
    select 1
    from public.company_members member
    where member.company_id = target_company_id
      and member.user_id = auth.uid()
      and member.active = true
      and member.role in ('owner', 'engineer', 'operator')
  )
  into allowed;

  if not allowed then
    return jsonb_build_object(
      'rows', '[]'::jsonb,
      'rowCount', 0,
      'truncated', false,
      'totalDefects', 0
    );
  end if;

  if has_failure_dimension then
    with filtered_controls as (
      select
        control.id,
        control.inspected_quantity,
        customer.id as customer_id,
        customer.name as customer_label,
        product.id as product_id,
        product.code || ' - ' || product.name as product_label,
        operation.id as operation_id,
        operation.code || ' - ' || operation.name as operation_label
      from public.controls control
      join public.operations operation
        on operation.id = control.operation_id
       and operation.company_id = control.company_id
       and operation.plant_id = control.plant_id
      join public.products product
        on product.id = operation.product_id
       and product.company_id = operation.company_id
       and product.plant_id = operation.plant_id
      join public.customers customer
        on customer.id = product.customer_id
       and customer.company_id = product.company_id
       and customer.plant_id = product.plant_id
      where control.company_id = target_company_id
        and control.plant_id = target_plant_id
        and control.source_record_status = 'imported'
        and (target_date_from is null or control.date >= target_date_from)
        and (target_date_to is null or control.date <= target_date_to)
        and (target_customer_ids is null or customer.id = any(target_customer_ids))
        and (target_product_ids is null or product.id = any(target_product_ids))
        and (target_operation_ids is null or operation.id = any(target_operation_ids))
    ),
    failure_by_control_mode as (
      select
        failure.control_id,
        failure.failure_mode_id,
        failure_mode.name as failure_mode_label,
        sum(failure.quantity)::bigint as defects
      from public.control_failures failure
      join public.failure_modes failure_mode
        on failure_mode.id = failure.failure_mode_id
       and failure_mode.company_id = failure.company_id
       and failure_mode.plant_id = failure.plant_id
      where failure.company_id = target_company_id
        and failure.plant_id = target_plant_id
        and failure.source_record_status = 'imported'
        and (target_failure_mode_ids is null or failure.failure_mode_id = any(target_failure_mode_ids))
      group by failure.control_id, failure.failure_mode_id, failure_mode.name
    ),
    base as (
      select
        control.id,
        control.inspected_quantity,
        control.customer_id,
        control.customer_label,
        control.product_id,
        control.product_label,
        control.operation_id,
        control.operation_label,
        failure.failure_mode_id,
        failure.failure_mode_label,
        failure.defects
      from filtered_controls control
      join failure_by_control_mode failure
        on failure.control_id = control.id
    ),
    grouped as (
      select
        case when 'customer' = any(group_by) then customer_id end as customer_id,
        case when 'customer' = any(group_by) then max(customer_label) end as customer_label,
        case when 'product' = any(group_by) then product_id end as product_id,
        case when 'product' = any(group_by) then max(product_label) end as product_label,
        case when 'operation' = any(group_by) then operation_id end as operation_id,
        case when 'operation' = any(group_by) then max(operation_label) end as operation_label,
        case when 'failure_mode' = any(group_by) then failure_mode_id end as failure_mode_id,
        case when 'failure_mode' = any(group_by) then max(failure_mode_label) end as failure_mode_label,
        count(distinct id)::bigint as controls,
        coalesce(sum(inspected_quantity), 0)::bigint as inspected_quantity,
        coalesce(sum(defects), 0)::bigint as defects
      from base
      group by
        case when 'customer' = any(group_by) then customer_id end,
        case when 'product' = any(group_by) then product_id end,
        case when 'operation' = any(group_by) then operation_id end,
        case when 'failure_mode' = any(group_by) then failure_mode_id end
    ),
    projected as (
      select
        *,
        case when inspected_quantity > 0 then defects::numeric / inspected_quantity else 0 end as dpu,
        count(*) over ()::bigint as total_rows,
        sum(defects) over ()::bigint as total_defects
      from grouped
    ),
    ordered as (
      select *
      from projected
      order by
        case when order_direction = 'asc' and order_measure = 'controls' then controls end asc,
        case when order_direction = 'asc' and order_measure = 'inspected_quantity' then inspected_quantity end asc,
        case when order_direction = 'asc' and order_measure = 'defects' then defects end asc,
        case when order_direction = 'asc' and order_measure = 'dpu' then dpu end asc,
        case when order_direction = 'desc' and order_measure = 'controls' then controls end desc,
        case when order_direction = 'desc' and order_measure = 'inspected_quantity' then inspected_quantity end desc,
        case when order_direction = 'desc' and order_measure = 'defects' then defects end desc,
        case when order_direction = 'desc' and order_measure = 'dpu' then dpu end desc,
        customer_label asc nulls last,
        product_label asc nulls last,
        operation_label asc nulls last,
        failure_mode_label asc nulls last
      limit row_limit
    )
    select jsonb_build_object(
      'rowCount', coalesce(max(total_rows), 0),
      'truncated', coalesce(max(total_rows), 0) > row_limit,
      'totalDefects', coalesce(max(total_defects), 0),
      'rows',
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'dimensions',
            jsonb_strip_nulls(jsonb_build_object(
              'customer', case when customer_id is null then null else jsonb_build_object('id', customer_id, 'label', customer_label) end,
              'product', case when product_id is null then null else jsonb_build_object('id', product_id, 'label', product_label) end,
              'operation', case when operation_id is null then null else jsonb_build_object('id', operation_id, 'label', operation_label) end,
              'failure_mode', case when failure_mode_id is null then null else jsonb_build_object('id', failure_mode_id, 'label', failure_mode_label) end
            )),
            'measures',
            jsonb_build_object(
              'controls', controls,
              'inspected_quantity', inspected_quantity,
              'defects', defects,
              'dpu', dpu
            )
          )
        ),
        '[]'::jsonb
      )
    )
    into output
    from ordered;
  else
    with filtered_controls as (
      select
        control.id,
        control.inspected_quantity,
        customer.id as customer_id,
        customer.name as customer_label,
        product.id as product_id,
        product.code || ' - ' || product.name as product_label,
        operation.id as operation_id,
        operation.code || ' - ' || operation.name as operation_label
      from public.controls control
      join public.operations operation
        on operation.id = control.operation_id
       and operation.company_id = control.company_id
       and operation.plant_id = control.plant_id
      join public.products product
        on product.id = operation.product_id
       and product.company_id = operation.company_id
       and product.plant_id = operation.plant_id
      join public.customers customer
        on customer.id = product.customer_id
       and customer.company_id = product.company_id
       and customer.plant_id = product.plant_id
      where control.company_id = target_company_id
        and control.plant_id = target_plant_id
        and control.source_record_status = 'imported'
        and (target_date_from is null or control.date >= target_date_from)
        and (target_date_to is null or control.date <= target_date_to)
        and (target_customer_ids is null or customer.id = any(target_customer_ids))
        and (target_product_ids is null or product.id = any(target_product_ids))
        and (target_operation_ids is null or operation.id = any(target_operation_ids))
    ),
    failure_by_control as (
      select
        failure.control_id,
        sum(failure.quantity)::bigint as defects
      from public.control_failures failure
      where failure.company_id = target_company_id
        and failure.plant_id = target_plant_id
        and failure.source_record_status = 'imported'
        and (target_failure_mode_ids is null or failure.failure_mode_id = any(target_failure_mode_ids))
      group by failure.control_id
    ),
    base as (
      select
        control.*,
        coalesce(failure.defects, 0)::bigint as defects
      from filtered_controls control
      left join failure_by_control failure
        on failure.control_id = control.id
      where target_failure_mode_ids is null or failure.control_id is not null
    ),
    grouped as (
      select
        case when 'customer' = any(group_by) then customer_id end as customer_id,
        case when 'customer' = any(group_by) then max(customer_label) end as customer_label,
        case when 'product' = any(group_by) then product_id end as product_id,
        case when 'product' = any(group_by) then max(product_label) end as product_label,
        case when 'operation' = any(group_by) then operation_id end as operation_id,
        case when 'operation' = any(group_by) then max(operation_label) end as operation_label,
        null::uuid as failure_mode_id,
        null::text as failure_mode_label,
        count(*)::bigint as controls,
        coalesce(sum(inspected_quantity), 0)::bigint as inspected_quantity,
        coalesce(sum(defects), 0)::bigint as defects
      from base
      group by
        case when 'customer' = any(group_by) then customer_id end,
        case when 'product' = any(group_by) then product_id end,
        case when 'operation' = any(group_by) then operation_id end
    ),
    projected as (
      select
        *,
        case when inspected_quantity > 0 then defects::numeric / inspected_quantity else 0 end as dpu,
        count(*) over ()::bigint as total_rows,
        sum(defects) over ()::bigint as total_defects
      from grouped
    ),
    ordered as (
      select *
      from projected
      order by
        case when order_direction = 'asc' and order_measure = 'controls' then controls end asc,
        case when order_direction = 'asc' and order_measure = 'inspected_quantity' then inspected_quantity end asc,
        case when order_direction = 'asc' and order_measure = 'defects' then defects end asc,
        case when order_direction = 'asc' and order_measure = 'dpu' then dpu end asc,
        case when order_direction = 'desc' and order_measure = 'controls' then controls end desc,
        case when order_direction = 'desc' and order_measure = 'inspected_quantity' then inspected_quantity end desc,
        case when order_direction = 'desc' and order_measure = 'defects' then defects end desc,
        case when order_direction = 'desc' and order_measure = 'dpu' then dpu end desc,
        customer_label asc nulls last,
        product_label asc nulls last,
        operation_label asc nulls last
      limit row_limit
    )
    select jsonb_build_object(
      'rowCount', coalesce(max(total_rows), 0),
      'truncated', coalesce(max(total_rows), 0) > row_limit,
      'totalDefects', coalesce(max(total_defects), 0),
      'rows',
      coalesce(
        jsonb_agg(
          jsonb_build_object(
            'dimensions',
            jsonb_strip_nulls(jsonb_build_object(
              'customer', case when customer_id is null then null else jsonb_build_object('id', customer_id, 'label', customer_label) end,
              'product', case when product_id is null then null else jsonb_build_object('id', product_id, 'label', product_label) end,
              'operation', case when operation_id is null then null else jsonb_build_object('id', operation_id, 'label', operation_label) end,
              'failure_mode', case when failure_mode_id is null then null else jsonb_build_object('id', failure_mode_id, 'label', failure_mode_label) end
            )),
            'measures',
            jsonb_build_object(
              'controls', controls,
              'inspected_quantity', inspected_quantity,
              'defects', defects,
              'dpu', dpu
            )
          )
        ),
        '[]'::jsonb
      )
    )
    into output
    from ordered;
  end if;

  return coalesce(output, jsonb_build_object(
    'rows', '[]'::jsonb,
    'rowCount', 0,
    'truncated', false,
    'totalDefects', 0
  ));
end;
$$;

grant execute on function public.da_05_controlled_quality_analysis(
  uuid, uuid, date, date, text[], text[], uuid[], uuid[], uuid[], uuid[], text, text, integer
) to authenticated;
