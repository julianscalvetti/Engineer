import type { PipelineResolverConfig, ResolutionStatus } from "./types";
import type { CatalogRecord, ExecutionIssue, ResolutionTrace } from "./execution-types";
import { runScopedLookup } from "./lookup-runner";
import { issue, runResolverTransformations } from "./transformation-runner";

export function runResolverPipeline(input: {
  resolver: PipelineResolverConfig;
  values: Record<string, unknown>;
  catalogs: Map<string, CatalogRecord[]>;
}): { values: Record<string, unknown>; traces: ResolutionTrace[]; issues: ExecutionIssue[] } {
  const values = { ...input.values };
  const traces: ResolutionTrace[] = [];
  const issues: ExecutionIssue[] = [];

  for (const step of input.resolver.steps) {
    if (step.type === "longest_catalog_prefix") {
      const inputField = step.input_field ?? step.source_field;
      const inputValue = stringify(inputField ? values[inputField] : undefined);
      const candidates = (input.catalogs.get(step.catalog_source) ?? [])
        .filter((record) => record.usable)
        .filter((record) => {
          const candidate = stringify(record.values[step.catalog_field]);
          return candidate && inputValue.startsWith(candidate);
        })
        .sort((left, right) => stringify(right.values[step.catalog_field]).length - stringify(left.values[step.catalog_field]).length);
      const longest = stringify(candidates[0]?.values[step.catalog_field]);
      const matched = candidates.filter((candidate) => stringify(candidate.values[step.catalog_field]).length === longest.length);
      const status: ResolutionStatus = matched.length === 0 ? "unresolved" : matched.length > 1 ? "ambiguous" : "resolved";
      const outputField = step.output_field ?? step.catalog_field;
      const remainderField = step.remainder_output_field ?? step.remainder_field ?? "unresolved_remainder";
      if (status === "resolved") {
        values[outputField] = longest;
        values[remainderField] = inputValue.slice(longest.length);
      }
      traces.push({
        resolver_type: step.type,
        catalog_source: step.catalog_source,
        input_value: inputValue,
        scope_values: {},
        match_count: matched.length,
        matched_record_ids: matched.map((record) => record.record_id),
        status,
        output_fields: {
          [outputField]: status === "resolved" ? longest : null,
          [remainderField]: status === "resolved" ? stringify(values[remainderField]) : null,
        },
      });
      if (status !== "resolved") {
        issues.push(issue("RESOLVER_UNRESOLVED", "pending_review", "Resolver prefix step did not resolve.", outputField));
      }
    }

    if (step.type === "transform_value") {
      const output = runResolverTransformations(stringify(values[step.input_field]), step.transformations);
      values[step.output_field] = output;
      traces.push({
        resolver_type: step.type,
        input_value: stringify(values[step.input_field]),
        scope_values: {},
        match_count: 0,
        matched_record_ids: [],
        status: "resolved",
        output_fields: { [step.output_field]: output },
      });
    }

    if (step.type === "scoped_catalog_lookup") {
      const result = runScopedLookup({ config: step, values, catalogs: input.catalogs });
      traces.push(result.trace);
      if (result.output !== undefined) values[step.output_field] = result.output;
      if (result.issue) issues.push(result.issue);
    }
  }

  return { values, traces, issues };
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}
