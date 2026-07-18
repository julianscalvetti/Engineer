import type { SourceFileMetadata, SourceLocation } from "../shared/types";

export type InferredCellType =
  | "empty"
  | "string"
  | "integer"
  | "decimal"
  | "number"
  | "boolean"
  | "date"
  | "datetime"
  | "formula"
  | "mixed"
  | "unknown";

export type ProfilingIssueSeverity = "blocking" | "review" | "informational";

export type StructuralClass =
  | "tabular_candidate"
  | "form_like"
  | "report_like"
  | "empty"
  | "unknown";

export type SamplePolicy = "none" | "masked" | "full";

export interface CellRange {
  startRow: number;
  endRow: number;
  startColumn: number;
  endColumn: number;
  address: string;
}

export interface CandidateDataBlock {
  range: string;
  fullRange: string;
  scannedRange: string;
  startRow: number;
  endRow: number;
  scannedEndRow: number;
  startColumn: number;
  endColumn: number;
  headerRow: number;
  confidence: number;
  reasons: string[];
  rowDensity: number;
  populatedColumnCount: number;
}

export interface ProfilingIssue {
  code: string;
  severity: ProfilingIssueSeverity;
  message: string;
  location?: SourceLocation;
  occurrences?: number;
  affectedColumns?: string[];
  exampleLocations?: SourceLocation[];
}

export interface ColumnProfile {
  sheetName: string;
  columnName: string;
  columnIndex: number;
  columnLetter: string;
  header: string;
  normalizedHeader: string;
  inferredType: InferredCellType;
  nullCount: number;
  nonNullCount: number;
  uniqueValueCount: number;
  uniquenessRatio: number;
  formulaCount: number;
  sampleValues: string[];
  minValue?: number;
  maxValue?: number;
  minDate?: string;
  maxDate?: string;
  possibleCatalog: boolean;
  statisticsSampled: boolean;
  scannedRows: number;
  issues: ProfilingIssue[];
}

export interface SheetProfile {
  name: string;
  sheetIndex: number;
  rowCount: number;
  totalRows: number;
  dataRows: number;
  scannedRows: number;
  samplingApplied: boolean;
  samplingLimit: number;
  columnCount: number;
  headerRow?: number;
  hidden: boolean;
  mergedCellsCount: number;
  formulaCellsCount: number;
  emptyRowsCount: number;
  nonEmptyRowsCount: number;
  physicalRange: CellRange;
  effectiveNonEmptyRange?: CellRange;
  candidateDataBlocks: CandidateDataBlock[];
  structuralClass: StructuralClass;
  structuralConfidence: number;
  structuralSignals: string[];
  suggestedClass: StructuralClass;
  suggestedRange?: string;
  suggestionConfidence: number;
  needsHumanReview: boolean;
  reviewReasons: string[];
  columns: ColumnProfile[];
  duplicateColumnNames: string[];
  issues: ProfilingIssue[];
}

export interface WorkbookProfile {
  sourceFile: SourceFileMetadata;
  sheets: SheetProfile[];
  issues: ProfilingIssue[];
  profiledAt: string;
  samplePolicy: SamplePolicy;
}

export interface ProfileReport {
  profile: WorkbookProfile;
  jsonArtifactPath?: string;
  markdownArtifactPath?: string;
  selectionManifestPath?: string;
}

export interface SheetProfilingOptions {
  headerRow?: number;
}

export interface SourceProfilingConfig {
  source?: {
    company_key?: string;
    format?: "xlsx";
    sheets?: Array<{
      name: string;
      header_row?: number;
    }>;
  };
  profiling?: {
    sample_values_limit?: number;
    sample_policy?: SamplePolicy;
    scan_rows_limit?: number;
    calculate_sha256?: boolean;
    inspect_formulas?: boolean;
    execute_macros?: false;
    catalog_max_unique_values?: number;
    catalog_max_uniqueness_ratio?: number;
  };
}

export interface ProfilingOptions {
  companyId?: string;
  sampleValuesLimit?: number;
  samplePolicy?: SamplePolicy;
  scanRowsLimit?: number;
  calculateSha256?: boolean;
  inspectFormulas?: boolean;
  relativePathRoot?: string;
  catalogMaxUniqueValues?: number;
  catalogMaxUniquenessRatio?: number;
  sheets?: Record<string, SheetProfilingOptions>;
  processedAt?: string;
  selectionOutputPath?: string;
}
