import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { ExecutionIssue, MappedSourceRecord, MappingPreviewSummary } from "../mapping/execution-types";

export type Action = "create" | "match" | "skip" | "pending_review" | "rejected";

export interface DryRunInput {
  previewJsonlPath: string;
  previewSummaryPath: string;
  outputDirectory: string;
  companyId?: string;
  plantId?: string;
}

export interface EntityPlanItem {
  key: string;
  action: Action;
  source_record_id: string;
  source_id: string;
  source_sheet_name: string;
  source_row_number: number;
  source_cell_address?: string;
  status: MappedSourceRecord["status"];
  values: Record<string, unknown>;
}

export interface IssuePlanItem {
  code: string;
  severity: ExecutionIssue["severity"];
  message: string;
  field?: string;
  source_record_id: string;
  source_id: string;
  source_sheet_name: string;
  source_row_number: number;
  source_cell_address?: string;
  details?: Record<string, unknown>;
}

export interface ImportDryRunPlan {
  mode: "dry_run";
  commit_allowed: false;
  commit_blockers: string[];
  generated_at: string;
  company_id?: string;
  plant_id?: string;
  source_file: MappingPreviewSummary["source_file"];
  mapping: MappingPreviewSummary["mapping"];
  preview_summary_path: string;
  preview_jsonl_path: string;
  entities: {
    customers: EntityPlanItem[];
    products: EntityPlanItem[];
    operations: EntityPlanItem[];
    failure_modes: EntityPlanItem[];
    controls: EntityPlanItem[];
    control_failures: EntityPlanItem[];
  };
  import_issues: IssuePlanItem[];
}

export interface ImportDryRunSummary {
  mode: "dry_run";
  commit_allowed: false;
  commit_blockers: string[];
  generated_at: string;
  source_file: MappingPreviewSummary["source_file"];
  mapping: MappingPreviewSummary["mapping"];
  preview_counts: {
    by_source_id: Record<string, number>;
    by_entity: Record<string, number>;
    by_status: Record<string, number>;
    by_issue: Record<string, number>;
  };
  dry_run_counts: {
    by_entity: Record<string, Record<Action, number>>;
    import_issues: number;
    pending_review_records: number;
    rejected_records: number;
  };
  differences: string[];
  output_files: {
    plan_json: string;
    summary_json: string;
    summary_md: string;
  };
}

export async function executeImportDryRun(input: DryRunInput): Promise<ImportDryRunSummary> {
  const [previewSummary, records] = await Promise.all([
    readJson<MappingPreviewSummary>(input.previewSummaryPath),
    readJsonl<MappedSourceRecord>(input.previewJsonlPath),
  ]);

  const plan = buildDryRunPlan({ input, previewSummary, records });
  const summary = buildDryRunSummary({ input, previewSummary, plan });
  return writeDryRunArtifacts({ outputDirectory: input.outputDirectory, plan, summary });
}

export async function loadImportDryRunPlan(planPath: string): Promise<ImportDryRunPlan> {
  return readJson<ImportDryRunPlan>(planPath);
}

function buildDryRunPlan(input: {
  input: DryRunInput;
  previewSummary: MappingPreviewSummary;
  records: MappedSourceRecord[];
}): ImportDryRunPlan {
  const customers = new Map<string, EntityPlanItem>();
  const products = new Map<string, EntityPlanItem>();
  const operations = new Map<string, EntityPlanItem>();
  const failureModes = new Map<string, EntityPlanItem>();
  const controls: EntityPlanItem[] = [];
  const controlFailures: EntityPlanItem[] = [];
  const importIssues: IssuePlanItem[] = [];

  for (const record of input.records) {
    importIssues.push(...record.issues.map((recordIssue) => toIssuePlanItem(record, recordIssue)));

    if (record.status === "pending_review" || record.status === "rejected") {
      continue;
    }

    if (record.source_id === "products") {
      const customerName = textValue(record, "customer.name");
      const productCode = textValue(record, "product.external_code");
      const productName = textValue(record, "product.name");
      if (customerName) {
        addOnce(customers, customerName, toEntityPlanItem(record, customerName, "create", { name: customerName }));
      }
      if (productCode && productName) {
        addOnce(
          products,
          productCode,
          toEntityPlanItem(record, productCode, "create", {
            code: productCode,
            name: productName,
            customer_key: customerName,
          }),
        );
      }
    }

    if (record.source_id === "operations") {
      const productCode = textValue(record, "product.external_code");
      const operationCode = textValue(record, "operation.external_code") || textValue(record, "operation.raw_name");
      const operationName = textValue(record, "operation.raw_name") || operationCode;
      if (productCode && operationCode && operationName) {
        const key = `${productCode}::${operationCode}`;
        addOnce(
          operations,
          key,
          toEntityPlanItem(record, key, "create", {
            product_key: productCode,
            code: operationCode,
            name: operationName,
          }),
        );
      }
    }

    if (record.source_id === "failure_modes") {
      const productCode = textValue(record, "product.external_code");
      const operationCode = textValue(record, "operation.external_code") || textValue(record, "operation.raw_name");
      const failureModeName = textValue(record, "failure_mode.name");
      if (productCode && operationCode && failureModeName) {
        const key = `${productCode}::${operationCode}::${failureModeName}`;
        addOnce(
          failureModes,
          key,
          toEntityPlanItem(record, key, "create", {
            product_key: productCode,
            operation_key: `${productCode}::${operationCode}`,
            name: failureModeName,
          }),
        );
      }
    }

    if (record.source_id === "controls") {
      const controlKey = record.record_id;
      const productCode = textValue(record, "product.external_code");
      const operationCode = textValue(record, "operation.external_code") || textValue(record, "operation.raw_name");
      const failureModeName = textValue(record, "failure_mode.name");
      const failureQuantity = numberValue(record, "control_failure.quantity") ?? 0;
      const controlItem = toEntityPlanItem(record, controlKey, "create", {
        occurred_at: value(record, "control.occurred_at"),
        product_key: productCode,
        operation_key: productCode && operationCode ? `${productCode}::${operationCode}` : undefined,
        shift: value(record, "control.shift"),
        operator: value(record, "control.operator"),
        inspected_quantity: value(record, "control.inspected_quantity"),
      });
      controls.push(controlItem);

      if (failureQuantity > 0 && productCode && operationCode && failureModeName) {
        const failureModeKey = `${productCode}::${operationCode}::${failureModeName}`;
        controlFailures.push(
          toEntityPlanItem(record, `${controlKey}::${failureModeKey}`, "create", {
            control_key: controlKey,
            failure_mode_key: failureModeKey,
            quantity: failureQuantity,
          }),
        );
      }
    }
  }

  return {
    mode: "dry_run",
    commit_allowed: false,
    commit_blockers: [
      "Dry-run only: no Supabase commit requested.",
      "Supabase admin credentials are not available in this environment.",
      "RLS tests and bootstrap could not be executed here.",
    ],
    generated_at: new Date().toISOString(),
    company_id: input.input.companyId,
    plant_id: input.input.plantId,
    source_file: input.previewSummary.source_file,
    mapping: input.previewSummary.mapping,
    preview_summary_path: path.resolve(input.input.previewSummaryPath),
    preview_jsonl_path: path.resolve(input.input.previewJsonlPath),
    entities: {
      customers: [...customers.values()],
      products: [...products.values()],
      operations: [...operations.values()],
      failure_modes: [...failureModes.values()],
      controls,
      control_failures: controlFailures,
    },
    import_issues: importIssues,
  };
}

function buildDryRunSummary(input: {
  input: DryRunInput;
  previewSummary: MappingPreviewSummary;
  plan: ImportDryRunPlan;
}): Omit<ImportDryRunSummary, "output_files"> {
  const pendingReviewRecords = input.previewSummary.counts_by_status.pending_review ?? 0;
  const rejectedRecords = input.previewSummary.counts_by_status.rejected ?? 0;
  const differences = [
    "Preview counts MappedSourceRecord rows; dry-run expands those rows into persistence targets.",
    "Dry-run adds derived customers from product records because customers are reused master data but not a standalone preview source.",
    "Dry-run creates control_failures from valid control records with positive failure quantity.",
    "Dry-run excludes pending_review and rejected records from create actions and records their issues in import_issues.",
  ];

  return {
    mode: "dry_run",
    commit_allowed: false,
    commit_blockers: input.plan.commit_blockers,
    generated_at: input.plan.generated_at,
    source_file: input.previewSummary.source_file,
    mapping: input.previewSummary.mapping,
    preview_counts: {
      by_source_id: input.previewSummary.counts_by_source_id,
      by_entity: input.previewSummary.counts_by_semantic_entity,
      by_status: input.previewSummary.counts_by_status,
      by_issue: input.previewSummary.counts_by_issue,
    },
    dry_run_counts: {
      by_entity: {
        customers: countActions(input.plan.entities.customers),
        products: countActions(input.plan.entities.products),
        operations: countActions(input.plan.entities.operations),
        failure_modes: countActions(input.plan.entities.failure_modes),
        controls: countActions(input.plan.entities.controls),
        control_failures: countActions(input.plan.entities.control_failures),
      },
      import_issues: input.plan.import_issues.length,
      pending_review_records: pendingReviewRecords,
      rejected_records: rejectedRecords,
    },
    differences,
  };
}

async function writeDryRunArtifacts(input: {
  outputDirectory: string;
  plan: ImportDryRunPlan;
  summary: Omit<ImportDryRunSummary, "output_files">;
}): Promise<ImportDryRunSummary> {
  await mkdir(input.outputDirectory, { recursive: true });
  const planJson = path.join(input.outputDirectory, "import-dry-run-plan.json");
  const summaryJson = path.join(input.outputDirectory, "import-dry-run-summary.json");
  const summaryMd = path.join(input.outputDirectory, "import-dry-run-summary.md");
  const summary: ImportDryRunSummary = {
    ...input.summary,
    output_files: {
      plan_json: planJson,
      summary_json: summaryJson,
      summary_md: summaryMd,
    },
  };

  await Promise.all([
    writeFile(planJson, `${JSON.stringify(input.plan, null, 2)}\n`, "utf8"),
    writeFile(summaryJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
    writeFile(summaryMd, renderSummary(summary), "utf8"),
  ]);

  return summary;
}

function toEntityPlanItem(
  record: MappedSourceRecord,
  key: string,
  action: Action,
  values: Record<string, unknown>,
): EntityPlanItem {
  return {
    key,
    action,
    source_record_id: record.record_id,
    source_id: record.source_id,
    source_sheet_name: record.source_locator.sheet_name,
    source_row_number: record.source_locator.row_number,
    source_cell_address: record.source_locator.cell_address,
    status: record.status,
    values,
  };
}

function toIssuePlanItem(record: MappedSourceRecord, issue: ExecutionIssue): IssuePlanItem {
  return {
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    field: issue.field,
    source_record_id: record.record_id,
    source_id: record.source_id,
    source_sheet_name: record.source_locator.sheet_name,
    source_row_number: record.source_locator.row_number,
    source_cell_address: record.source_locator.cell_address,
    details: issue.details,
  };
}

function addOnce(target: Map<string, EntityPlanItem>, key: string, item: EntityPlanItem): void {
  if (target.has(key)) return;
  target.set(key, item);
}

function countActions(items: EntityPlanItem[]): Record<Action, number> {
  const counts: Record<Action, number> = {
    create: 0,
    match: 0,
    skip: 0,
    pending_review: 0,
    rejected: 0,
  };
  items.forEach((item) => {
    counts[item.action] += 1;
  });
  return counts;
}

function value(record: MappedSourceRecord, field: string): unknown {
  return record.semantic_values[field];
}

function textValue(record: MappedSourceRecord, field: string): string {
  const fieldValue = value(record, field);
  return typeof fieldValue === "string" ? fieldValue.trim() : "";
}

function numberValue(record: MappedSourceRecord, field: string): number | null {
  const fieldValue = value(record, field);
  return typeof fieldValue === "number" && Number.isFinite(fieldValue) ? fieldValue : null;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const content = await readFile(filePath, "utf8");
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function renderSummary(summary: ImportDryRunSummary): string {
  const lines: string[] = [];
  lines.push("# Import Dry Run");
  lines.push("");
  lines.push(`- Source file: ${summary.source_file.file_name}`);
  lines.push(`- Mapping: ${summary.mapping.mapping_id} (${summary.mapping.mapping_version})`);
  lines.push(`- Generated at: ${summary.generated_at}`);
  lines.push(`- Commit allowed: ${summary.commit_allowed}`);
  lines.push(`- Plan hash: ${hashObject(summary.dry_run_counts)}`);
  lines.push("");
  lines.push("## Commit Blockers");
  summary.commit_blockers.forEach((blocker) => lines.push(`- ${blocker}`));
  lines.push("");
  lines.push("## Preview Status Counts");
  Object.entries(summary.preview_counts.by_status).forEach(([status, count]) => lines.push(`- ${status}: ${count}`));
  lines.push("");
  lines.push("## Dry Run Entity Counts");
  Object.entries(summary.dry_run_counts.by_entity).forEach(([entity, counts]) => {
    lines.push(`- ${entity}: ${JSON.stringify(counts)}`);
  });
  lines.push(`- import_issues: ${summary.dry_run_counts.import_issues}`);
  lines.push("");
  lines.push("## Differences");
  summary.differences.forEach((difference) => lines.push(`- ${difference}`));
  lines.push("");
  lines.push("## Output Files");
  lines.push(`- Plan JSON: ${summary.output_files.plan_json}`);
  lines.push(`- Summary JSON: ${summary.output_files.summary_json}`);
  lines.push(`- Summary MD: ${summary.output_files.summary_md}`);
  lines.push("");
  return lines.join("\n");
}

function hashObject(valueToHash: unknown): string {
  return createHash("sha256").update(JSON.stringify(valueToHash)).digest("hex");
}
