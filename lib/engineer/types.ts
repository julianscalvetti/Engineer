import type { TenantView } from "../controls/types";

export type EngineerStatus = "ready" | "unauthenticated" | "unauthorized" | "error";

export type EngineerRuntime = {
  supabaseUrl: string;
  publishableKey: string;
  auth:
    | {
        mode: "access_token";
        accessToken: string;
      }
    | {
        mode: "password";
        email: string;
        password: string;
      };
};

export type EngineerClientContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  accessToken?: string;
};

export type EngineerDateFilters = {
  dateFrom?: string;
  dateTo?: string;
  customerId?: string;
  productId?: string;
  operationId?: string;
  failureModeId?: string;
};

export type EngineerDateRangeContract = {
  date_from: string | null;
  date_to: string | null;
};

export type EngineerTemporalScope = "full_history" | "filtered_period";

export type EngineerTemporalContract = {
  requested_date_range: EngineerDateRangeContract;
  applied_date_range: EngineerDateRangeContract;
  historical_range: EngineerDateRangeContract;
  scope: EngineerTemporalScope;
  truncated: boolean;
  warnings: string[];
};

export type EngineerTrendInterval = "day" | "week" | "month";

export type EngineerPagination = {
  page?: number;
  limit?: number;
};

export type EngineerAnalysisMeasure = "controls" | "inspected_quantity" | "defects" | "dpu";

export type EngineerAnalysisDimension = "customer" | "product" | "operation" | "failure_mode";

export type EngineerAnalysisFilters = {
  dateFrom?: string;
  dateTo?: string;
  customerIds?: string[];
  productIds?: string[];
  operationIds?: string[];
  failureModeIds?: string[];
};

export type EngineerAnalyzeQualityInput = {
  measures: EngineerAnalysisMeasure[];
  groupBy?: EngineerAnalysisDimension[];
  filters?: EngineerAnalysisFilters;
  orderBy?: {
    measure: EngineerAnalysisMeasure;
    direction: "asc" | "desc";
  };
  limit?: number;
};

export type EngineerCompareQualityPeriodsInput = {
  periodA: {
    dateFrom: string;
    dateTo: string;
  };
  periodB: {
    dateFrom: string;
    dateTo: string;
  };
  measures: EngineerAnalysisMeasure[];
  groupBy?: EngineerAnalysisDimension;
  filters?: Omit<EngineerAnalysisFilters, "dateFrom" | "dateTo">;
  limit?: number;
};

export type EngineerQualityParetoInput = {
  dimension: EngineerAnalysisDimension;
  measure: "defects";
  dateFrom?: string;
  dateTo?: string;
  filters?: Omit<EngineerAnalysisFilters, "dateFrom" | "dateTo">;
  threshold?: number;
  limit?: number;
};

export type EngineerAnalysisDimensionValue = {
  id: string;
  label: string;
};

export type EngineerAnalysisMeasures = Record<EngineerAnalysisMeasure, number>;

export type EngineerAnalysisRow = {
  dimensions: Partial<Record<EngineerAnalysisDimension, EngineerAnalysisDimensionValue>>;
  measures: EngineerAnalysisMeasures;
};

export type EngineerAnalysisContext = {
  company: { id: string; name: string } | null;
  plant: { id: string; name: string } | null;
  requested_date_range: EngineerDateRangeContract;
  applied_date_range: EngineerDateRangeContract;
  historical_range: EngineerDateRangeContract;
  filters_applied: Omit<EngineerAnalysisFilters, "dateFrom" | "dateTo">;
  scope: EngineerTemporalScope;
};

export type EngineerAnalysisMetadata = {
  generated_at: string;
  row_count: number;
  truncated: boolean;
  measures: EngineerAnalysisMeasure[];
  group_by: EngineerAnalysisDimension[];
};

export type EngineerAnalyzeQualityResult = {
  status: EngineerStatus;
  context: EngineerAnalysisContext;
  data: EngineerAnalysisRow[];
  metadata: EngineerAnalysisMetadata;
  warnings: string[];
  error: string;
};

export type EngineerCompareDirection = "improved" | "worsened" | "unchanged" | "not_applicable";

export type EngineerMeasureComparison = {
  periodAValue: number;
  periodBValue: number;
  absoluteDelta: number;
  percentageDelta: number | null;
  direction: EngineerCompareDirection;
};

export type EngineerCompareQualityRow = {
  dimensions: Partial<Record<EngineerAnalysisDimension, EngineerAnalysisDimensionValue>>;
  measures: Partial<Record<EngineerAnalysisMeasure, EngineerMeasureComparison>>;
};

export type EngineerCompareQualityPeriodsResult = {
  status: EngineerStatus;
  context: EngineerAnalysisContext & {
    periodA: EngineerDateRangeContract;
    periodB: EngineerDateRangeContract;
  };
  data: EngineerCompareQualityRow[];
  metadata: EngineerAnalysisMetadata;
  warnings: string[];
  error: string;
};

export type EngineerQualityParetoRow = {
  dimension: EngineerAnalysisDimensionValue | null;
  value: number;
  share: number;
  cumulativeShare: number;
  includedInThreshold: boolean;
};

export type EngineerQualityParetoResult = {
  status: EngineerStatus;
  context: EngineerAnalysisContext;
  data: EngineerQualityParetoRow[];
  metadata: EngineerAnalysisMetadata & {
    threshold: number;
    cutoffIndex: number | null;
    totalDefects: number;
  };
  warnings: string[];
  error: string;
};

export type EngineerResolvedFilters = Required<Pick<EngineerDateFilters, "dateFrom" | "dateTo">> & {
  customerId: string;
  productId: string;
  operationId: string;
  failureModeId: string;
};

export type EngineerKpis = {
  controls: number;
  inspectedQuantity: number;
  defects: number;
  dpu: number;
};

export type EngineerQualitySummary = EngineerTemporalContract & {
  status: EngineerStatus;
  tenant: TenantView | null;
  filters: EngineerResolvedFilters;
  kpis: EngineerKpis | null;
  todaySummary: EngineerKpis | null;
  transferredRows: number;
  error: string;
};

export type EngineerRankingDimension = "failure_mode" | "operation_dpu";

export type EngineerRankingItem = {
  id: string;
  label: string;
  value: number;
  inspectedQuantity?: number;
  defects?: number;
};

export type EngineerQualityRanking = EngineerTemporalContract & {
  status: EngineerStatus;
  tenant: TenantView | null;
  filters: EngineerResolvedFilters;
  dimension: EngineerRankingDimension;
  items: EngineerRankingItem[];
  limit: number;
  transferredRows: number;
  error: string;
};

export type EngineerTrendPoint = EngineerKpis & {
  date: string;
};

export type EngineerQualityTrend = EngineerTemporalContract & {
  status: EngineerStatus;
  tenant: TenantView | null;
  filters: EngineerResolvedFilters;
  interval: EngineerTrendInterval;
  requestedInterval: EngineerTrendInterval;
  points: EngineerTrendPoint[];
  transferredRows: number;
  error: string;
};

export type EngineerCatalogEntity = "customer" | "product" | "operation" | "failure_mode";

export type EngineerCatalogItem = {
  entity: EngineerCatalogEntity;
  id: string;
  code?: string;
  name: string;
  parentId?: string;
  parentName?: string;
};

export type EngineerCatalogSearch = EngineerTemporalContract & {
  status: EngineerStatus;
  tenant: TenantView | null;
  query: string;
  entities: EngineerCatalogEntity[];
  items: EngineerCatalogItem[];
  limit: number;
  transferredRows: number;
  error: string;
};

export type EngineerControlSearch = EngineerTemporalContract & {
  status: EngineerStatus;
  tenant: TenantView | null;
  filters: EngineerResolvedFilters;
  page: number;
  limit: number;
  total: number;
  controls: EngineerControlListItem[];
  transferredRows: number;
  error: string;
};

export type EngineerControlListItem = {
  id: string;
  date: string;
  shift: string;
  operator: string;
  inspectedQuantity: number;
  observations: string | null;
  customer: { id: string; name: string } | null;
  product: { id: string; code: string; name: string } | null;
  operation: { id: string; code: string; name: string } | null;
  failures: Array<{ id: string; name: string; quantity: number }>;
  source: {
    fileName: string | null;
    sheetName: string | null;
    rowNumber: number | null;
    cellAddress: string | null;
    sourceRecordId: string | null;
  };
};

export type EngineerControlDetail = EngineerTemporalContract & {
  status: EngineerStatus;
  tenant: TenantView | null;
  control: EngineerControlListItem | null;
  transferredRows: number;
  error: string;
};

export type EngineerIndustrialContext = EngineerTemporalContract & {
  status: EngineerStatus;
  tenant: TenantView | null;
  catalogCounts: Record<EngineerCatalogEntity, number>;
  controlCounts: {
    controls: number;
    controlFailures: number;
  };
  historicalRange: {
    dateFrom: string | null;
    dateTo: string | null;
  };
  limits: {
    catalog: number;
    ranking: number;
    history: number;
    defaultWindowDays: number;
  };
  capabilities: string[];
  error: string;
};
