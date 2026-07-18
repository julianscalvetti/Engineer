import type {
  MappingIssue,
  MappingValidationReport,
  AcceptanceCriterionConfig,
  ResolutionStatus,
  SourceLayout,
} from "./types";

export type PreviewStatus = "valid" | "warning" | "pending_review" | "rejected";

export type SampleMode = "none" | "masked" | "full";

export interface MappingPreviewInput {
  inputFilePath: string;
  sourceSelectionPath: string;
  semanticMappingPath: string;
  outputDirectory: string;
  maxRecords?: number;
  sampleMode?: SampleMode;
  sourceIds?: string[];
  failOnValidationErrors?: boolean;
}

export interface SourceLocator {
  sheet_name: string;
  row_number: number;
  selected_range?: string;
  header_row: number;
  column_number?: number;
  column_letter?: string;
  column_header?: string;
  cell_address?: string;
}

export interface ExecutionIssue {
  code: string;
  severity: PreviewStatus;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface TransformationTrace {
  field: string;
  type: string;
  input: string | null;
  output: string | number | boolean | null;
  success: boolean;
  error_code?: string;
  error_message?: string;
}

export interface ResolutionTrace {
  resolver_type: string;
  catalog_source?: string;
  input_value?: string | null;
  scope_values?: Record<string, string | null>;
  match_count: number;
  matched_record_ids: string[];
  status: ResolutionStatus;
  output_fields: Record<string, string | null>;
}

export interface MeasurementSourceTrace {
  source_column: string;
  raw_value: string | null;
  sheet_name: string;
  row_number: number;
  column_number?: number;
  column_letter?: string;
  cell_address?: string;
}

export interface ControlMeasurementPreview {
  measurement_id: string;
  semantic_entity: "control_measurement";
  characteristic: {
    external_code?: string;
    name?: string;
  };
  typed_value: unknown;
  unit?: string;
  acceptance_criterion?: AcceptanceCriterionConfig;
  conformity_status?: unknown;
  source: MeasurementSourceTrace;
  transformations: TransformationTrace[];
  issues: ExecutionIssue[];
}

export interface MappedSourceRecord {
  record_id: string;
  source_id: string;
  semantic_entity: string;
  source_layout: SourceLayout;
  status: PreviewStatus;
  semantic_values: Record<string, unknown>;
  raw_values: Record<string, unknown>;
  preserved_values: Record<string, unknown>;
  measurements: ControlMeasurementPreview[];
  source_locator: SourceLocator;
  transformations: TransformationTrace[];
  resolutions: ResolutionTrace[];
  issues: ExecutionIssue[];
  mapping_id: string;
  mapping_version: string;
  source_file_name: string;
  source_file_sha256: string;
}

export interface CatalogRecord {
  record_id: string;
  source_id: string;
  status: PreviewStatus;
  values: Record<string, unknown>;
  usable: boolean;
}

export interface SourceExecutionStats {
  source_id: string;
  available_records: number;
  processed_records: number;
  generated_records: number;
  truncated: boolean;
  status_counts: Record<PreviewStatus, number>;
  issue_counts: Record<string, number>;
  catalog_usable_records: number;
  catalog_unusable_records: number;
}

export interface MappingPreviewSummary {
  source_file: {
    path: string;
    file_name: string;
    sha256: string;
  };
  mapping: {
    mapping_id: string;
    mapping_version: string;
  };
  executed_at: string;
  parameters: {
    max_records?: number;
    sample_mode: SampleMode;
    source_ids?: string[];
    fail_on_validation_errors: boolean;
  };
  validation: Pick<MappingValidationReport, "errors" | "warnings" | "informational">;
  sources: SourceExecutionStats[];
  counts_by_source_id: Record<string, number>;
  counts_by_semantic_entity: Record<string, number>;
  counts_by_status: Record<PreviewStatus, number>;
  counts_by_issue: Record<string, number>;
  failed_transformations: TransformationTrace[];
  lookup_results: Record<ResolutionStatus, number>;
  resolver_results: Record<ResolutionStatus, number>;
  semantic_review_values: Array<{ source_id: string; value: string; record_id: string }>;
  missing_required_fields: Array<{ source_id: string; field: string; record_id: string }>;
  measurement_counts_by_source_id: Record<string, number>;
  issue_examples: Record<string, Array<Pick<MappedSourceRecord, "record_id" | "source_id" | "source_locator" | "issues">>>;
  output_files: {
    jsonl: string;
    summary_json: string;
    summary_md: string;
  };
}

export interface ExecutionContext {
  catalogs: Map<string, CatalogRecord[]>;
  records: MappedSourceRecord[];
}

export interface ExecutionValidationResult {
  report: MappingValidationReport;
  errors: MappingIssue[];
}
