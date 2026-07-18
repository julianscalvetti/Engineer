export type {
  CompanyId,
  IngestionId,
  SourceFileFormat,
  SourceFileMetadata,
  SourceLocation,
} from "./shared/types";

export { IngestionError } from "./shared/errors";
export type { IngestionErrorCode } from "./shared/errors";

export type {
  ColumnProfile,
  CandidateDataBlock,
  CellRange,
  InferredCellType,
  ProfileReport,
  ProfilingOptions,
  ProfilingIssue,
  ProfilingIssueSeverity,
  SamplePolicy,
  SheetProfilingOptions,
  SheetProfile,
  SourceProfilingConfig,
  StructuralClass,
  WorkbookProfile,
} from "./profiling";

export { profileXlsxFile } from "./profiling";

export type {
  FieldTransformation,
  FieldTreatment,
  MappingFieldConfig,
  MappingIssue,
  MeasurementMappingConfig,
  MappingSourceConfig,
  MappingValidationInput,
  MappingValidationOptions,
  MappingValidationReport,
  PrefixResolution,
  ResolverConfig,
  ResolverSummary,
  SemanticDataType,
  SemanticMappingConfig,
  SemanticMappingVersion,
  SourceColumnSelector,
  SourceLayout,
  SourceSelectionConfig,
} from "./mapping";
export type {
  ControlMeasurementPreview,
  MappedSourceRecord,
  MappingPreviewInput,
  MappingPreviewSummary,
  PreviewStatus,
  SampleMode,
} from "./mapping";

export {
  applyRegexReplace,
  evaluateResolverPipeline,
  renderMappingValidationMarkdown,
  resolveLongestCatalogPrefix,
  resolveScopedCatalogLookup,
  validateSemanticMapping,
  writeMappingValidationReport,
  executeSemanticMappingPreview,
} from "./mapping";
