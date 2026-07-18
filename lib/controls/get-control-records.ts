import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveTenantContext } from "@/lib/tenant/context";
import type {
  ControlFailure,
  ControlHistoryData,
  ControlHistoryFilters,
  ControlHistoryOptions,
  ControlRecord,
  ControlsViewData,
  FailureModeRef,
  ImportFileRef,
} from "./types";

type DataScope = {
  companyId: string;
  companyName: string;
  plantId: string;
  plantName: string;
};

type ControlRow = Omit<ControlRecord, "operations" | "control_failures" | "import_files">;
type ControlFailureRow = Omit<ControlFailure, "failure_modes"> & {
  control_id: string;
};
type OperationRow = {
  id: string;
  product_id: string;
  code: string;
  name: string;
};
type ProductRow = {
  id: string;
  customer_id: string;
  code: string;
  name: string;
};
type CustomerRow = {
  id: string;
  name: string;
};

const PAGE_SIZE = 1000;
const HISTORY_PAGE_SIZE = 200;

export function defaultControlHistoryFilters(
  input: Partial<Record<keyof ControlHistoryFilters, string | number | undefined>> = {},
): ControlHistoryFilters {
  const dateTo = stringValue(input.dateTo);
  const dateFrom = stringValue(input.dateFrom) || (dateTo ? dateKeyDaysBefore(dateTo, 13) : "");

  return {
    dateFrom,
    dateTo,
    customerId: stringValue(input.customerId),
    productId: stringValue(input.productId),
    operationId: stringValue(input.operationId),
    failureModeId: stringValue(input.failureModeId),
    page: Math.max(1, numberValue(input.page, 1)),
    pageSize: Math.min(Math.max(1, numberValue(input.pageSize, HISTORY_PAGE_SIZE)), HISTORY_PAGE_SIZE),
  };
}

export async function getControlRecordsData(
  supabase: SupabaseClient,
  options: { controlId?: string } = {},
): Promise<ControlsViewData> {
  try {
    const context = await getActiveTenantContext(supabase);
    if (context.status !== "ready") {
      return {
        status: context.status,
        tenant: null,
        controls: [],
        error: context.message,
      };
    }

    const scope: DataScope = {
      companyId: context.company.id,
      companyName: context.company.name,
      plantId: context.plant.id,
      plantName: context.plant.name,
    };

    const [controls, operations, products, customers, failureModes, importFiles] = await Promise.all([
      fetchControls(supabase, scope, options.controlId),
      fetchOperations(supabase, scope),
      fetchProducts(supabase, scope),
      fetchCustomers(supabase, scope),
      fetchFailureModes(supabase, scope),
      fetchImportFiles(supabase, scope),
    ]);

    const controlFailures = await fetchControlFailures(supabase, scope, options.controlId);

    return {
      status: "ready",
      tenant: {
        companyId: context.company.id,
        companyName: context.company.name,
        plantId: context.plant.id,
        plantName: context.plant.name,
        role: context.role,
      },
      controls: composeControls({
        scope,
        controls,
        operations,
        products,
        customers,
        failureModes,
        controlFailures,
        importFiles,
      }),
      error: "",
    };
  } catch (error) {
    return {
      status: "error",
      tenant: null,
      controls: [],
      error: getErrorMessage(error),
    };
  }
}

export async function getControlHistoryPageData(
  supabase: SupabaseClient,
  filters: ControlHistoryFilters,
): Promise<ControlHistoryData> {
  try {
    const context = await getActiveTenantContext(supabase);
    if (context.status !== "ready") {
      return emptyHistoryData(context.status, context.message, filters);
    }

    const resolvedFilters = await resolveHistoryDateRange(supabase, {
      companyId: context.company.id,
      companyName: context.company.name,
      plantId: context.plant.id,
      plantName: context.plant.name,
    }, filters);

    const { data, error } = await supabase.rpc("da_03_control_history_page", {
      target_company_id: context.company.id,
      target_plant_id: context.plant.id,
      target_date_from: resolvedFilters.dateFrom,
      target_date_to: resolvedFilters.dateTo,
      target_customer_id: resolvedFilters.customerId || null,
      target_product_id: resolvedFilters.productId || null,
      target_operation_id: resolvedFilters.operationId || null,
      target_failure_mode_id: resolvedFilters.failureModeId || null,
      target_page: resolvedFilters.page,
      target_page_size: resolvedFilters.pageSize,
    });

    if (error) {
      throw new Error(`No se pudo cargar el historial paginado: ${error.message}`);
    }

    const page = normalizeHistoryPage(data);
    const options = await fetchHistoryOptions(supabase, {
      companyId: context.company.id,
      companyName: context.company.name,
      plantId: context.plant.id,
      plantName: context.plant.name,
    });

    return {
      status: "ready",
      tenant: {
        companyId: context.company.id,
        companyName: context.company.name,
        plantId: context.plant.id,
        plantName: context.plant.name,
        role: context.role,
      },
      controls: page.controls,
      total: page.total,
      page: page.page,
      pageSize: page.pageSize,
      filters: resolvedFilters,
      options,
      transferredRows: page.controls.length,
      error: "",
    };
  } catch (error) {
    return emptyHistoryData("error", getErrorMessage(error), filters);
  }
}

async function resolveHistoryDateRange(
  supabase: SupabaseClient,
  scope: DataScope,
  filters: ControlHistoryFilters,
): Promise<ControlHistoryFilters> {
  if (filters.dateFrom && filters.dateTo) return filters;

  const dateTo = filters.dateTo || toDateKey(new Date());
  const dateFrom = filters.dateFrom || dateKeyDaysBefore(dateTo, 13);

  return {
    ...filters,
    dateFrom,
    dateTo,
  };
}

async function fetchHistoryOptions(
  supabase: SupabaseClient,
  scope: DataScope,
): Promise<ControlHistoryOptions> {
  const [customers, products, operations, failureModes] = await Promise.all([
    fetchCustomers(supabase, scope),
    fetchProducts(supabase, scope),
    fetchOperations(supabase, scope),
    fetchFailureModesWithOperation(supabase, scope),
  ]);

  return {
    customers: customers.map((customer) => ({ id: customer.id, name: customer.name })),
    products,
    operations,
    failureModes,
  };
}

async function fetchFailureModesWithOperation(
  supabase: SupabaseClient,
  scope: DataScope,
): Promise<Array<{ id: string; name: string; operation_id: string }>> {
  const { data, error } = await supabase
    .from("failure_modes")
    .select("id, name, operation_id")
    .eq("company_id", scope.companyId)
    .eq("plant_id", scope.plantId)
    .eq("source_record_status", "imported")
    .order("name", { ascending: true });

  if (error) throw new Error(`No se pudieron leer modos de falla: ${error.message}`);
  return (data ?? []) as unknown as Array<{ id: string; name: string; operation_id: string }>;
}

function normalizeHistoryPage(value: unknown): {
  controls: ControlRecord[];
  total: number;
  page: number;
  pageSize: number;
} {
  const item = value as {
    rows?: unknown;
    total?: unknown;
    page?: unknown;
    pageSize?: unknown;
  } | null;

  return {
    controls: Array.isArray(item?.rows) ? (item.rows as ControlRecord[]) : [],
    total: numberValue(item?.total, 0),
    page: numberValue(item?.page, 1),
    pageSize: numberValue(item?.pageSize, HISTORY_PAGE_SIZE),
  };
}

function emptyHistoryData(
  status: "unauthenticated" | "unauthorized" | "error",
  error: string,
  filters: ControlHistoryFilters,
): ControlHistoryData {
  return {
    status,
    tenant: null,
    controls: [],
    total: 0,
    page: filters.page,
    pageSize: filters.pageSize,
    filters,
    options: {
      customers: [],
      products: [],
      operations: [],
      failureModes: [],
    },
    transferredRows: 0,
    error,
  };
}

async function fetchControls(
  supabase: SupabaseClient,
  scope: DataScope,
  controlId?: string,
): Promise<ControlRow[]> {
  const rows: ControlRow[] = [];
  let lastId = "";

  for (;;) {
    let query = supabase
      .from("controls")
      .select(
        [
          "id",
          "company_id",
          "plant_id",
          "operation_id",
          "date",
          "shift",
          "operator",
          "inspected_quantity",
          "observations",
          "created_at",
          "updated_at",
          "import_batch_id",
          "import_file_id",
          "source_record_id",
          "source_id",
          "source_sheet_name",
          "source_row_number",
          "source_cell_address",
          "mapping_id",
          "mapping_version",
          "source_record_status",
        ].join(", "),
      )
      .eq("company_id", scope.companyId)
      .eq("plant_id", scope.plantId)
      .eq("source_record_status", "imported")
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (controlId) query = query.eq("id", controlId);
    if (lastId) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw new Error(`No se pudieron leer controles: ${error.message}`);

    const page = (data ?? []) as unknown as ControlRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE || controlId) break;
    lastId = page[page.length - 1].id;
  }
  return rows;
}

async function fetchControlFailures(
  supabase: SupabaseClient,
  scope: DataScope,
  controlId?: string,
): Promise<ControlFailureRow[]> {
  const rows: ControlFailureRow[] = [];
  let lastId = "";

  for (;;) {
    let query = supabase
      .from("control_failures")
      .select(
        [
          "id",
          "control_id",
          "failure_mode_id",
          "quantity",
          "source_sheet_name",
          "source_row_number",
          "source_cell_address",
          "source_record_id",
        ].join(", "),
      )
      .eq("company_id", scope.companyId)
      .eq("plant_id", scope.plantId)
      .eq("source_record_status", "imported")
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (controlId) query = query.eq("control_id", controlId);
    if (lastId) query = query.gt("id", lastId);

    const { data, error } = await query;
    if (error) throw new Error(`No se pudieron leer fallas de controles: ${error.message}`);

    const page = (data ?? []) as unknown as ControlFailureRow[];
    rows.push(...page);
    if (page.length < PAGE_SIZE || controlId) break;
    lastId = page[page.length - 1].id;
  }
  return rows;
}

async function fetchOperations(supabase: SupabaseClient, scope: DataScope): Promise<OperationRow[]> {
  const { data, error } = await supabase
    .from("operations")
    .select("id, product_id, code, name")
    .eq("company_id", scope.companyId)
    .eq("plant_id", scope.plantId)
    .eq("source_record_status", "imported")
    .order("code", { ascending: true });

  if (error) throw new Error(`No se pudieron leer operaciones: ${error.message}`);
  return (data ?? []) as unknown as OperationRow[];
}

async function fetchProducts(supabase: SupabaseClient, scope: DataScope): Promise<ProductRow[]> {
  const { data, error } = await supabase
    .from("products")
    .select("id, customer_id, code, name")
    .eq("company_id", scope.companyId)
    .eq("plant_id", scope.plantId)
    .eq("source_record_status", "imported")
    .order("code", { ascending: true });

  if (error) throw new Error(`No se pudieron leer piezas: ${error.message}`);
  return (data ?? []) as unknown as ProductRow[];
}

async function fetchCustomers(supabase: SupabaseClient, scope: DataScope): Promise<CustomerRow[]> {
  const { data, error } = await supabase
    .from("customers")
    .select("id, name")
    .eq("company_id", scope.companyId)
    .eq("plant_id", scope.plantId)
    .eq("source_record_status", "imported")
    .order("name", { ascending: true });

  if (error) throw new Error(`No se pudieron leer clientes: ${error.message}`);
  return (data ?? []) as unknown as CustomerRow[];
}

async function fetchFailureModes(
  supabase: SupabaseClient,
  scope: DataScope,
): Promise<FailureModeRef[]> {
  const { data, error } = await supabase
    .from("failure_modes")
    .select("id, name")
    .eq("company_id", scope.companyId)
    .eq("plant_id", scope.plantId)
    .eq("source_record_status", "imported")
    .order("name", { ascending: true });

  if (error) throw new Error(`No se pudieron leer modos de falla: ${error.message}`);
  return (data ?? []) as unknown as FailureModeRef[];
}

async function fetchImportFiles(supabase: SupabaseClient, scope: DataScope): Promise<ImportFileRef[]> {
  const { data, error } = await supabase
    .from("import_files")
    .select("id, file_name, file_sha256")
    .eq("company_id", scope.companyId)
    .eq("plant_id", scope.plantId);

  if (error) throw new Error(`No se pudieron leer archivos de importacion: ${error.message}`);
  return (data ?? []) as unknown as ImportFileRef[];
}

function composeControls(input: {
  scope: DataScope;
  controls: ControlRow[];
  operations: OperationRow[];
  products: ProductRow[];
  customers: CustomerRow[];
  failureModes: FailureModeRef[];
  controlFailures: ControlFailureRow[];
  importFiles: ImportFileRef[];
}): ControlRecord[] {
  const customers = new Map(input.customers.map((customer) => [customer.id, customer]));
  const products = new Map(input.products.map((product) => [product.id, product]));
  const operations = new Map(input.operations.map((operation) => [operation.id, operation]));
  const failureModes = new Map(input.failureModes.map((failureMode) => [failureMode.id, failureMode]));
  const importFiles = new Map(input.importFiles.map((file) => [file.id, file]));
  const failuresByControl = new Map<string, ControlFailure[]>();

  for (const failure of input.controlFailures) {
    const items = failuresByControl.get(failure.control_id) ?? [];
    items.push({
      id: failure.id,
      failure_mode_id: failure.failure_mode_id,
      quantity: failure.quantity,
      source_sheet_name: failure.source_sheet_name,
      source_row_number: failure.source_row_number,
      source_cell_address: failure.source_cell_address,
      source_record_id: failure.source_record_id,
      failure_modes: failureModes.get(failure.failure_mode_id) ?? null,
    });
    failuresByControl.set(failure.control_id, items);
  }

  return input.controls.map((control) => {
    const operation = operations.get(control.operation_id) ?? null;
    const product = operation ? products.get(operation.product_id) ?? null : null;
    const customer = product ? customers.get(product.customer_id) ?? null : null;

    return {
      ...control,
      import_files: control.import_file_id ? importFiles.get(control.import_file_id) ?? null : null,
      operations: operation
        ? {
            id: operation.id,
            code: operation.code,
            name: operation.name,
            products: product
              ? {
                  id: product.id,
                  code: product.code,
                  name: product.name,
                  customers: customer
                    ? {
                        id: customer.id,
                        name: customer.name,
                        plants: {
                          id: input.scope.plantId,
                          name: input.scope.plantName,
                          companies: {
                            id: input.scope.companyId,
                            name: input.scope.companyName,
                          },
                        },
                      }
                    : null,
                }
              : null,
          }
        : null,
      control_failures: failuresByControl.get(control.id) ?? [],
    };
  }).sort((left, right) => {
    const dateOrder = right.date.localeCompare(left.date);
    if (dateOrder !== 0) return dateOrder;
    return right.created_at.localeCompare(left.created_at);
  });
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Ocurrio un error inesperado.";
}

function stringValue(value: string | number | undefined) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyDaysBefore(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - days);
  return toDateKey(date);
}
