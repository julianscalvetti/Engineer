import type {
  CombinedPriority,
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

function findTopPieceDisplayName(
  rows: ValidRow[],
  topPieceCode: string | undefined,
): string | null {
  if (!topPieceCode) return null;

  const descriptions = new Map<string, number>();

  for (const { row, noOk } of rows) {
    const code = row.cod_pieza?.trim() || "Sin dato";
    const description = row.descripcion_pieza?.trim();

    if (code === topPieceCode && description) {
      descriptions.set(description, (descriptions.get(description) ?? 0) + noOk);
    }
  }

  const mainDescription = Array.from(descriptions.entries()).sort(
    ([descriptionA, totalA], [descriptionB, totalB]) =>
      totalB - totalA || descriptionA.localeCompare(descriptionB, "es"),
  )[0]?.[0];

  return formatPieceDisplayName(topPieceCode, mainDescription);
}

function formatPieceDisplayName(code: string, description?: string): string {
  if (description && code !== "Sin dato") return `${description} (${code})`;
  return description ?? code;
}

function calculateCombinedPriority(
  rows: ValidRow[],
  includeOperation: boolean,
): CombinedPriority | null {
  const groups = new Map<
    string,
    {
      pieceCode: string;
      operation: string | null;
      failureMode: string;
      totalNoOk: number;
      descriptions: Map<string, number>;
    }
  >();

  for (const { row, noOk } of rows) {
    const pieceCode = row.cod_pieza?.trim() || "Sin dato";
    const operation = includeOperation ? row.operacion?.trim() || null : null;
    const failureMode = row.modo_falla?.trim() || "Sin dato";
    const key = JSON.stringify([pieceCode, operation, failureMode]);
    const group = groups.get(key) ?? {
      pieceCode,
      operation,
      failureMode,
      totalNoOk: 0,
      descriptions: new Map<string, number>(),
    };
    const description = row.descripcion_pieza?.trim();

    group.totalNoOk += noOk;
    if (description) {
      group.descriptions.set(description, (group.descriptions.get(description) ?? 0) + noOk);
    }
    groups.set(key, group);
  }

  const topGroup = Array.from(groups.values()).sort(
    (a, b) =>
      b.totalNoOk - a.totalNoOk ||
      JSON.stringify([a.pieceCode, a.operation, a.failureMode]).localeCompare(
        JSON.stringify([b.pieceCode, b.operation, b.failureMode]),
        "es",
      ),
  )[0];

  if (!topGroup) return null;

  const mainDescription = Array.from(topGroup.descriptions.entries()).sort(
    ([descriptionA, totalA], [descriptionB, totalB]) =>
      totalB - totalA || descriptionA.localeCompare(descriptionB, "es"),
  )[0]?.[0];

  return {
    piece: formatPieceDisplayName(topGroup.pieceCode, mainDescription),
    operation: topGroup.operation,
    failureMode: topGroup.failureMode,
    totalNoOk: topGroup.totalNoOk,
  };
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
  const failureModes = buildRanking(validRows, "modo_falla", totalNoOk);
  const pieces = buildRanking(validRows, "cod_pieza", totalNoOk);

  return {
    totalNoOk,
    validRows: validRows.length,
    discardedRows,
    topPieceDisplayName: findTopPieceDisplayName(validRows, pieces[0]?.label),
    combinedPriority: calculateCombinedPriority(
      validRows,
      availableColumns.has("operacion"),
    ),
    estimatedRate: calculateEstimatedRate(validRows, availableColumns, totalNoOk),
    failureModes,
    pieces,
    operations: availableColumns.has("operacion")
      ? buildRanking(validRows, "operacion", totalNoOk)
      : null,
    shifts: availableColumns.has("turno")
      ? buildRanking(validRows, "turno", totalNoOk)
      : null,
  };
}
