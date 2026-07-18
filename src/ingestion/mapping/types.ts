export type SemanticMappingVersion = "semantic-mapping-v1";

export type SourceLayout = "row_table" | "wide_columns_to_rows";

export type SemanticDataType = "string" | "integer" | "decimal" | "date" | "datetime" | "boolean";

export type FieldTreatment = "direct" | "lookup" | "derived_ignore" | "pending";

export type FieldTransformation =
  | "trim"
  | "normalize_whitespace"
  | "uppercase"
  | "lowercase"
  | "parse_integer"
  | "parse_decimal"
  | "parse_date"
  | "extract_regex"
  | "preserve_string";

export type ResolverType = "longest_catalog_prefix" | "pipeline" | "transform_value" | "scoped_catalog_lookup";

export type ResolutionStatus = "resolved" | "ambiguous" | "unresolved" | "skipped";

export type LookupUnresolvedPolicy = "warning" | "pending_review" | "rejected";

export type LookupAmbiguousPolicy = "pending_review" | "rejected";

export interface SourceColumnSelector {
  header?: string;
  occurrence?: number;
  column_index?: number;
  column_letter?: string;
}

export interface RegexReplaceTransformationConfig {
  type: "regex_replace";
  pattern: string;
  replacement: string;
  flags?: string;
}

export type ResolverTransformationConfig = RegexReplaceTransformationConfig;

export interface ResolverScopeConfig {
  catalog_field: string;
  value_field: string;
}

export interface FieldLookupConfig {
  catalog_source: string;
  catalog_match_field: string;
  input_field: string;
  scope?: ResolverScopeConfig[];
  required?: boolean;
  on_unresolved?: LookupUnresolvedPolicy;
  on_ambiguous?: LookupAmbiguousPolicy;
  preserve_input_value?: boolean;
}

export interface MappingFieldConfig {
  source_column?: string;
  source_column_selector?: SourceColumnSelector;
  semantic_field: string;
  data_type: SemanticDataType;
  required: boolean;
  treatment: FieldTreatment;
  transformations?: FieldTransformation[];
  preserve_raw_value: boolean;
  on_missing?: LookupUnresolvedPolicy;
  regex?: string;
  on_no_match?: "pending_review" | "warning" | "rejected";
  fallback_value?: null;
  lookup?: FieldLookupConfig;
}

export interface WideFieldConfig extends Omit<MappingFieldConfig, "source_column"> {
  source_column?: string;
}

export interface MeasurementCharacteristicConfig {
  external_code?: string;
  name?: string;
}

export interface MeasurementValueConfig {
  source_column?: string;
  source_column_selector?: SourceColumnSelector;
  data_type: SemanticDataType;
  required: boolean;
  transformations?: FieldTransformation[];
  on_missing?: LookupUnresolvedPolicy;
  regex?: string;
  on_no_match?: "pending_review" | "warning" | "rejected";
  fallback_value?: null;
  preserve_raw_value?: boolean;
}

export interface AcceptanceCriterionConfig {
  external_code?: string;
  name?: string;
  description?: string;
  unit?: string;
  min_value?: number;
  max_value?: number;
  target_value?: string | number | boolean;
}

export interface MeasurementConformityStatusConfig {
  source_column?: string;
  source_column_selector?: SourceColumnSelector;
  required?: boolean;
  transformations?: FieldTransformation[];
  on_missing?: LookupUnresolvedPolicy;
  preserve_raw_value?: boolean;
}

export interface MeasurementMappingConfig {
  id?: string;
  characteristic: MeasurementCharacteristicConfig;
  value: MeasurementValueConfig;
  unit?: string;
  acceptance_criterion?: AcceptanceCriterionConfig;
  conformity_status?: MeasurementConformityStatusConfig;
}

export interface LongestCatalogPrefixResolverConfig {
  type: "longest_catalog_prefix";
  input_field?: string;
  catalog_source: string;
  catalog_field: string;
  output_field?: string;
  remainder_field?: string;
  remainder_output_field?: string;
  source_field?: string;
  preserve_fields?: string[];
}

export interface TransformValueResolverConfig {
  type: "transform_value";
  input_field: string;
  output_field: string;
  transformations: ResolverTransformationConfig[];
}

export interface ScopedCatalogLookupResolverConfig {
  type: "scoped_catalog_lookup";
  input_field: string;
  catalog_source: string;
  catalog_match_field: string;
  output_field: string;
  scope?: ResolverScopeConfig[];
  required?: boolean;
}

export type ResolverStepConfig =
  | LongestCatalogPrefixResolverConfig
  | TransformValueResolverConfig
  | ScopedCatalogLookupResolverConfig;

export interface PipelineResolverConfig {
  type: "pipeline";
  steps: ResolverStepConfig[];
}

export type ResolverConfig =
  | LongestCatalogPrefixResolverConfig
  | PipelineResolverConfig
  | ScopedCatalogLookupResolverConfig;

export interface MappingSourceConfig {
  id: string;
  layout: SourceLayout;
  sheet: string;
  header_row: number;
  data_range?: string;
  fields?: MappingFieldConfig[];
  column_header?: WideFieldConfig;
  cell_value?: WideFieldConfig;
  measurements?: MeasurementMappingConfig[];
  resolver?: ResolverConfig;
  depends_on?: string[];
  semantic_review_values?: string[];
}

export interface SemanticMappingConfig {
  mapping_version: SemanticMappingVersion;
  mapping_id: string;
  source_file_name?: string;
  source_file_sha256?: string;
  source_selection_path?: string;
  status: "draft" | "approved" | "deprecated";
  company_context?: string;
  assumptions?: string[];
  unresolved_decisions?: string[];
  sources: MappingSourceConfig[];
}

export interface SourceSelectionSheet {
  name: string;
  final_decision?: string;
  final_range?: string | null;
  final_header_row?: number | null;
  suggested_range?: string | null;
  header_row?: number | null;
}

export interface SourceSelectionConfig {
  file_name?: string;
  file_sha256?: string;
  profile_version?: string;
  sheets: SourceSelectionSheet[];
}

export interface MappingValidationOptions {
  sampleRowsLimit?: number;
}

export interface MappingValidationInput {
  inputPath: string;
  sourceSelectionPath: string;
  mappingPath: string;
  profilePath?: string;
  outputDir?: string;
  options?: MappingValidationOptions;
}

export interface ParsedCellRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  address: string;
}

export interface CellCoordinate {
  address: string;
  rowNumber: number;
  columnIndex: number;
  value: string;
}

export interface PopulatedDataOutsideRange {
  direction: "right" | "below";
  count: number;
  examples: CellCoordinate[];
  observedAlternativeRange?: string;
}

export interface AdjacentRowInspection {
  rowNumber: number;
  nonEmptyValues: number;
  distinctValues: number;
  values: string[];
}

export interface SheetInspection {
  sheet: string;
  headerRow: number;
  dataRange?: string;
  selectedRange?: ParsedCellRange;
  physicalRange: ParsedCellRange;
  effectiveRange?: ParsedCellRange;
  columns: string[];
  selectedHeaderValues: string[];
  selectedDataCellCount: number;
  populatedColumnsInSheet: number;
  populatedColumnsInSelectedRange: number;
  columnCoverageRatio: number;
  populatedRowsInSheet: number;
  populatedRowsInSelectedRange: number;
  rowCoverageRatio: number;
  populatedDataOutsideRange: PopulatedDataOutsideRange[];
  adjacentRows: AdjacentRowInspection[];
  sampleRows: Record<number, string[]>;
}

export interface SourceProfileRange {
  range: string;
  start_row: number;
  end_row: number;
  start_column: number;
  end_column: number;
}

export interface SourceProfileCandidateBlock {
  range: string;
  full_range?: string;
  scanned_range?: string;
  header_row?: number;
  confidence?: number;
}

export interface SourceProfileSheetSummary {
  sheet_name: string;
  physical_range?: SourceProfileRange;
  effective_non_empty_range?: SourceProfileRange;
  candidate_data_blocks?: SourceProfileCandidateBlock[];
  total_rows?: number;
  column_count?: number;
  detected_header_row?: number;
}

export interface SourceProfileSummary {
  sheets: SourceProfileSheetSummary[];
}

export interface ProfileComparisonSummary {
  physicalRange?: string;
  effectiveRange?: string;
  detectedHeaderRow?: number;
  candidateBlocks: SourceProfileCandidateBlock[];
}

export interface MappingIssue {
  code: string;
  severity: "error" | "warning" | "informational";
  message: string;
  sourceId?: string;
  details?: Record<string, unknown>;
}

export interface ResolverSummary {
  sourceId: string;
  type: ResolverType;
  catalogSource?: string;
  catalogField?: string;
  remainderField?: string;
  steps?: ResolverStepSummary[];
}

export interface ResolverStepSummary {
  index: number;
  type: ResolverType;
  inputField?: string;
  outputField?: string;
  remainderOutputField?: string;
  catalogSource?: string;
  catalogMatchField?: string;
  catalogField?: string;
  scope?: ResolverScopeConfig[];
  transformations?: ResolverTransformationConfig[];
}

export interface LookupSummary {
  sourceId: string;
  semanticField: string;
  catalogSource: string;
  catalogMatchField: string;
  inputField: string;
  scope: ResolverScopeConfig[];
  required: boolean;
  onUnresolved: LookupUnresolvedPolicy;
  onAmbiguous: LookupAmbiguousPolicy;
  preserveInputValue: boolean;
}

export interface ResolverLimitedTestSummary {
  sourceId: string;
  testedField: string;
  total: number;
  resolved: number;
  ambiguous: number;
  unresolved: number;
  skipped: number;
  ambiguousExamples: Array<Record<string, unknown>>;
  unresolvedExamples: Array<Record<string, unknown>>;
}

export interface MappingValidationReport {
  sourceFile: {
    path: string;
    fileName: string;
    sha256: string;
  };
  mapping: {
    mappingId?: string;
    mappingVersion?: string;
    status?: string;
  };
  sources: Array<{
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
    populatedDataOutsideRange: PopulatedDataOutsideRange[];
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
  errors: MappingIssue[];
  warnings: MappingIssue[];
  informational: MappingIssue[];
  unresolvedDecisions: string[];
}

export interface PrefixResolution {
  status: ResolutionStatus;
  originalValue: string;
  resolved?: string;
  remainder?: string;
  method: ResolverType;
  candidates: string[];
}
