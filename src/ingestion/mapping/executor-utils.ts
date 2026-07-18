import ExcelJS from "exceljs";

import type { MappingSourceConfig } from "./types";
import type { ExecutionIssue, MappedSourceRecord, PreviewStatus, SourceLocator } from "./execution-types";

export function stringifyCell(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
  if (value && typeof value === "object") {
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("richText" in value && Array.isArray(value.richText)) {
      return value.richText
        .map((part) => (part && typeof part === "object" && "text" in part ? String(part.text) : ""))
        .join("");
    }
    if ("result" in value) return stringifyCell(value.result as ExcelJS.CellValue);
    if ("formula" in value && typeof value.formula === "string") return `=${value.formula}`;
  }
  return String(value);
}

export function columnNumberToName(columnNumber: number): string {
  let name = "";
  let current = columnNumber;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

export function parseRange(range: string): { startRow: number; endRow: number; startColumn: number; endColumn: number } {
  const match = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(range);
  if (!match) throw new Error(`Invalid range: ${range}`);
  return {
    startColumn: columnNameToNumber(match[1]),
    startRow: Number(match[2]),
    endColumn: columnNameToNumber(match[3]),
    endRow: Number(match[4]),
  };
}

export function buildRecord(input: {
  recordId: string;
  source: MappingSourceConfig;
  semanticValues: Record<string, unknown>;
  rawValues: Record<string, unknown>;
  preservedValues: Record<string, unknown>;
  measurements?: MappedSourceRecord["measurements"];
  locator: SourceLocator;
  transformations: MappedSourceRecord["transformations"];
  resolutions: MappedSourceRecord["resolutions"];
  issues: ExecutionIssue[];
  mappingId: string;
  mappingVersion: string;
  sourceFileName: string;
  sourceFileSha256: string;
}): MappedSourceRecord {
  return {
    record_id: input.recordId,
    source_id: input.source.id,
    semantic_entity: input.source.id,
    source_layout: input.source.layout,
    status: statusFromIssues(input.issues),
    semantic_values: input.semanticValues,
    raw_values: input.rawValues,
    preserved_values: input.preservedValues,
    measurements: input.measurements ?? [],
    source_locator: input.locator,
    transformations: input.transformations,
    resolutions: input.resolutions,
    issues: input.issues,
    mapping_id: input.mappingId,
    mapping_version: input.mappingVersion,
    source_file_name: input.sourceFileName,
    source_file_sha256: input.sourceFileSha256,
  };
}

export function statusFromIssues(issues: ExecutionIssue[]): PreviewStatus {
  if (issues.some((item) => item.severity === "rejected")) return "rejected";
  if (issues.some((item) => item.severity === "pending_review")) return "pending_review";
  if (issues.some((item) => item.severity === "warning")) return "warning";
  return "valid";
}

export function columnNameToNumber(columnName: string): number {
  return columnName
    .toUpperCase()
    .split("")
    .reduce((sum, character) => sum * 26 + character.charCodeAt(0) - 64, 0);
}
