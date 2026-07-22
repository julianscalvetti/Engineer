import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { EntityPlanItem, ImportDryRunPlan } from "./dry-run";

export interface CommitInput {
  supabase: SupabaseClient;
  plan: ImportDryRunPlan;
  companyId: string;
  plantId: string;
  ownerUserId: string;
  expectedCounts: CommitCounts;
  chunkSize?: number;
}

export interface CommitCounts {
  customers: number;
  products: number;
  operations: number;
  failure_modes: number;
  controls: number;
  control_failures: number;
  import_issues: number;
}

export interface CommitResult {
  batch_id: string;
  final_status: "committed" | "failed";
  idempotent: boolean;
  counts: CommitCounts;
  expected: CommitCounts;
  differences: Record<string, { expected: number; actual: number }>;
  owner_read_validation: {
    checked: boolean;
    readable: boolean;
    reason?: string;
  };
}

interface BatchRow {
  id: string;
  status: string;
}

const DEFAULT_CHUNK_SIZE = 500;

export async function commitImportPlan(input: CommitInput): Promise<CommitResult> {
  const chunkSize = input.chunkSize ?? DEFAULT_CHUNK_SIZE;
  assertPlanScope(input.plan, input.companyId, input.plantId);
  await assertBootstrapState(input);

  const existingCommitted = await findCommittedBatch(input);
  if (existingCommitted) {
    const counts = await countBatch(input.supabase, existingCommitted.id);
    const differences = diffCounts(input.expectedCounts, counts);
    return {
      batch_id: existingCommitted.id,
      final_status: existingCommitted.status === "committed" ? "committed" : "failed",
      idempotent: Object.keys(differences).length === 0,
      counts,
      expected: input.expectedCounts,
      differences,
      owner_read_validation: await validateOwnerReadable(input.supabase, input.companyId, input.ownerUserId),
    };
  }

  const batch = await createBatch(input);
  let importFileId = "";

  try {
    importFileId = await createImportFile(input, batch.id);
    const customerIds = await upsertCustomers(input, batch.id, importFileId, chunkSize);
    const productIds = await upsertProducts(input, batch.id, importFileId, customerIds, chunkSize);
    const operationIds = await upsertOperations(input, batch.id, importFileId, productIds, chunkSize);
    const failureModeIds = await upsertFailureModes(input, batch.id, importFileId, operationIds, chunkSize);
    const controlIds = await insertControls(input, batch.id, importFileId, operationIds, chunkSize);
    await insertControlFailures(input, batch.id, importFileId, controlIds, failureModeIds, chunkSize);
    await insertImportIssues(input, batch.id, importFileId, chunkSize);

    const counts = await countBatch(input.supabase, batch.id);
    const differences = diffCounts(input.expectedCounts, counts);
    if (Object.keys(differences).length > 0) {
      await markBatchFailed(input.supabase, batch.id, `Reconciliation failed: ${JSON.stringify(differences)}`);
      return {
        batch_id: batch.id,
        final_status: "failed",
        idempotent: false,
        counts,
        expected: input.expectedCounts,
        differences,
        owner_read_validation: await validateOwnerReadable(input.supabase, input.companyId, input.ownerUserId),
      };
    }

    await updateBatch(input.supabase, batch.id, {
      status: "committed",
      committed_at: new Date().toISOString(),
      source_record_status: "imported",
      source_file_count: 1,
      source_record_count: totalSourceRecords(input.plan),
      issue_count: input.expectedCounts.import_issues,
      notes: "DA-02A ROMET import committed through service-role API.",
    });

    return {
      batch_id: batch.id,
      final_status: "committed",
      idempotent: false,
      counts,
      expected: input.expectedCounts,
      differences,
      owner_read_validation: await validateOwnerReadable(input.supabase, input.companyId, input.ownerUserId),
    };
  } catch (error) {
    await markBatchFailed(input.supabase, batch.id, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

function assertPlanScope(plan: ImportDryRunPlan, companyId: string, plantId: string): void {
  if (plan.mode !== "dry_run") throw new Error("Only dry-run plans can be committed.");
  if (plan.company_id && plan.company_id !== companyId) throw new Error("Plan company_id does not match commit company_id.");
  if (plan.plant_id && plan.plant_id !== plantId) throw new Error("Plan plant_id does not match commit plant_id.");
}

async function assertBootstrapState(input: CommitInput): Promise<void> {
  const { data: company, error: companyError } = await input.supabase
    .from("companies")
    .select("id, name, active")
    .eq("id", input.companyId)
    .eq("name", "ROMET")
    .single();
  if (companyError || !company?.active) throw new Error("ROMET company is missing or inactive.");

  const { data: plant, error: plantError } = await input.supabase
    .from("plants")
    .select("id, company_id, name, active")
    .eq("id", input.plantId)
    .eq("company_id", input.companyId)
    .eq("name", "Planta Principal")
    .single();
  if (plantError || !plant?.active) throw new Error("ROMET main plant is missing or inactive.");

  const { data: membership, error: membershipError } = await input.supabase
    .from("company_members")
    .select("company_id, user_id, role, active")
    .eq("company_id", input.companyId)
    .eq("user_id", input.ownerUserId)
    .eq("role", "owner")
    .eq("active", true)
    .single();
  if (membershipError || !membership) throw new Error("ROMET owner membership is missing.");
}

async function findCommittedBatch(input: CommitInput): Promise<BatchRow | null> {
  const { data, error } = await input.supabase
    .from("import_batches")
    .select("id, status")
    .eq("company_id", input.companyId)
    .eq("plant_id", input.plantId)
    .eq("mapping_id", input.plan.mapping.mapping_id)
    .eq("mapping_version", input.plan.mapping.mapping_version)
    .eq("status", "committed")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error) throw new Error(`Could not query committed import batches: ${error.message}`);

  for (const batch of data ?? []) {
    const { data: files, error: filesError } = await input.supabase
      .from("import_files")
      .select("id")
      .eq("import_batch_id", batch.id)
      .eq("file_sha256", input.plan.source_file.sha256)
      .limit(1);
    if (filesError) throw new Error(`Could not query import files: ${filesError.message}`);
    if ((files ?? []).length > 0) return batch as BatchRow;
  }

  return null;
}

async function createBatch(input: CommitInput): Promise<BatchRow> {
  const { data, error } = await input.supabase
    .from("import_batches")
    .insert({
      company_id: input.companyId,
      plant_id: input.plantId,
      mapping_id: input.plan.mapping.mapping_id,
      mapping_version: input.plan.mapping.mapping_version,
      status: "committing",
      source_file_count: 1,
      source_record_count: totalSourceRecords(input.plan),
      issue_count: input.expectedCounts.import_issues,
      import_plan: {
        source_file: input.plan.source_file,
        mapping: input.plan.mapping,
        expected_counts: input.expectedCounts,
        plan_hash: hashPlan(input.plan),
      },
      import_plan_hash: hashPlan(input.plan),
      notes: "DA-02A ROMET import started through service-role API.",
    })
    .select("id, status")
    .single();
  if (error) throw new Error(`Could not create import batch: ${error.message}`);
  return data as BatchRow;
}

async function createImportFile(input: CommitInput, batchId: string): Promise<string> {
  const { data, error } = await input.supabase
    .from("import_files")
    .upsert(
      {
        import_batch_id: batchId,
        company_id: input.companyId,
        plant_id: input.plantId,
        file_name: input.plan.source_file.file_name,
        file_sha256: input.plan.source_file.sha256,
        storage_path: input.plan.source_file.path,
        mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        mapping_id: input.plan.mapping.mapping_id,
        mapping_version: input.plan.mapping.mapping_version,
        status: "mapped",
      },
      { onConflict: "company_id,import_batch_id,file_sha256" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`Could not register import file: ${error.message}`);
  return data.id as string;
}

async function upsertCustomers(
  input: CommitInput,
  batchId: string,
  importFileId: string,
  chunkSize: number,
): Promise<Map<string, string>> {
  const rows = input.plan.entities.customers.map((item) => ({
    company_id: input.companyId,
    plant_id: input.plantId,
    name: String(item.values.name),
    active: true,
    ...traceColumns(input, batchId, importFileId, item),
  }));
  await upsertChunks(input.supabase, "customers", rows, "company_id,plant_id,name", chunkSize);
  return fetchKeyMap(input.supabase, "customers", "name", input.companyId, input.plantId);
}

async function upsertProducts(
  input: CommitInput,
  batchId: string,
  importFileId: string,
  customerIds: Map<string, string>,
  chunkSize: number,
): Promise<Map<string, string>> {
  const rows = input.plan.entities.products.map((item) => {
    const customerId = requiredMapValue(customerIds, resolveProductCustomerKey(input.plan, item), "customer");
    return {
      company_id: input.companyId,
      plant_id: input.plantId,
      customer_id: customerId,
      code: item.key,
      name: String(item.values.name),
      active: true,
      ...traceColumns(input, batchId, importFileId, item),
    };
  });
  await upsertChunks(input.supabase, "products", rows, "company_id,plant_id,customer_id,code", chunkSize);
  return fetchKeyMap(input.supabase, "products", "code", input.companyId, input.plantId);
}

function resolveProductCustomerKey(plan: ImportDryRunPlan, item: EntityPlanItem): string {
  const customerKey = String(item.values.customer_key ?? "").trim();
  if (customerKey) return customerKey;

  const previousProduct = [...plan.entities.products]
    .filter(
      (candidate) =>
        candidate.source_sheet_name === item.source_sheet_name &&
        candidate.source_row_number < item.source_row_number &&
        String(candidate.values.customer_key ?? "").trim(),
    )
    .sort((left, right) => right.source_row_number - left.source_row_number)[0];

  if (!previousProduct) return "";
  return String(previousProduct.values.customer_key ?? "").trim();
}

async function upsertOperations(
  input: CommitInput,
  batchId: string,
  importFileId: string,
  productIds: Map<string, string>,
  chunkSize: number,
): Promise<Map<string, string>> {
  const rows = input.plan.entities.operations.map((item) => {
    const productKey = String(item.values.product_key);
    const productId = requiredMapValue(productIds, productKey, "product");
    return {
      company_id: input.companyId,
      plant_id: input.plantId,
      product_id: productId,
      code: String(item.values.code),
      name: String(item.values.name),
      ...traceColumns(input, batchId, importFileId, item),
    };
  });
  await upsertChunks(input.supabase, "operations", rows, "company_id,plant_id,product_id,code", chunkSize);
  return fetchCompositeOperationMap(input.supabase, input.companyId, input.plantId);
}

async function upsertFailureModes(
  input: CommitInput,
  batchId: string,
  importFileId: string,
  operationIds: Map<string, string>,
  chunkSize: number,
): Promise<Map<string, string>> {
  const rows = input.plan.entities.failure_modes.map((item) => {
    const operationKey = String(item.values.operation_key);
    const operationId = requiredMapValue(operationIds, operationKey, "operation");
    return {
      company_id: input.companyId,
      plant_id: input.plantId,
      operation_id: operationId,
      name: String(item.values.name),
      active: true,
      ...traceColumns(input, batchId, importFileId, item),
    };
  });
  await upsertChunks(input.supabase, "failure_modes", rows, "company_id,plant_id,operation_id,name", chunkSize);
  return fetchCompositeFailureModeMap(input.supabase, input.companyId, input.plantId);
}

async function insertControls(
  input: CommitInput,
  batchId: string,
  importFileId: string,
  operationIds: Map<string, string>,
  chunkSize: number,
): Promise<Map<string, string>> {
  await deleteByBatch(input.supabase, "controls", batchId);
  const rows = input.plan.entities.controls.map((item) => {
    const operationKey = String(item.values.operation_key);
    const operationId = requiredMapValue(operationIds, operationKey, "operation");
    return {
      company_id: input.companyId,
      plant_id: input.plantId,
      operation_id: operationId,
      date: isoDateOnly(item.values.occurred_at),
      shift: String(item.values.shift),
      operator: String(item.values.operator),
      inspected_quantity: Number(item.values.inspected_quantity),
      ...traceColumns(input, batchId, importFileId, item),
    };
  });
  const inserted = await insertChunks<{ id: string; source_record_id: string }>(
    input.supabase,
    "controls",
    rows,
    "id, source_record_id",
    chunkSize,
  );
  return new Map(inserted.map((row) => [row.source_record_id, row.id]));
}

async function insertControlFailures(
  input: CommitInput,
  batchId: string,
  importFileId: string,
  controlIds: Map<string, string>,
  failureModeIds: Map<string, string>,
  chunkSize: number,
): Promise<void> {
  await deleteByBatch(input.supabase, "control_failures", batchId);
  const rows = input.plan.entities.control_failures.map((item) => {
    const controlId = requiredMapValue(controlIds, String(item.values.control_key), "control");
    const failureModeId = requiredMapValue(failureModeIds, String(item.values.failure_mode_key), "failure_mode");
    return {
      company_id: input.companyId,
      plant_id: input.plantId,
      control_id: controlId,
      failure_mode_id: failureModeId,
      quantity: Number(item.values.quantity),
      ...traceColumns(input, batchId, importFileId, item),
    };
  });
  await insertChunks(input.supabase, "control_failures", rows, "id", chunkSize);
}

async function insertImportIssues(
  input: CommitInput,
  batchId: string,
  importFileId: string,
  chunkSize: number,
): Promise<void> {
  await deleteByBatch(input.supabase, "import_issues", batchId);
  const rows = input.plan.import_issues.map((item) => ({
    import_batch_id: batchId,
    import_file_id: importFileId,
    company_id: input.companyId,
    plant_id: input.plantId,
    mapping_id: input.plan.mapping.mapping_id,
    mapping_version: input.plan.mapping.mapping_version,
    source_record_id: item.source_record_id,
    source_id: item.source_id,
    source_sheet_name: item.source_sheet_name,
    source_row_number: item.source_row_number,
    source_cell_address: item.source_cell_address,
    target_table: targetTableForSource(item.source_id),
    issue_code: item.code,
    severity: issueSeverity(item.severity),
    status: item.severity === "pending_review" ? "open" : "accepted",
    message: item.message,
    details: {
      field: item.field,
      source_severity: item.severity,
      ...(item.details ?? {}),
    },
  }));
  await insertChunks(input.supabase, "import_issues", rows, "id", chunkSize);
}

function traceColumns(
  input: CommitInput,
  batchId: string,
  importFileId: string,
  item: EntityPlanItem,
): Record<string, unknown> {
  return {
    import_batch_id: batchId,
    import_file_id: importFileId,
    source_record_id: item.source_record_id,
    source_id: item.source_id,
    source_sheet_name: item.source_sheet_name,
    source_row_number: item.source_row_number,
    source_cell_address: item.source_cell_address,
    mapping_id: input.plan.mapping.mapping_id,
    mapping_version: input.plan.mapping.mapping_version,
    source_record_status: item.status === "warning" || item.status === "valid" ? "imported" : item.status,
  };
}

async function upsertChunks(
  supabase: SupabaseClient,
  table: string,
  rows: Array<Record<string, unknown>>,
  onConflict: string,
  chunkSize: number,
): Promise<void> {
  for (const chunk of chunks(rows, chunkSize)) {
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) throw new Error(`Could not upsert ${table}: ${error.message}`);
  }
}

async function insertChunks<T>(
  supabase: SupabaseClient,
  table: string,
  rows: Array<Record<string, unknown>>,
  selectColumns: string,
  chunkSize: number,
): Promise<T[]> {
  const output: T[] = [];
  for (const chunk of chunks(rows, chunkSize)) {
    const { data, error } = await supabase.from(table).insert(chunk).select(selectColumns);
    if (error) throw new Error(`Could not insert ${table}: ${error.message}`);
    output.push(...((data ?? []) as T[]));
  }
  return output;
}

async function fetchKeyMap(
  supabase: SupabaseClient,
  table: string,
  keyColumn: string,
  companyId: string,
  plantId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from(table)
    .select(`id, ${keyColumn}`)
    .eq("company_id", companyId)
    .eq("plant_id", plantId);
  if (error) throw new Error(`Could not fetch ${table}: ${error.message}`);
  const rows = (data ?? []) as unknown as Array<{ id: string } & Record<string, unknown>>;
  return new Map(rows.map((row) => [String(row[keyColumn]), String(row.id)]));
}

async function fetchCompositeOperationMap(
  supabase: SupabaseClient,
  companyId: string,
  plantId: string,
): Promise<Map<string, string>> {
  const productCodes = await fetchIdCodeMap(supabase, "products", companyId, plantId);
  const { data, error } = await supabase
    .from("operations")
    .select("id, product_id, code")
    .eq("company_id", companyId)
    .eq("plant_id", plantId);
  if (error) throw new Error(`Could not fetch operations: ${error.message}`);
  const map = new Map<string, string>();
  const rows = (data ?? []) as unknown as Array<{
    id: string;
    product_id: string;
    code: string;
  }>;
  for (const row of rows) {
    const productCode = productCodes.get(row.product_id);
    if (productCode) map.set(`${productCode}::${row.code}`, row.id);
  }
  return map;
}

async function fetchCompositeFailureModeMap(
  supabase: SupabaseClient,
  companyId: string,
  plantId: string,
): Promise<Map<string, string>> {
  const operationKeys = await fetchOperationIdKeyMap(supabase, companyId, plantId);
  const { data, error } = await supabase
    .from("failure_modes")
    .select("id, operation_id, name")
    .eq("company_id", companyId)
    .eq("plant_id", plantId);
  if (error) throw new Error(`Could not fetch failure modes: ${error.message}`);
  const map = new Map<string, string>();
  const rows = (data ?? []) as unknown as Array<{ id: string; operation_id: string; name: string }>;
  for (const row of rows) {
    const operationKey = operationKeys.get(row.operation_id);
    if (operationKey) map.set(`${operationKey}::${row.name}`, row.id);
  }
  return map;
}

async function fetchIdCodeMap(
  supabase: SupabaseClient,
  table: string,
  companyId: string,
  plantId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from(table)
    .select("id, code")
    .eq("company_id", companyId)
    .eq("plant_id", plantId);
  if (error) throw new Error(`Could not fetch ${table} codes: ${error.message}`);
  const rows = (data ?? []) as unknown as Array<{ id: string; code: string }>;
  return new Map(rows.map((row) => [row.id, row.code]));
}

async function fetchOperationIdKeyMap(
  supabase: SupabaseClient,
  companyId: string,
  plantId: string,
): Promise<Map<string, string>> {
  const productCodes = await fetchIdCodeMap(supabase, "products", companyId, plantId);
  const { data, error } = await supabase
    .from("operations")
    .select("id, product_id, code")
    .eq("company_id", companyId)
    .eq("plant_id", plantId);
  if (error) throw new Error(`Could not fetch operation keys: ${error.message}`);
  const rows = (data ?? []) as unknown as Array<{ id: string; product_id: string; code: string }>;
  const map = new Map<string, string>();
  for (const row of rows) {
    const productCode = productCodes.get(row.product_id);
    if (productCode) map.set(row.id, `${productCode}::${row.code}`);
  }
  return map;
}

async function countBatch(supabase: SupabaseClient, batchId: string): Promise<CommitCounts> {
  const [customers, products, operations, failureModes, controls, controlFailures, importIssues] = await Promise.all([
    countRows(supabase, "customers", batchId),
    countRows(supabase, "products", batchId),
    countRows(supabase, "operations", batchId),
    countRows(supabase, "failure_modes", batchId),
    countRows(supabase, "controls", batchId),
    countRows(supabase, "control_failures", batchId),
    countRows(supabase, "import_issues", batchId),
  ]);
  return {
    customers,
    products,
    operations,
    failure_modes: failureModes,
    controls,
    control_failures: controlFailures,
    import_issues: importIssues,
  };
}

async function countRows(supabase: SupabaseClient, table: string, batchId: string): Promise<number> {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("import_batch_id", batchId);
  if (error) throw new Error(`Could not count ${table}: ${error.message}`);
  return count ?? 0;
}

function diffCounts(expected: CommitCounts, actual: CommitCounts): Record<string, { expected: number; actual: number }> {
  const differences: Record<string, { expected: number; actual: number }> = {};
  for (const key of Object.keys(expected) as Array<keyof CommitCounts>) {
    if (expected[key] !== actual[key]) differences[key] = { expected: expected[key], actual: actual[key] };
  }
  return differences;
}

async function validateOwnerReadable(
  supabase: SupabaseClient,
  companyId: string,
  ownerUserId: string,
): Promise<CommitResult["owner_read_validation"]> {
  const { data, error } = await supabase
    .from("company_members")
    .select("company_id, user_id, role, active")
    .eq("company_id", companyId)
    .eq("user_id", ownerUserId)
    .eq("role", "owner")
    .eq("active", true)
    .single();

  if (error || !data) {
    return { checked: true, readable: false, reason: "Owner membership not visible to service-role verification." };
  }

  return {
    checked: true,
    readable: true,
    reason: "Owner has active company_members row; service-role API cannot create an authenticated user session without the owner password.",
  };
}

async function updateBatch(
  supabase: SupabaseClient,
  batchId: string,
  values: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("import_batches").update(values).eq("id", batchId);
  if (error) throw new Error(`Could not update import batch: ${error.message}`);
}

async function markBatchFailed(supabase: SupabaseClient, batchId: string, message: string): Promise<void> {
  await updateBatch(supabase, batchId, {
    status: "failed",
    notes: `DA-02A import failed: ${message}`.slice(0, 2000),
  });
}

async function deleteByBatch(supabase: SupabaseClient, table: string, batchId: string): Promise<void> {
  const { error } = await supabase.from(table).delete().eq("import_batch_id", batchId);
  if (error) throw new Error(`Could not delete existing ${table} rows for batch: ${error.message}`);
}

function requiredMapValue(map: Map<string, string>, key: string, entity: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Missing ${entity} id for key ${key}.`);
  return value;
}

function isoDateOnly(value: unknown): string {
  if (typeof value !== "string" || !value) throw new Error("Control date is missing.");
  return value.slice(0, 10);
}

function issueSeverity(severity: string): "informational" | "warning" | "error" {
  if (severity === "warning" || severity === "pending_review") return "warning";
  if (severity === "rejected") return "error";
  return "informational";
}

function targetTableForSource(sourceId: string): string | undefined {
  if (sourceId === "products") return "products";
  if (sourceId === "operations") return "operations";
  if (sourceId === "failure_modes") return "failure_modes";
  if (sourceId === "controls") return "controls";
  return undefined;
}

function chunks<T>(rows: T[], size: number): T[][] {
  const output: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    output.push(rows.slice(index, index + size));
  }
  return output;
}

function totalSourceRecords(plan: ImportDryRunPlan): number {
  return (
    plan.entities.products.length +
    plan.entities.operations.length +
    plan.entities.failure_modes.length +
    plan.entities.controls.length
  );
}

function hashPlan(plan: ImportDryRunPlan): string {
  return createHash("sha256")
    .update(
      JSON.stringify({
        source_file: plan.source_file,
        mapping: plan.mapping,
        entities: {
          customers: plan.entities.customers.length,
          products: plan.entities.products.length,
          operations: plan.entities.operations.length,
          failure_modes: plan.entities.failure_modes.length,
          controls: plan.entities.controls.length,
          control_failures: plan.entities.control_failures.length,
        },
        import_issues: plan.import_issues.length,
      }),
    )
    .digest("hex");
}
