export type IngestionId = string;

export type CompanyId = string;

export type SourceFileFormat = "xlsx" | "xlsm" | "csv" | "unknown";

export interface SourceFileMetadata {
  id?: IngestionId;
  companyId?: CompanyId;
  originalFilename: string;
  absolutePath?: string;
  relativePath?: string;
  sha256: string;
  sizeBytes: number;
  mimeType: string;
  format: SourceFileFormat;
  extension?: string;
  receivedAt: string;
  processedAt?: string;
  workbookSheetCount?: number;
  warnings?: string[];
}

export interface SourceLocation {
  fileId?: IngestionId;
  sheetName?: string;
  rowNumber?: number;
  columnName?: string;
  columnIndex?: number;
}
