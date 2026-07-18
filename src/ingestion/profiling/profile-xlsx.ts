import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

import type { SourceFileMetadata, SourceLocation } from "../shared/types";
import { IngestionError } from "../shared/errors";
import { renderProfileMarkdown } from "./markdown";
import { renderSourceSelectionManifest } from "./source-selection";
import type {
  CandidateDataBlock,
  CellRange,
  ColumnProfile,
  InferredCellType,
  ProfileReport,
  ProfilingIssue,
  ProfilingIssueSeverity,
  ProfilingOptions,
  SamplePolicy,
  SheetProfile,
  StructuralClass,
  WorkbookProfile,
} from "./types";

const XLSX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const DEFAULT_SAMPLE_VALUES_LIMIT = 10;
const DEFAULT_SCAN_ROWS_LIMIT = 10_000;
const DEFAULT_CATALOG_MAX_UNIQUE_VALUES = 50;
const DEFAULT_CATALOG_MAX_UNIQUENESS_RATIO = 0.2;
const HEADER_DETECTION_SCAN_ROWS = 50;
const MAX_HEADER_CANDIDATES = 8;
const MAX_CANDIDATE_BLOCKS = 5;

interface ScanCell {
  rawValue: ExcelJS.CellValue;
  textValue: string;
  inferredType: InferredCellType;
  empty: boolean;
  formula: boolean;
}

interface SheetScan {
  rows: ScanCell[][];
  columnPrefixes: number[][];
  rowNonEmptyCounts: number[];
  fullColumnLastRows: number[];
  scannedRows: number;
  totalRows: number;
  columnCount: number;
  emptyRowsCount: number;
  nonEmptyRowsCount: number;
  formulaCellsCount: number;
  effectiveRange?: CellRange;
  fullEffectiveRange?: CellRange;
}

interface IssueDraft {
  code: string;
  severity: ProfilingIssueSeverity;
  message: string;
  affectedColumn?: string;
  exampleLocation?: SourceLocation;
}

export async function profileXlsxFile(
  filePath: string,
  outputDir: string,
  options: ProfilingOptions = {},
): Promise<ProfileReport> {
  const absolutePath = path.resolve(filePath);
  const extension = path.extname(absolutePath).toLowerCase();

  if (extension !== ".xlsx") {
    throw new IngestionError(
      "Only .xlsx files are supported by the Technical Profiler at this stage.",
      "UNSUPPORTED_FORMAT",
      { filePath: absolutePath, extension },
    );
  }

  const [fileStat, sha256] = await Promise.all([stat(absolutePath), calculateSha256(absolutePath)]);
  const workbook = new ExcelJS.Workbook();

  // ExcelJS reads workbook data only. The profiler never executes VBA, macros, or embedded code.
  await workbook.xlsx.readFile(absolutePath);

  const processedAt = options.processedAt ?? new Date().toISOString();
  const samplePolicy = options.samplePolicy ?? "masked";
  const sourceFile = buildSourceFileMetadata({
    absolutePath,
    extension,
    fileSize: fileStat.size,
    options,
    processedAt,
    sha256,
    workbookSheetCount: workbook.worksheets.length,
  });

  const effectiveOptions = { ...options, samplePolicy };
  const profile: WorkbookProfile = {
    sourceFile,
    sheets: workbook.worksheets.map((worksheet, index) =>
      profileWorksheet(worksheet, index + 1, effectiveOptions),
    ),
    issues: [],
    profiledAt: processedAt,
    samplePolicy,
  };

  const jsonArtifactPath = path.join(outputDir, "source-profile.json");
  const markdownArtifactPath = path.join(outputDir, "source-profile.md");
  const selectionManifestPath =
    options.selectionOutputPath ?? path.join(outputDir, "source-selection.generated.yaml");

  await Promise.all([
    mkdir(outputDir, { recursive: true }),
    mkdir(path.dirname(selectionManifestPath), { recursive: true }),
  ]);

  await Promise.all([
    writeFile(jsonArtifactPath, `${JSON.stringify(toSourceProfileJson(profile), null, 2)}\n`, "utf8"),
    writeFile(markdownArtifactPath, renderProfileMarkdown(profile), "utf8"),
    writeFile(selectionManifestPath, renderSourceSelectionManifest(profile), "utf8"),
  ]);

  return { profile, jsonArtifactPath, markdownArtifactPath, selectionManifestPath };
}

function buildSourceFileMetadata(input: {
  absolutePath: string;
  extension: string;
  fileSize: number;
  options: ProfilingOptions;
  processedAt: string;
  sha256: string;
  workbookSheetCount: number;
}): SourceFileMetadata {
  return {
    companyId: input.options.companyId,
    originalFilename: path.basename(input.absolutePath),
    absolutePath: input.absolutePath,
    relativePath: getSafeRelativePath(input.absolutePath, input.options.relativePathRoot),
    sha256: input.sha256,
    sizeBytes: input.fileSize,
    mimeType: XLSX_MIME_TYPE,
    format: "xlsx",
    extension: input.extension,
    receivedAt: input.processedAt,
    processedAt: input.processedAt,
    workbookSheetCount: input.workbookSheetCount,
    warnings: [
      "Workbook processed in read-only profiling mode.",
      "Macros and embedded code are never executed.",
      "Macro metadata can only be detected when the file format exposes it to the reader.",
    ],
  };
}

function profileWorksheet(
  worksheet: ExcelJS.Worksheet,
  sheetIndex: number,
  options: ProfilingOptions,
): SheetProfile {
  const totalRows = worksheet.rowCount;
  const columnCount = worksheet.columnCount;
  const samplingLimit = options.scanRowsLimit ?? DEFAULT_SCAN_ROWS_LIMIT;
  const scannedRows = Math.min(totalRows, samplingLimit);
  const scan = buildSheetScan(worksheet, scannedRows, columnCount, options);
  const hidden = worksheet.state === "hidden" || worksheet.state === "veryHidden";
  const mergedCellsCount = countMergedCells(worksheet);
  const detectedCandidateDataBlocks = detectCandidateDataBlocks(worksheet.name, scan, options);
  const configuredHeaderRow = getConfiguredHeaderRow(worksheet.name, options);
  const candidateDataBlocks = prioritizeCandidateDataBlocks(detectedCandidateDataBlocks, configuredHeaderRow);
  const primaryBlock = candidateDataBlocks[0];
  const headerRow = primaryBlock?.headerRow ?? configuredHeaderRow;
  const duplicateColumnNames = findDuplicateHeaders(scan, headerRow, primaryBlock);
  const columns = primaryBlock
    ? Array.from({ length: primaryBlock.endColumn - primaryBlock.startColumn + 1 }, (_, index) =>
        profileColumn(worksheet.name, scan, primaryBlock.startColumn + index, primaryBlock, options),
      ).filter((column) => column.nonNullCount > 0 || column.normalizedHeader)
    : [];
  const dataRows = primaryBlock
    ? Math.max(primaryBlock.endRow - primaryBlock.headerRow, 0)
    : scan.nonEmptyRowsCount;
  const issues = groupIssueDrafts(
    buildSheetIssueDrafts({
      sheetName: worksheet.name,
      hidden,
      mergedCellsCount,
      formulaCellsCount: scan.formulaCellsCount,
      duplicateColumnNames,
      columns,
      primaryBlock,
    }),
  );
  const structural = classifySheet({
    totalRows,
    columnCount,
    dataRows,
    nonEmptyRowsCount: scan.nonEmptyRowsCount,
    candidateDataBlocks,
    mergedCellsCount,
    formulaCellsCount: scan.formulaCellsCount,
    effectiveRange: scan.effectiveRange,
  });
  const suggestion = buildSheetSuggestion({
    structuralClass: structural.structuralClass,
    confidence: structural.confidence,
    signals: structural.signals,
    candidateDataBlocks,
    fullEffectiveRange: scan.fullEffectiveRange,
    mergedCellsCount,
    formulaCellsCount: scan.formulaCellsCount,
    totalRows,
    columnCount,
  });

  return {
    name: worksheet.name,
    sheetIndex,
    rowCount: totalRows,
    totalRows,
    dataRows,
    scannedRows,
    samplingApplied: totalRows > samplingLimit,
    samplingLimit,
    columnCount,
    headerRow,
    hidden,
    mergedCellsCount,
    formulaCellsCount: scan.formulaCellsCount,
    emptyRowsCount: scan.emptyRowsCount,
    nonEmptyRowsCount: scan.nonEmptyRowsCount,
    physicalRange: buildRange(1, Math.max(totalRows, 1), 1, Math.max(columnCount, 1)),
    effectiveNonEmptyRange: scan.fullEffectiveRange,
    candidateDataBlocks,
    structuralClass: structural.structuralClass,
    structuralConfidence: structural.confidence,
    structuralSignals: structural.signals,
    suggestedClass: suggestion.suggestedClass,
    suggestedRange: suggestion.suggestedRange,
    suggestionConfidence: suggestion.confidence,
    needsHumanReview: suggestion.needsHumanReview,
    reviewReasons: suggestion.reviewReasons,
    columns,
    duplicateColumnNames,
    issues,
  };
}

function prioritizeCandidateDataBlocks(
  candidateDataBlocks: CandidateDataBlock[],
  configuredHeaderRow: number | undefined,
): CandidateDataBlock[] {
  if (!configuredHeaderRow) return candidateDataBlocks;
  return [...candidateDataBlocks].sort((left, right) => {
    const leftConfigured = left.headerRow === configuredHeaderRow ? 0 : 1;
    const rightConfigured = right.headerRow === configuredHeaderRow ? 0 : 1;
    return leftConfigured - rightConfigured || right.confidence - left.confidence;
  });
}

function buildSheetScan(
  worksheet: ExcelJS.Worksheet,
  scannedRows: number,
  columnCount: number,
  options: ProfilingOptions,
): SheetScan {
  const rows: ScanCell[][] = Array.from({ length: scannedRows + 1 }, () => []);
  const rowNonEmptyCounts = Array(scannedRows + 1).fill(0) as number[];
  const fullColumnLastRows = Array(columnCount + 1).fill(0) as number[];
  const columnPrefixes = Array.from({ length: columnCount + 1 }, () =>
    Array(scannedRows + 1).fill(0),
  ) as number[][];
  let formulaCellsCount = 0;
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = 0;
  let minColumn = Number.POSITIVE_INFINITY;
  let maxColumn = 0;
  let fullMinRow = Number.POSITIVE_INFINITY;
  let fullMaxRow = 0;
  let fullMinColumn = Number.POSITIVE_INFINITY;
  let fullMaxColumn = 0;

  for (let rowNumber = 1; rowNumber <= scannedRows; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);

    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      const cell = row.getCell(columnIndex);
      const empty = isEmptyCellValue(cell.value);
      const formula = options.inspectFormulas !== false && isFormulaCell(cell);
      const snapshot: ScanCell = {
        rawValue: cell.value,
        textValue: stringifyCellValue(cell.value),
        inferredType: inferCellType(cell, options),
        empty,
        formula,
      };

      rows[rowNumber][columnIndex] = snapshot;
      columnPrefixes[columnIndex][rowNumber] =
        columnPrefixes[columnIndex][rowNumber - 1] + (empty ? 0 : 1);

      if (empty) {
        continue;
      }

      rowNonEmptyCounts[rowNumber] += 1;
      minRow = Math.min(minRow, rowNumber);
      maxRow = Math.max(maxRow, rowNumber);
      minColumn = Math.min(minColumn, columnIndex);
      maxColumn = Math.max(maxColumn, columnIndex);
      fullColumnLastRows[columnIndex] = rowNumber;
      if (formula) formulaCellsCount += 1;
    }
  }

  for (let rowNumber = scannedRows + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
      if (isEmptyCellValue(row.getCell(columnIndex).value)) continue;
      fullMinRow = Math.min(fullMinRow, rowNumber);
      fullMaxRow = Math.max(fullMaxRow, rowNumber);
      fullMinColumn = Math.min(fullMinColumn, columnIndex);
      fullMaxColumn = Math.max(fullMaxColumn, columnIndex);
      fullColumnLastRows[columnIndex] = rowNumber;
    }
  }

  if (maxRow > 0) {
    fullMinRow = Math.min(fullMinRow, minRow);
    fullMaxRow = Math.max(fullMaxRow, maxRow);
    fullMinColumn = Math.min(fullMinColumn, minColumn);
    fullMaxColumn = Math.max(fullMaxColumn, maxColumn);
  }

  const emptyRowsCount = rowNonEmptyCounts.slice(1).filter((count) => count === 0).length;
  return {
    rows,
    columnPrefixes,
    rowNonEmptyCounts,
    fullColumnLastRows,
    scannedRows,
    totalRows: worksheet.rowCount,
    columnCount,
    emptyRowsCount,
    nonEmptyRowsCount: scannedRows - emptyRowsCount,
    formulaCellsCount,
    effectiveRange: maxRow === 0 ? undefined : buildRange(minRow, maxRow, minColumn, maxColumn),
    fullEffectiveRange:
      fullMaxRow === 0 ? undefined : buildRange(fullMinRow, fullMaxRow, fullMinColumn, fullMaxColumn),
  };
}

function detectCandidateDataBlocks(
  sheetName: string,
  scan: SheetScan,
  options: ProfilingOptions,
): CandidateDataBlock[] {
  if (!scan.effectiveRange) return [];

  const headerRows = new Set<number>();
  const configuredHeaderRow = getConfiguredHeaderRow(sheetName, options);
  if (configuredHeaderRow) headerRows.add(configuredHeaderRow);

  const scoredRows: Array<{ rowNumber: number; score: number }> = [];
  const lastHeaderProbe = Math.min(
    scan.effectiveRange.endRow,
    scan.effectiveRange.startRow + HEADER_DETECTION_SCAN_ROWS,
  );

  for (let rowNumber = scan.effectiveRange.startRow; rowNumber <= lastHeaderProbe; rowNumber += 1) {
    const score = scoreHeaderRow(scan, rowNumber, scan.effectiveRange.startColumn, scan.effectiveRange.endColumn);
    if (score >= 0.45) scoredRows.push({ rowNumber, score });
  }

  scoredRows
    .sort((a, b) => b.score - a.score || a.rowNumber - b.rowNumber)
    .slice(0, MAX_HEADER_CANDIDATES)
    .forEach((candidate) => headerRows.add(candidate.rowNumber));

  const blocks: CandidateDataBlock[] = [];

  for (const headerRow of headerRows) {
    for (const segment of findPopulatedColumnSegments(scan, headerRow)) {
      const block = scoreCandidateBlock(scan, headerRow, segment.startColumn, segment.endColumn);
      if (block && block.confidence >= 0.35) blocks.push(block);
    }
  }

  return blocks
    .sort((a, b) => b.confidence - a.confidence || b.populatedColumnCount - a.populatedColumnCount)
    .slice(0, MAX_CANDIDATE_BLOCKS);
}

function findPopulatedColumnSegments(
  scan: SheetScan,
  headerRow: number,
): Array<{ startColumn: number; endColumn: number }> {
  if (!scan.effectiveRange || headerRow >= scan.effectiveRange.endRow) return [];

  const activeColumns: number[] = [];

  for (let columnIndex = scan.effectiveRange.startColumn; columnIndex <= scan.effectiveRange.endColumn; columnIndex += 1) {
    const header = scan.rows[headerRow]?.[columnIndex]?.textValue ?? "";
    const dataCount = getColumnNonEmptyCount(scan, columnIndex, headerRow + 1, scan.effectiveRange.endRow);
    if (dataCount > 0 && (normalizeHeader(header) || dataCount >= 2)) {
      activeColumns.push(columnIndex);
    }
  }

  const segments: Array<{ startColumn: number; endColumn: number }> = [];
  if (activeColumns.length === 0) return segments;

  let startColumn = activeColumns[0];
  let previousColumn = activeColumns[0];
  for (const columnIndex of activeColumns.slice(1)) {
    if (columnIndex === previousColumn + 1) {
      previousColumn = columnIndex;
      continue;
    }
    segments.push({ startColumn, endColumn: previousColumn });
    startColumn = columnIndex;
    previousColumn = columnIndex;
  }
  segments.push({ startColumn, endColumn: previousColumn });

  return segments.filter((segment) => segment.endColumn - segment.startColumn + 1 >= 2);
}

function scoreCandidateBlock(
  scan: SheetScan,
  headerRow: number,
  startColumn: number,
  endColumn: number,
): CandidateDataBlock | undefined {
  const endRow = findLastDataRow(scan, headerRow + 1, scan.effectiveRange?.endRow ?? scan.scannedRows, startColumn, endColumn);
  if (endRow <= headerRow) return undefined;
  const fullEndRow = findFullBlockEndRow(scan, headerRow, startColumn, endColumn, endRow);

  const width = endColumn - startColumn + 1;
  const dataRowCount = endRow - headerRow;
  const populatedCells = countPopulatedCells(scan, headerRow + 1, endRow, startColumn, endColumn);
  const rowDensity = populatedCells / Math.max(width * dataRowCount, 1);
  const populatedColumnCount = countPopulatedColumns(scan, headerRow + 1, endRow, startColumn, endColumn);
  const headerScore = scoreHeaderRow(scan, headerRow, startColumn, endColumn);
  const typeConsistency = scoreTypeConsistency(scan, headerRow + 1, endRow, startColumn, endColumn);
  const continuity = populatedColumnCount / width;
  const sizeScore = Math.min(1, width / 6) * 0.45 + Math.min(1, dataRowCount / 10) * 0.55;
  const confidence = clamp(
    headerScore * 0.3 + rowDensity * 0.25 + typeConsistency * 0.2 + continuity * 0.15 + sizeScore * 0.1,
  );
  const reasons: string[] = [];

  if (headerScore >= 0.7) reasons.push("usable_headers");
  if (rowDensity >= 0.45) reasons.push("dense_data_rows");
  if (continuity >= 0.8) reasons.push("continuous_columns");
  if (typeConsistency >= 0.7) reasons.push("consistent_column_types");
  if (populatedColumnCount === width) reasons.push("no_empty_columns_inside_block");

  return {
    range: buildRange(headerRow, fullEndRow, startColumn, endColumn).address,
    fullRange: buildRange(headerRow, fullEndRow, startColumn, endColumn).address,
    scannedRange: buildRange(headerRow, endRow, startColumn, endColumn).address,
    startRow: headerRow,
    endRow: fullEndRow,
    scannedEndRow: endRow,
    startColumn,
    endColumn,
    headerRow,
    confidence,
    reasons,
    rowDensity,
    populatedColumnCount,
  };
}

function profileColumn(
  sheetName: string,
  scan: SheetScan,
  columnIndex: number,
  block: CandidateDataBlock,
  options: ProfilingOptions,
): ColumnProfile {
  const columnLetter = columnNumberToName(columnIndex);
  const header = scan.rows[block.headerRow]?.[columnIndex]?.textValue ?? "";
  const normalizedHeader = normalizeHeader(header);
  const sampleValuesLimit = options.sampleValuesLimit ?? DEFAULT_SAMPLE_VALUES_LIMIT;
  const samplePolicy = options.samplePolicy ?? "masked";
  const catalogMaxUniqueValues = options.catalogMaxUniqueValues ?? DEFAULT_CATALOG_MAX_UNIQUE_VALUES;
  const catalogMaxUniquenessRatio =
    options.catalogMaxUniquenessRatio ?? DEFAULT_CATALOG_MAX_UNIQUENESS_RATIO;
  const startRow = block.headerRow + 1;
  const endRow = Math.min(block.scannedEndRow, scan.scannedRows);
  const samples: string[] = [];
  const uniqueValues = new Set<string>();
  const observedTypes = new Set<InferredCellType>();
  let nullCount = 0;
  let nonNullCount = 0;
  let formulaCount = 0;
  let minValue: number | undefined;
  let maxValue: number | undefined;
  let minDate: Date | undefined;
  let maxDate: Date | undefined;

  for (let rowNumber = startRow; rowNumber <= endRow; rowNumber += 1) {
    const cell = scan.rows[rowNumber]?.[columnIndex];
    if (!cell || cell.empty) {
      nullCount += 1;
      continue;
    }

    nonNullCount += 1;
    observedTypes.add(cell.inferredType);
    if (cell.formula) formulaCount += 1;
    uniqueValues.add(cell.textValue);

    const sampleValue = applySamplePolicy(cell.textValue, samplePolicy);
    if (sampleValue !== undefined && samples.length < sampleValuesLimit) samples.push(sampleValue);

    if (typeof cell.rawValue === "number") {
      minValue = minValue === undefined ? cell.rawValue : Math.min(minValue, cell.rawValue);
      maxValue = maxValue === undefined ? cell.rawValue : Math.max(maxValue, cell.rawValue);
    }

    if (cell.rawValue instanceof Date) {
      minDate = minDate === undefined || cell.rawValue < minDate ? cell.rawValue : minDate;
      maxDate = maxDate === undefined || cell.rawValue > maxDate ? cell.rawValue : maxDate;
    }
  }

  const inferredType = inferColumnType(observedTypes, nonNullCount);
  const uniquenessRatio = nonNullCount === 0 ? 0 : uniqueValues.size / nonNullCount;

  return {
    sheetName,
    columnName: header,
    columnIndex,
    columnLetter,
    header,
    normalizedHeader,
    inferredType,
    nullCount,
    nonNullCount,
    uniqueValueCount: uniqueValues.size,
    uniquenessRatio,
    formulaCount,
    sampleValues: samples,
    minValue,
    maxValue,
    minDate: minDate?.toISOString(),
    maxDate: maxDate?.toISOString(),
    possibleCatalog:
      nonNullCount > 0 &&
      uniqueValues.size <= catalogMaxUniqueValues &&
      uniquenessRatio <= catalogMaxUniquenessRatio,
    statisticsSampled: block.endRow > endRow,
    scannedRows: Math.max(endRow - startRow + 1, 0),
    issues: [],
  };
}

function classifySheet(input: {
  totalRows: number;
  columnCount: number;
  dataRows: number;
  nonEmptyRowsCount: number;
  candidateDataBlocks: CandidateDataBlock[];
  mergedCellsCount: number;
  formulaCellsCount: number;
  effectiveRange?: CellRange;
}): { structuralClass: StructuralClass; confidence: number; signals: string[] } {
  const signals: string[] = [];

  if (!input.effectiveRange || input.nonEmptyRowsCount === 0) {
    return { structuralClass: "empty", confidence: 1, signals: ["no_non_empty_cells"] };
  }

  const bestBlock = input.candidateDataBlocks[0];
  const formulaRatio = input.formulaCellsCount / Math.max(input.totalRows * input.columnCount, 1);
  const mergedRatio = input.mergedCellsCount / Math.max(input.totalRows * input.columnCount, 1);

  if (bestBlock) {
    signals.push(`best_block_confidence=${bestBlock.confidence.toFixed(3)}`);
    signals.push(`best_block_density=${bestBlock.rowDensity.toFixed(3)}`);
  }
  if (input.candidateDataBlocks.length > 1) signals.push("multiple_candidate_blocks");
  if (formulaRatio > 0.15) signals.push("high_formula_ratio");
  if (mergedRatio > 0.02) signals.push("merged_cells_present");
  if (input.dataRows <= 3) signals.push("few_data_rows");

  if (input.mergedCellsCount > 0 && input.dataRows <= 8) {
    return { structuralClass: "form_like", confidence: 0.65, signals: ["merged_or_sparse_layout", ...signals] };
  }
  if (bestBlock && bestBlock.confidence >= 0.65 && input.dataRows >= 2) {
    return { structuralClass: "tabular_candidate", confidence: bestBlock.confidence, signals: ["usable_tabular_block", ...signals] };
  }
  if (input.candidateDataBlocks.length > 1 || formulaRatio > 0.1 || input.mergedCellsCount > 0) {
    return { structuralClass: "report_like", confidence: 0.6, signals: ["multi_region_or_calculated_layout", ...signals] };
  }
  return { structuralClass: "unknown", confidence: bestBlock?.confidence ?? 0.4, signals };
}

function buildSheetSuggestion(input: {
  structuralClass: StructuralClass;
  confidence: number;
  signals: string[];
  candidateDataBlocks: CandidateDataBlock[];
  fullEffectiveRange?: CellRange;
  mergedCellsCount: number;
  formulaCellsCount: number;
  totalRows: number;
  columnCount: number;
}): {
  suggestedClass: StructuralClass;
  suggestedRange?: string;
  confidence: number;
  needsHumanReview: boolean;
  reviewReasons: string[];
} {
  const primaryBlock = input.candidateDataBlocks[0];
  const reviewReasons: string[] = [];

  if (input.candidateDataBlocks.length > 1) {
    const secondBlock = input.candidateDataBlocks[1];
    if (secondBlock && Math.abs(primaryBlock.confidence - secondBlock.confidence) <= 0.08) {
      reviewReasons.push("multiple_similar_candidate_blocks");
    }
  }

  if (input.confidence < 0.75) {
    reviewReasons.push("low_suggestion_confidence");
  }

  const hasMixedSignals =
    input.signals.includes("multiple_candidate_blocks") &&
    (input.mergedCellsCount > 0 || input.formulaCellsCount > 0);
  if (hasMixedSignals) {
    reviewReasons.push("mixed_form_report_table_signals");
  }

  if (primaryBlock && input.fullEffectiveRange) {
    const blockCells =
      (primaryBlock.endRow - primaryBlock.startRow + 1) *
      (primaryBlock.endColumn - primaryBlock.startColumn + 1);
    const effectiveCells =
      (input.fullEffectiveRange.endRow - input.fullEffectiveRange.startRow + 1) *
      (input.fullEffectiveRange.endColumn - input.fullEffectiveRange.startColumn + 1);
    if (effectiveCells > 0 && blockCells / effectiveCells < 0.25) {
      reviewReasons.push("main_block_small_fraction_of_sheet");
    }
  }

  if (input.mergedCellsCount > 0) {
    reviewReasons.push("merged_cells_present");
  }

  return {
    suggestedClass: input.structuralClass,
    suggestedRange: primaryBlock?.fullRange,
    confidence: input.confidence,
    needsHumanReview: reviewReasons.length > 0,
    reviewReasons,
  };
}

function buildSheetIssueDrafts(input: {
  sheetName: string;
  hidden: boolean;
  mergedCellsCount: number;
  formulaCellsCount: number;
  duplicateColumnNames: string[];
  columns: ColumnProfile[];
  primaryBlock?: CandidateDataBlock;
}): IssueDraft[] {
  const drafts: IssueDraft[] = [];

  if (input.hidden) {
    drafts.push({
      code: "HIDDEN_SHEET",
      severity: "informational",
      message: "Sheet is hidden in the workbook.",
      exampleLocation: { sheetName: input.sheetName },
    });
  }
  if (input.mergedCellsCount > 0) {
    drafts.push({
      code: "MERGED_CELLS_DETECTED",
      severity: "informational",
      message: "Merged cells were detected and may affect later mapping review.",
      exampleLocation: { sheetName: input.sheetName },
    });
  }
  if (input.formulaCellsCount > 0) {
    drafts.push({
      code: "FORMULAS_DETECTED",
      severity: "informational",
      message: "Formula cells were detected. Formulas are read as workbook data and never executed.",
      exampleLocation: { sheetName: input.sheetName },
    });
  }
  input.duplicateColumnNames.forEach((header) => {
    drafts.push({
      code: "DUPLICATE_HEADER",
      severity: "review",
      message: `Duplicate normalized header detected: ${header}`,
      affectedColumn: header,
      exampleLocation: { sheetName: input.sheetName, rowNumber: input.primaryBlock?.headerRow },
    });
  });
  if (input.primaryBlock) {
    input.columns.forEach((column) => {
      if (!column.normalizedHeader) {
        drafts.push({
          code: "EMPTY_HEADER",
          severity: "review",
          message: "Column inside the candidate data block has an empty or unusable header.",
          affectedColumn: column.columnLetter,
          exampleLocation: {
            sheetName: input.sheetName,
            rowNumber: input.primaryBlock?.headerRow,
            columnIndex: column.columnIndex,
          },
        });
      }
      if (column.inferredType === "mixed") {
        drafts.push({
          code: "MIXED_TYPES",
          severity: "review",
          message: "Column contains incompatible technical types in the profiled sample.",
          affectedColumn: column.columnLetter,
          exampleLocation: { sheetName: input.sheetName, columnIndex: column.columnIndex },
        });
      }
    });
  }

  return drafts;
}

function groupIssueDrafts(drafts: IssueDraft[]): ProfilingIssue[] {
  const grouped = new Map<string, ProfilingIssue>();

  drafts.forEach((draft) => {
    const key = `${draft.code}:${draft.severity}:${draft.message}`;
    const current = grouped.get(key);
    if (!current) {
      grouped.set(key, {
        code: draft.code,
        severity: draft.severity,
        message: draft.message,
        occurrences: 1,
        affectedColumns: draft.affectedColumn ? [draft.affectedColumn] : [],
        exampleLocations: draft.exampleLocation ? [draft.exampleLocation] : [],
      });
      return;
    }
    current.occurrences = (current.occurrences ?? 1) + 1;
    if (draft.affectedColumn && !current.affectedColumns?.includes(draft.affectedColumn)) {
      current.affectedColumns = [...(current.affectedColumns ?? []), draft.affectedColumn];
    }
    if (draft.exampleLocation && (current.exampleLocations?.length ?? 0) < 5) {
      current.exampleLocations = [...(current.exampleLocations ?? []), draft.exampleLocation];
    }
  });

  return [...grouped.values()];
}

function findDuplicateHeaders(
  scan: SheetScan,
  headerRow: number | undefined,
  primaryBlock?: CandidateDataBlock,
): string[] {
  if (!headerRow || !primaryBlock) return [];

  const seen = new Map<string, number>();
  const duplicates = new Set<string>();

  for (let columnIndex = primaryBlock.startColumn; columnIndex <= primaryBlock.endColumn; columnIndex += 1) {
    const normalized = normalizeHeader(scan.rows[headerRow]?.[columnIndex]?.textValue ?? "");
    if (!normalized) continue;
    const previousCount = seen.get(normalized) ?? 0;
    seen.set(normalized, previousCount + 1);
    if (previousCount > 0) duplicates.add(normalized);
  }

  return [...duplicates].sort();
}

function scoreHeaderRow(scan: SheetScan, rowNumber: number, startColumn: number, endColumn: number): number {
  const values: string[] = [];
  const normalizedValues: string[] = [];

  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
    const value = scan.rows[rowNumber]?.[columnIndex]?.textValue ?? "";
    if (!value) continue;
    values.push(value);
    normalizedValues.push(normalizeHeader(value));
  }

  if (values.length < 2) return 0;

  const usableHeaders = normalizedValues.filter(Boolean);
  const uniqueHeaders = new Set(usableHeaders);
  const textLikeCount = values.filter((value) => Number.isNaN(Number(value))).length;
  return clamp(
    usableHeaders.length / values.length * 0.45 +
      uniqueHeaders.size / Math.max(usableHeaders.length, 1) * 0.25 +
      textLikeCount / values.length * 0.3,
  );
}

function getColumnNonEmptyCount(scan: SheetScan, columnIndex: number, startRow: number, endRow: number): number {
  const safeStart = Math.max(1, startRow);
  const safeEnd = Math.min(scan.scannedRows, endRow);
  if (safeEnd < safeStart) return 0;
  return scan.columnPrefixes[columnIndex][safeEnd] - scan.columnPrefixes[columnIndex][safeStart - 1];
}

function findLastDataRow(
  scan: SheetScan,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
): number {
  for (let rowNumber = Math.min(endRow, scan.scannedRows); rowNumber >= startRow; rowNumber -= 1) {
    for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
      if (!scan.rows[rowNumber]?.[columnIndex]?.empty) return rowNumber;
    }
  }
  return startRow - 1;
}

function findFullBlockEndRow(
  scan: SheetScan,
  headerRow: number,
  startColumn: number,
  endColumn: number,
  fallbackEndRow: number,
): number {
  if (!scan.fullEffectiveRange) return fallbackEndRow;
  if (scan.totalRows > scan.scannedRows) return Math.max(fallbackEndRow, scan.totalRows);
  if (scan.fullEffectiveRange.endRow <= scan.scannedRows) return fallbackEndRow;
  let fullEndRow = fallbackEndRow;
  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
    fullEndRow = Math.max(fullEndRow, scan.fullColumnLastRows[columnIndex] ?? 0);
  }
  return fullEndRow >= headerRow ? fullEndRow : fallbackEndRow;
}

function countPopulatedCells(
  scan: SheetScan,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
): number {
  let count = 0;
  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
    count += getColumnNonEmptyCount(scan, columnIndex, startRow, endRow);
  }
  return count;
}

function countPopulatedColumns(
  scan: SheetScan,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
): number {
  let count = 0;
  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
    if (getColumnNonEmptyCount(scan, columnIndex, startRow, endRow) > 0) count += 1;
  }
  return count;
}

function scoreTypeConsistency(
  scan: SheetScan,
  startRow: number,
  endRow: number,
  startColumn: number,
  endColumn: number,
): number {
  const columnScores: number[] = [];
  const safeEnd = Math.min(endRow, startRow + 999, scan.scannedRows);

  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
    const counts = new Map<InferredCellType, number>();
    let nonEmptyCount = 0;
    for (let rowNumber = startRow; rowNumber <= safeEnd; rowNumber += 1) {
      const cell = scan.rows[rowNumber]?.[columnIndex];
      if (!cell || cell.empty) continue;
      nonEmptyCount += 1;
      counts.set(cell.inferredType, (counts.get(cell.inferredType) ?? 0) + 1);
    }
    if (nonEmptyCount > 0) columnScores.push(Math.max(...counts.values()) / nonEmptyCount);
  }

  return columnScores.length === 0
    ? 0
    : columnScores.reduce((sum, score) => sum + score, 0) / columnScores.length;
}

function inferCellType(cell: ExcelJS.Cell, options: ProfilingOptions): InferredCellType {
  const value = cell.value;

  if (isEmptyCellValue(value)) return "empty";
  if (options.inspectFormulas !== false && isFormulaCell(cell)) return "formula";
  if (typeof value === "string") return "string";
  if (typeof value === "number") return Number.isInteger(value) ? "integer" : "decimal";
  if (typeof value === "boolean") return "boolean";
  if (value instanceof Date) return isDateWithoutTime(value) ? "date" : "datetime";
  if (isTextObjectValue(value)) return "string";
  return "unknown";
}

function inferColumnType(observedTypes: Set<InferredCellType>, nonNullCount: number): InferredCellType {
  if (nonNullCount === 0) return "empty";
  const types = [...observedTypes].filter((type) => type !== "empty");
  if (types.length === 0) return "empty";
  if (types.length === 1) return types[0];

  const numericTypes = new Set(["integer", "decimal"]);
  if (types.every((type) => numericTypes.has(type))) return types.includes("decimal") ? "decimal" : "integer";

  const dateTypes = new Set(["date", "datetime"]);
  if (types.every((type) => dateTypes.has(type))) return types.includes("datetime") ? "datetime" : "date";

  return "mixed";
}

function isEmptyCellValue(value: ExcelJS.CellValue): boolean {
  return value === null || value === undefined || value === "";
}

function isFormulaCell(cell: ExcelJS.Cell): boolean {
  if (cell.type === ExcelJS.ValueType.Formula) return true;
  const value = cell.value;
  return Boolean(value && typeof value === "object" && ("formula" in value || "sharedFormula" in value));
}

function isTextObjectValue(value: ExcelJS.CellValue): boolean {
  return Boolean(value && typeof value === "object" && ("text" in value || "richText" in value || "hyperlink" in value));
}

function stringifyCellValue(value: ExcelJS.CellValue): string {
  if (isEmptyCellValue(value)) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);

  if (value && typeof value === "object") {
    if ("formula" in value && typeof value.formula === "string") return `=${value.formula}`;
    if ("sharedFormula" in value && typeof value.sharedFormula === "string") return `=${value.sharedFormula}`;
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => (part && typeof part === "object" && "text" in part && typeof part.text === "string" ? part.text : ""))
        .join("");
    }
    if ("error" in value && typeof value.error === "string") return value.error;
  }

  return String(value);
}

function normalizeHeader(header: string): string {
  return header
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function applySamplePolicy(value: string, policy: SamplePolicy): string | undefined {
  if (policy === "none") return undefined;
  if (policy === "full") return value;
  return maskSensitiveString(value);
}

function maskSensitiveString(value: string): string {
  let masked = value;
  masked = masked.replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]");
  masked = masked.replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip]");
  masked = masked.replace(/\\\\[^\s]+/g, "[network_path]");
  masked = masked.replace(/\b(?:\+?\d[\d\s().-]{7,}\d)\b/g, "[phone_or_id]");
  masked = masked.replace(/\b(?=[A-Z0-9-]{8,}\b)(?=.*[A-Z])(?=.*\d)[A-Z0-9-]+\b/gi, "[identifier]");
  return masked;
}

function isDateWithoutTime(value: Date): boolean {
  return (
    value.getUTCHours() === 0 &&
    value.getUTCMinutes() === 0 &&
    value.getUTCSeconds() === 0 &&
    value.getUTCMilliseconds() === 0
  );
}

function getConfiguredHeaderRow(sheetName: string, options: ProfilingOptions): number | undefined {
  return options.sheets?.[sheetName]?.headerRow;
}

function countMergedCells(worksheet: ExcelJS.Worksheet): number {
  const model = worksheet.model as { merges?: unknown[] | Record<string, unknown> };
  if (Array.isArray(model.merges)) return model.merges.length;
  if (model.merges && typeof model.merges === "object") return Object.keys(model.merges).length;
  return 0;
}

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

function getSafeRelativePath(absolutePath: string, root?: string): string | undefined {
  if (!root) return path.basename(absolutePath);
  const relativePath = path.relative(path.resolve(root), absolutePath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) return undefined;
  return relativePath;
}

function buildRange(startRow: number, endRow: number, startColumn: number, endColumn: number): CellRange {
  return {
    startRow,
    endRow,
    startColumn,
    endColumn,
    address: `${columnNumberToName(startColumn)}${startRow}:${columnNumberToName(endColumn)}${endRow}`,
  };
}

function columnNumberToName(columnNumber: number): string {
  let name = "";
  let current = columnNumber;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function toSourceProfileJson(profile: WorkbookProfile): unknown {
  return {
    file: {
      file_name: profile.sourceFile.originalFilename,
      absolute_path: profile.sourceFile.absolutePath,
      relative_path: profile.sourceFile.relativePath,
      size_bytes: profile.sourceFile.sizeBytes,
      mime_type: profile.sourceFile.mimeType,
      sha256: profile.sourceFile.sha256,
      extension: profile.sourceFile.extension,
      processed_at: profile.sourceFile.processedAt ?? profile.profiledAt,
      workbook_sheet_count: profile.sourceFile.workbookSheetCount ?? profile.sheets.length,
      sample_policy: profile.samplePolicy,
      warnings: profile.sourceFile.warnings ?? [],
    },
    sample_policy: profile.samplePolicy,
    sheets: profile.sheets.map((sheet) => ({
      sheet_name: sheet.name,
      sheet_index: sheet.sheetIndex,
      row_count: sheet.rowCount,
      total_rows: sheet.totalRows,
      data_rows: sheet.dataRows,
      scanned_rows: sheet.scannedRows,
      sampling_applied: sheet.samplingApplied,
      sampling_limit: sheet.samplingLimit,
      column_count: sheet.columnCount,
      detected_header_row: sheet.headerRow,
      hidden: sheet.hidden,
      merged_cells_count: sheet.mergedCellsCount,
      formula_cells_count: sheet.formulaCellsCount,
      empty_rows_count: sheet.emptyRowsCount,
      non_empty_rows_count: sheet.nonEmptyRowsCount,
      physical_range: toJsonRange(sheet.physicalRange),
      effective_non_empty_range: sheet.effectiveNonEmptyRange ? toJsonRange(sheet.effectiveNonEmptyRange) : undefined,
      candidate_data_blocks: sheet.candidateDataBlocks.map((block) => ({
        range: block.range,
        full_range: block.fullRange,
        scanned_range: block.scannedRange,
        start_row: block.startRow,
        end_row: block.endRow,
        scanned_end_row: block.scannedEndRow,
        start_column: block.startColumn,
        end_column: block.endColumn,
        header_row: block.headerRow,
        confidence: block.confidence,
        reasons: block.reasons,
        row_density: block.rowDensity,
        populated_column_count: block.populatedColumnCount,
      })),
      structural_class: sheet.structuralClass,
      structural_confidence: sheet.structuralConfidence,
      structural_signals: sheet.structuralSignals,
      suggested_class: sheet.suggestedClass,
      suggested_range: sheet.suggestedRange,
      suggestion_confidence: sheet.suggestionConfidence,
      needs_human_review: sheet.needsHumanReview,
      review_reasons: sheet.reviewReasons,
      issues: sheet.issues.map(toJsonIssue),
      columns: sheet.columns.map((column) => ({
        column_index: column.columnIndex,
        column_letter: column.columnLetter,
        header: column.header,
        normalized_header: column.normalizedHeader,
        inferred_type: column.inferredType,
        null_count: column.nullCount,
        non_null_count: column.nonNullCount,
        unique_count: column.uniqueValueCount,
        uniqueness_ratio: column.uniquenessRatio,
        formula_count: column.formulaCount,
        sample_values: column.sampleValues,
        sample_policy: profile.samplePolicy,
        statistics_sampled: column.statisticsSampled || sheet.samplingApplied,
        scanned_rows: column.scannedRows,
        min_value: column.minValue,
        max_value: column.maxValue,
        min_date: column.minDate,
        max_date: column.maxDate,
        possible_catalog: column.possibleCatalog,
        issues: column.issues.map(toJsonIssue),
      })),
    })),
    issues: profile.issues.map(toJsonIssue),
  };
}

function toJsonRange(range: CellRange): unknown {
  return {
    range: range.address,
    start_row: range.startRow,
    end_row: range.endRow,
    start_column: range.startColumn,
    end_column: range.endColumn,
  };
}

function toJsonIssue(issue: ProfilingIssue): unknown {
  return {
    code: issue.code,
    severity: issue.severity,
    message: issue.message,
    occurrences: issue.occurrences ?? 1,
    affected_columns: issue.affectedColumns ?? [],
    example_locations: issue.exampleLocations ?? [],
    location: issue.location,
  };
}
