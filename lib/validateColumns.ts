import {
  RECOMMENDED_COLUMNS,
  REQUIRED_COLUMNS,
  type ColumnValidation,
} from "@/types/quality";

export function normalizeColumnName(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .replace(/^ï»¿/, "")
    .trim()
    .replace(/\s+/g, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export function validateColumns(columns: string[]): ColumnValidation {
  const normalizedColumns = new Set(columns.map(normalizeColumnName));
  const missingRequired = REQUIRED_COLUMNS.filter(
    (column) => !normalizedColumns.has(normalizeColumnName(column)),
  );
  const missingRecommended = RECOMMENDED_COLUMNS.filter(
    (column) => !normalizedColumns.has(normalizeColumnName(column)),
  );

  return {
    missingRequired: [...missingRequired],
    missingRecommended: [...missingRecommended],
    status:
      missingRequired.length > 0
        ? "invalid"
        : missingRecommended.length > 0
          ? "warning"
          : "valid",
  };
}
