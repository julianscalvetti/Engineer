import path from "node:path";

import {
  SUPPORTED_DATA_TYPES,
  SUPPORTED_LAYOUTS,
  SUPPORTED_MAPPING_VERSION,
  SUPPORTED_REGEX_FLAGS,
  SUPPORTED_RESOLVERS,
  SUPPORTED_RESOLVER_TRANSFORMATIONS,
  SUPPORTED_TRANSFORMATIONS,
  SUPPORTED_TREATMENTS,
  asStringArray,
  isObject,
} from "./schema";
import { parseRange } from "./loader";
import { evaluateResolverPipeline, type CatalogRecord } from "./engine";
import type {
  FieldLookupConfig,
  LookupSummary,
  MappingFieldConfig,
  MappingIssue,
  MeasurementMappingConfig,
  MappingSourceConfig,
  ProfileComparisonSummary,
  ResolverSummary,
  ResolverLimitedTestSummary,
  ResolverScopeConfig,
  ResolverStepConfig,
  SemanticMappingConfig,
  SheetInspection,
  SourceProfileSheetSummary,
  SourceProfileSummary,
  SourceSelectionConfig,
} from "./types";
import type { ColumnReferenceConfig } from "./column-selector";
import { columnNameToNumber } from "./executor-utils";

export interface ValidationContext {
  mappingPath: string;
  sourceSelectionPath: string;
  mapping?: SemanticMappingConfig;
  sourceSelection?: SourceSelectionConfig;
  sourceProfile?: SourceProfileSummary;
  sheetNames: string[];
  inspections: SheetInspection[];
  sourceFileSha256: string;
  loadErrors: MappingIssue[];
}

export interface ValidationResult {
  errors: MappingIssue[];
  warnings: MappingIssue[];
  informational: MappingIssue[];
  sourceSummaries: Array<{
    id: string;
    sheet: string;
    layout: string;
    selectedRange?: string;
    selectedHeaderRow: number;
    profile?: ProfileComparisonSummary;
    populatedColumnsInSheet: number;
    populatedColumnsInSelectedRange: number;
    columnCoverageRatio: number;
    populatedRowsInSheet: number;
    populatedRowsInSelectedRange: number;
    rowCoverageRatio: number;
    headerPlausibilityScore: number;
    catalogHeaderMatchRatio?: number;
    populatedDataOutsideRange: SheetInspection["populatedDataOutsideRange"];
    structuralWarnings: MappingIssue[];
    semanticFields: string[];
    transformations: string[];
    columnsFound: string[];
    columnsMissing: string[];
  }>;
  layoutsUsed: string[];
  semanticFields: string[];
  transformations: string[];
  dependencies: Record<string, string[]>;
  resolvers: ResolverSummary[];
  lookups: LookupSummary[];
  resolverTests: ResolverLimitedTestSummary[];
}

export function validateMappingContext(context: ValidationContext): ValidationResult {
  const errors: MappingIssue[] = context.loadErrors.filter((issue) => issue.severity === "error");
  const warnings: MappingIssue[] = context.loadErrors.filter((issue) => issue.severity === "warning");
  const informational: MappingIssue[] = context.loadErrors.filter((issue) => issue.severity === "informational");
  const mapping = context.mapping;
  const sourceSelection = context.sourceSelection;
  const sourceSummaries: ValidationResult["sourceSummaries"] = [];
  const dependencies: Record<string, string[]> = {};
  const resolvers: ResolverSummary[] = [];
  const lookups: LookupSummary[] = [];
  const resolverTests: ResolverLimitedTestSummary[] = [];

  if (!mapping || !isObject(mapping)) {
    errors.push(issue("INVALID_MAPPING_SCHEMA", "Mapping YAML must contain an object."));
    return emptyResult(errors, warnings);
  }

  if (mapping.mapping_version !== SUPPORTED_MAPPING_VERSION) {
    errors.push(
      issue("UNSUPPORTED_MAPPING_VERSION", `Unsupported mapping version: ${String(mapping.mapping_version)}.`),
    );
  }

  if (!Array.isArray(mapping.sources)) {
    errors.push(issue("INVALID_MAPPING_SCHEMA", "Mapping must declare a sources array."));
    return emptyResult(errors, warnings);
  }

  if (mapping.source_selection_path) {
    const expectedSelection = path.resolve(path.dirname(context.mappingPath), mapping.source_selection_path);
    const actualSelection = path.resolve(context.sourceSelectionPath);
    if (expectedSelection !== actualSelection && path.resolve(mapping.source_selection_path) !== actualSelection) {
      warnings.push(
        warning("SOURCE_SELECTION_PATH_MISMATCH", "Mapping source_selection_path differs from the CLI selection path."),
      );
    }
  }

  if (mapping.source_file_sha256 && mapping.source_file_sha256 !== context.sourceFileSha256) {
    warnings.push(warning("SOURCE_HASH_MISMATCH", "Mapping source_file_sha256 differs from the input file hash."));
  }

  const sourceIds = new Set<string>();
  const duplicateSourceIds = new Set<string>();
  mapping.sources.forEach((source) => {
    if (sourceIds.has(source.id)) duplicateSourceIds.add(source.id);
    sourceIds.add(source.id);
  });
  duplicateSourceIds.forEach((id) => errors.push(issue("DUPLICATE_SOURCE", `Duplicate source id: ${id}.`, id)));

  const selectedSheets = new Map((sourceSelection?.sheets ?? []).map((sheet) => [sheet.name, sheet]));
  const inspectionBySheet = new Map(context.inspections.map((inspection) => [inspection.sheet, inspection]));
  const profileBySheet = new Map((context.sourceProfile?.sheets ?? []).map((sheet) => [sheet.sheet_name, sheet]));
  const catalogRowsBySource = buildCatalogRowsBySource(mapping.sources, inspectionBySheet);
  const catalogValuesBySource = buildCatalogValuesBySource(catalogRowsBySource);

  for (const source of mapping.sources) {
    dependencies[source.id] = unique([...asStringArray(source.depends_on), ...getLookupDependencies(source)]);
    validateSourceShape(source, errors);
    validateSourceSelection(source, selectedSheets, errors, warnings);
    validateWorkbookPresence(source, context.sheetNames, inspectionBySheet, errors, warnings);
    validateFields(source, errors);
    validateMeasurements(source, errors);
    validateResolver(source, sourceIds, errors, resolvers);
    validateLookups(source, sourceIds, errors, lookups);
    const sourceSummary = buildSourceSummary({
      source,
      inspection: inspectionBySheet.get(source.sheet),
      profile: profileBySheet.get(source.sheet),
      catalogValuesBySource,
    });
    sourceSummaries.push(sourceSummary);
    sourceSummary.structuralWarnings.forEach((structuralIssue) => warnings.push(structuralIssue));
    compareWithProfile(source, profileBySheet.get(source.sheet), informational);
  }

  validateCircularDependencies(dependencies, errors);
  validateLookupScopeAvailability(mapping.sources, errors);
  validateResolverPipelines(mapping.sources, sourceIds, errors);
  resolverTests.push(...buildResolverLimitedTests(mapping.sources, inspectionBySheet, catalogRowsBySource));

  return {
    errors,
    warnings,
    informational,
    sourceSummaries,
    layoutsUsed: unique(mapping.sources.map((source) => source.layout).filter(Boolean)),
    semanticFields: unique(sourceSummaries.flatMap((source) => source.semanticFields)),
    transformations: unique(sourceSummaries.flatMap((source) => source.transformations)),
    dependencies,
    resolvers,
    lookups,
    resolverTests,
  };
}

function validateSourceShape(source: MappingSourceConfig, errors: MappingIssue[]): void {
  if (!source.id) errors.push(issue("INVALID_SOURCE", "Source id is required."));

  if (!SUPPORTED_LAYOUTS.has(source.layout)) {
    errors.push(issue("UNSUPPORTED_SOURCE_LAYOUT", `Unsupported source layout: ${String(source.layout)}.`, source.id));
  }

  if (!source.sheet) errors.push(issue("INVALID_SOURCE", "Source sheet is required.", source.id));
  if (!Number.isInteger(source.header_row) || source.header_row < 1) {
    errors.push(issue("INVALID_HEADER_ROW", "Source header_row must be a positive integer.", source.id));
  }

  if (source.data_range) {
    try {
      parseRange(source.data_range);
    } catch {
      errors.push(issue("INVALID_RANGE", `Invalid data_range: ${source.data_range}.`, source.id));
    }
  }
}

function validateSourceSelection(
  source: MappingSourceConfig,
  selectedSheets: Map<string, { final_decision?: string; final_range?: string | null; final_header_row?: number | null }>,
  errors: MappingIssue[],
  warnings: MappingIssue[],
): void {
  const selected = selectedSheets.get(source.sheet);
  if (!selected) {
    errors.push(issue("SOURCE_NOT_IN_SELECTION", "Source sheet is not present in source-selection.yaml.", source.id));
    return;
  }

  if (selected.final_decision && selected.final_decision !== "include") {
    errors.push(issue("SOURCE_NOT_APPROVED", "Source sheet is not approved as include in source-selection.yaml.", source.id));
  }

  if (selected.final_header_row && selected.final_header_row !== source.header_row) {
    warnings.push(warning("HEADER_ROW_SELECTION_MISMATCH", "Configured header_row differs from source selection.", source.id));
  }

  if (selected.final_range && source.data_range && selected.final_range !== source.data_range) {
    warnings.push(warning("RANGE_SELECTION_MISMATCH", "Configured data_range differs from source selection.", source.id));
  }
}

function validateWorkbookPresence(
  source: MappingSourceConfig,
  sheetNames: string[],
  inspectionBySheet: Map<string, SheetInspection>,
  errors: MappingIssue[],
  warnings: MappingIssue[],
): void {
  if (!sheetNames.includes(source.sheet)) {
    errors.push(issue("SHEET_NOT_FOUND", "Configured source sheet was not found in the input workbook.", source.id));
    return;
  }

  const inspection = inspectionBySheet.get(source.sheet);
  for (const field of source.fields ?? []) {
    if (field.treatment === "derived_ignore" || field.treatment === "pending") continue;
    if (!hasConfiguredColumn(field, inspection) && (field.source_column || field.source_column_selector)) {
      errors.push(
        issue("SOURCE_COLUMN_NOT_FOUND", `Configured source column was not found: ${columnReferenceLabel(field)}.`, source.id),
      );
    }
  }

  for (const measurement of source.measurements ?? []) {
    if (!hasConfiguredColumn(measurement.value, inspection)) {
      errors.push(
        issue("SOURCE_COLUMN_NOT_FOUND", `Configured measurement source column was not found: ${columnReferenceLabel(measurement.value)}.`, source.id),
      );
    }
    if (measurement.conformity_status && !hasConfiguredColumn(measurement.conformity_status, inspection)) {
      errors.push(
        issue(
          "SOURCE_COLUMN_NOT_FOUND",
          `Configured measurement conformity source column was not found: ${columnReferenceLabel(measurement.conformity_status)}.`,
          source.id,
        ),
      );
    }
  }

  if (inspection && inspection.columns.length === 0) {
    warnings.push(warning("NO_COLUMNS_DETECTED", "No header columns were detected for this source.", source.id));
  }
}

function validateFields(source: MappingSourceConfig, errors: MappingIssue[]): void {
  const fields = getAllFields(source);
  const seenSemanticFields = new Set<string>();

  for (const field of fields) {
    if (!field.semantic_field) {
      errors.push(issue("INVALID_FIELD", "Field semantic_field is required.", source.id));
      continue;
    }

    if (seenSemanticFields.has(field.semantic_field)) {
      errors.push(
        issue("DUPLICATE_SEMANTIC_FIELD", `Duplicate semantic_field in source: ${field.semantic_field}.`, source.id),
      );
    }
    seenSemanticFields.add(field.semantic_field);

    if (!SUPPORTED_DATA_TYPES.has(field.data_type)) {
      errors.push(issue("INVALID_DATA_TYPE", `Unsupported data_type: ${String(field.data_type)}.`, source.id));
    }

    if (!SUPPORTED_TREATMENTS.has(field.treatment)) {
      errors.push(issue("INVALID_TREATMENT", `Unsupported treatment: ${String(field.treatment)}.`, source.id));
    }

    for (const transformation of field.transformations ?? []) {
      if (!SUPPORTED_TRANSFORMATIONS.has(transformation)) {
        errors.push(
          issue("UNSUPPORTED_TRANSFORMATION", `Unsupported transformation: ${String(transformation)}.`, source.id),
        );
      }
    }

    if (field.regex) validateRegex(field.regex, undefined, "INVALID_FIELD_REGEX", source.id, errors);

    if (field.on_missing && !["warning", "pending_review", "rejected"].includes(field.on_missing)) {
      errors.push(issue("INVALID_FIELD_POLICY", `Invalid on_missing policy: ${String(field.on_missing)}.`, source.id));
    }

    if (field.required && !field.source_column && source.layout === "row_table") {
      errors.push(issue("REQUIRED_FIELD_WITHOUT_SOURCE_COLUMN", "Required row_table field has no source_column.", source.id));
    }
  }
}

function validateMeasurements(source: MappingSourceConfig, errors: MappingIssue[]): void {
  if (!source.measurements || source.measurements.length === 0) return;

  if (source.layout !== "row_table") {
    errors.push(issue("UNSUPPORTED_MEASUREMENT_LAYOUT", "Measurement Model v1 supports row_table sources only.", source.id));
  }

  const measurementIds = new Set<string>();
  source.measurements.forEach((measurement, index) => {
    const measurementId = getMeasurementId(measurement, index);
    if (measurementIds.has(measurementId)) {
      errors.push(issue("DUPLICATE_MEASUREMENT", `Duplicate measurement id: ${measurementId}.`, source.id));
    }
    measurementIds.add(measurementId);

    if (!measurement.characteristic?.external_code && !measurement.characteristic?.name) {
      errors.push(issue("INVALID_MEASUREMENT", "Measurement must declare characteristic.external_code or characteristic.name.", source.id));
    }

    if (!hasColumnReference(measurement.value)) {
      errors.push(issue("INVALID_MEASUREMENT", "Measurement value must declare source_column or source_column_selector.", source.id));
    }

    if (!SUPPORTED_DATA_TYPES.has(measurement.value?.data_type)) {
      errors.push(issue("INVALID_DATA_TYPE", `Unsupported measurement data_type: ${String(measurement.value?.data_type)}.`, source.id));
    }

    validateMeasurementTransformations(measurement, source.id, errors);
  });
}

function validateMeasurementTransformations(
  measurement: MeasurementMappingConfig,
  sourceId: string,
  errors: MappingIssue[],
): void {
  for (const transformation of measurement.value?.transformations ?? []) {
    if (!SUPPORTED_TRANSFORMATIONS.has(transformation)) {
      errors.push(issue("UNSUPPORTED_TRANSFORMATION", `Unsupported measurement transformation: ${String(transformation)}.`, sourceId));
    }
  }
  for (const transformation of measurement.conformity_status?.transformations ?? []) {
    if (!SUPPORTED_TRANSFORMATIONS.has(transformation)) {
      errors.push(issue("UNSUPPORTED_TRANSFORMATION", `Unsupported measurement conformity transformation: ${String(transformation)}.`, sourceId));
    }
  }
  if (measurement.value?.regex) validateRegex(measurement.value.regex, undefined, "INVALID_FIELD_REGEX", sourceId, errors);
}

function validateResolver(
  source: MappingSourceConfig,
  sourceIds: Set<string>,
  errors: MappingIssue[],
  resolvers: ResolverSummary[],
): void {
  if (!source.resolver) return;

  if (!SUPPORTED_RESOLVERS.has(source.resolver.type)) {
    errors.push(issue("UNSUPPORTED_RESOLVER", `Unsupported resolver: ${String(source.resolver.type)}.`, source.id));
    return;
  }

  if (source.resolver.type === "pipeline") {
    resolvers.push({
      sourceId: source.id,
      type: source.resolver.type,
      steps: source.resolver.steps.map((step, index) => toResolverStepSummary(step, index)),
    });
    return;
  }

  if (source.resolver.type === "scoped_catalog_lookup") {
    if (!sourceIds.has(source.resolver.catalog_source)) {
      errors.push(issue("CATALOG_SOURCE_NOT_FOUND", "Resolver references a catalog source that does not exist.", source.id));
    }
    resolvers.push({
      sourceId: source.id,
      type: source.resolver.type,
      steps: [toResolverStepSummary(source.resolver, 0)],
    });
    return;
  }

  if (!sourceIds.has(source.resolver.catalog_source)) {
    errors.push(issue("CATALOG_SOURCE_NOT_FOUND", "Resolver references a catalog source that does not exist.", source.id));
  }

  resolvers.push({
    sourceId: source.id,
    type: source.resolver.type,
    catalogSource: source.resolver.catalog_source,
    catalogField: source.resolver.catalog_field,
    remainderField: source.resolver.remainder_field,
  });
}

function validateLookups(
  source: MappingSourceConfig,
  sourceIds: Set<string>,
  errors: MappingIssue[],
  lookups: LookupSummary[],
): void {
  for (const field of getAllFields(source)) {
    if (!field.lookup) continue;
    const lookup = field.lookup;
    if (!sourceIds.has(lookup.catalog_source)) {
      errors.push(issue("LOOKUP_CATALOG_NOT_FOUND", "Lookup references a catalog source that does not exist.", source.id, {
        semantic_field: field.semantic_field,
        catalog_source: lookup.catalog_source,
      }));
    }
    if (lookup.on_unresolved && !["warning", "pending_review", "rejected"].includes(lookup.on_unresolved)) {
      errors.push(issue("INVALID_LOOKUP_POLICY", `Invalid on_unresolved policy: ${String(lookup.on_unresolved)}.`, source.id));
    }
    if (lookup.on_ambiguous && !["pending_review", "rejected"].includes(lookup.on_ambiguous)) {
      errors.push(issue("INVALID_LOOKUP_POLICY", `Invalid on_ambiguous policy: ${String(lookup.on_ambiguous)}.`, source.id));
    }
    if (lookup.required !== undefined && typeof lookup.required !== "boolean") {
      errors.push(issue("INVALID_LOOKUP_POLICY", "Lookup required must be boolean when provided.", source.id));
    }
    if (lookup.preserve_input_value !== undefined && typeof lookup.preserve_input_value !== "boolean") {
      errors.push(issue("INVALID_LOOKUP_POLICY", "Lookup preserve_input_value must be boolean when provided.", source.id));
    }
    lookups.push(toLookupSummary(source.id, field.semantic_field, lookup));
  }
}

function validateCircularDependencies(dependencies: Record<string, string[]>, errors: MappingIssue[]): void {
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (sourceId: string, pathIds: string[]): void => {
    if (visiting.has(sourceId)) {
      errors.push(issue("CIRCULAR_SOURCE_DEPENDENCY", `Circular dependency detected: ${[...pathIds, sourceId].join(" -> ")}.`));
      return;
    }
    if (visited.has(sourceId)) return;

    visiting.add(sourceId);
    for (const dependency of dependencies[sourceId] ?? []) {
      if (dependencies[dependency]) visit(dependency, [...pathIds, sourceId]);
    }
    visiting.delete(sourceId);
    visited.add(sourceId);
  };

  Object.keys(dependencies).forEach((sourceId) => visit(sourceId, []));
}

function buildSourceSummary(input: {
  source: MappingSourceConfig;
  inspection?: SheetInspection;
  profile?: SourceProfileSheetSummary;
  catalogValuesBySource: Map<string, Set<string>>;
}): ValidationResult["sourceSummaries"][number] {
  const { source, inspection, profile, catalogValuesBySource } = input;
  const fields = getAllFields(source);
  const configuredColumns = (source.fields ?? [])
    .filter((field) => field.treatment !== "derived_ignore" && field.treatment !== "pending")
    .map(columnReferenceLabel)
    .filter((column) => column !== "unconfigured");
  const foundColumns = new Set(inspection?.columns ?? []);
  const structural = inspection
    ? analyzeStructuralPlausibility(source, inspection, catalogValuesBySource)
    : { headerPlausibilityScore: 0, catalogHeaderMatchRatio: undefined, structuralWarnings: [] };
  const profileSummary = profile ? toProfileSummary(profile) : undefined;

  return {
    id: source.id,
    sheet: source.sheet,
    layout: source.layout,
    selectedRange: inspection?.selectedRange?.address ?? source.data_range,
    selectedHeaderRow: source.header_row,
    profile: profileSummary,
    populatedColumnsInSheet: inspection?.populatedColumnsInSheet ?? 0,
    populatedColumnsInSelectedRange: inspection?.populatedColumnsInSelectedRange ?? 0,
    columnCoverageRatio: inspection?.columnCoverageRatio ?? 0,
    populatedRowsInSheet: inspection?.populatedRowsInSheet ?? 0,
    populatedRowsInSelectedRange: inspection?.populatedRowsInSelectedRange ?? 0,
    rowCoverageRatio: inspection?.rowCoverageRatio ?? 0,
    headerPlausibilityScore: structural.headerPlausibilityScore,
    catalogHeaderMatchRatio: structural.catalogHeaderMatchRatio,
    populatedDataOutsideRange: inspection?.populatedDataOutsideRange ?? [],
    structuralWarnings: structural.structuralWarnings,
    semanticFields: [...fields.map((field) => field.semantic_field), ...getMeasurementSemanticFields(source)],
    transformations: unique(fields.flatMap((field) => field.transformations ?? [])),
    columnsFound: [...foundColumns],
    columnsMissing: configuredColumns.filter((column) => !foundColumns.has(column)),
  };
}

function getAllFields(source: MappingSourceConfig): MappingFieldConfig[] {
  return [
    ...(source.fields ?? []),
    ...(source.column_header ? [source.column_header] : []),
    ...(source.cell_value ? [source.cell_value] : []),
  ];
}

function getMeasurementSemanticFields(source: MappingSourceConfig): string[] {
  if (!source.measurements?.length) return [];
  return unique(
    source.measurements.flatMap((measurement) => [
      measurement.characteristic.external_code ? "characteristic.external_code" : "",
      measurement.characteristic.name ? "characteristic.name" : "",
      "control_measurement.typed_value",
      measurement.unit ? "control_measurement.unit" : "",
      measurement.acceptance_criterion ? "acceptance_criterion" : "",
      measurement.conformity_status ? "control_measurement.conformity_status" : "",
    ]).filter(Boolean),
  );
}

function emptyResult(errors: MappingIssue[], warnings: MappingIssue[]): ValidationResult {
  return {
    errors,
    warnings,
    informational: [],
    sourceSummaries: [],
    layoutsUsed: [],
    semanticFields: [],
    transformations: [],
    dependencies: {},
    resolvers: [],
    lookups: [],
    resolverTests: [],
  };
}

function issue(
  code: string,
  message: string,
  sourceId?: string,
  details?: Record<string, unknown>,
): MappingIssue {
  return { code, severity: "error", message, sourceId, details };
}

function warning(
  code: string,
  message: string,
  sourceId?: string,
  details?: Record<string, unknown>,
): MappingIssue {
  return { code, severity: "warning", message, sourceId, details };
}

function informational(
  code: string,
  message: string,
  sourceId?: string,
  details?: Record<string, unknown>,
): MappingIssue {
  return { code, severity: "informational", message, sourceId, details };
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function analyzeStructuralPlausibility(
  source: MappingSourceConfig,
  inspection: SheetInspection,
  catalogValuesBySource: Map<string, Set<string>>,
): {
  headerPlausibilityScore: number;
  catalogHeaderMatchRatio?: number;
  structuralWarnings: MappingIssue[];
} {
  const structuralWarnings: MappingIssue[] = [];
  const catalogMatch = calculateCatalogHeaderMatch(source, inspection, catalogValuesBySource);
  const score =
    source.layout === "row_table"
      ? scoreRowTableHeader(source, inspection)
      : scoreWideHeader(inspection, catalogMatch?.ratio);

  if (source.layout === "wide_columns_to_rows" && inspection.columnCoverageRatio < 0.85) {
    structuralWarnings.push(
      warning("LOW_SELECTED_COLUMN_COVERAGE", "Selected range covers a low fraction of populated sheet columns.", source.id, {
        populated_columns_in_sheet: inspection.populatedColumnsInSheet,
        populated_columns_in_selected_range: inspection.populatedColumnsInSelectedRange,
        column_coverage_ratio: inspection.columnCoverageRatio,
      }),
    );
  }

  if (inspection.rowCoverageRatio < 0.85) {
    structuralWarnings.push(
      warning("LOW_SELECTED_ROW_COVERAGE", "Selected range covers a low fraction of populated sheet rows.", source.id, {
        populated_rows_in_sheet: inspection.populatedRowsInSheet,
        populated_rows_in_selected_range: inspection.populatedRowsInSelectedRange,
        row_coverage_ratio: inspection.rowCoverageRatio,
      }),
    );
  }

  inspection.populatedDataOutsideRange.forEach((outside) => {
    structuralWarnings.push(
      warning("POPULATED_DATA_OUTSIDE_SELECTED_RANGE", "Populated contiguous data exists outside the selected range.", source.id, {
        direction: outside.direction,
        count: outside.count,
        examples: outside.examples,
        observed_alternative_range: outside.observedAlternativeRange,
      }),
    );
  });

  if (score <= 0.5) {
    structuralWarnings.push(
      warning("LOW_HEADER_PLAUSIBILITY", "Configured header row has low structural plausibility.", source.id, {
        header_plausibility_score: score,
      }),
    );
  }

  const adjacent = findMorePlausibleAdjacentRow(source, inspection, score, catalogValuesBySource);
  if (adjacent) {
    structuralWarnings.push(
      warning("ADJACENT_ROW_MORE_PLAUSIBLE", "An adjacent row appears more plausible as the header row.", source.id, adjacent),
    );
  }

  if (catalogMatch && catalogMatch.ratio < 0.5) {
    structuralWarnings.push(
      warning("LOW_CATALOG_HEADER_MATCH", "Wide header values have low match ratio against the configured catalog.", source.id, {
        catalog_source: catalogMatch.catalogSource,
        catalog_header_match_ratio: catalogMatch.ratio,
        matched_headers: catalogMatch.matched,
        total_headers: catalogMatch.total,
      }),
    );
  }

  return {
    headerPlausibilityScore: score,
    catalogHeaderMatchRatio: catalogMatch?.ratio,
    structuralWarnings,
  };
}

function scoreRowTableHeader(source: MappingSourceConfig, inspection: SheetInspection): number {
  const headerValues = inspection.selectedHeaderValues;
  const nonEmptyRatio = ratio(headerValues.filter(Boolean).length, headerValues.length);
  const distinctRatio = ratio(new Set(headerValues.filter(Boolean)).size, headerValues.filter(Boolean).length);
  const configuredColumns = getConfiguredSourceColumns(source);
  const matchRatio = ratio(configuredColumns.filter((column) => inspection.columns.includes(column)).length, configuredColumns.length);
  return round(nonEmptyRatio * 0.2 + distinctRatio * 0.2 + matchRatio * 0.6);
}

function scoreWideHeader(inspection: SheetInspection, catalogMatchRatio?: number): number {
  const headerValues = inspection.selectedHeaderValues;
  const nonEmptyValues = headerValues.filter(Boolean);
  const nonEmptyRatio = ratio(nonEmptyValues.length, headerValues.length);
  const distinctRatio = ratio(new Set(nonEmptyValues).size, nonEmptyValues.length);
  const hasDataBelow = inspection.selectedDataCellCount > 0 ? 1 : 0;
  const parts = catalogMatchRatio === undefined
    ? [nonEmptyRatio, distinctRatio, hasDataBelow]
    : [nonEmptyRatio, distinctRatio, hasDataBelow, catalogMatchRatio];
  return round(parts.reduce((sum, value) => sum + value, 0) / parts.length);
}

function findMorePlausibleAdjacentRow(
  source: MappingSourceConfig,
  inspection: SheetInspection,
  currentScore: number,
  catalogValuesBySource: Map<string, Set<string>>,
): Record<string, unknown> | undefined {
  let best: { rowNumber: number; score: number } | undefined;

  for (const adjacent of inspection.adjacentRows) {
    const adjacentInspection: SheetInspection = {
      ...inspection,
      headerRow: adjacent.rowNumber,
      columns: adjacent.values.filter(Boolean),
      selectedHeaderValues: adjacent.values,
    };
    const catalogMatch = calculateCatalogHeaderMatch(source, adjacentInspection, catalogValuesBySource);
    const score =
      source.layout === "row_table"
        ? scoreRowTableHeader(source, adjacentInspection)
        : scoreWideHeader(adjacentInspection, catalogMatch?.ratio);
    if (!best || score > best.score) best = { rowNumber: adjacent.rowNumber, score };
  }

  if (best && best.score >= currentScore + 0.2) {
    return {
      configured_header_row: inspection.headerRow,
      configured_header_score: currentScore,
      adjacent_row: best.rowNumber,
      adjacent_row_score: best.score,
    };
  }

  return undefined;
}

function calculateCatalogHeaderMatch(
  source: MappingSourceConfig,
  inspection: SheetInspection,
  catalogValuesBySource: Map<string, Set<string>>,
): { ratio: number; matched: number; total: number; catalogSource: string } | undefined {
  const catalogSource = getResolverCatalogSource(source) ?? findCatalogSourceForHeader(source);
  if (!catalogSource) return undefined;
  const catalogValues = catalogValuesBySource.get(catalogSource);
  if (!catalogValues || catalogValues.size === 0) return undefined;

  const headers = inspection.selectedHeaderValues.filter(Boolean);
  if (headers.length === 0) return { ratio: 0, matched: 0, total: 0, catalogSource };

  const matched = headers.filter((header) =>
    source.resolver?.type === "longest_catalog_prefix" || source.resolver?.type === "pipeline"
      ? [...catalogValues].some((value) => header.startsWith(value))
      : catalogValues.has(header),
  ).length;

  return { ratio: ratio(matched, headers.length), matched, total: headers.length, catalogSource };
}

function findCatalogSourceForHeader(source: MappingSourceConfig): string | undefined {
  if (!source.column_header) return undefined;
  return source.depends_on?.[0];
}

function buildCatalogRowsBySource(
  sources: MappingSourceConfig[],
  inspectionBySheet: Map<string, SheetInspection>,
): Map<string, CatalogRecord[]> {
  const rowsBySource = new Map<string, CatalogRecord[]>();

  for (const source of sources) {
    const inspection = inspectionBySheet.get(source.sheet);
    if (!inspection) continue;
    const rows: CatalogRecord[] = [];

    if (source.layout === "row_table") {
      const fieldColumns = (source.fields ?? [])
        .filter((field) => hasColumnReference(field) && field.treatment !== "derived_ignore")
        .map((field) => ({
          field,
          columnOffset: getConfiguredColumnOffset(field, inspection),
        }))
        .filter((entry) => entry.columnOffset >= 0);

      Object.entries(inspection.sampleRows).forEach(([rowNumber, rowValues]) => {
        if (Number(rowNumber) <= source.header_row) return;
        const row: CatalogRecord = {};
        let usable = true;
        fieldColumns.forEach(({ field, columnOffset }) => {
          const value = applyFieldTransformations(rowValues[columnOffset], field);
          row[field.semantic_field] = value;
          if (!isCatalogFieldUsable(field, value)) usable = false;
        });
        row.__usable = usable;
        if (Object.entries(row).some(([key, value]) => key !== "__usable" && Boolean(value))) rows.push(row);
      });
    } else {
      const headerField = source.column_header?.semantic_field;
      const cellField = source.cell_value?.semantic_field;
      if (headerField && cellField) {
        Object.entries(inspection.sampleRows).forEach(([rowNumber, rowValues]) => {
          if (Number(rowNumber) <= source.header_row) return;
          rowValues.forEach((value, columnOffset) => {
            if (!value) return;
            const headerValue = applyFieldTransformations(inspection.selectedHeaderValues[columnOffset] ?? "", source.column_header);
            const cellValue = applyFieldTransformations(value, source.cell_value);
            const row: CatalogRecord = {
              [headerField]: headerValue,
              [cellField]: cellValue,
            };
            let usable =
              isCatalogFieldUsable(source.column_header, headerValue) &&
              isCatalogFieldUsable(source.cell_value, cellValue);
            for (const field of source.fields ?? []) {
              if (field.source_column === "__cell_value__") {
                const fieldValue = applyFieldTransformations(value, field);
                row[field.semantic_field] = fieldValue;
                if (!isCatalogFieldUsable(field, fieldValue)) usable = false;
              }
            }
            row.__usable = usable;
            rows.push(row);
          });
        });
      }
    }

    rowsBySource.set(source.id, rows);
  }

  return rowsBySource;
}

function buildCatalogValuesBySource(rowsBySource: Map<string, CatalogRecord[]>): Map<string, Set<string>> {
  const valuesBySource = new Map<string, Set<string>>();
  rowsBySource.forEach((rows, sourceId) => {
    const values = new Set<string>();
    rows.forEach((row) => {
      if (row.__usable === false) return;
      Object.entries(row).forEach(([key, value]) => {
        if (key === "__usable") return;
        if (value) values.add(String(value));
      });
    });
    valuesBySource.set(sourceId, values);
  });
  return valuesBySource;
}

function applyFieldTransformations(value: string, field: MappingFieldConfig | undefined): string | null {
  if (!field) return value;
  let current = value;
  for (const transformation of field.transformations ?? []) {
    if (transformation === "trim") current = current.trim();
    if (transformation === "normalize_whitespace") current = current.replace(/\s+/g, " ").trim();
    if (transformation === "uppercase") current = current.toUpperCase();
    if (transformation === "lowercase") current = current.toLowerCase();
    if (transformation === "extract_regex" && field.regex) {
      const match = new RegExp(field.regex).exec(current);
      current = match?.[1] ?? "";
    }
    if (transformation === "preserve_string") current = String(current);
  }
  if (!current && field.fallback_value === null) return null;
  return current;
}

function hasConfiguredColumn(config: ColumnReferenceConfig | undefined, inspection: SheetInspection | undefined): boolean {
  if (!config || !hasColumnReference(config) || !inspection) return false;
  return getConfiguredColumnOffset(config, inspection) >= 0;
}

function getConfiguredColumnOffset(config: ColumnReferenceConfig, inspection: SheetInspection): number {
  const selector = config.source_column_selector;
  const startColumn = inspection.selectedRange?.startColumn ?? 1;
  const endColumn = inspection.selectedRange?.endColumn ?? inspection.selectedHeaderValues.length;

  if (selector?.column_index !== undefined) {
    return selector.column_index >= startColumn && selector.column_index <= endColumn
      ? selector.column_index - startColumn
      : -1;
  }

  if (selector?.column_letter) {
    const columnIndex = columnNameToNumber(selector.column_letter);
    return columnIndex >= startColumn && columnIndex <= endColumn ? columnIndex - startColumn : -1;
  }

  const header = selector?.header ?? config.source_column;
  if (!header) return -1;
  const occurrence = selector?.header ? selector.occurrence ?? 1 : undefined;
  let seen = 0;
  for (const [index, currentHeader] of inspection.selectedHeaderValues.entries()) {
    if (currentHeader !== header) continue;
    seen += 1;
    if (occurrence === undefined || seen === occurrence) {
      if (occurrence === undefined) continue;
      return index;
    }
  }
  if (occurrence === undefined) {
    return inspection.selectedHeaderValues.lastIndexOf(header);
  }
  return -1;
}

function hasColumnReference(config: ColumnReferenceConfig | undefined): boolean {
  return Boolean(
    config?.source_column ||
      config?.source_column_selector?.header ||
      config?.source_column_selector?.column_index !== undefined ||
      config?.source_column_selector?.column_letter,
  );
}

function columnReferenceLabel(config: ColumnReferenceConfig | undefined): string {
  if (!config) return "unconfigured";
  const selector = config.source_column_selector;
  if (selector?.column_index !== undefined) return `column_index:${selector.column_index}`;
  if (selector?.column_letter) return `column_letter:${selector.column_letter}`;
  if (selector?.header) return `header:${selector.header}#${selector.occurrence ?? 1}`;
  return config.source_column ?? "unconfigured";
}

function isCatalogFieldUsable(field: MappingFieldConfig | undefined, value: string | null): boolean {
  if (!field) return true;
  if (value !== "" && value !== null) return true;
  if (field.required) return false;
  if (field.on_missing === "pending_review" || field.on_missing === "rejected") return false;
  if ((field.transformations ?? []).includes("extract_regex")) {
    return field.on_no_match !== "pending_review" && field.on_no_match !== "rejected";
  }
  return true;
}

function validateResolverPipelines(
  sources: MappingSourceConfig[],
  sourceIds: Set<string>,
  errors: MappingIssue[],
): void {
  const sourceOrder = new Map(sources.map((source, index) => [source.id, index]));
  for (const source of sources) {
    const resolver = source.resolver;
    if (!resolver || resolver.type !== "pipeline") continue;
    if (!Array.isArray(resolver.steps) || resolver.steps.length === 0) {
      errors.push(issue("INVALID_RESOLVER_PIPELINE", "Resolver pipeline must contain at least one step.", source.id));
      continue;
    }

    const availableFields = new Set(getAllFields(source).map((field) => field.semantic_field));
    const outputFields = new Set<string>();
    for (const [index, step] of resolver.steps.entries()) {
      validateResolverStepConfig(step, source, index, sourceIds, sourceOrder, availableFields, outputFields, errors);
    }
  }
}

function validateResolverStepConfig(
  step: ResolverStepConfig,
  source: MappingSourceConfig,
  index: number,
  sourceIds: Set<string>,
  sourceOrder: Map<string, number>,
  availableFields: Set<string>,
  outputFields: Set<string>,
  errors: MappingIssue[],
): void {
  if (!SUPPORTED_RESOLVERS.has(step.type)) {
    errors.push(issue("INVALID_RESOLVER_PIPELINE", `Unsupported resolver step type: ${String(step.type)}.`, source.id));
    return;
  }

  const inputField = getStepInputField(step);
  if (inputField && !availableFields.has(inputField)) {
    errors.push(issue("RESOLVER_INPUT_FIELD_NOT_FOUND", `Resolver step input field not found: ${inputField}.`, source.id, {
      step_index: index,
    }));
  }

  const catalogSource = "catalog_source" in step ? step.catalog_source : undefined;
  if (catalogSource) {
    if (!sourceIds.has(catalogSource)) {
      errors.push(issue("CATALOG_SOURCE_NOT_FOUND", "Resolver step references a catalog source that does not exist.", source.id, {
        step_index: index,
        catalog_source: catalogSource,
      }));
    }
    const currentOrder = sourceOrder.get(source.id) ?? 0;
    const catalogOrder = sourceOrder.get(catalogSource) ?? Number.POSITIVE_INFINITY;
    if (catalogOrder >= currentOrder) {
      errors.push(issue("INVALID_RESOLVER_PIPELINE", "Resolver step uses a catalog that is not available before this source.", source.id, {
        step_index: index,
        catalog_source: catalogSource,
      }));
    }
  }

  for (const outputField of getStepOutputFields(step)) {
    if (outputFields.has(outputField)) {
      errors.push(issue("RESOLVER_OUTPUT_CONFLICT", `Resolver output field is produced more than once: ${outputField}.`, source.id, {
        step_index: index,
      }));
    }
    outputFields.add(outputField);
    availableFields.add(outputField);
  }

  if (step.type === "transform_value") {
    step.transformations.forEach((transformation) => {
      if (!SUPPORTED_RESOLVER_TRANSFORMATIONS.has(transformation.type)) {
        errors.push(issue("INVALID_RESOLVER_PIPELINE", `Unsupported resolver transformation: ${String(transformation.type)}.`, source.id));
      }
      if (transformation.type === "regex_replace") {
        validateRegex(transformation.pattern, transformation.flags, "INVALID_REGEX_REPLACE", source.id, errors);
      }
    });
  }

  if (step.type === "scoped_catalog_lookup") {
    validateScopeFields(step.scope ?? [], availableFields, source.id, errors);
  }
}

function validateLookupScopeAvailability(sources: MappingSourceConfig[], errors: MappingIssue[]): void {
  for (const source of sources) {
    const availableFields = new Set(getAllFields(source).map((field) => field.semantic_field));
    for (const field of getAllFields(source)) {
      if (!field.lookup) continue;
      if (!availableFields.has(field.lookup.input_field)) {
        errors.push(issue("RESOLVER_INPUT_FIELD_NOT_FOUND", `Lookup input field not found: ${field.lookup.input_field}.`, source.id));
      }
      validateScopeFields(field.lookup.scope ?? [], availableFields, source.id, errors);
    }
  }
}

function validateScopeFields(
  scope: ResolverScopeConfig[],
  availableFields: Set<string>,
  sourceId: string,
  errors: MappingIssue[],
): void {
  scope.forEach((entry) => {
    if (!availableFields.has(entry.value_field)) {
      errors.push(issue("LOOKUP_SCOPE_FIELD_NOT_FOUND", `Scope value_field is not available: ${entry.value_field}.`, sourceId));
    }
  });
}

function buildResolverLimitedTests(
  sources: MappingSourceConfig[],
  inspectionBySheet: Map<string, SheetInspection>,
  catalogRowsBySource: Map<string, CatalogRecord[]>,
): ResolverLimitedTestSummary[] {
  const tests: ResolverLimitedTestSummary[] = [];
  for (const source of sources) {
    if (!source.resolver || source.resolver.type !== "pipeline" || !source.column_header) continue;
    const resolver = source.resolver;
    const inspection = inspectionBySheet.get(source.sheet);
    if (!inspection) continue;

    const summary: ResolverLimitedTestSummary = {
      sourceId: source.id,
      testedField: source.column_header.semantic_field,
      total: 0,
      resolved: 0,
      ambiguous: 0,
      unresolved: 0,
      skipped: 0,
      ambiguousExamples: [],
      unresolvedExamples: [],
    };

    inspection.selectedHeaderValues.filter(Boolean).forEach((header) => {
      summary.total += 1;
      const result = safeEvaluateResolverPipeline({
        resolver,
        initialValues: { [source.column_header!.semantic_field]: header },
        catalogs: catalogRowsBySource,
      });
      summary[result.status] += 1;
      if (result.status === "ambiguous" && summary.ambiguousExamples.length < 10) {
        summary.ambiguousExamples.push({ input: header, values: result.values, steps: result.stepResults });
      }
      if (result.status === "unresolved" && summary.unresolvedExamples.length < 10) {
        summary.unresolvedExamples.push({ input: header, values: result.values, steps: result.stepResults });
      }
    });

    tests.push(summary);
  }
  return tests;
}

function safeEvaluateResolverPipeline(input: Parameters<typeof evaluateResolverPipeline>[0]): ReturnType<typeof evaluateResolverPipeline> {
  try {
    return evaluateResolverPipeline(input);
  } catch (error) {
    return {
      status: "unresolved",
      values: input.initialValues,
      stepResults: [
        {
          index: -1,
          type: "pipeline",
          status: "unresolved",
          value: error instanceof Error ? error.message : "Resolver evaluation failed.",
        },
      ],
    };
  }
}

function getLookupDependencies(source: MappingSourceConfig): string[] {
  return unique(getAllFields(source).map((field) => field.lookup?.catalog_source).filter((value): value is string => Boolean(value)));
}

function getMeasurementId(measurement: MeasurementMappingConfig, index: number): string {
  return measurement.id ?? measurement.characteristic?.external_code ?? measurement.characteristic?.name ?? `measurement_${index + 1}`;
}

function toResolverStepSummary(step: ResolverStepConfig, index: number): NonNullable<ResolverSummary["steps"]>[number] {
  return {
    index,
    type: step.type,
    inputField: getStepInputField(step),
    outputField: "output_field" in step ? step.output_field : undefined,
    remainderOutputField: step.type === "longest_catalog_prefix" ? step.remainder_output_field ?? step.remainder_field : undefined,
    catalogSource: "catalog_source" in step ? step.catalog_source : undefined,
    catalogField: step.type === "longest_catalog_prefix" ? step.catalog_field : undefined,
    catalogMatchField: step.type === "scoped_catalog_lookup" ? step.catalog_match_field : undefined,
    scope: "scope" in step ? step.scope : undefined,
    transformations: step.type === "transform_value" ? step.transformations : undefined,
  };
}

function getResolverCatalogSource(source: MappingSourceConfig): string | undefined {
  if (!source.resolver) return undefined;
  if (source.resolver.type === "longest_catalog_prefix" || source.resolver.type === "scoped_catalog_lookup") {
    return source.resolver.catalog_source;
  }
  return source.resolver.steps.find((step) => "catalog_source" in step)?.catalog_source;
}

function toLookupSummary(sourceId: string, semanticField: string, lookup: FieldLookupConfig): LookupSummary {
  return {
    sourceId,
    semanticField,
    catalogSource: lookup.catalog_source,
    catalogMatchField: lookup.catalog_match_field,
    inputField: lookup.input_field,
    scope: lookup.scope ?? [],
    required: lookup.required ?? false,
    onUnresolved: lookup.on_unresolved ?? "pending_review",
    onAmbiguous: lookup.on_ambiguous ?? "pending_review",
    preserveInputValue: lookup.preserve_input_value ?? true,
  };
}

function getStepInputField(step: ResolverStepConfig): string | undefined {
  if (step.type === "longest_catalog_prefix") return step.input_field ?? step.source_field;
  return step.input_field;
}

function getStepOutputFields(step: ResolverStepConfig): string[] {
  if (step.type === "longest_catalog_prefix") {
    return [step.output_field ?? step.catalog_field, step.remainder_output_field ?? step.remainder_field ?? "unresolved_remainder"];
  }
  return [step.output_field];
}

function validateRegex(
  pattern: string,
  flags: string | undefined,
  code: string,
  sourceId: string | undefined,
  errors: MappingIssue[],
): void {
  const invalidFlags = [...(flags ?? "")].filter((flag) => !SUPPORTED_REGEX_FLAGS.has(flag));
  if (invalidFlags.length > 0) {
    errors.push(issue(code, `Invalid regex flags: ${invalidFlags.join(", ")}.`, sourceId));
    return;
  }
  try {
    new RegExp(pattern, flags);
  } catch (error) {
    errors.push(issue(code, error instanceof Error ? error.message : "Invalid regular expression.", sourceId));
  }
}

function compareWithProfile(
  source: MappingSourceConfig,
  profile: SourceProfileSheetSummary | undefined,
  informationalIssues: MappingIssue[],
): void {
  if (!profile) return;

  if (profile.detected_header_row && profile.detected_header_row !== source.header_row) {
    informationalIssues.push(
      informational("PROFILE_HEADER_ROW_DIFFERENCE", "Configured header_row differs from technical profile detection.", source.id, {
        configured_header_row: source.header_row,
        profile_detected_header_row: profile.detected_header_row,
      }),
    );
  }

  const candidateRanges = (profile.candidate_data_blocks ?? [])
    .map((block) => block.full_range ?? block.range)
    .filter((range): range is string => Boolean(range));
  if (source.data_range && candidateRanges.length > 0 && !candidateRanges.includes(source.data_range)) {
    informationalIssues.push(
      informational("PROFILE_RANGE_DIFFERENCE", "Configured data_range differs from technical profile candidates.", source.id, {
        configured_data_range: source.data_range,
        profile_candidate_ranges: candidateRanges,
      }),
    );
  }
}

function toProfileSummary(profile: SourceProfileSheetSummary): ProfileComparisonSummary {
  return {
    physicalRange: profile.physical_range?.range,
    effectiveRange: profile.effective_non_empty_range?.range,
    detectedHeaderRow: profile.detected_header_row,
    candidateBlocks: profile.candidate_data_blocks ?? [],
  };
}

function getConfiguredSourceColumns(source: MappingSourceConfig): string[] {
  const fieldColumns = (source.fields ?? [])
    .filter((field) => field.treatment !== "derived_ignore" && field.treatment !== "pending")
    .map((field) => field.source_column)
    .filter((column): column is string => Boolean(column));
  const measurementColumns = (source.measurements ?? []).flatMap((measurement) =>
    [columnReferenceLabel(measurement.value), columnReferenceLabel(measurement.conformity_status)].filter((column) => column !== "unconfigured"),
  );
  return [...fieldColumns, ...measurementColumns];
}

function ratio(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return round(numerator / denominator);
}

function round(value: number): number {
  return Number(value.toFixed(4));
}
