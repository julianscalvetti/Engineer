export const REQUIRED_COLUMNS = [
  "FECHA",
  "COD PIEZA",
  "MODO DE FALLA",
  "CANT NO OK",
] as const;

export const RECOMMENDED_COLUMNS = [
  "DESCRIPCION PZA",
  "OPERACIÓN",
  "TURNO",
  "CANT TOTAL",
  "TOTAL CONTROLADO",
  "DPU",
] as const;

export type ValidationStatus = "invalid" | "warning" | "valid";

export type RawCsvRow = Record<string, string | undefined>;

export interface RankingItem {
  label: string;
  totalNoOk: number;
  percentage: number;
}

export interface EstimatedRate {
  denominatorColumn: "TOTAL CONTROLADO" | "CANT TOTAL" | "TOTAL PRODUCIDO";
  denominatorTotal: number;
  percentage: number;
}

export interface CombinedPriority {
  piece: string;
  operation: string | null;
  failureMode: string;
  totalNoOk: number;
}

export interface QualityAnalysis {
  totalNoOk: number;
  validRows: number;
  discardedRows: number;
  topPieceDisplayName: string | null;
  combinedPriority: CombinedPriority | null;
  estimatedRate: EstimatedRate | null;
  failureModes: RankingItem[];
  pieces: RankingItem[];
  operations: RankingItem[] | null;
  shifts: RankingItem[] | null;
}

export interface QualityNoticeData {
  totalNoOk: number;
  piece: string;
  pieceNoOk: number;
  failureMode: string;
  failureModePercentage: number;
  operation: string | null;
  shift: string | null;
  estimatedRate: EstimatedRate | null;
  combinedPriority: CombinedPriority;
}

export interface ColumnValidation {
  missingRequired: string[];
  missingRecommended: string[];
  status: ValidationStatus;
}

export interface CsvFileResult extends ColumnValidation {
  fileName: string;
  rowCount: number;
  columns: string[];
  rows: RawCsvRow[];
}
