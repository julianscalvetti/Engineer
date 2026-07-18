import ExcelJS from "exceljs";

import type { MappingSourceConfig, SemanticMappingConfig } from "./types";
import type { CatalogRecord, MappedSourceRecord } from "./execution-types";
import { buildHeaderIndex, columnSelectorKey, resolveConfiguredColumn } from "./column-selector";
import { runFieldLookup } from "./lookup-runner";
import { runConfiguredMeasurements } from "./measurement-runner";
import { issue, runFieldTransformations } from "./transformation-runner";
import { buildRecord, parseRange, stringifyCell } from "./executor-utils";

export function executeRowTableSource(input: {
  worksheet: ExcelJS.Worksheet;
  source: MappingSourceConfig;
  mapping: SemanticMappingConfig;
  sourceFileName: string;
  sourceFileSha256: string;
  catalogs: Map<string, CatalogRecord[]>;
  maxRecords?: number;
}): { records: MappedSourceRecord[]; availableRecords: number; truncated: boolean } {
  const source = input.source;
  const range = parseRange(source.data_range ?? `A1:${input.worksheet.columnCount}${input.worksheet.rowCount}`);
  const headerRow = input.worksheet.getRow(source.header_row);
  const headerIndex = buildHeaderIndex(headerRow, range.startColumn, range.endColumn);

  const records: MappedSourceRecord[] = [];
  let availableRecords = 0;
  for (let rowNumber = Math.max(range.startRow, source.header_row + 1); rowNumber <= range.endRow; rowNumber += 1) {
    const row = input.worksheet.getRow(rowNumber);
    const rowValues: string[] = [];
    for (let column = range.startColumn; column <= range.endColumn; column += 1) {
      rowValues.push(stringifyCell(row.getCell(column).value).trim());
    }
    if (rowValues.every((value) => !value)) continue;
    availableRecords += 1;
    if (input.maxRecords !== undefined && records.length >= input.maxRecords) continue;

    const semanticValues: Record<string, unknown> = {};
    const rawValues: Record<string, unknown> = {};
    const preservedValues: Record<string, unknown> = {};
    const transformations: MappedSourceRecord["transformations"] = [];
    const resolutions: MappedSourceRecord["resolutions"] = [];
    const issues: MappedSourceRecord["issues"] = [];

    for (const field of source.fields ?? []) {
      const resolvedColumn = resolveConfiguredColumn(field, headerIndex);
      const raw = resolvedColumn.columnNumber ? stringifyCell(row.getCell(resolvedColumn.columnNumber).value).trim() : "";
      if (field.source_column || field.source_column_selector) rawValues[columnSelectorKey(field)] = raw;
      if (field.preserve_raw_value) preservedValues[field.semantic_field] = raw;
      if (field.treatment === "derived_ignore") {
        preservedValues[`ignored:${field.semantic_field}`] = raw;
        continue;
      }

      const transformed = runFieldTransformations(field, raw);
      transformations.push(...transformed.traces);
      issues.push(...transformed.issues);
      semanticValues[field.semantic_field] = transformed.value;

      if (field.lookup) {
        const lookup = runFieldLookup({ lookup: field.lookup, values: semanticValues, catalogs: input.catalogs, field: field.semantic_field });
        resolutions.push(lookup.trace);
        if (lookup.output !== undefined) semanticValues[field.semantic_field] = lookup.output;
        if (lookup.issue) issues.push(lookup.issue);
      }
    }

    applySemanticReviewValues(source, semanticValues, issues);
    const measurementResult = runConfiguredMeasurements({
      measurements: source.measurements ?? [],
      row,
      headerIndex,
      sheetName: input.worksheet.name,
      rowNumber,
    });
    issues.push(...measurementResult.issues);

    records.push(
      buildRecord({
        recordId: `${source.id}:${rowNumber}`,
        source,
        semanticValues,
        rawValues,
        preservedValues,
        measurements: measurementResult.measurements,
        locator: {
          sheet_name: input.worksheet.name,
          row_number: rowNumber,
          selected_range: source.data_range,
          header_row: source.header_row,
        },
        transformations,
        resolutions,
        issues,
        mappingId: input.mapping.mapping_id,
        mappingVersion: input.mapping.mapping_version,
        sourceFileName: input.sourceFileName,
        sourceFileSha256: input.sourceFileSha256,
      }),
    );
  }

  return { records, availableRecords, truncated: input.maxRecords !== undefined && availableRecords > records.length };
}

function applySemanticReviewValues(
  source: MappingSourceConfig,
  semanticValues: Record<string, unknown>,
  issues: MappedSourceRecord["issues"],
): void {
  const reviewValues = new Set(source.semantic_review_values ?? []);
  Object.entries(semanticValues).forEach(([field, value]) => {
    if (reviewValues.has(String(value))) {
      issues.push(issue("SEMANTIC_REVIEW_VALUE", "pending_review", "Value requires semantic review.", field, {
        value: String(value),
      }));
    }
  });
}
