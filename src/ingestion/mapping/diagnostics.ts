import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { MappingValidationReport } from "./types";

export async function writeMappingValidationReport(
  report: MappingValidationReport,
  outputDir: string,
): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(outputDir, "mapping-validation.json");
  const markdownPath = path.join(outputDir, "mapping-validation.md");

  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, renderMappingValidationMarkdown(report), "utf8"),
  ]);

  return { jsonPath, markdownPath };
}

export function renderMappingValidationMarkdown(report: MappingValidationReport): string {
  const lines: string[] = [];

  lines.push("# Semantic Mapping Validation");
  lines.push("");
  lines.push(`- Source file: ${report.sourceFile.fileName}`);
  lines.push(`- SHA-256: ${report.sourceFile.sha256 || "not_available"}`);
  lines.push(`- Mapping ID: ${report.mapping.mappingId ?? "not_available"}`);
  lines.push(`- Mapping version: ${report.mapping.mappingVersion ?? "not_available"}`);
  lines.push(`- Status: ${report.mapping.status ?? "not_available"}`);
  lines.push("");
  lines.push("## Sources");
  report.sources.forEach((source) => {
    lines.push(`- ${source.id}: ${source.sheet} (${source.layout}) ${source.selectedRange ?? "no_range"}`);
  });
  lines.push("");
  lines.push("## Layouts");
  list(lines, report.layoutsUsed);
  lines.push("");
  lines.push("## Semantic fields");
  list(lines, report.semanticFields);
  lines.push("");
  lines.push("## Transformations");
  list(lines, report.transformations);
  lines.push("");
  lines.push("## Dependencies");
  Object.entries(report.dependencies).forEach(([sourceId, dependencies]) => {
    lines.push(`- ${sourceId}: ${dependencies.length > 0 ? dependencies.join(", ") : "none"}`);
  });
  lines.push("");
  lines.push("## Columns");
  report.sources.forEach((source) => {
    lines.push(`### ${source.id}`);
    lines.push(`- Selected range: ${source.selectedRange ?? "not_available"}`);
    lines.push(`- Selected header row: ${source.selectedHeaderRow}`);
    lines.push(`- Profile physical range: ${source.profile?.physicalRange ?? "not_available"}`);
    lines.push(`- Profile effective range: ${source.profile?.effectiveRange ?? "not_available"}`);
    lines.push(`- Row coverage ratio: ${source.rowCoverageRatio}`);
    lines.push(`- Column coverage ratio: ${source.columnCoverageRatio}`);
    lines.push(`- Header plausibility score: ${source.headerPlausibilityScore}`);
    lines.push(`- Catalog header match ratio: ${source.catalogHeaderMatchRatio ?? "not_applicable"}`);
    lines.push(`- Found: ${source.columnsFound.length > 0 ? source.columnsFound.join(", ") : "none"}`);
    lines.push(`- Missing: ${source.columnsMissing.length > 0 ? source.columnsMissing.join(", ") : "none"}`);
    lines.push(`- Populated data outside range: ${source.populatedDataOutsideRange.length}`);
    source.populatedDataOutsideRange.forEach((outside) => {
      lines.push(
        `  - ${outside.direction}: ${outside.count}, alternative=${outside.observedAlternativeRange ?? "not_available"}`,
      );
    });
    lines.push(`- Structural warnings: ${source.structuralWarnings.length}`);
    source.structuralWarnings.forEach((issue) => {
      lines.push(`  - ${issue.code}: ${issue.message}`);
    });
  });
  lines.push("");
  lines.push("## Resolvers");
  if (report.resolvers.length === 0) {
    lines.push("- none");
  } else {
    report.resolvers.forEach((resolver) => {
      lines.push(`- ${resolver.sourceId}: ${resolver.type}`);
      (resolver.steps ?? []).forEach((step) => {
        lines.push(
          `  - step ${step.index}: ${step.type}, input=${step.inputField ?? "none"}, output=${step.outputField ?? "none"}, catalog=${step.catalogSource ?? "none"}, scope=${formatScope(step.scope ?? [])}`,
        );
      });
      if (!resolver.steps) {
        lines.push(
          `  - catalog=${resolver.catalogSource ?? "none"}, field=${resolver.catalogField ?? "none"}, remainder=${resolver.remainderField ?? "none"}`,
        );
      }
    });
  }
  lines.push("");
  lines.push("## Field lookups");
  if (report.lookups.length === 0) {
    lines.push("- none");
  } else {
    report.lookups.forEach((lookup) => {
      lines.push(
        `- ${lookup.sourceId}.${lookup.semanticField}: catalog=${lookup.catalogSource}, match=${lookup.catalogMatchField}, input=${lookup.inputField}, scope=${formatScope(lookup.scope)}, on_unresolved=${lookup.onUnresolved}, on_ambiguous=${lookup.onAmbiguous}`,
      );
    });
  }
  lines.push("");
  lines.push("## Resolver limited tests");
  if (report.resolverTests.length === 0) {
    lines.push("- none");
  } else {
    report.resolverTests.forEach((test) => {
      lines.push(
        `- ${test.sourceId}.${test.testedField}: total=${test.total}, resolved=${test.resolved}, ambiguous=${test.ambiguous}, unresolved=${test.unresolved}, skipped=${test.skipped}`,
      );
      if (test.ambiguousExamples.length > 0) {
        lines.push(`  - ambiguous examples: ${JSON.stringify(test.ambiguousExamples.slice(0, 10))}`);
      }
      if (test.unresolvedExamples.length > 0) {
        lines.push(`  - unresolved examples: ${JSON.stringify(test.unresolvedExamples.slice(0, 10))}`);
      }
    });
  }
  lines.push("");
  lines.push("## Errors");
  issueList(lines, report.errors);
  lines.push("");
  lines.push("## Warnings");
  issueList(lines, report.warnings);
  lines.push("");
  lines.push("## Informational");
  issueList(lines, report.informational);
  lines.push("");
  lines.push("## Pending semantic decisions");
  list(lines, report.unresolvedDecisions);
  lines.push("");

  return lines.join("\n");
}

function formatScope(scope: Array<{ catalog_field: string; value_field: string }>): string {
  if (scope.length === 0) return "none";
  return scope.map((entry) => `${entry.catalog_field}=${entry.value_field}`).join(", ");
}

function list(lines: string[], values: string[]): void {
  if (values.length === 0) {
    lines.push("- none");
    return;
  }
  values.forEach((value) => lines.push(`- ${value}`));
}

function issueList(lines: string[], issues: MappingValidationReport["errors"]): void {
  if (issues.length === 0) {
    lines.push("- none");
    return;
  }
  issues.forEach((issue) => {
    lines.push(`- ${issue.code}${issue.sourceId ? ` [${issue.sourceId}]` : ""}: ${issue.message}`);
  });
}
