import type { TenantView } from "@/lib/controls/types";

export type DashboardStatus = "ready" | "unauthenticated" | "unauthorized" | "error";

export type DashboardKpis = {
  controls: number;
  inspectedQuantity: number;
  defects: number;
  dpu: number;
};

export type DashboardEvolutionPoint = DashboardKpis & {
  label: string;
};

export type DashboardOperationDpu = {
  operationId: string;
  label: string;
  inspectedQuantity: number;
  defects: number;
  value: number;
};

export type DashboardFailureRanking = {
  failureModeId: string;
  label: string;
  quantity: number;
};

export type DashboardSummary = {
  kpis: DashboardKpis;
  evolution: DashboardEvolutionPoint[];
  operationDpu: DashboardOperationDpu[];
  failureRanking: DashboardFailureRanking[];
  todaySummary: DashboardKpis;
  transferredRows: number;
};

export type DashboardData = {
  status: DashboardStatus;
  tenant: TenantView | null;
  summary: DashboardSummary | null;
  initialError: string;
};
