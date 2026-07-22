export type {
  ApprovedSourceSelection,
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
} from "./types";
export type {
  ControlMeasurementPreview,
  MappedSourceRecord,
  MappingPreviewInput,
  MappingPreviewSummary,
  PreviewStatus,
  SampleMode,
} from "./execution-types";

export { buildApprovedSourceSelections } from "./approved-source-selection";
export {
  applyRegexReplace,
  evaluateResolverPipeline,
  resolveLongestCatalogPrefix,
  resolveScopedCatalogLookup,
  validateSemanticMapping,
} from "./engine";
export { renderMappingValidationMarkdown, writeMappingValidationReport } from "./diagnostics";
export { executeSemanticMappingPreview } from "./executor";
