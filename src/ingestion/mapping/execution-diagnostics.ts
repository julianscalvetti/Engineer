import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MappedSourceRecord, MappingPreviewSummary, PreviewStatus, ResolutionTrace } from "./execution-types";

export async function writeMappingPreviewArtifacts(input: {
  records: MappedSourceRecord[];
  summary: Omit<MappingPreviewSummary, "output_files">;
  outputDirectory: string;
}): Promise<MappingPreviewSummary> {
  await mkdir(input.outputDirectory, { recursive: true });
  const jsonl = path.join(input.outputDirectory, "mapping-preview.jsonl");
  const summaryJson = path.join(input.outputDirectory, "mapping-preview-summary.json");
  const summaryMd = path.join(input.outputDirectory, "mapping-preview-summary.md");
  const summary: MappingPreviewSummary = {
    ...input.summary,
    output_files: {
      jsonl,
      summary_json: summaryJson,
      summary_md: summaryMd,
    },
  };

  await Promise.all([
    writeFile(jsonl, input.records.map((record) => JSON.stringify(record)).join("\n") + "\n", "utf8"),
    writeFile(summaryJson, `${JSON.stringify(summary, null, 2)}\n`, "utf8"),
    writeFile(summaryMd, renderMappingPreviewSummary(summary), "utf8"),
  ]);

  return summary;
}

export function buildPreviewSummary(input: {
  records: MappedSourceRecord[];
  sourceStats: MappingPreviewSummary["sources"];
  validation: MappingPreviewSummary["validation"];
  sourceFile: MappingPreviewSummary["source_file"];
  mapping: MappingPreviewSummary["mapping"];
  parameters: MappingPreviewSummary["parameters"];
  executedAt: string;
}): Omit<MappingPreviewSummary, "output_files"> {
  const countsByStatus = emptyStatusCounts();
  const countsBySource: Record<string, number> = {};
  const countsByEntity: Record<string, number> = {};
  const countsByIssue: Record<string, number> = {};
  const measurementCountsBySource: Record<string, number> = {};
  const issueExamples: MappingPreviewSummary["issue_examples"] = {};
  const semanticReviewValues: MappingPreviewSummary["semantic_review_values"] = [];
  const missingRequiredFields: MappingPreviewSummary["missing_required_fields"] = [];
  const failedTransformations = input.records.flatMap((record) =>
    record.transformations.filter((trace) => !trace.success),
  );
  const lookupResults = emptyResolutionCounts();
  const resolverResults = emptyResolutionCounts();

  input.records.forEach((record) => {
    countsByStatus[record.status] += 1;
    countsBySource[record.source_id] = (countsBySource[record.source_id] ?? 0) + 1;
    countsByEntity[record.semantic_entity] = (countsByEntity[record.semantic_entity] ?? 0) + 1;
    if (record.measurements.length > 0) {
      measurementCountsBySource[record.source_id] =
        (measurementCountsBySource[record.source_id] ?? 0) + record.measurements.length;
      countsByEntity.control_measurement = (countsByEntity.control_measurement ?? 0) + record.measurements.length;
    }
    record.resolutions.forEach((resolution) => incrementResolution(resolution, lookupResults, resolverResults));
    record.issues.forEach((recordIssue) => {
      countsByIssue[recordIssue.code] = (countsByIssue[recordIssue.code] ?? 0) + 1;
      issueExamples[recordIssue.code] ??= [];
      if (issueExamples[recordIssue.code].length < 10) {
        issueExamples[recordIssue.code].push({
          record_id: record.record_id,
          source_id: record.source_id,
          source_locator: record.source_locator,
          issues: [recordIssue],
        });
      }
      if (recordIssue.code === "SEMANTIC_REVIEW_VALUE") {
        semanticReviewValues.push({
          source_id: record.source_id,
          value: String(recordIssue.details?.value ?? recordIssue.field ?? ""),
          record_id: record.record_id,
        });
      }
      if (recordIssue.code === "REQUIRED_FIELD_MISSING") {
        missingRequiredFields.push({
          source_id: record.source_id,
          field: recordIssue.field ?? "",
          record_id: record.record_id,
        });
      }
    });
  });

  return {
    source_file: input.sourceFile,
    mapping: input.mapping,
    executed_at: input.executedAt,
    parameters: input.parameters,
    validation: input.validation,
    sources: input.sourceStats,
    counts_by_source_id: countsBySource,
    counts_by_semantic_entity: countsByEntity,
    counts_by_status: countsByStatus,
    counts_by_issue: countsByIssue,
    failed_transformations: failedTransformations,
    lookup_results: lookupResults,
    resolver_results: resolverResults,
    semantic_review_values: semanticReviewValues.slice(0, 100),
    missing_required_fields: missingRequiredFields.slice(0, 100),
    measurement_counts_by_source_id: measurementCountsBySource,
    issue_examples: issueExamples,
  };
}

function renderMappingPreviewSummary(summary: MappingPreviewSummary): string {
  const lines: string[] = [];
  lines.push("# Mapping Execution Preview");
  lines.push("");
  lines.push(`- Source file: ${summary.source_file.file_name}`);
  lines.push(`- SHA-256: ${summary.source_file.sha256}`);
  lines.push(`- Mapping: ${summary.mapping.mapping_id} (${summary.mapping.mapping_version})`);
  lines.push(`- Executed at: ${summary.executed_at}`);
  lines.push(`- Sample mode: ${summary.parameters.sample_mode}`);
  lines.push(`- Max records: ${summary.parameters.max_records ?? "none"}`);
  lines.push("");
  lines.push("## Sources");
  summary.sources.forEach((source) => {
    lines.push(
      `- ${source.source_id}: available=${source.available_records}, processed=${source.processed_records}, generated=${source.generated_records}, valid=${source.status_counts.valid}, warning=${source.status_counts.warning}, pending_review=${source.status_counts.pending_review}, rejected=${source.status_counts.rejected}, truncated=${source.truncated}`,
    );
  });
  lines.push("");
  lines.push("## Status Counts");
  Object.entries(summary.counts_by_status).forEach(([status, count]) => lines.push(`- ${status}: ${count}`));
  lines.push("");
  lines.push("## Measurement Counts");
  if (Object.keys(summary.measurement_counts_by_source_id).length === 0) lines.push("- none");
  Object.entries(summary.measurement_counts_by_source_id).forEach(([sourceId, count]) => lines.push(`- ${sourceId}: ${count}`));
  lines.push("");
  lines.push("## Issue Counts");
  if (Object.keys(summary.counts_by_issue).length === 0) lines.push("- none");
  Object.entries(summary.counts_by_issue).forEach(([code, count]) => lines.push(`- ${code}: ${count}`));
  lines.push("");
  lines.push("## Resolution Counts");
  lines.push(`- Lookups: ${JSON.stringify(summary.lookup_results)}`);
  lines.push(`- Resolvers: ${JSON.stringify(summary.resolver_results)}`);
  lines.push("");
  lines.push("## Output Files");
  lines.push(`- JSONL: ${summary.output_files.jsonl}`);
  lines.push(`- Summary JSON: ${summary.output_files.summary_json}`);
  lines.push(`- Summary MD: ${summary.output_files.summary_md}`);
  lines.push("");
  return lines.join("\n");
}

function incrementResolution(
  resolution: ResolutionTrace,
  lookupResults: Record<string, number>,
  resolverResults: Record<string, number>,
): void {
  const target = resolution.resolver_type === "scoped_catalog_lookup" ? lookupResults : resolverResults;
  target[resolution.status] = (target[resolution.status] ?? 0) + 1;
}

function emptyStatusCounts(): Record<PreviewStatus, number> {
  return { valid: 0, warning: 0, pending_review: 0, rejected: 0 };
}

function emptyResolutionCounts(): Record<string, number> {
  return { resolved: 0, ambiguous: 0, unresolved: 0, skipped: 0 };
}
