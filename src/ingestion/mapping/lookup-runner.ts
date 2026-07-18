import type { FieldLookupConfig, ResolutionStatus, ScopedCatalogLookupResolverConfig } from "./types";
import type { CatalogRecord, ExecutionIssue, ResolutionTrace } from "./execution-types";
import { issue } from "./transformation-runner";

export function runFieldLookup(input: {
  lookup: FieldLookupConfig;
  values: Record<string, unknown>;
  catalogs: Map<string, CatalogRecord[]>;
  field: string;
}): { trace: ResolutionTrace; issue?: ExecutionIssue; output?: unknown } {
  const config = toScopedConfig(input.lookup, input.field);
  return runScopedLookup({
    config,
    values: input.values,
    catalogs: input.catalogs,
    onUnresolved: input.lookup.on_unresolved ?? "pending_review",
    onAmbiguous: input.lookup.on_ambiguous ?? "pending_review",
  });
}

export function runScopedLookup(input: {
  config: ScopedCatalogLookupResolverConfig;
  values: Record<string, unknown>;
  catalogs: Map<string, CatalogRecord[]>;
  onUnresolved?: "warning" | "pending_review" | "rejected";
  onAmbiguous?: "pending_review" | "rejected";
}): { trace: ResolutionTrace; issue?: ExecutionIssue; output?: unknown } {
  const scopeValues: Record<string, string | null> = {};
  for (const scope of input.config.scope ?? []) {
    const value = stringify(input.values[scope.value_field]);
    scopeValues[scope.value_field] = value || null;
    if (!value) {
      const trace = buildTrace(input.config, "skipped", "", scopeValues, [], {});
      return {
        trace,
        issue: issue("LOOKUP_SCOPE_UNAVAILABLE", input.onUnresolved ?? "pending_review", "Lookup scope value is unavailable.", input.config.output_field),
      };
    }
  }

  const inputValue = stringify(input.values[input.config.input_field]);
  if (!inputValue) {
    const status = input.config.required === false ? "skipped" : "unresolved";
    return {
      trace: buildTrace(input.config, status, inputValue, scopeValues, [], {}),
      issue: status === "skipped" ? undefined : issue("LOOKUP_UNRESOLVED", input.onUnresolved ?? "pending_review", "Lookup input is empty.", input.config.output_field),
    };
  }

  const candidates = (input.catalogs.get(input.config.catalog_source) ?? []).filter((record) => {
    if (!record.usable) return false;
    const scopeOk = (input.config.scope ?? []).every(
      (scope) => stringify(record.values[scope.catalog_field]) === stringify(input.values[scope.value_field]),
    );
    return scopeOk && stringify(record.values[input.config.catalog_match_field]) === inputValue;
  });

  const status: ResolutionStatus =
    candidates.length === 0 ? "unresolved" : candidates.length > 1 ? "ambiguous" : "resolved";
  const output =
    status === "resolved"
      ? candidates[0].values[input.config.output_field] ?? candidates[0].values[input.config.catalog_match_field]
      : undefined;
  const trace = buildTrace(
    input.config,
    status,
    inputValue,
    scopeValues,
    candidates,
    output === undefined ? {} : { [input.config.output_field]: stringify(output) },
  );

  if (status === "resolved") return { trace, output };
  if (status === "ambiguous") {
    return {
      trace,
      issue: issue("LOOKUP_AMBIGUOUS", input.onAmbiguous ?? "pending_review", "Lookup matched multiple catalog records.", input.config.output_field),
    };
  }
  return {
    trace,
    issue: issue("LOOKUP_UNRESOLVED", input.onUnresolved ?? "pending_review", "Lookup did not match any catalog record.", input.config.output_field),
  };
}

function toScopedConfig(lookup: FieldLookupConfig, outputField: string): ScopedCatalogLookupResolverConfig {
  return {
    type: "scoped_catalog_lookup",
    input_field: lookup.input_field,
    catalog_source: lookup.catalog_source,
    catalog_match_field: lookup.catalog_match_field,
    output_field: outputField,
    scope: lookup.scope,
    required: lookup.required,
  };
}

function buildTrace(
  config: ScopedCatalogLookupResolverConfig,
  status: ResolutionStatus,
  inputValue: string,
  scopeValues: Record<string, string | null>,
  candidates: CatalogRecord[],
  outputFields: Record<string, string | null>,
): ResolutionTrace {
  return {
    resolver_type: config.type,
    catalog_source: config.catalog_source,
    input_value: inputValue,
    scope_values: scopeValues,
    match_count: candidates.length,
    matched_record_ids: candidates.map((candidate) => candidate.record_id),
    status,
    output_fields: outputFields,
  };
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}
