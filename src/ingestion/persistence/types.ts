import type { ExecutionIssue, MappedSourceRecord, PreviewStatus } from "../mapping/execution-types";

export type ImportSourceRecordStatus = PreviewStatus | "imported" | "skipped" | "failed";
export type ImportIssueSeverity = "informational" | "warning" | "error";

export interface ImportPersistenceContext {
  companyId: string;
  plantId: string;
  importBatchId: string;
  importFileId: string;
  mappingId: string;
  mappingVersion: string;
}

export interface SourceTrace {
  sourceRecordId: string;
  sourceId: string;
  sourceSheetName: string;
  sourceRowNumber: number;
  sourceColumnName?: string;
  sourceCellAddress?: string;
  mappingId: string;
  mappingVersion: string;
  sourceRecordStatus: ImportSourceRecordStatus;
}

export interface ImportTraceColumns extends SourceTrace {
  importBatchId: string;
  importFileId: string;
}

export interface ProductImportDraft extends ImportTraceColumns {
  companyId: string;
  plantId: string;
  customerId: string;
  code: string;
  name: string;
  active: boolean;
}

export interface OperationImportDraft extends ImportTraceColumns {
  companyId: string;
  plantId: string;
  productId: string;
  code: string;
  name: string;
}

export interface FailureModeImportDraft extends ImportTraceColumns {
  companyId: string;
  plantId: string;
  operationId: string;
  name: string;
  active: boolean;
}

export interface ControlImportDraft extends ImportTraceColumns {
  companyId: string;
  plantId: string;
  operationId: string;
  date: string;
  shift: string;
  operator: string;
  inspectedQuantity: number;
  observations?: string;
}

export interface ControlFailureImportDraft extends ImportTraceColumns {
  companyId: string;
  plantId: string;
  controlId: string;
  failureModeId: string;
  quantity: number;
}

export interface ImportIssueDraft extends SourceTrace {
  companyId: string;
  plantId?: string;
  importBatchId: string;
  importFileId?: string;
  targetTable?: "products" | "operations" | "failure_modes" | "controls" | "control_failures";
  targetRecordId?: string;
  issueCode: string;
  severity: ImportIssueSeverity;
  sourceIssueSeverity?: ExecutionIssue["severity"];
  message: string;
  details?: Record<string, unknown>;
}

export interface PersistenceDraft {
  sourceRecord: MappedSourceRecord;
  product?: ProductImportDraft;
  operation?: OperationImportDraft;
  failureMode?: FailureModeImportDraft;
  control?: ControlImportDraft;
  controlFailures: ControlFailureImportDraft[];
  importIssues: ImportIssueDraft[];
}

export type MappedSourceRecordPersistenceMapper = (
  record: MappedSourceRecord,
  context: ImportPersistenceContext,
) => PersistenceDraft;
