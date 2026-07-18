import type { CandidateDataBlock, ColumnProfile, ProfilingIssueSeverity, SheetProfile, WorkbookProfile } from "./types";

export function renderProfileMarkdown(profile: WorkbookProfile): string {
  const lines: string[] = [];
  const issueCounts = countIssuesBySeverity(profile.sheets);

  lines.push("# Source Profile");
  lines.push("");
  lines.push("## Workbook summary");
  lines.push("");
  lines.push(`- File: ${profile.sourceFile.originalFilename}`);
  lines.push(`- Relative path: ${profile.sourceFile.relativePath ?? "n/a"}`);
  lines.push(`- Absolute path: ${profile.sourceFile.absolutePath ?? "n/a"}`);
  lines.push(`- Size bytes: ${profile.sourceFile.sizeBytes}`);
  lines.push(`- MIME type: ${profile.sourceFile.mimeType}`);
  lines.push(`- Extension: ${profile.sourceFile.extension ?? "n/a"}`);
  lines.push(`- SHA-256: ${profile.sourceFile.sha256}`);
  lines.push(`- Processed at: ${profile.sourceFile.processedAt ?? profile.profiledAt}`);
  lines.push(`- Sheet count: ${profile.sourceFile.workbookSheetCount ?? profile.sheets.length}`);
  lines.push(`- Sample policy: ${profile.samplePolicy}`);
  lines.push(
    `- Issues: blocking ${issueCounts.blocking}, review ${issueCounts.review}, informational ${issueCounts.informational}`,
  );

  if (profile.sourceFile.warnings?.length) {
    lines.push("");
    lines.push("### Safety notes");
    lines.push("");
    profile.sourceFile.warnings.forEach((warning) => lines.push(`- ${warning}`));
  }

  lines.push("");
  lines.push("## Sheets overview");
  lines.push("");
  lines.push(
    "| # | Sheet | Suggested class | Confidence | Review | Physical range | Suggested range | Rows total/scanned | Sampling | Issues B/R/I |",
  );
  lines.push("|---:|---|---|---:|---|---|---|---:|---|---|");
  profile.sheets.forEach((sheet) => {
    const sheetIssues = countIssuesForSheet(sheet);
    lines.push(
      [
        sheet.sheetIndex,
        escapePipe(sheet.name),
        sheet.suggestedClass,
        sheet.suggestionConfidence.toFixed(3),
        sheet.needsHumanReview ? "needs_review" : "suggested",
        sheet.physicalRange.address,
        sheet.suggestedRange ?? "n/a",
        `${sheet.totalRows}/${sheet.scannedRows}`,
        sheet.samplingApplied ? `yes (${sheet.samplingLimit})` : `no (${sheet.samplingLimit})`,
        `${sheetIssues.blocking}/${sheetIssues.review}/${sheetIssues.informational}`,
      ]
        .map(String)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  });

  profile.sheets.forEach((sheet) => {
    lines.push("");
    lines.push(`## Sheet ${sheet.sheetIndex}: ${sheet.name}`);
    lines.push("");
    lines.push(`- Structural class: ${sheet.structuralClass}`);
    lines.push(`- Structural confidence: ${sheet.structuralConfidence.toFixed(3)}`);
    lines.push(`- Structural signals: ${sheet.structuralSignals.join(", ") || "n/a"}`);
    lines.push(`- Suggested class: ${sheet.suggestedClass}`);
    lines.push(`- Suggested range: ${sheet.suggestedRange ?? "n/a"}`);
    lines.push(`- Suggestion confidence: ${sheet.suggestionConfidence.toFixed(3)}`);
    lines.push(`- Needs human review: ${sheet.needsHumanReview ? "yes" : "no"}`);
    lines.push(`- Review reasons: ${sheet.reviewReasons.join(", ") || "n/a"}`);
    lines.push(`- Physical range: ${sheet.physicalRange.address}`);
    lines.push(`- Effective non-empty range: ${sheet.effectiveNonEmptyRange?.address ?? "n/a"}`);
    lines.push(`- Header row: ${sheet.headerRow ?? "n/a"}`);
    lines.push(`- Total rows: ${sheet.totalRows}`);
    lines.push(`- Data rows: ${sheet.dataRows}`);
    lines.push(`- Scanned rows: ${sheet.scannedRows}`);
    lines.push(`- Sampling applied: ${sheet.samplingApplied ? "yes" : "no"}`);
    lines.push(`- Sampling limit: ${sheet.samplingLimit}`);
    lines.push(`- Columns in physical range: ${sheet.columnCount}`);
    lines.push(`- Hidden: ${sheet.hidden ? "yes" : "no"}`);
    lines.push(`- Merged cells: ${sheet.mergedCellsCount}`);
    lines.push(`- Formula cells: ${sheet.formulaCellsCount}`);
    lines.push(`- Empty rows: ${sheet.emptyRowsCount}`);
    lines.push(`- Non-empty rows: ${sheet.nonEmptyRowsCount}`);

    renderBlocks(lines, sheet.candidateDataBlocks);
    renderIssues(lines, sheet);
    renderColumns(lines, sheet.columns);
  });

  lines.push("");
  return lines.join("\n");
}

function renderBlocks(lines: string[], blocks: CandidateDataBlock[]): void {
  lines.push("");
  lines.push("### Candidate data blocks");
  lines.push("");

  if (blocks.length === 0) {
    lines.push("- None detected.");
    return;
  }

  lines.push("| # | Full range | Scanned range | Header row | Confidence | Density | Populated columns | Reasons |");
  lines.push("|---:|---|---|---:|---:|---:|---:|---|");
  blocks.forEach((block, index) => {
    lines.push(
      [
        index + 1,
        block.fullRange,
        block.scannedRange,
        block.headerRow,
        block.confidence.toFixed(3),
        block.rowDensity.toFixed(3),
        block.populatedColumnCount,
        block.reasons.join(", "),
      ]
        .map(String)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  });
}

function renderIssues(lines: string[], sheet: SheetProfile): void {
  lines.push("");
  lines.push("### Issues");
  lines.push("");

  if (sheet.issues.length === 0) {
    lines.push("- None.");
    return;
  }

  lines.push("| Severity | Code | Occurrences | Affected columns | Message |");
  lines.push("|---|---|---:|---|---|");
  sheet.issues.forEach((issue) => {
    lines.push(
      [
        issue.severity,
        issue.code,
        issue.occurrences ?? 1,
        escapePipe((issue.affectedColumns ?? []).join(", ")),
        escapePipe(issue.message),
      ]
        .map(String)
        .join(" | ")
        .replace(/^/, "| ")
        .replace(/$/, " |"),
    );
  });
}

function renderColumns(lines: string[], columns: ColumnProfile[]): void {
  lines.push("");
  lines.push("### Columns in primary candidate block");
  lines.push("");

  if (columns.length === 0) {
    lines.push("- None.");
    return;
  }

  lines.push(
    "| # | Letter | Header | Type | Nulls | Non-nulls | Unique | Unique ratio | Sampled | Formulas | Catalog? |",
  );
  lines.push("|---:|---|---|---|---:|---:|---:|---:|---|---:|---|");
  columns.forEach((column) => lines.push(renderColumnRow(column)));
}

function renderColumnRow(column: ColumnProfile): string {
  return [
    column.columnIndex,
    escapePipe(column.columnLetter),
    escapePipe(column.header || "(empty header)"),
    column.inferredType,
    column.nullCount,
    column.nonNullCount,
    column.uniqueValueCount,
    column.uniquenessRatio.toFixed(3),
    column.statisticsSampled ? "yes" : "no",
    column.formulaCount,
    column.possibleCatalog ? "yes" : "no",
  ]
    .map((value) => String(value))
    .join(" | ")
    .replace(/^/, "| ")
    .replace(/$/, " |");
}

function countIssuesBySeverity(sheets: SheetProfile[]): Record<ProfilingIssueSeverity, number> {
  return sheets.reduce(
    (counts, sheet) => {
      const sheetCounts = countIssuesForSheet(sheet);
      counts.blocking += sheetCounts.blocking;
      counts.review += sheetCounts.review;
      counts.informational += sheetCounts.informational;
      return counts;
    },
    { blocking: 0, review: 0, informational: 0 },
  );
}

function countIssuesForSheet(sheet: SheetProfile): Record<ProfilingIssueSeverity, number> {
  return sheet.issues.reduce(
    (counts, issue) => {
      counts[issue.severity] += issue.occurrences ?? 1;
      return counts;
    },
    { blocking: 0, review: 0, informational: 0 },
  );
}

function escapePipe(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
