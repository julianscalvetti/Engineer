import type { DashboardData, DashboardSummary } from "@/lib/dashboard/types";
import { createClient } from "@/lib/supabase/server";
import { getActiveTenantContext } from "@/lib/tenant/context";

export async function getDashboardData(): Promise<DashboardData> {
  try {
    const supabase = await createClient();
    const context = await getActiveTenantContext(supabase);

    if (context.status !== "ready") {
      return {
        status: context.status,
        tenant: null,
        summary: null,
        initialError: context.message,
      };
    }

    const { data, error } = await supabase.rpc("da_03_dashboard_summary", {
      target_company_id: context.company.id,
      target_plant_id: context.plant.id,
      target_date_from: null,
      target_date_to: null,
      target_customer_id: null,
      target_product_id: null,
      target_operation_id: null,
      target_failure_mode_id: null,
    });

    if (error) {
      throw new Error(`No se pudo cargar el dashboard agregado: ${error.message}`);
    }

    const summary = normalizeDashboardSummary(data);

    return {
      status: "ready",
      tenant: {
        companyId: context.company.id,
        companyName: context.company.name,
        plantId: context.plant.id,
        plantName: context.plant.name,
        role: context.role,
      },
      summary,
      initialError: "",
    };
  } catch (error) {
    return {
      status: "error",
      tenant: null,
      summary: null,
      initialError: getErrorMessage(error),
    };
  }
}

function normalizeDashboardSummary(value: unknown): DashboardSummary {
  const summary = value as Partial<DashboardSummary> | null;
  const kpis = normalizeKpis(summary?.kpis);
  const evolution = Array.isArray(summary?.evolution)
    ? summary.evolution.map((item) => ({
        ...normalizeKpis(item),
        label: String((item as { label?: unknown }).label ?? ""),
      }))
    : [];
  const operationDpu = Array.isArray(summary?.operationDpu)
    ? summary.operationDpu.map((item) => ({
        operationId: String((item as { operationId?: unknown }).operationId ?? ""),
        label: String((item as { label?: unknown }).label ?? ""),
        inspectedQuantity: numberValue((item as { inspectedQuantity?: unknown }).inspectedQuantity),
        defects: numberValue((item as { defects?: unknown }).defects),
        value: numberValue((item as { value?: unknown }).value),
      }))
    : [];
  const failureRanking = Array.isArray(summary?.failureRanking)
    ? summary.failureRanking.map((item) => ({
        failureModeId: String((item as { failureModeId?: unknown }).failureModeId ?? ""),
        label: String((item as { label?: unknown }).label ?? ""),
        quantity: numberValue((item as { quantity?: unknown }).quantity),
      }))
    : [];

  return {
    kpis,
    evolution,
    operationDpu,
    failureRanking,
    todaySummary: normalizeKpis(summary?.todaySummary),
    transferredRows: 1 + evolution.length + operationDpu.length + failureRanking.length,
  };
}

function normalizeKpis(value: unknown) {
  const item = value as {
    controls?: unknown;
    inspectedQuantity?: unknown;
    defects?: unknown;
    dpu?: unknown;
  } | null;

  return {
    controls: numberValue(item?.controls),
    inspectedQuantity: numberValue(item?.inspectedQuantity),
    defects: numberValue(item?.defects),
    dpu: numberValue(item?.dpu),
  };
}

function numberValue(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Ocurrio un error inesperado.";
}
