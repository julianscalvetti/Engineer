import type { RawCsvRow } from "@/types/quality";
import { normalizeColumnName } from "./validateColumns";

const INTERNAL_COLUMN_NAMES: Record<string, string> = {
  FECHA: "fecha",
  "MES - ANO": "mes_anio",
  "MES-ANO": "mes_anio",
  "COD PIEZA": "cod_pieza",
  "DESCRIPCION PZA": "descripcion_pieza",
  CLIENTE: "cliente",
  OPERACION: "operacion",
  AUXILIAR: "auxiliar",
  TURNO: "turno",
  OPERADOR: "operador",
  "MODO DE FALLA": "modo_falla",
  "CANT NO OK": "cant_no_ok",
  "CANT TOTAL": "cant_total",
  "DETALLE MODO DE FALLA": "detalle_modo_falla",
  DPU: "dpu",
  "TOTAL CONTROLADO": "total_controlado",
  "TOTAL PRODUCIDO": "total_producido",
  "AUXILIAR FECHA 6 MESES": "auxiliar_fecha_6_meses",
  "AUXILIAR FECHA ANUAL": "auxiliar_fecha_anual",
};

export type NormalizedQualityRow = Record<string, string | undefined>;

export function toInternalColumnName(column: string): string {
  const normalized = normalizeColumnName(column);

  return (
    INTERNAL_COLUMN_NAMES[normalized] ??
    normalized
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
  );
}

export function normalizeRow(row: RawCsvRow): NormalizedQualityRow {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => [toInternalColumnName(column), value]),
  );
}
