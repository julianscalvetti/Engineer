create index if not exists controls_da03_history_idx
  on public.controls (company_id, plant_id, date desc, created_at desc, id)
  where source_record_status = 'imported';

create index if not exists controls_da03_operation_history_idx
  on public.controls (company_id, plant_id, operation_id, date desc, created_at desc, id)
  where source_record_status = 'imported';

create index if not exists control_failures_da03_failure_mode_idx
  on public.control_failures (company_id, plant_id, failure_mode_id, control_id)
  where source_record_status = 'imported';

create or replace function public.da_03_dashboard_summary(
  target_company_id uuid,
  target_plant_id uuid,
  target_date_from date default null,
  target_date_to date default null,
  target_customer_id uuid default null,
  target_product_id uuid default null,
  target_operation_id uuid default null,
  target_failure_mode_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  allowed boolean;
  output jsonb;
begin
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
      'kpis', jsonb_build_object('controls', 0, 'inspectedQuantity', 0, 'defects', 0, 'dpu', 0),
      'evolution', '[]'::jsonb,
      'operationDpu', '[]'::jsonb,
      'failureRanking', '[]'::jsonb,
      'todaySummary', jsonb_build_object('controls', 0, 'inspectedQuantity', 0, 'defects', 0, 'dpu', 0)
    );
  end if;

  select jsonb_build_object(
    'kpis',
    (
      select jsonb_build_object(
        'controls', control_totals.controls_count,
        'inspectedQuantity', control_totals.inspected_quantity,
        'defects', failure_totals.defects,
        'dpu', case
          when control_totals.inspected_quantity > 0
          then failure_totals.defects::numeric / control_totals.inspected_quantity
          else 0
        end
      )
      from (
        select
          count(*)::bigint as controls_count,
          coalesce(sum(control.inspected_quantity), 0)::bigint as inspected_quantity
        from public.controls control
        where control.company_id = target_company_id
          and control.plant_id = target_plant_id
          and control.source_record_status = 'imported'
          and (target_date_from is null or control.date >= target_date_from)
          and (target_date_to is null or control.date <= target_date_to)
          and (target_operation_id is null or control.operation_id = target_operation_id)
      ) control_totals
      cross join (
        select coalesce(sum(failure.quantity), 0)::bigint as defects
        from public.control_failures failure
        join public.controls control
          on control.id = failure.control_id
         and control.company_id = failure.company_id
         and control.plant_id = failure.plant_id
        where failure.company_id = target_company_id
          and failure.plant_id = target_plant_id
          and failure.source_record_status = 'imported'
          and control.source_record_status = 'imported'
          and (target_date_from is null or control.date >= target_date_from)
          and (target_date_to is null or control.date <= target_date_to)
          and (target_operation_id is null or control.operation_id = target_operation_id)
      ) failure_totals
    ),
    'evolution',
    coalesce(
      (
        with control_by_date as (
          select
            control.date,
            count(*)::bigint as controls_count,
            coalesce(sum(control.inspected_quantity), 0)::bigint as inspected_quantity
          from public.controls control
          where control.company_id = target_company_id
            and control.plant_id = target_plant_id
            and control.source_record_status = 'imported'
            and (target_date_from is null or control.date >= target_date_from)
            and (target_date_to is null or control.date <= target_date_to)
            and (target_operation_id is null or control.operation_id = target_operation_id)
          group by control.date
        ),
        failure_by_date as (
          select
            control.date,
            coalesce(sum(failure.quantity), 0)::bigint as defects
          from public.control_failures failure
          join public.controls control
            on control.id = failure.control_id
           and control.company_id = failure.company_id
           and control.plant_id = failure.plant_id
          where failure.company_id = target_company_id
            and failure.plant_id = target_plant_id
            and failure.source_record_status = 'imported'
            and control.source_record_status = 'imported'
            and (target_date_from is null or control.date >= target_date_from)
            and (target_date_to is null or control.date <= target_date_to)
            and (target_operation_id is null or control.operation_id = target_operation_id)
          group by control.date
        )
        select jsonb_agg(
          jsonb_build_object(
            'label', control_by_date.date::text,
            'controls', control_by_date.controls_count,
            'inspectedQuantity', control_by_date.inspected_quantity,
            'defects', coalesce(failure_by_date.defects, 0),
            'dpu', case
              when control_by_date.inspected_quantity > 0
              then coalesce(failure_by_date.defects, 0)::numeric / control_by_date.inspected_quantity
              else 0
            end
          )
          order by control_by_date.date
        )
        from control_by_date
        left join failure_by_date
          on failure_by_date.date = control_by_date.date
      ),
      '[]'::jsonb
    ),
    'operationDpu',
    coalesce(
      (
        with control_by_operation as (
          select
            control.operation_id,
            count(*)::bigint as controls_count,
            coalesce(sum(control.inspected_quantity), 0)::bigint as inspected_quantity
          from public.controls control
          where control.company_id = target_company_id
            and control.plant_id = target_plant_id
            and control.source_record_status = 'imported'
            and (target_date_from is null or control.date >= target_date_from)
            and (target_date_to is null or control.date <= target_date_to)
            and (target_operation_id is null or control.operation_id = target_operation_id)
          group by control.operation_id
        ),
        failure_by_operation as (
          select
            control.operation_id,
            coalesce(sum(failure.quantity), 0)::bigint as defects
          from public.control_failures failure
          join public.controls control
            on control.id = failure.control_id
           and control.company_id = failure.company_id
           and control.plant_id = failure.plant_id
          where failure.company_id = target_company_id
            and failure.plant_id = target_plant_id
            and failure.source_record_status = 'imported'
            and control.source_record_status = 'imported'
            and (target_date_from is null or control.date >= target_date_from)
            and (target_date_to is null or control.date <= target_date_to)
            and (target_operation_id is null or control.operation_id = target_operation_id)
          group by control.operation_id
        )
        select jsonb_agg(
          jsonb_build_object(
            'operationId', control_by_operation.operation_id,
            'label', operation.code || ' - ' || operation.name,
            'inspectedQuantity', control_by_operation.inspected_quantity,
            'defects', coalesce(control_by_operation.defects, 0),
            'value', case
              when control_by_operation.inspected_quantity > 0
              then coalesce(control_by_operation.defects, 0)::numeric / control_by_operation.inspected_quantity
              else 0
            end
          )
        )
        from (
          select *
          from control_by_operation
          left join failure_by_operation using (operation_id)
          order by case
            when inspected_quantity > 0 then coalesce(defects, 0)::numeric / inspected_quantity
            else 0
          end desc
          limit 10
        ) control_by_operation
        join public.operations operation
          on operation.id = control_by_operation.operation_id
         and operation.company_id = target_company_id
         and operation.plant_id = target_plant_id
      ),
      '[]'::jsonb
    ),
    'failureRanking',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'failureModeId', ranked.failure_mode_id,
            'label', ranked.name,
            'quantity', ranked.quantity
          )
        )
        from (
          select
            failure.failure_mode_id,
            failure_mode.name,
            sum(failure.quantity)::bigint as quantity
          from public.control_failures failure
          join public.failure_modes failure_mode
            on failure_mode.id = failure.failure_mode_id
           and failure_mode.company_id = failure.company_id
           and failure_mode.plant_id = failure.plant_id
          where failure.company_id = target_company_id
            and failure.plant_id = target_plant_id
            and failure.source_record_status = 'imported'
          group by failure.failure_mode_id, failure_mode.name
          order by sum(failure.quantity) desc, failure_mode.name
          limit 10
        ) ranked
      ),
      '[]'::jsonb
    ),
    'todaySummary',
    (
      select jsonb_build_object(
        'controls', control_totals.controls_count,
        'inspectedQuantity', control_totals.inspected_quantity,
        'defects', failure_totals.defects,
        'dpu', case
          when control_totals.inspected_quantity > 0
          then failure_totals.defects::numeric / control_totals.inspected_quantity
          else 0
        end
      )
      from (
        select
          count(*)::bigint as controls_count,
          coalesce(sum(control.inspected_quantity), 0)::bigint as inspected_quantity
        from public.controls control
        where control.company_id = target_company_id
          and control.plant_id = target_plant_id
          and control.source_record_status = 'imported'
          and control.date = current_date
      ) control_totals
      cross join (
        select coalesce(sum(failure.quantity), 0)::bigint as defects
        from public.control_failures failure
        join public.controls control
          on control.id = failure.control_id
         and control.company_id = failure.company_id
         and control.plant_id = failure.plant_id
        where failure.company_id = target_company_id
          and failure.plant_id = target_plant_id
          and failure.source_record_status = 'imported'
          and control.source_record_status = 'imported'
          and control.date = current_date
      ) failure_totals
    )
  )
  into output;

  return output;
end;
$$;


create or replace function public.da_03_control_history_page(
  target_company_id uuid,
  target_plant_id uuid,
  target_date_from date,
  target_date_to date,
  target_customer_id uuid default null,
  target_product_id uuid default null,
  target_operation_id uuid default null,
  target_failure_mode_id uuid default null,
  target_page integer default 1,
  target_page_size integer default 200
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with access as (
  select exists (
    select 1
    from public.company_members member
    where member.company_id = target_company_id
      and member.user_id = auth.uid()
      and member.active = true
      and member.role in ('owner', 'engineer', 'operator')
  ) as allowed
),
input as (
  select
    greatest(coalesce(target_page, 1), 1) as page_number,
    least(greatest(coalesce(target_page_size, 200), 1), 200) as page_size
),
filtered_controls as (
  select
    control.id,
    control.company_id,
    control.plant_id,
    control.operation_id,
    control.date,
    control.shift,
    control.operator,
    control.inspected_quantity,
    control.observations,
    control.created_at,
    control.updated_at,
    control.import_batch_id,
    control.import_file_id,
    control.source_record_id,
    control.source_id,
    control.source_sheet_name,
    control.source_row_number,
    control.source_cell_address,
    control.mapping_id,
    control.mapping_version,
    control.source_record_status,
    operation.code as operation_code,
    operation.name as operation_name,
    product.id as product_id,
    product.code as product_code,
    product.name as product_name,
    customer.id as customer_id,
    customer.name as customer_name
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
    and (select allowed from access)
    and control.date >= target_date_from
    and control.date <= target_date_to
    and (target_customer_id is null or customer.id = target_customer_id)
    and (target_product_id is null or product.id = target_product_id)
    and (target_operation_id is null or operation.id = target_operation_id)
    and (
      target_failure_mode_id is null
      or exists (
        select 1
        from public.control_failures failure_filter
        where failure_filter.control_id = control.id
          and failure_filter.company_id = control.company_id
          and failure_filter.plant_id = control.plant_id
          and failure_filter.failure_mode_id = target_failure_mode_id
          and failure_filter.source_record_status = 'imported'
      )
    )
),
total as (
  select count(*)::bigint as row_count
  from filtered_controls
),
page_controls as (
  select filtered_controls.*
  from filtered_controls, input
  order by filtered_controls.date desc, filtered_controls.created_at desc, filtered_controls.id
  limit (select page_size from input)
  offset ((select page_number - 1 from input) * (select page_size from input))
)
select jsonb_build_object(
  'total', (select row_count from total),
  'page', (select page_number from input),
  'pageSize', (select page_size from input),
  'rows',
  coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'id', control.id,
          'company_id', control.company_id,
          'plant_id', control.plant_id,
          'operation_id', control.operation_id,
          'date', control.date,
          'shift', control.shift,
          'operator', control.operator,
          'inspected_quantity', control.inspected_quantity,
          'observations', control.observations,
          'created_at', control.created_at,
          'updated_at', control.updated_at,
          'import_batch_id', control.import_batch_id,
          'import_file_id', control.import_file_id,
          'source_record_id', control.source_record_id,
          'source_id', control.source_id,
          'source_sheet_name', control.source_sheet_name,
          'source_row_number', control.source_row_number,
          'source_cell_address', control.source_cell_address,
          'mapping_id', control.mapping_id,
          'mapping_version', control.mapping_version,
          'source_record_status', control.source_record_status,
          'import_files',
          (
            select jsonb_build_object(
              'id', import_file.id,
              'file_name', import_file.file_name,
              'file_sha256', import_file.file_sha256
            )
            from public.import_files import_file
            where import_file.id = control.import_file_id
              and import_file.company_id = control.company_id
          ),
          'operations',
          jsonb_build_object(
            'id', control.operation_id,
            'code', control.operation_code,
            'name', control.operation_name,
            'products',
            jsonb_build_object(
              'id', control.product_id,
              'code', control.product_code,
              'name', control.product_name,
              'customers',
              jsonb_build_object(
                'id', control.customer_id,
                'name', control.customer_name,
                'plants',
                jsonb_build_object(
                  'id', target_plant_id,
                  'name', (select plant.name from public.plants plant where plant.id = target_plant_id),
                  'companies',
                  jsonb_build_object(
                    'id', target_company_id,
                    'name', (select company.name from public.companies company where company.id = target_company_id)
                  )
                )
              )
            )
          ),
          'control_failures',
          coalesce(
            (
              select jsonb_agg(
                jsonb_build_object(
                  'id', failure.id,
                  'failure_mode_id', failure.failure_mode_id,
                  'quantity', failure.quantity,
                  'source_sheet_name', failure.source_sheet_name,
                  'source_row_number', failure.source_row_number,
                  'source_cell_address', failure.source_cell_address,
                  'source_record_id', failure.source_record_id,
                  'failure_modes',
                  jsonb_build_object(
                    'id', failure_mode.id,
                    'name', failure_mode.name
                  )
                )
                order by failure_mode.name
              )
              from public.control_failures failure
              join public.failure_modes failure_mode
                on failure_mode.id = failure.failure_mode_id
               and failure_mode.company_id = failure.company_id
               and failure_mode.plant_id = failure.plant_id
              where failure.control_id = control.id
                and failure.company_id = control.company_id
                and failure.plant_id = control.plant_id
                and failure.source_record_status = 'imported'
            ),
            '[]'::jsonb
          )
        )
        order by control.date desc, control.created_at desc, control.id
      )
      from page_controls control
    ),
    '[]'::jsonb
  )
);
$$;


grant execute on function public.da_03_dashboard_summary(
  uuid, uuid, date, date, uuid, uuid, uuid, uuid
) to authenticated;
grant execute on function public.da_03_control_history_page(
  uuid, uuid, date, date, uuid, uuid, uuid, uuid, integer, integer
) to authenticated;
