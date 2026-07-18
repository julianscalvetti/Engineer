export type TenantView = {
  companyId: string;
  companyName: string;
  plantId: string;
  plantName: string;
  role: "owner" | "engineer" | "operator";
};

export type CompanyRef = {
  id: string;
  name: string;
};

export type PlantRef = {
  id: string;
  name: string;
  companies: CompanyRef | null;
};

export type CustomerRef = {
  id: string;
  name: string;
  plants: PlantRef | null;
};

export type ProductRef = {
  id: string;
  code: string;
  name: string;
  customers: CustomerRef | null;
};

export type OperationRef = {
  id: string;
  code: string;
  name: string;
  products: ProductRef | null;
};

export type FailureModeRef = {
  id: string;
  name: string;
};

export type ControlFailure = {
  id: string;
  failure_mode_id: string;
  quantity: number;
  source_sheet_name: string | null;
  source_row_number: number | null;
  source_cell_address: string | null;
  source_record_id: string | null;
  failure_modes: FailureModeRef | null;
};

export type ImportFileRef = {
  id: string;
  file_name: string;
  file_sha256: string;
};

export type ControlRecord = {
  id: string;
  company_id: string;
  plant_id: string;
  operation_id: string;
  date: string;
  shift: string;
  operator: string;
  inspected_quantity: number;
  observations: string | null;
  created_at: string;
  updated_at: string;
  import_batch_id: string | null;
  import_file_id: string | null;
  source_record_id: string | null;
  source_id: string | null;
  source_sheet_name: string | null;
  source_row_number: number | null;
  source_cell_address: string | null;
  mapping_id: string | null;
  mapping_version: string | null;
  source_record_status: string | null;
  import_files: ImportFileRef | null;
  operations: OperationRef | null;
  control_failures: ControlFailure[];
};

export type ControlsViewData =
  | {
      status: "ready";
      tenant: TenantView;
      controls: ControlRecord[];
      error: "";
    }
  | {
      status: "unauthenticated" | "unauthorized" | "error";
      tenant: null;
      controls: [];
      error: string;
    };

export type ControlHistoryFilters = {
  dateFrom: string;
  dateTo: string;
  customerId: string;
  productId: string;
  operationId: string;
  failureModeId: string;
  page: number;
  pageSize: number;
};

export type ControlHistoryOptions = {
  customers: Array<{ id: string; name: string }>;
  products: Array<{ id: string; code: string; name: string; customer_id: string }>;
  operations: Array<{ id: string; code: string; name: string; product_id: string }>;
  failureModes: Array<{ id: string; name: string; operation_id: string }>;
};

export type ControlHistoryData =
  | {
      status: "ready";
      tenant: TenantView;
      controls: ControlRecord[];
      total: number;
      page: number;
      pageSize: number;
      filters: ControlHistoryFilters;
      options: ControlHistoryOptions;
      transferredRows: number;
      error: "";
    }
  | {
      status: "unauthenticated" | "unauthorized" | "error";
      tenant: null;
      controls: [];
      total: 0;
      page: number;
      pageSize: number;
      filters: ControlHistoryFilters;
      options: ControlHistoryOptions;
      transferredRows: 0;
      error: string;
    };
