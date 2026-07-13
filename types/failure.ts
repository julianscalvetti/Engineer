export type Shift = "A" | "B" | "C";

export type ProductOperation = {
  station: string;
  failureModes: string[];
};

export type Product = {
  code: string;
  name: string;
  operations: ProductOperation[];
};

export type FailureQuantity = {
  mode: string;
  quantity: number;
};

export type FailureRecord = {
  id: string;
  productCode: string;
  operationStation: string;
  shift: Shift;
  operator: string;
  failures: FailureQuantity[];
  total: number;
  observations: string;
  originalOcrText: string;
  fileName: string;
  timestamp: string;
};

export type ParsedOcrData = {
  productCode?: string;
  operationStation?: string;
  shift?: Shift;
  operator?: string;
  observations?: string;
  quantities: Record<string, number>;
};
