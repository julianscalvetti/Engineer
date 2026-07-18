import type { SheetProfile, StructuralClass, WorkbookProfile } from "./types";

const PROFILE_VERSION = "technical-profiler-v1.1.1";

export type SourceSelectionDecision = "include" | "exclude" | "pending_review";
export type SourceSelectionReviewStatus = "suggested" | "needs_review";

export interface SourceSelectionSheet {
  name: string;
  suggestedClass: StructuralClass;
  suggestedRange?: string;
  headerRow?: number;
  confidence: number;
  decision: SourceSelectionDecision;
  reviewStatus: SourceSelectionReviewStatus;
  reasons: string[];
}

export function renderSourceSelectionManifest(profile: WorkbookProfile): string {
  const lines: string[] = [];

  lines.push(`file_name: ${yamlScalar(profile.sourceFile.originalFilename)}`);
  lines.push(`file_sha256: ${yamlScalar(profile.sourceFile.sha256)}`);
  lines.push(`profile_version: ${yamlScalar(PROFILE_VERSION)}`);
  lines.push(`generated_at: ${yamlScalar(profile.profiledAt)}`);
  lines.push("sheets:");

  profile.sheets.map(toSourceSelectionSheet).forEach((sheet) => {
    lines.push(`  - name: ${yamlScalar(sheet.name)}`);
    lines.push(`    suggested_class: ${sheet.suggestedClass}`);
    lines.push(`    suggested_range: ${sheet.suggestedRange ? yamlScalar(sheet.suggestedRange) : "null"}`);
    lines.push(`    header_row: ${sheet.headerRow ?? "null"}`);
    lines.push(`    confidence: ${round(sheet.confidence)}`);
    lines.push(`    decision: ${sheet.decision}`);
    lines.push(`    review_status: ${sheet.reviewStatus}`);
    lines.push("    reasons:");
    if (sheet.reasons.length === 0) {
      lines.push("      - no_additional_reasons");
    } else {
      sheet.reasons.forEach((reason) => lines.push(`      - ${yamlScalar(reason)}`));
    }
  });

  lines.push("");
  return lines.join("\n");
}

export function toSourceSelectionSheet(sheet: SheetProfile): SourceSelectionSheet {
  const decision = suggestDecision(sheet);
  const reasons = [
    `suggested_class=${sheet.suggestedClass}`,
    `confidence=${round(sheet.suggestionConfidence)}`,
    ...sheet.reviewReasons,
  ];

  if (sheet.suggestedRange) {
    reasons.push(`suggested_range=${sheet.suggestedRange}`);
  }

  return {
    name: sheet.name,
    suggestedClass: sheet.suggestedClass,
    suggestedRange: sheet.suggestedRange,
    headerRow: sheet.headerRow,
    confidence: sheet.suggestionConfidence,
    decision,
    reviewStatus: sheet.needsHumanReview ? "needs_review" : "suggested",
    reasons,
  };
}

function suggestDecision(sheet: SheetProfile): SourceSelectionDecision {
  if (
    sheet.suggestedClass === "empty" ||
    sheet.suggestedClass === "form_like" ||
    sheet.suggestedClass === "report_like"
  ) {
    return "exclude";
  }

  if (sheet.suggestedClass === "tabular_candidate" && sheet.suggestionConfidence >= 0.75) {
    return "include";
  }

  return "pending_review";
}

function yamlScalar(value: string): string {
  return JSON.stringify(value);
}

function round(value: number): number {
  return Number(value.toFixed(3));
}
