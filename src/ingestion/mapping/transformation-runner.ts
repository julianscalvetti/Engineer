import type { MappingFieldConfig, ResolverTransformationConfig } from "./types";
import type { ExecutionIssue, PreviewStatus, TransformationTrace } from "./execution-types";

export function runFieldTransformations(
  field: MappingFieldConfig,
  rawValue: unknown,
): { value: unknown; traces: TransformationTrace[]; issues: ExecutionIssue[] } {
  let value: string | number | null = stringify(rawValue);
  const traces: TransformationTrace[] = [];
  const issues: ExecutionIssue[] = [];

  for (const transformation of field.transformations ?? []) {
    const input = stringify(value);
    try {
      const textValue = stringify(value);
      if (transformation === "trim") value = textValue.trim();
      if (transformation === "normalize_whitespace") value = textValue.replace(/\s+/g, " ").trim();
      if (transformation === "uppercase") value = textValue.toUpperCase();
      if (transformation === "lowercase") value = textValue.toLowerCase();
      if (transformation === "preserve_string") value = String(value);
      if (transformation === "parse_integer") value = parseInteger(textValue, field.semantic_field, issues);
      if (transformation === "parse_decimal") value = parseDecimal(textValue, field.semantic_field, issues);
      if (transformation === "parse_date") value = parseDate(textValue, field.semantic_field, issues);
      if (transformation === "extract_regex") value = extractRegex(textValue, field, issues);
      traces.push({ field: field.semantic_field, type: transformation, input, output: value, success: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Transformation failed.";
      traces.push({
        field: field.semantic_field,
        type: transformation,
        input,
        output: null,
        success: false,
        error_code: "TRANSFORMATION_FAILED",
        error_message: message,
      });
      issues.push(issue("TRANSFORMATION_FAILED", "rejected", message, field.semantic_field));
      value = null;
    }
  }

  if (value === "" || value === null) {
    if (field.required) {
      issues.push(issue("REQUIRED_FIELD_MISSING", "rejected", "Required field is missing.", field.semantic_field));
    } else if (field.on_missing) {
      issues.push(issue("OPTIONAL_FIELD_MISSING", field.on_missing, "Optional field is missing.", field.semantic_field));
    }
  }

  return { value: value === "" ? null : value, traces, issues };
}

export function runResolverTransformations(value: string, transformations: ResolverTransformationConfig[]): string {
  return transformations.reduce((current, transformation) => {
    if (transformation.type === "regex_replace") {
      return current.replace(new RegExp(transformation.pattern, transformation.flags), transformation.replacement);
    }
    return current;
  }, value);
}

export function issue(
  code: string,
  severity: PreviewStatus,
  message: string,
  field?: string,
  details?: Record<string, unknown>,
): ExecutionIssue {
  return { code, severity, message, field, details };
}

function extractRegex(value: string, field: MappingFieldConfig, issues: ExecutionIssue[]): string | null {
  const match = field.regex ? new RegExp(field.regex).exec(value) : undefined;
  if (match?.[1]) return match[1];

  const severity = field.on_no_match === "rejected" ? "rejected" : field.on_no_match === "warning" ? "warning" : "pending_review";
  issues.push(issue("TRANSFORMATION_NO_MATCH", severity, "Regex did not match input value.", field.semantic_field));
  return field.fallback_value === null ? null : "";
}

function parseInteger(value: string, field: string, issues: ExecutionIssue[]): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) {
    issues.push(issue("INVALID_INTEGER", "rejected", "Value is not a valid integer.", field));
    return null;
  }
  return parsed;
}

function parseDecimal(value: string, field: string, issues: ExecutionIssue[]): number | null {
  if (!value) return null;
  const normalized = value.replace(",", ".");
  const parsed = Number(normalized);
  if (Number.isNaN(parsed)) {
    issues.push(issue("INVALID_DECIMAL", "rejected", "Value is not a valid decimal.", field));
    return null;
  }
  return parsed;
}

function parseDate(value: string, field: string, issues: ExecutionIssue[]): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    issues.push(issue("INVALID_DATE", "rejected", "Value is not a valid date.", field));
    return null;
  }
  return parsed.toISOString();
}

function stringify(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
