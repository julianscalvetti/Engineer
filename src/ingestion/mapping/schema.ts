import type { FieldTransformation, ResolverType, SourceLayout } from "./types";

export const SUPPORTED_MAPPING_VERSION = "semantic-mapping-v1";

export const SUPPORTED_LAYOUTS = new Set<SourceLayout>(["row_table", "wide_columns_to_rows"]);

export const SUPPORTED_TRANSFORMATIONS = new Set<FieldTransformation>([
  "trim",
  "normalize_whitespace",
  "uppercase",
  "lowercase",
  "parse_integer",
  "parse_decimal",
  "parse_date",
  "extract_regex",
  "preserve_string",
]);

export const SUPPORTED_TREATMENTS = new Set(["direct", "lookup", "derived_ignore", "pending"]);

export const SUPPORTED_DATA_TYPES = new Set(["string", "integer", "decimal", "date", "datetime", "boolean"]);

export const SUPPORTED_RESOLVERS = new Set<ResolverType>([
  "longest_catalog_prefix",
  "pipeline",
  "transform_value",
  "scoped_catalog_lookup",
]);

export const SUPPORTED_RESOLVER_TRANSFORMATIONS = new Set(["regex_replace"]);

export const SUPPORTED_REGEX_FLAGS = new Set(["g", "i", "m", "s", "u", "y"]);

export function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
