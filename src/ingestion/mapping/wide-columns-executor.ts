import ExcelJS from "exceljs";

import type { MappingSourceConfig, SemanticMappingConfig } from "./types";
import type { CatalogRecord, MappedSourceRecord } from "./execution-types";
import { runFieldLookup } from "./lookup-runner";
import { runResolverPipeline } from "./resolver-runner";
import { issue, runFieldTransformations } from "./transformation-runner";
import { buildRecord, columnNumberToName, parseRange, stringifyCell } from "./executor-utils";

export function executeWideColumnsSource(input: {
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
  const records: MappedSourceRecord[] = [];
  let availableRecords = 0;

  for (let column = range.startColumn; column <= range.endColumn; column += 1) {
    const header = stringifyCell(input.worksheet.getRow(source.header_row).getCell(column).value).trim();
    if (!header) continue;
    const headerEvaluation = evaluateColumnHeader({ source, header, catalogs: input.catalogs });

    for (let rowNumber = Math.max(range.startRow, source.header_row + 1); rowNumber <= range.endRow; rowNumber += 1) {
      const rawCellValue = stringifyCell(input.worksheet.getRow(rowNumber).getCell(column).value).trim();
      if (!rawCellValue) continue;
      availableRecords += 1;
      if (input.maxRecords !== undefined && records.length >= input.maxRecords) continue;

      const semanticValues: Record<string, unknown> = {};
      const rawValues: Record<string, unknown> = {
        source_column_header: header,
        source_cell_value: rawCellValue,
      };
      const preservedValues: Record<string, unknown> = { ...headerEvaluation.preservedValues };
      const transformations: MappedSourceRecord["transformations"] = [...headerEvaluation.transformations];
      const resolutions: MappedSourceRecord["resolutions"] = [...headerEvaluation.resolutions];
      const issues: MappedSourceRecord["issues"] = [...headerEvaluation.issues];
      Object.assign(semanticValues, headerEvaluation.semanticValues);

      if (source.resolver?.type === "pipeline") {
        const resolved = runResolverPipeline({ resolver: source.resolver, values: semanticValues, catalogs: input.catalogs });
        Object.assign(semanticValues, resolved.values);
        resolutions.push(...resolved.traces);
        issues.push(...resolved.issues);
        semanticValues.resolution_method = "pipeline";
        semanticValues.resolution_status = resolved.issues.length > 0 ? "pending_review" : "resolved";
      }

      if (source.cell_value) {
        const transformed = runFieldTransformations(source.cell_value, rawCellValue);
        transformations.push(...transformed.traces);
        issues.push(...transformed.issues);
        semanticValues[source.cell_value.semantic_field] = transformed.value;
        if (source.cell_value.preserve_raw_value) preservedValues[source.cell_value.semantic_field] = rawCellValue;
      }

      for (const field of source.fields ?? []) {
        if (field.source_column !== "__cell_value__") continue;
        const transformed = runFieldTransformations(field, rawCellValue);
        transformations.push(...transformed.traces);
        issues.push(...transformed.issues);
        semanticValues[field.semantic_field] = transformed.value;
      }

      if ((source.semantic_review_values ?? []).includes(rawCellValue)) {
        issues.push(issue("SEMANTIC_REVIEW_VALUE", "pending_review", "Value requires semantic review.", source.cell_value?.semantic_field, {
          value: rawCellValue,
        }));
      }

      records.push(
        buildRecord({
          recordId: `${source.id}:${rowNumber}:${column}`,
          source,
          semanticValues,
          rawValues,
          preservedValues,
          locator: {
            sheet_name: input.worksheet.name,
            row_number: rowNumber,
            column_number: column,
            column_letter: columnNumberToName(column),
            column_header: header,
            cell_address: `${columnNumberToName(column)}${rowNumber}`,
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
  }

  return { records, availableRecords, truncated: input.maxRecords !== undefined && availableRecords > records.length };
}

function evaluateColumnHeader(input: {
  source: MappingSourceConfig;
  header: string;
  catalogs: Map<string, CatalogRecord[]>;
}): {
  semanticValues: Record<string, unknown>;
  preservedValues: Record<string, unknown>;
  transformations: MappedSourceRecord["transformations"];
  resolutions: MappedSourceRecord["resolutions"];
  issues: MappedSourceRecord["issues"];
} {
  const semanticValues: Record<string, unknown> = {};
  const preservedValues: Record<string, unknown> = {};
  const transformations: MappedSourceRecord["transformations"] = [];
  const resolutions: MappedSourceRecord["resolutions"] = [];
  const issues: MappedSourceRecord["issues"] = [];
  const field = input.source.column_header;
  if (!field) return { semanticValues, preservedValues, transformations, resolutions, issues };

  const transformed = runFieldTransformations(field, input.header);
  transformations.push(...transformed.traces);
  issues.push(...transformed.issues);
  semanticValues[field.semantic_field] = transformed.value;
  if (field.preserve_raw_value) preservedValues[field.semantic_field] = input.header;

  if (field.treatment === "lookup" && field.lookup) {
    const lookup = runFieldLookup({
      lookup: field.lookup,
      values: semanticValues,
      catalogs: input.catalogs,
      field: field.semantic_field,
    });
    resolutions.push(lookup.trace);
    if (lookup.output !== undefined) semanticValues[field.semantic_field] = lookup.output;
    if (lookup.issue) issues.push(lookup.issue);
  }

  return { semanticValues, preservedValues, transformations, resolutions, issues };
}
