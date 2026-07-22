import ExcelJS from "exceljs";
import path from "node:path";

import { loadSemanticMapping, loadSourceSelection } from "./loader";
import { validateSemanticMapping } from "./engine";
import { buildApprovedSourceSelections } from "./approved-source-selection";
import { executeRowTableSource } from "./row-table-executor";
import { executeWideColumnsSource } from "./wide-columns-executor";
import { buildPreviewSummary, writeMappingPreviewArtifacts } from "./execution-diagnostics";
import type {
  CatalogRecord,
  MappedSourceRecord,
  MappingPreviewInput,
  MappingPreviewSummary,
  SourceExecutionStats,
} from "./execution-types";
import type { MappingSourceConfig } from "./types";

export async function executeSemanticMappingPreview(input: MappingPreviewInput): Promise<MappingPreviewSummary> {
  const validation = await validateSemanticMapping({
    inputPath: input.inputFilePath,
    sourceSelectionPath: input.sourceSelectionPath,
    mappingPath: input.semanticMappingPath,
  });

  if ((input.failOnValidationErrors ?? true) && validation.errors.length > 0) {
    throw new Error(`Semantic mapping validation failed with ${validation.errors.length} error(s).`);
  }

  const mappingLoad = await loadSemanticMapping(input.semanticMappingPath);
  if (!mappingLoad.value) throw new Error(`Could not load semantic mapping: ${mappingLoad.errors.join("; ")}`);
  const selectionLoad = await loadSourceSelection(input.sourceSelectionPath);
  if (!selectionLoad.value) throw new Error(`Could not load source selection: ${selectionLoad.errors.join("; ")}`);
  const mapping = mappingLoad.value;
  const approvedSelectionResult = buildApprovedSourceSelections({
    sourceSelection: selectionLoad.value,
    semanticMapping: mapping,
  });
  if (approvedSelectionResult.errors.length > 0) {
    throw new Error(`Approved source selection failed with ${approvedSelectionResult.errors.length} error(s).`);
  }
  const approvedSourcesById = new Map(approvedSelectionResult.approvedSources.map((source) => [source.sourceId, source]));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(input.inputFilePath);

  const sourceFilter = new Set(input.sourceIds ? expandSourceSelection(mapping.sources, input.sourceIds) : mapping.sources.map((source) => source.id));
  const orderedSources = orderSources(mapping.sources).filter((source) => sourceFilter.has(source.id));
  const catalogs = new Map<string, CatalogRecord[]>();
  const records: MappedSourceRecord[] = [];
  const stats: SourceExecutionStats[] = [];
  const sourceFileName = path.basename(input.inputFilePath);
  const sourceFileSha256 = validation.sourceFile.sha256;

  for (const source of orderedSources) {
    const approvedSource = approvedSourcesById.get(source.id);
    if (!approvedSource) throw new Error(`Approved source selection not found: ${source.id}`);
    const worksheet = workbook.getWorksheet(approvedSource.physical.sheet);
    if (!worksheet) throw new Error(`Worksheet not found: ${approvedSource.physical.sheet}`);
    const result =
      source.layout === "row_table"
        ? executeRowTableSource({
            worksheet,
            source,
            approvedSource,
            mapping,
            sourceFileName,
            sourceFileSha256,
            catalogs,
            maxRecords: input.maxRecords,
          })
        : executeWideColumnsSource({
            worksheet,
            source,
            approvedSource,
            mapping,
            sourceFileName,
            sourceFileSha256,
            catalogs,
            maxRecords: input.maxRecords,
          });
    records.push(...result.records);
    const catalogRecords = toCatalogRecords(result.records);
    catalogs.set(source.id, catalogRecords);
    stats.push(buildSourceStats(source.id, result.availableRecords, result.records, result.truncated, catalogRecords));
  }

  const summary = buildPreviewSummary({
    records,
    sourceStats: stats,
    validation: {
      errors: validation.errors,
      warnings: validation.warnings,
      informational: validation.informational,
    },
    sourceFile: {
      path: path.resolve(input.inputFilePath),
      file_name: sourceFileName,
      sha256: sourceFileSha256,
    },
    mapping: {
      mapping_id: mapping.mapping_id,
      mapping_version: mapping.mapping_version,
    },
    parameters: {
      max_records: input.maxRecords,
      sample_mode: input.sampleMode ?? "masked",
      source_ids: input.sourceIds,
      fail_on_validation_errors: input.failOnValidationErrors ?? true,
    },
    executedAt: new Date().toISOString(),
  });

  return writeMappingPreviewArtifacts({ records, summary, outputDirectory: input.outputDirectory });
}

function orderSources(sources: MappingSourceConfig[]): MappingSourceConfig[] {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const visited = new Set<string>();
  const ordered: MappingSourceConfig[] = [];
  const visit = (source: MappingSourceConfig): void => {
    if (visited.has(source.id)) return;
    visited.add(source.id);
    (source.depends_on ?? []).forEach((dependency) => {
      const dependencySource = byId.get(dependency);
      if (dependencySource) visit(dependencySource);
    });
    ordered.push(source);
  };
  sources.forEach(visit);
  return ordered;
}

function expandSourceSelection(sources: MappingSourceConfig[], requestedSourceIds: string[]): string[] {
  const byId = new Map(sources.map((source) => [source.id, source]));
  const selected = new Set<string>();
  const visit = (sourceId: string): void => {
    if (selected.has(sourceId)) return;
    const source = byId.get(sourceId);
    if (!source) return;
    (source.depends_on ?? []).forEach(visit);
    selected.add(sourceId);
  };
  requestedSourceIds.forEach(visit);
  return [...selected];
}

function toCatalogRecords(records: MappedSourceRecord[]): CatalogRecord[] {
  return records.map((record) => ({
    record_id: record.record_id,
    source_id: record.source_id,
    status: record.status,
    values: record.semantic_values,
    usable: record.status === "valid" || record.status === "warning",
  }));
}

function buildSourceStats(
  sourceId: string,
  availableRecords: number,
  records: MappedSourceRecord[],
  truncated: boolean,
  catalogRecords: CatalogRecord[],
): SourceExecutionStats {
  const status_counts = { valid: 0, warning: 0, pending_review: 0, rejected: 0 };
  const issue_counts: Record<string, number> = {};
  records.forEach((record) => {
    status_counts[record.status] += 1;
    record.issues.forEach((recordIssue) => {
      issue_counts[recordIssue.code] = (issue_counts[recordIssue.code] ?? 0) + 1;
    });
  });
  return {
    source_id: sourceId,
    available_records: availableRecords,
    processed_records: records.length,
    generated_records: records.length,
    truncated,
    status_counts,
    issue_counts,
    catalog_usable_records: catalogRecords.filter((record) => record.usable).length,
    catalog_unusable_records: catalogRecords.filter((record) => !record.usable).length,
  };
}
