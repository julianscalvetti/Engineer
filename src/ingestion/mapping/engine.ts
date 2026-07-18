import path from "node:path";

import {
  assertReadableFile,
  inspectWorkbook,
  loadSemanticMapping,
  loadSourceProfile,
  loadSourceSelection,
} from "./loader";
import { validateMappingContext } from "./validator";
import type {
  MappingIssue,
  MappingValidationInput,
  MappingValidationReport,
  PrefixResolution,
  ResolutionStatus,
  ResolverStepConfig,
  ScopedCatalogLookupResolverConfig,
  PipelineResolverConfig,
} from "./types";

export type CatalogRecord = Record<string, string | null | undefined | boolean> & {
  __usable?: boolean;
  record_id?: string;
};

export interface ScopedLookupResult {
  status: ResolutionStatus;
  inputValue: string;
  outputField: string;
  resolved?: string;
  candidates: CatalogRecord[];
}

export interface PipelineEvaluationResult {
  status: ResolutionStatus;
  values: CatalogRecord;
  stepResults: Array<{
    index: number;
    type: string;
    status: ResolutionStatus;
    outputField?: string;
    value?: string | null;
    candidates?: number;
  }>;
}

export async function validateSemanticMapping(input: MappingValidationInput): Promise<MappingValidationReport> {
  const inputPath = path.resolve(input.inputPath);
  const mappingPath = path.resolve(input.mappingPath);
  const sourceSelectionPath = path.resolve(input.sourceSelectionPath);
  const profilePath = input.profilePath ? path.resolve(input.profilePath) : undefined;
  const loadErrors: MappingIssue[] = [];

  const inputReadError = await assertReadableFile(inputPath);
  if (inputReadError) {
    loadErrors.push({
      code: "SOURCE_FILE_NOT_FOUND",
      severity: "error",
      message: inputReadError,
    });
  }

  const [mappingLoad, selectionLoad, profileLoad] = await Promise.all([
    loadSemanticMapping(mappingPath),
    loadSourceSelection(sourceSelectionPath),
    profilePath ? loadSourceProfile(profilePath) : Promise.resolve({ path: "", value: undefined, errors: [] }),
  ]);

  mappingLoad.errors.forEach((message) =>
    loadErrors.push({ code: "INVALID_MAPPING_YAML", severity: "error", message }),
  );
  selectionLoad.errors.forEach((message) =>
    loadErrors.push({ code: "INVALID_SOURCE_SELECTION_YAML", severity: "error", message }),
  );
  profileLoad.errors.forEach((message) =>
    loadErrors.push({ code: "INVALID_SOURCE_PROFILE_JSON", severity: "error", message }),
  );

  const inspectionRequests =
    mappingLoad.value?.sources?.map((source) => ({
      sheet: source.sheet,
      headerRow: source.header_row,
      dataRange: source.data_range,
    })) ?? [];
  const workbook =
    inputReadError || inspectionRequests.length === 0
      ? { sha256: "", inspections: [], sheetNames: [] }
      : await inspectWorkbook(inputPath, inspectionRequests);

  const result = validateMappingContext({
    mappingPath,
    sourceSelectionPath,
    mapping: mappingLoad.value,
    sourceSelection: selectionLoad.value,
    sourceProfile: profileLoad.value,
    sheetNames: workbook.sheetNames,
    inspections: workbook.inspections,
    sourceFileSha256: workbook.sha256,
    loadErrors,
  });

  return {
    sourceFile: {
      path: inputPath,
      fileName: path.basename(inputPath),
      sha256: workbook.sha256,
    },
    mapping: {
      mappingId: mappingLoad.value?.mapping_id,
      mappingVersion: mappingLoad.value?.mapping_version,
      status: mappingLoad.value?.status,
    },
    sources: result.sourceSummaries,
    layoutsUsed: result.layoutsUsed,
    semanticFields: result.semanticFields,
    transformations: result.transformations,
    dependencies: result.dependencies,
    resolvers: result.resolvers,
    lookups: result.lookups,
    resolverTests: result.resolverTests,
    errors: result.errors,
    warnings: result.warnings,
    informational: result.informational,
    unresolvedDecisions: mappingLoad.value?.unresolved_decisions ?? [],
  };
}

export function resolveLongestCatalogPrefix(value: string, catalogValues: string[]): PrefixResolution {
  const originalValue = value;
  const sortedMatches = catalogValues
    .filter((candidate) => candidate && value.startsWith(candidate))
    .sort((left, right) => right.length - left.length || left.localeCompare(right));
  const longestLength = sortedMatches[0]?.length ?? 0;
  const candidates = sortedMatches.filter((candidate) => candidate.length === longestLength);

  if (candidates.length === 0) {
    return {
      status: "unresolved",
      originalValue,
      method: "longest_catalog_prefix",
      candidates: [],
    };
  }

  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      originalValue,
      method: "longest_catalog_prefix",
      candidates,
    };
  }

  const resolved = candidates[0];
  return {
    status: "resolved",
    originalValue,
    resolved,
    remainder: value.slice(resolved.length),
    method: "longest_catalog_prefix",
    candidates,
  };
}

export function evaluateResolverPipeline(input: {
  resolver: PipelineResolverConfig;
  initialValues: CatalogRecord;
  catalogs: Map<string, CatalogRecord[]>;
}): PipelineEvaluationResult {
  const values: CatalogRecord = { ...input.initialValues };
  const stepResults: PipelineEvaluationResult["stepResults"] = [];
  let finalStatus: ResolutionStatus = "resolved";

  input.resolver.steps.forEach((step, index) => {
    const result = evaluateResolverStep(step, values, input.catalogs);
    stepResults.push({
      index,
      type: step.type,
      status: result.status,
      outputField: result.outputField,
      value: result.value,
      candidates: result.candidates,
    });
    if (result.outputField) values[result.outputField] = result.value;
    if (result.extraValues) {
      Object.entries(result.extraValues).forEach(([field, value]) => {
        values[field] = value;
      });
    }
    if (result.status !== "resolved") finalStatus = result.status;
  });

  return { status: finalStatus, values, stepResults };
}

export function resolveScopedCatalogLookup(
  config: ScopedCatalogLookupResolverConfig,
  values: CatalogRecord,
  catalogRows: CatalogRecord[],
): ScopedLookupResult {
  const inputValue = stringifyValue(values[config.input_field]);
  if (!inputValue) {
    return {
      status: config.required === false ? "skipped" : "unresolved",
      inputValue,
      outputField: config.output_field,
      candidates: [],
    };
  }

  const scopedRows = catalogRows.filter((row) =>
    isUsableCatalogRow(row) &&
    (config.scope ?? []).every((scope) => stringifyValue(row[scope.catalog_field]) === stringifyValue(values[scope.value_field])),
  );
  const candidates = scopedRows.filter((row) => stringifyValue(row[config.catalog_match_field]) === inputValue);

  if (candidates.length === 0) {
    return { status: "unresolved", inputValue, outputField: config.output_field, candidates: [] };
  }

  if (candidates.length > 1) {
    return { status: "ambiguous", inputValue, outputField: config.output_field, candidates };
  }

  return {
    status: "resolved",
    inputValue,
    outputField: config.output_field,
    resolved: stringifyValue(candidates[0][config.output_field] ?? candidates[0][config.catalog_match_field]),
    candidates,
  };
}

export function applyRegexReplace(inputValue: string, pattern: string, replacement: string, flags = ""): string {
  return inputValue.replace(new RegExp(pattern, flags), replacement);
}

function evaluateResolverStep(
  step: ResolverStepConfig,
  values: CatalogRecord,
  catalogs: Map<string, CatalogRecord[]>,
): {
  status: ResolutionStatus;
  outputField?: string;
  value?: string | null;
  candidates?: number;
  extraValues?: CatalogRecord;
} {
  if (step.type === "longest_catalog_prefix") {
    const inputField = step.input_field ?? step.source_field;
    const inputValue = stringifyValue(inputField ? values[inputField] : undefined);
    const catalogValues = (catalogs.get(step.catalog_source) ?? [])
      .filter(isUsableCatalogRow)
      .map((row) => stringifyValue(row[step.catalog_field]))
      .filter(Boolean);
    const resolution = resolveLongestCatalogPrefix(inputValue, catalogValues);
    const outputField = step.output_field ?? step.catalog_field;
    const remainderField = step.remainder_output_field ?? step.remainder_field ?? "unresolved_remainder";
    return {
      status: resolution.status,
      outputField,
      value: resolution.resolved ?? null,
      candidates: resolution.candidates.length,
      extraValues: { [remainderField]: resolution.remainder ?? null },
    };
  }

  if (step.type === "transform_value") {
    const value = stringifyValue(values[step.input_field]);
    const transformed = step.transformations.reduce((current, transformation) => {
      if (transformation.type === "regex_replace") {
        return applyRegexReplace(current, transformation.pattern, transformation.replacement, transformation.flags);
      }
      return current;
    }, value);
    return { status: "resolved", outputField: step.output_field, value: transformed };
  }

  const lookup = resolveScopedCatalogLookup(step, values, catalogs.get(step.catalog_source) ?? []);
  return {
    status: lookup.status,
    outputField: step.output_field,
    value: lookup.resolved ?? null,
    candidates: lookup.candidates.length,
  };
}

function isUsableCatalogRow(row: CatalogRecord): boolean {
  return row.__usable !== false;
}

function stringifyValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}
