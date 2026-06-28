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

export interface ColumnValidation {
  missingRequired: string[];
  missingRecommended: string[];
  status: ValidationStatus;
}

export interface CsvFileResult extends ColumnValidation {
  fileName: string;
  rowCount: number;
  columns: string[];
}
