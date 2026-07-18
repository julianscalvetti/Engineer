import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";
import { parseDocument } from "yaml";

import type {
  AdjacentRowInspection,
  CellCoordinate,
  ParsedCellRange,
  SemanticMappingConfig,
  SheetInspection,
  SourceProfileSummary,
  SourceSelectionConfig,
} from "./types";

export interface LoadedYaml<T> {
  path: string;
  value?: T;
  errors: string[];
}

interface PopulationScan {
  effectiveRange?: ParsedCellRange;
  populatedRows: Set<number>;
  populatedColumns: Set<number>;
  rowToColumns: Map<number, Set<number>>;
  columnToRows: Map<number, Set<number>>;
  cells: CellCoordinate[];
}

export async function assertReadableFile(filePath: string): Promise<string | undefined> {
  const absolutePath = path.resolve(filePath);
  try {
    const stats = await stat(absolutePath);
    if (!stats.isFile()) return "Path is not a file.";
    await access(absolutePath);
    return undefined;
  } catch (error) {
    return error instanceof Error ? error.message : "File is not readable.";
  }
}

export async function loadSemanticMapping(filePath: string): Promise<LoadedYaml<SemanticMappingConfig>> {
  return loadYamlFile<SemanticMappingConfig>(filePath);
}

export async function loadSourceSelection(filePath: string): Promise<LoadedYaml<SourceSelectionConfig>> {
  return loadYamlFile<SourceSelectionConfig>(filePath);
}

export async function loadSourceProfile(filePath: string): Promise<LoadedYaml<SourceProfileSummary>> {
  const absolutePath = path.resolve(filePath);
  const readError = await assertReadableFile(absolutePath);
  if (readError) return { path: absolutePath, errors: [readError] };

  try {
    const content = await readFile(absolutePath, "utf8");
    const parsed = JSON.parse(content) as SourceProfileSummary;
    return { path: absolutePath, value: parsed, errors: [] };
  } catch (error) {
    return {
      path: absolutePath,
      errors: [error instanceof Error ? error.message : "Invalid JSON profile."],
    };
  }
}

export async function inspectWorkbook(
  filePath: string,
  requests: Array<{ sheet: string; headerRow: number; dataRange?: string }>,
): Promise<{ sha256: string; inspections: SheetInspection[]; sheetNames: string[] }> {
  const absolutePath = path.resolve(filePath);
  const workbook = new ExcelJS.Workbook();
  const [sha256] = await Promise.all([calculateSha256(absolutePath), workbook.xlsx.readFile(absolutePath)]);
  const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
  const inspections: SheetInspection[] = [];

  for (const request of requests) {
    const worksheet = workbook.getWorksheet(request.sheet);
    if (!worksheet) {
      inspections.push({
        sheet: request.sheet,
        headerRow: request.headerRow,
        dataRange: request.dataRange,
        physicalRange: buildRange(1, 1, 1, 1),
        columns: [],
        selectedHeaderValues: [],
        selectedDataCellCount: 0,
        populatedColumnsInSheet: 0,
        populatedColumnsInSelectedRange: 0,
        columnCoverageRatio: 0,
        populatedRowsInSheet: 0,
        populatedRowsInSelectedRange: 0,
        rowCoverageRatio: 0,
        populatedDataOutsideRange: [],
        adjacentRows: [],
        sampleRows: {},
      });
      continue;
    }

    const physicalRange = buildRange(1, Math.max(worksheet.rowCount, 1), 1, Math.max(worksheet.columnCount, 1));
    const scan = scanWorksheet(worksheet);
    const effectiveRange = scan.effectiveRange;
    const range = request.dataRange
      ? parseRange(request.dataRange)
      : effectiveRange ?? physicalRange;
    const startColumn = range.startColumn;
    const endColumn = range.endColumn;
    const header = worksheet.getRow(request.headerRow);
    const columns: string[] = [];
    const selectedHeaderValues: string[] = [];

    for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
      const value = stringifyCellValue(header.getCell(columnIndex).value).trim();
      selectedHeaderValues.push(value);
      if (value) columns.push(value);
    }

    const populatedColumnsInSheet = scan.populatedColumns.size;
    const populatedColumnsInSelectedRange = countPopulatedColumns(scan, range);
    const populatedRowsInSheet = scan.populatedRows.size;
    const populatedRowsInSelectedRange = countPopulatedRows(scan, range);

    inspections.push({
      sheet: request.sheet,
      headerRow: request.headerRow,
      dataRange: request.dataRange,
      selectedRange: range,
      physicalRange,
      effectiveRange,
      columns,
      selectedHeaderValues,
      selectedDataCellCount: countPopulatedCells(
        scan,
        buildRange(Math.min(request.headerRow + 1, range.endRow), range.endRow, range.startColumn, range.endColumn),
      ),
      populatedColumnsInSheet,
      populatedColumnsInSelectedRange,
      columnCoverageRatio: ratio(populatedColumnsInSelectedRange, populatedColumnsInSheet),
      populatedRowsInSheet,
      populatedRowsInSelectedRange,
      rowCoverageRatio: ratio(populatedRowsInSelectedRange, populatedRowsInSheet),
      populatedDataOutsideRange: findPopulatedDataOutsideRange(scan, range, effectiveRange),
      adjacentRows: inspectAdjacentRows(worksheet, request.headerRow, range),
      sampleRows: sampleRows(worksheet, range),
    });
  }

  return { sha256, inspections, sheetNames };
}

export function parseRange(range: string): {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  address: string;
} {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(range.trim());
  if (!match) {
    throw new Error("Invalid range format.");
  }

  const startColumn = columnNameToNumber(match[1]);
  const startRow = Number(match[2]);
  const endColumn = columnNameToNumber(match[3]);
  const endRow = Number(match[4]);

  if (startRow < 1 || endRow < startRow || startColumn < 1 || endColumn < startColumn) {
    throw new Error("Invalid range boundaries.");
  }

  return { ...buildRange(startRow, endRow, startColumn, endColumn) };
}

async function loadYamlFile<T>(filePath: string): Promise<LoadedYaml<T>> {
  const absolutePath = path.resolve(filePath);
  const readError = await assertReadableFile(absolutePath);
  if (readError) return { path: absolutePath, errors: [readError] };

  const content = await readFile(absolutePath, "utf8");
  const document = parseDocument(content, { prettyErrors: false });
  const errors = [...document.errors, ...document.warnings].map((error) => error.message);
  if (errors.length > 0) return { path: absolutePath, errors };

  return { path: absolutePath, value: document.toJS() as T, errors: [] };
}

async function calculateSha256(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  const stream = createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

function stringifyCellValue(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
        .join("");
    }
    if ("formula" in value && typeof value.formula === "string") return `=${value.formula}`;
  }
  return String(value);
}

function scanWorksheet(worksheet: ExcelJS.Worksheet): PopulationScan {
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = 0;
  let minColumn = Number.POSITIVE_INFINITY;
  let maxColumn = 0;
  const populatedRows = new Set<number>();
  const populatedColumns = new Set<number>();
  const rowToColumns = new Map<number, Set<number>>();
  const columnToRows = new Map<number, Set<number>>();
  const cells: CellCoordinate[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    row.eachCell({ includeEmpty: false }, (cell, columnIndex) => {
      const value = stringifyCellValue(cell.value).trim();
      if (!value) return;
      minRow = Math.min(minRow, rowNumber);
      maxRow = Math.max(maxRow, rowNumber);
      minColumn = Math.min(minColumn, columnIndex);
      maxColumn = Math.max(maxColumn, columnIndex);
      populatedRows.add(rowNumber);
      populatedColumns.add(columnIndex);
      addToSetMap(rowToColumns, rowNumber, columnIndex);
      addToSetMap(columnToRows, columnIndex, rowNumber);
      cells.push({
        address: `${columnNumberToName(columnIndex)}${rowNumber}`,
        rowNumber,
        columnIndex,
        value,
      });
    });
  });

  return {
    effectiveRange: maxRow === 0 ? undefined : buildRange(minRow, maxRow, minColumn, maxColumn),
    populatedRows,
    populatedColumns,
    rowToColumns,
    columnToRows,
    cells,
  };
}

function countPopulatedColumns(scan: PopulationScan, range: ParsedCellRange | undefined): number {
  if (!range) return 0;
  let count = 0;
  for (let columnIndex = range.startColumn; columnIndex <= range.endColumn; columnIndex += 1) {
    if (columnHasValues(scan, columnIndex, range.startRow, range.endRow)) count += 1;
  }
  return count;
}

function countPopulatedRows(scan: PopulationScan, range: ParsedCellRange | undefined): number {
  if (!range) return 0;
  let count = 0;
  for (let rowNumber = range.startRow; rowNumber <= range.endRow; rowNumber += 1) {
    if (rowHasValues(scan, rowNumber, range.startColumn, range.endColumn)) count += 1;
  }
  return count;
}

function countPopulatedCells(scan: PopulationScan, range: ParsedCellRange): number {
  if (range.endRow < range.startRow || range.endColumn < range.startColumn) return 0;
  let count = 0;
  for (const cell of scan.cells) {
    if (isCellInRange(cell, range)) count += 1;
  }
  return count;
}

function findPopulatedDataOutsideRange(
  scan: PopulationScan,
  range: ParsedCellRange,
  effectiveRange: ParsedCellRange | undefined,
): SheetInspection["populatedDataOutsideRange"] {
  if (!effectiveRange) return [];
  const outside: SheetInspection["populatedDataOutsideRange"] = [];

  if (range.endColumn < effectiveRange.endColumn) {
    let lastContiguousColumn = range.endColumn;
    for (let columnIndex = range.endColumn + 1; columnIndex <= effectiveRange.endColumn; columnIndex += 1) {
      if (!columnHasValues(scan, columnIndex, range.startRow, range.endRow)) break;
      lastContiguousColumn = columnIndex;
    }
    if (lastContiguousColumn > range.endColumn) {
      outside.push({
        direction: "right",
        count: lastContiguousColumn - range.endColumn,
        examples: collectExamples(
          scan,
          buildRange(range.startRow, range.endRow, range.endColumn + 1, lastContiguousColumn),
        ),
        observedAlternativeRange: buildRange(
          range.startRow,
          range.endRow,
          range.startColumn,
          lastContiguousColumn,
        ).address,
      });
    }
  }

  if (range.endRow < effectiveRange.endRow) {
    let lastContiguousRow = range.endRow;
    for (let rowNumber = range.endRow + 1; rowNumber <= effectiveRange.endRow; rowNumber += 1) {
      if (!rowHasValues(scan, rowNumber, range.startColumn, range.endColumn)) break;
      lastContiguousRow = rowNumber;
    }
    if (lastContiguousRow > range.endRow) {
      outside.push({
        direction: "below",
        count: lastContiguousRow - range.endRow,
        examples: collectExamples(
          scan,
          buildRange(range.endRow + 1, lastContiguousRow, range.startColumn, range.endColumn),
        ),
        observedAlternativeRange: buildRange(
          range.startRow,
          lastContiguousRow,
          range.startColumn,
          range.endColumn,
        ).address,
      });
    }
  }

  return outside;
}

function inspectAdjacentRows(
  worksheet: ExcelJS.Worksheet,
  headerRow: number,
  range: ParsedCellRange,
): AdjacentRowInspection[] {
  return [headerRow - 1, headerRow + 1]
    .filter((rowNumber) => rowNumber >= 1 && rowNumber <= worksheet.rowCount)
    .map((rowNumber) => {
      const values = getRowValues(worksheet, rowNumber, range.startColumn, range.endColumn);
      const nonEmptyValues = values.filter(Boolean);
      return {
        rowNumber,
        nonEmptyValues: nonEmptyValues.length,
        distinctValues: new Set(nonEmptyValues).size,
        values,
      };
    });
}

function sampleRows(worksheet: ExcelJS.Worksheet, range: ParsedCellRange): Record<number, string[]> {
  const rows: Record<number, string[]> = {};
  const endRow = Math.min(range.endRow, range.startRow + 199);
  for (let rowNumber = range.startRow; rowNumber <= endRow; rowNumber += 1) {
    rows[rowNumber] = getRowValues(worksheet, rowNumber, range.startColumn, range.endColumn);
  }
  return rows;
}

function collectExamples(
  scan: PopulationScan,
  range: ParsedCellRange,
): CellCoordinate[] {
  const examples: CellCoordinate[] = [];
  for (const cell of scan.cells) {
    if (!isCellInRange(cell, range)) continue;
    examples.push(cell);
    if (examples.length >= 5) return examples;
  }
  return examples;
}

function getRowValues(
  worksheet: ExcelJS.Worksheet,
  rowNumber: number,
  startColumn: number,
  endColumn: number,
): string[] {
  const row = worksheet.getRow(rowNumber);
  const values: string[] = [];
  for (let columnIndex = startColumn; columnIndex <= endColumn; columnIndex += 1) {
    values.push(stringifyCellValue(row.getCell(columnIndex).value).trim());
  }
  return values;
}

function columnHasValues(
  scan: PopulationScan,
  columnIndex: number,
  startRow: number,
  endRow: number,
): boolean {
  for (const rowNumber of scan.columnToRows.get(columnIndex) ?? []) {
    if (rowNumber >= startRow && rowNumber <= endRow) return true;
  }
  return false;
}

function rowHasValues(
  scan: PopulationScan,
  rowNumber: number,
  startColumn: number,
  endColumn: number,
): boolean {
  for (const columnIndex of scan.rowToColumns.get(rowNumber) ?? []) {
    if (columnIndex >= startColumn && columnIndex <= endColumn) return true;
  }
  return false;
}

function addToSetMap(map: Map<number, Set<number>>, key: number, value: number): void {
  const existing = map.get(key);
  if (existing) {
    existing.add(value);
    return;
  }
  map.set(key, new Set([value]));
}

function isCellInRange(cell: CellCoordinate, range: ParsedCellRange): boolean {
  return (
    cell.rowNumber >= range.startRow &&
    cell.rowNumber <= range.endRow &&
    cell.columnIndex >= range.startColumn &&
    cell.columnIndex <= range.endColumn
  );
}

function buildRange(startRow: number, endRow: number, startColumn: number, endColumn: number): ParsedCellRange {
  return {
    startRow,
    endRow,
    startColumn,
    endColumn,
    address: `${columnNumberToName(startColumn)}${startRow}:${columnNumberToName(endColumn)}${endRow}`,
  };
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number((numerator / denominator).toFixed(4));
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

function columnNameToNumber(columnName: string): number {
  return columnName
    .toUpperCase()
    .split("")
    .reduce((sum, character) => sum * 26 + character.charCodeAt(0) - 64, 0);
}
