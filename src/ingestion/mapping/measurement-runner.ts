import ExcelJS from "exceljs";

import type { MappingFieldConfig, MeasurementConformityStatusConfig, MeasurementMappingConfig } from "./types";
import type { ControlMeasurementPreview, ExecutionIssue } from "./execution-types";
import type { HeaderIndex } from "./column-selector";
import { columnSelectorKey, resolveConfiguredColumn } from "./column-selector";
import { columnNumberToName, stringifyCell } from "./executor-utils";
import { runFieldTransformations } from "./transformation-runner";

export function runConfiguredMeasurements(input: {
  measurements: MeasurementMappingConfig[];
  row: ExcelJS.Row;
  headerIndex: HeaderIndex;
  sheetName: string;
  rowNumber: number;
}): { measurements: ControlMeasurementPreview[]; issues: ExecutionIssue[] } {
  const measurements: ControlMeasurementPreview[] = [];
  const issues: ExecutionIssue[] = [];

  for (const config of input.measurements) {
    const resolvedColumn = resolveConfiguredColumn(config.value, input.headerIndex);
    const columnNumber = resolvedColumn.columnNumber;
    const rawValue = columnNumber ? stringifyCell(input.row.getCell(columnNumber).value).trim() : "";
    const measurementId = getMeasurementId(config);

    if (!rawValue && !config.value.required && !config.value.on_missing) continue;

    const valueField = toValueField(config, measurementId);
    const transformed = runFieldTransformations(valueField, rawValue);
    const measurementIssues = [...transformed.issues];
    const typedValue = transformed.value;

    if ((typedValue === null || typedValue === "") && !config.value.required) {
      issues.push(...measurementIssues);
      continue;
    }

    const conformity = runConformityStatus(config.conformity_status, input.row, input.headerIndex, measurementId);
    measurementIssues.push(...conformity.issues);
    issues.push(...measurementIssues);

    measurements.push({
      measurement_id: measurementId,
      semantic_entity: "control_measurement",
      characteristic: {
        external_code: config.characteristic.external_code,
        name: config.characteristic.name,
      },
      typed_value: typedValue,
      unit: config.unit,
      acceptance_criterion: config.acceptance_criterion,
      conformity_status: conformity.value,
      source: {
        source_column: columnSelectorKey(config.value),
        raw_value: rawValue || null,
        sheet_name: input.sheetName,
        row_number: input.rowNumber,
        column_number: columnNumber,
        column_letter: columnNumber ? columnNumberToName(columnNumber) : undefined,
        cell_address: columnNumber ? `${columnNumberToName(columnNumber)}${input.rowNumber}` : undefined,
      },
      transformations: [...transformed.traces, ...conformity.transformations],
      issues: measurementIssues,
    });
  }

  return { measurements, issues };
}

function runConformityStatus(
  config: MeasurementConformityStatusConfig | undefined,
  row: ExcelJS.Row,
  headerIndex: HeaderIndex,
  measurementId: string,
): {
  value?: unknown;
  transformations: ControlMeasurementPreview["transformations"];
  issues: ExecutionIssue[];
} {
  if (!config) return { transformations: [], issues: [] };
  const columnNumber = resolveConfiguredColumn(config, headerIndex).columnNumber;
  const rawValue = columnNumber ? stringifyCell(row.getCell(columnNumber).value).trim() : "";
  if (!rawValue && !config.required && !config.on_missing) return { transformations: [], issues: [] };

  const transformed = runFieldTransformations(toConformityField(config, measurementId), rawValue);
  return {
    value: transformed.value,
    transformations: transformed.traces,
    issues: transformed.issues,
  };
}

function toValueField(config: MeasurementMappingConfig, measurementId: string): MappingFieldConfig {
  return {
    source_column: config.value.source_column,
    source_column_selector: config.value.source_column_selector,
    semantic_field: `control_measurement.${measurementId}.typed_value`,
    data_type: config.value.data_type,
    required: config.value.required,
    treatment: "direct",
    transformations: config.value.transformations,
    preserve_raw_value: config.value.preserve_raw_value ?? true,
    on_missing: config.value.on_missing,
    regex: config.value.regex,
    on_no_match: config.value.on_no_match,
    fallback_value: config.value.fallback_value,
  };
}

function toConformityField(config: MeasurementConformityStatusConfig, measurementId: string): MappingFieldConfig {
  return {
    source_column: config.source_column,
    source_column_selector: config.source_column_selector,
    semantic_field: `control_measurement.${measurementId}.conformity_status`,
    data_type: "string",
    required: config.required ?? false,
    treatment: "direct",
    transformations: config.transformations,
    preserve_raw_value: config.preserve_raw_value ?? true,
    on_missing: config.on_missing,
  };
}

function getMeasurementId(config: MeasurementMappingConfig): string {
  return config.id ?? config.characteristic.external_code ?? config.characteristic.name ?? "measurement";
}
