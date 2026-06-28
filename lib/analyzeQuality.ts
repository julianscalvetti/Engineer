import type {
  EstimatedRate,
  QualityAnalysis,
  RankingItem,
  RawCsvRow,
} from "@/types/quality";
import {
  normalizeRow,
  toInternalColumnName,
  type NormalizedQualityRow,
} from "./normalizeColumns";

interface ValidRow {
  row: NormalizedQualityRow;
  noOk: number;
}

const DENOMINATORS: Array<{
  key: string;
  label: EstimatedRate["denominatorColumn"];
}> = [
  { key: "total_controlado", label: "TOTAL CONTROLADO" },
  { key: "cant_total", label: "CANT TOTAL" },
  { key: "total_producido", label: "TOTAL PRODUCIDO" },
];

export function parseQualityNumber(value: string | undefined): number | null {
  if (value === undefined) return null;

  const compact = value.trim().replace(/[\s\u00A0]/g, "");
  if (!compact || !/^[+-]?[\d.,]+$/.test(compact)) return null;

  const lastComma = compact.lastIndexOf(",");
  const lastDot = compact.lastIndexOf(".");
  let normalized = compact;

  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? compact.replace(/\./g, "").replace(",", ".")
        : compact.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = compact.replace(",", ".");
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildRanking(
  rows: ValidRow[],
  key: string,
  totalNoOk: number,
): RankingItem[] {
  const totals = new Map<string, number>();

  for (const { row, noOk } of rows) {
    const label = row[key]?.trim() || "Sin dato";
    totals.set(label, (totals.get(label) ?? 0) + noOk);
  }

  return Array.from(totals, ([label, itemTotal]) => ({
    label,
    totalNoOk: itemTotal,
    percentage: totalNoOk > 0 ? (itemTotal / totalNoOk) * 100 : 0,
  }))
    .sort(
      (a, b) =>
        b.totalNoOk - a.totalNoOk || a.label.localeCompare(b.label, "es"),
    )
    .slice(0, 5);
}

function calculateEstimatedRate(
  rows: ValidRow[],
  availableColumns: Set<string>,
  totalNoOk: number,
): EstimatedRate | null {
  for (const denominator of DENOMINATORS) {
    if (!availableColumns.has(denominator.key)) continue;

    const denominatorTotal = rows.reduce((total, { row }) => {
      const value = parseQualityNumber(row[denominator.key]);
      return value !== null && value > 0 ? total + value : total;
    }, 0);

    if (denominatorTotal > 0) {
      return {
        denominatorColumn: denominator.label,
        denominatorTotal,
        percentage: (totalNoOk / denominatorTotal) * 100,
      };
    }
  }

  return null;
}

export function analyzeQuality(rows: RawCsvRow[], columns: string[]): QualityAnalysis {
  const availableColumns = new Set(columns.map(toInternalColumnName));
  const validRows: ValidRow[] = [];
  let discardedRows = 0;

  for (const rawRow of rows) {
    const row = normalizeRow(rawRow);
    const noOk = parseQualityNumber(row.cant_no_ok);

    if (noOk === null || noOk < 0) {
      discardedRows += 1;
      continue;
    }

    validRows.push({ row, noOk });
  }

  const totalNoOk = validRows.reduce((total, row) => total + row.noOk, 0);

  return {
    totalNoOk,
    validRows: validRows.length,
    discardedRows,
    estimatedRate: calculateEstimatedRate(validRows, availableColumns, totalNoOk),
    failureModes: buildRanking(validRows, "modo_falla", totalNoOk),
    pieces: buildRanking(validRows, "cod_pieza", totalNoOk),
    operations: availableColumns.has("operacion")
      ? buildRanking(validRows, "operacion", totalNoOk)
      : null,
    shifts: availableColumns.has("turno")
      ? buildRanking(validRows, "turno", totalNoOk)
      : null,
  };
}
