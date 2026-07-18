export type IngestionErrorCode =
  | "INVALID_SOURCE"
  | "UNSUPPORTED_FORMAT"
  | "PROFILING_FAILED"
  | "CONFIGURATION_ERROR";

export class IngestionError extends Error {
  constructor(
    message: string,
    public readonly code: IngestionErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "IngestionError";
  }
}
