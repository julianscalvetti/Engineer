import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveTenantContext } from "../tenant/context";
import type { ControlRecord } from "../controls/types";
import type {
  EngineerAnalysisDimension,
  EngineerAnalysisFilters,
  EngineerAnalysisMeasure,
  EngineerAnalysisRow,
  EngineerAnalyzeQualityInput,
  EngineerAnalyzeQualityResult,
  EngineerCatalogEntity,
  EngineerCatalogItem,
  EngineerCatalogSearch,
  EngineerCompareDirection,
  EngineerCompareQualityPeriodsInput,
  EngineerCompareQualityPeriodsResult,
  EngineerCompareQualityRow,
  EngineerClientContext,
  EngineerControlDetail,
  EngineerControlListItem,
  EngineerControlSearch,
  EngineerDateFilters,
  EngineerDateRangeContract,
  EngineerIndustrialContext,
  EngineerKpis,
  EngineerPagination,
  EngineerQualityParetoInput,
  EngineerQualityParetoResult,
  EngineerQualityRanking,
  EngineerQualitySummary,
  EngineerTemporalContract,
  EngineerQualityTrend,
  EngineerRankingDimension,
  EngineerRankingItem,
  EngineerResolvedFilters,
  EngineerTrendInterval,
} from "./types";

const DEFAULT_WINDOW_DAYS = 14;
const MAX_CATALOG_LIMIT = 50;
const MAX_RANKING_LIMIT = 50;
const MAX_HISTORY_LIMIT = 200;
const MAX_ANALYSIS_LIMIT = 100;
const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const catalogEntities: EngineerCatalogEntity[] = ["customer", "product", "operation", "failure_mode"];
const analysisMeasures: EngineerAnalysisMeasure[] = ["controls", "inspected_quantity", "defects", "dpu"];
const analysisDimensions: EngineerAnalysisDimension[] = ["customer", "product", "operation", "failure_mode"];

type TenantScope = {
  companyId: string;
  companyName: string;
  plantId: string;
  plantName: string;
  role: "owner" | "engineer" | "operator";
};

type DashboardSummaryPayload = {
  kpis?: unknown;
  todaySummary?: unknown;
  evolution?: unknown;
  operationDpu?: unknown;
  failureRanking?: unknown;
};

type ControlDetailRow = {
  id: string;
  operation_id: string;
  date: string;
  shift: string;
  operator: string;
  inspected_quantity: number;
  observations: string | null;
  import_file_id: string | null;
  source_sheet_name: string | null;
  source_row_number: number | null;
  source_cell_address: string | null;
  source_record_id: string | null;
};

type HistoricalRange = {
  dateFrom: string | null;
  dateTo: string | null;
};

type ResolvedTemporalFilters = EngineerTemporalContract & {
  filters: EngineerResolvedFilters;
};

export async function getQualitySummary(
  context: EngineerClientContext,
  filters: EngineerDateFilters = {},
): Promise<EngineerQualitySummary> {
  try {
    const tenant = await resolveTenant(context);
    if ("status" in tenant) {
      const temporal = emptyTemporalContract(filters);
      return { ...tenant, ...temporal, filters: temporal.filters, kpis: null, todaySummary: null, transferredRows: 0 };
    }

    const historicalRange = await fetchHistoricalRange(context.supabase, tenant);
    const temporal = resolveFullHistoryFilters(filters, historicalRange);
    const summary = await fetchDashboardSummary(context.supabase, tenant, temporal.filters);
    const kpis = normalizeKpis(summary.kpis);
    const warnings = withNoDataWarning(temporal.warnings, kpis.controls);

    return {
      status: "ready",
      tenant,
      filters: temporal.filters,
      requested_date_range: temporal.requested_date_range,
      applied_date_range: temporal.applied_date_range,
      historical_range: temporal.historical_range,
      scope: temporal.scope,
      truncated: false,
      warnings,
      kpis,
      todaySummary: normalizeKpis(summary.todaySummary),
      transferredRows: 1,
      error: "",
    };
  } catch (error) {
    return errorSummary(filters, getErrorMessage(error));
  }
}

export async function getQualityRanking(
  context: EngineerClientContext,
  input: EngineerDateFilters & { dimension?: EngineerRankingDimension; limit?: number } = {},
): Promise<EngineerQualityRanking> {
  const dimension = input.dimension ?? "failure_mode";
  const limit = clampLimit(input.limit, MAX_RANKING_LIMIT);

  try {
    const tenant = await resolveTenant(context);
    const fallbackTemporal = emptyTemporalContract(input);
    if ("status" in tenant) {
      return { ...tenant, ...fallbackTemporal, filters: fallbackTemporal.filters, dimension, items: [], limit, transferredRows: 0 };
    }

    const historicalRange = await fetchHistoricalRange(context.supabase, tenant);
    const temporal = resolveDefaultWindowFilters(input, historicalRange);
    const summary = await fetchDashboardSummary(context.supabase, tenant, temporal.filters);
    const source = dimension === "operation_dpu" ? summary.operationDpu : summary.failureRanking;
    const sourceItems = normalizeRankingItems(source, dimension).sort((left, right) => right.value - left.value);
    const items = sourceItems.slice(0, limit);
    const truncated = sourceItems.length > limit;

    return {
      status: "ready",
      tenant,
      filters: temporal.filters,
      requested_date_range: temporal.requested_date_range,
      applied_date_range: temporal.applied_date_range,
      historical_range: temporal.historical_range,
      scope: temporal.scope,
      truncated,
      warnings: withTruncationWarning(temporal.warnings, truncated, `El ranking se limito a ${limit} filas.`),
      dimension,
      items,
      limit,
      transferredRows: items.length,
      error: "",
    };
  } catch (error) {
    return {
      status: "error",
      tenant: null,
      ...emptyTemporalContract(input),
      dimension,
      items: [],
      limit,
      transferredRows: 0,
      error: getErrorMessage(error),
    };
  }
}

export async function getQualityTrend(
  context: EngineerClientContext,
  filters: EngineerDateFilters & { interval?: EngineerTrendInterval } = {},
): Promise<EngineerQualityTrend> {
  const interval = filters.interval ?? "day";

  try {
    const tenant = await resolveTenant(context);
    const fallbackTemporal = emptyTemporalContract(filters);
    if ("status" in tenant) {
      return { ...tenant, ...fallbackTemporal, filters: fallbackTemporal.filters, interval, requestedInterval: interval, points: [], transferredRows: 0 };
    }

    const historicalRange = await fetchHistoricalRange(context.supabase, tenant);
    const temporal = resolveFullHistoryFilters(filters, historicalRange);
    const summary = await fetchDashboardSummary(context.supabase, tenant, temporal.filters);
    const trend = buildBoundedTrend(normalizeTrendPoints(summary.evolution), interval);
    const warnings = withNoDataWarning([...temporal.warnings, ...trend.warnings], trend.points.length);

    return {
      status: "ready",
      tenant,
      filters: temporal.filters,
      requested_date_range: temporal.requested_date_range,
      applied_date_range: temporal.applied_date_range,
      historical_range: temporal.historical_range,
      scope: temporal.scope,
      truncated: trend.truncated,
      warnings,
      interval: trend.interval,
      requestedInterval: interval,
      points: trend.points,
      transferredRows: trend.points.length,
      error: "",
    };
  } catch (error) {
    const fallbackTemporal = emptyTemporalContract(filters);
    return {
      status: "error",
      tenant: null,
      ...fallbackTemporal,
      filters: fallbackTemporal.filters,
      interval,
      requestedInterval: interval,
      points: [],
      transferredRows: 0,
      error: getErrorMessage(error),
    };
  }
}

export async function searchQualityCatalog(
  context: EngineerClientContext,
  input: { query?: string; entities?: EngineerCatalogEntity[]; limit?: number } = {},
): Promise<EngineerCatalogSearch> {
  const query = normalizeSearch(input.query);
  const entities = normalizeCatalogEntities(input.entities);
  const limit = clampLimit(input.limit, MAX_CATALOG_LIMIT);

  try {
    const tenant = await resolveTenant(context);
    const fallbackTemporal = emptyTemporalContract();
    if ("status" in tenant) return { ...tenant, ...fallbackTemporal, query, entities, items: [], limit, transferredRows: 0 };

    const historicalRange = await fetchHistoricalRange(context.supabase, tenant);
    const temporal = resolveFullHistoryFilters({}, historicalRange);
    const results = await Promise.all(
      entities.map((entity) => fetchCatalogEntity(context.supabase, tenant, entity, query, limit)),
    );
    const sourceItems = results.flat();
    const items = sourceItems.slice(0, limit);
    const truncated = sourceItems.length > limit || results.some((entityItems) => entityItems.length === limit);

    return {
      status: "ready",
      tenant,
      requested_date_range: temporal.requested_date_range,
      applied_date_range: temporal.applied_date_range,
      historical_range: temporal.historical_range,
      scope: temporal.scope,
      truncated,
      warnings: withTruncationWarning(temporal.warnings, truncated, `El catalogo se limito a ${limit} filas.`),
      query,
      entities,
      items,
      limit,
      transferredRows: items.length,
      error: "",
    };
  } catch (error) {
    return {
      status: "error",
      tenant: null,
      ...emptyTemporalContract(),
      query,
      entities,
      items: [],
      limit,
      transferredRows: 0,
      error: getErrorMessage(error),
    };
  }
}

export async function searchControls(
  context: EngineerClientContext,
  input: EngineerDateFilters & EngineerPagination = {},
): Promise<EngineerControlSearch> {
  const fallbackTemporal = emptyTemporalContract(input);
  const page = Math.max(1, numberValue(input.page, 1));
  const limit = clampLimit(input.limit, MAX_HISTORY_LIMIT);

  try {
    const tenant = await resolveTenant(context);
    if ("status" in tenant) {
      return { ...tenant, ...fallbackTemporal, filters: fallbackTemporal.filters, page, limit, total: 0, controls: [], transferredRows: 0 };
    }

    const historicalRange = await fetchHistoricalRange(context.supabase, tenant);
    const temporal = resolveDefaultWindowFilters(input, historicalRange);
    const historyPage = await fetchControlHistoryPage(context.supabase, tenant, temporal.filters, page, limit);
    const controls = normalizeControlRecords(historyPage.rows);
    const truncated = controls.length < historyPage.total;
    const warnings = withNoDataWarning(
      withTruncationWarning(temporal.warnings, truncated, `search_controls devuelve una pagina de maximo ${limit} controles sobre ${historyPage.total} controles encontrados.`),
      controls.length,
    );

    return {
      status: "ready",
      tenant,
      filters: temporal.filters,
      requested_date_range: temporal.requested_date_range,
      applied_date_range: temporal.applied_date_range,
      historical_range: temporal.historical_range,
      scope: temporal.scope,
      truncated,
      warnings,
      page: historyPage.page,
      limit: historyPage.pageSize,
      total: historyPage.total,
      controls,
      transferredRows: controls.length,
      error: "",
    };
  } catch (error) {
    return {
      status: "error",
      tenant: null,
      ...fallbackTemporal,
      filters: fallbackTemporal.filters,
      page,
      limit,
      total: 0,
      controls: [],
      transferredRows: 0,
      error: getErrorMessage(error),
    };
  }
}

export async function getControlDetail(
  context: EngineerClientContext,
  input: { controlId: string },
): Promise<EngineerControlDetail> {
  try {
    const tenant = await resolveTenant(context);
    const fallbackTemporal = emptyTemporalContract();
    if ("status" in tenant) return { ...tenant, ...fallbackTemporal, control: null, transferredRows: 0 };

    const historicalRange = await fetchHistoricalRange(context.supabase, tenant);
    const temporal = resolveFullHistoryFilters({}, historicalRange);
    const control = await fetchControlDetail(context.supabase, tenant, input.controlId);

    return {
      status: "ready",
      tenant,
      requested_date_range: temporal.requested_date_range,
      applied_date_range: temporal.applied_date_range,
      historical_range: temporal.historical_range,
      scope: temporal.scope,
      truncated: false,
      warnings: control ? temporal.warnings : [...temporal.warnings, "No hay datos para el control solicitado dentro del tenant autenticado."],
      control,
      transferredRows: control ? 1 : 0,
      error: "",
    };
  } catch (error) {
    return {
      status: "error",
      tenant: null,
      ...emptyTemporalContract(),
      control: null,
      transferredRows: 0,
      error: getErrorMessage(error),
    };
  }
}

export async function getIndustrialContext(context: EngineerClientContext): Promise<EngineerIndustrialContext> {
  try {
    const tenant = await resolveTenant(context);
    const fallbackTemporal = emptyTemporalContract();
    if ("status" in tenant) {
      return {
        ...tenant,
        ...fallbackTemporal,
        catalogCounts: zeroCatalogCounts(),
        controlCounts: { controls: 0, controlFailures: 0 },
        historicalRange: { dateFrom: null, dateTo: null },
        limits: limits(),
        capabilities: [],
      };
    }

    const [customerCount, productCount, operationCount, failureModeCount, controls, controlFailures, historicalRange] = await Promise.all([
      countRows(context.supabase, "customers", tenant),
      countRows(context.supabase, "products", tenant),
      countRows(context.supabase, "operations", tenant),
      countRows(context.supabase, "failure_modes", tenant),
      countRows(context.supabase, "controls", tenant),
      countRows(context.supabase, "control_failures", tenant),
      fetchHistoricalRange(context.supabase, tenant),
    ]);
    const temporal = resolveFullHistoryFilters({}, historicalRange);

    return {
      status: "ready",
      tenant,
      requested_date_range: temporal.requested_date_range,
      applied_date_range: temporal.applied_date_range,
      historical_range: temporal.historical_range,
      scope: temporal.scope,
      truncated: false,
      warnings: temporal.warnings,
      catalogCounts: {
        customer: customerCount,
        product: productCount,
        operation: operationCount,
        failure_mode: failureModeCount,
      },
      controlCounts: {
        controls,
        controlFailures,
      },
      historicalRange,
      limits: limits(),
      capabilities: [
        "quality summary over DA-03 dashboard RPC",
        "quality ranking over DA-03 dashboard RPC",
        "quality trend over DA-03 dashboard RPC",
        "catalog search over scoped industrial tables",
        "control search over DA-03 paginated history RPC",
        "single control detail lookup",
      ],
      error: "",
    };
  } catch (error) {
    return {
      status: "error",
      tenant: null,
      ...emptyTemporalContract(),
      catalogCounts: zeroCatalogCounts(),
      controlCounts: { controls: 0, controlFailures: 0 },
      historicalRange: { dateFrom: null, dateTo: null },
      limits: limits(),
      capabilities: [],
      error: getErrorMessage(error),
    };
  }
}

export async function analyzeQuality(
  context: EngineerClientContext,
  input: EngineerAnalyzeQualityInput,
): Promise<EngineerAnalyzeQualityResult> {
  try {
    const normalized = normalizeAnalyzeInput(input);
    const tenant = await resolveTenant(context);
    if ("status" in tenant) return analysisError(normalized, tenant.error, null);

    const historicalRange = await fetchHistoricalRange(context.supabase, tenant);
    const applied = resolveAnalysisDateRange(normalized.filters, historicalRange);
    const payload = await fetchControlledQualityAnalysis(context.supabase, tenant, {
      measures: normalized.measures,
      groupBy: normalized.groupBy,
      filters: normalized.filters,
      applied,
      orderBy: normalized.orderBy,
      limit: normalized.limit,
    });
    const rows = normalizeAnalysisRows(payload.rows, normalized.measures);
    const warnings = buildAnalysisWarnings({
      filters: normalized.filters,
      applied,
      historicalRange,
      rowCount: rows.length,
      truncated: payload.truncated,
    });

    return {
      status: "ready",
      context: analysisContext(tenant, normalized.filters, applied, historicalRange),
      data: rows,
      metadata: {
        generated_at: new Date().toISOString(),
        row_count: payload.rowCount,
        truncated: payload.truncated,
        measures: normalized.measures,
        group_by: normalized.groupBy,
      },
      warnings,
      error: "",
    };
  } catch (error) {
    return analysisError(input, getErrorMessage(error), null);
  }
}

export async function compareQualityPeriods(
  context: EngineerClientContext,
  input: EngineerCompareQualityPeriodsInput,
): Promise<EngineerCompareQualityPeriodsResult> {
  try {
    const normalized = normalizeCompareInput(input);
    const tenant = await resolveTenant(context);
    if ("status" in tenant) return compareError(input, tenant.error, null);

    const historicalRange = await fetchHistoricalRange(context.supabase, tenant);
    const groupBy = normalized.groupBy ? [normalized.groupBy] : [];
    const [periodA, periodB] = await Promise.all([
      fetchControlledQualityAnalysis(context.supabase, tenant, {
        measures: normalized.measures,
        groupBy,
        filters: { ...normalized.filters, ...normalized.periodA },
        applied: normalized.periodA,
        orderBy: { measure: normalized.measures[0], direction: "desc" },
        limit: normalized.limit,
      }),
      fetchControlledQualityAnalysis(context.supabase, tenant, {
        measures: normalized.measures,
        groupBy,
        filters: { ...normalized.filters, ...normalized.periodB },
        applied: normalized.periodB,
        orderBy: { measure: normalized.measures[0], direction: "desc" },
        limit: normalized.limit,
      }),
    ]);
    const rows = compareAnalysisRows(
      normalizeAnalysisRows(periodA.rows, normalized.measures),
      normalizeAnalysisRows(periodB.rows, normalized.measures),
      normalized.measures,
      normalized.groupBy,
    );
    const warnings = [
      ...buildPeriodWarnings(normalized.periodA, historicalRange, "periodA"),
      ...buildPeriodWarnings(normalized.periodB, historicalRange, "periodB"),
    ];
    if (periodA.truncated || periodB.truncated) warnings.push("La comparacion fue truncada al limite solicitado.");
    if (rows.length === 0) warnings.push("No hay datos en los periodos seleccionados.");
    if (rows.some((row) => Object.values(row.measures).some((measure) => measure?.percentageDelta === null))) {
      warnings.push("Alguna variacion porcentual no es aplicable porque el valor inicial es cero.");
    }

    return {
      status: "ready",
      context: {
        ...analysisContext(tenant, normalized.filters, normalized.periodA, historicalRange),
        periodA: dateRangeContract(normalized.periodA),
        periodB: dateRangeContract(normalized.periodB),
      },
      data: rows,
      metadata: {
        generated_at: new Date().toISOString(),
        row_count: rows.length,
        truncated: periodA.truncated || periodB.truncated,
        measures: normalized.measures,
        group_by: groupBy,
      },
      warnings,
      error: "",
    };
  } catch (error) {
    return compareError(input, getErrorMessage(error), null);
  }
}

export async function getQualityPareto(
  context: EngineerClientContext,
  input: EngineerQualityParetoInput,
): Promise<EngineerQualityParetoResult> {
  try {
    const normalized = normalizeParetoInput(input);
    const tenant = await resolveTenant(context);
    if ("status" in tenant) return paretoError(normalized, tenant.error, null);

    const historicalRange = await fetchHistoricalRange(context.supabase, tenant);
    const applied = resolveAnalysisDateRange(normalized, historicalRange);
    const payload = await fetchControlledQualityAnalysis(context.supabase, tenant, {
      measures: ["defects"],
      groupBy: [normalized.dimension],
      filters: normalized.filters ?? {},
      applied,
      orderBy: { measure: "defects", direction: "desc" },
      limit: normalized.limit,
    });
    const rows = normalizeAnalysisRows(payload.rows, ["defects"]);
    const totalDefects = payload.totalDefects || rows.reduce((sum, row) => sum + row.measures.defects, 0);
    let cumulative = 0;
    let cutoffIndex: number | null = null;
    const data = rows.map((row, index) => {
      const value = row.measures.defects;
      const share = totalDefects > 0 ? value / totalDefects : 0;
      cumulative += share;
      const includedInThreshold = cutoffIndex === null;
      if (includedInThreshold && cumulative >= normalized.threshold) cutoffIndex = index;
      return {
        dimension: row.dimensions[normalized.dimension] ?? null,
        value,
        share,
        cumulativeShare: cumulative,
        includedInThreshold,
      };
    });
    const warnings = buildAnalysisWarnings({
      filters: normalized,
      applied,
      historicalRange,
      rowCount: data.length,
      truncated: payload.truncated,
    });
    if (totalDefects === 0) warnings.push("No hay defectos en el periodo seleccionado; Pareto no aplicable.");

    return {
      status: "ready",
      context: analysisContext(tenant, normalized.filters ?? {}, applied, historicalRange),
      data,
      metadata: {
        generated_at: new Date().toISOString(),
        row_count: payload.rowCount,
        truncated: payload.truncated,
        measures: ["defects"],
        group_by: [normalized.dimension],
        threshold: normalized.threshold,
        cutoffIndex,
        totalDefects,
      },
      warnings,
      error: "",
    };
  } catch (error) {
    return paretoError(input, getErrorMessage(error), null);
  }
}

export function clampLimit(value: unknown, max: number) {
  return Math.min(Math.max(1, numberValue(value, max)), max);
}

export function resolveDateFilters(filters: EngineerDateFilters = {}, maxDays = DEFAULT_WINDOW_DAYS): EngineerResolvedFilters {
  const dateTo = normalizeDateKey(filters.dateTo) || toDateKey(new Date());
  let dateFrom = normalizeDateKey(filters.dateFrom) || dateKeyDaysBefore(dateTo, DEFAULT_WINDOW_DAYS - 1);

  if (dateFrom > dateTo) {
    throw new Error("dateFrom no puede ser posterior a dateTo.");
  }
  if (daysBetween(dateFrom, dateTo) + 1 > maxDays) {
    dateFrom = dateKeyDaysBefore(dateTo, maxDays - 1);
  }

  return {
    dateFrom,
    dateTo,
    customerId: stringValue(filters.customerId),
    productId: stringValue(filters.productId),
    operationId: stringValue(filters.operationId),
    failureModeId: stringValue(filters.failureModeId),
  };
}

function resolveFullHistoryFilters(filters: EngineerDateFilters = {}, historicalRange: HistoricalRange): ResolvedTemporalFilters {
  const requestedDateFrom = normalizeDateKey(filters.dateFrom);
  const requestedDateTo = normalizeDateKey(filters.dateTo);
  const resolvedFilters = {
    dateFrom: requestedDateFrom || historicalRange.dateFrom || "",
    dateTo: requestedDateTo || historicalRange.dateTo || "",
    customerId: stringValue(filters.customerId),
    productId: stringValue(filters.productId),
    operationId: stringValue(filters.operationId),
    failureModeId: stringValue(filters.failureModeId),
  };
  assertValidDateOrder(resolvedFilters.dateFrom, resolvedFilters.dateTo);

  return {
    filters: resolvedFilters,
    ...temporalContract(filters, resolvedFilters, historicalRange, false),
  };
}

function resolveDefaultWindowFilters(filters: EngineerDateFilters = {}, historicalRange: HistoricalRange): ResolvedTemporalFilters {
  const resolvedFilters = resolveDateFilters(filters, Number.MAX_SAFE_INTEGER);
  return {
    filters: resolvedFilters,
    ...temporalContract(filters, resolvedFilters, historicalRange, false),
  };
}

function emptyTemporalContract(filters: EngineerDateFilters = {}): ResolvedTemporalFilters {
  const resolvedFilters = safeResolveDateFilters(filters);
  return {
    filters: resolvedFilters,
    requested_date_range: safeRequestedDateRange(filters),
    applied_date_range: dateRangeContract(resolvedFilters),
    historical_range: { date_from: null, date_to: null },
    scope: "filtered_period",
    truncated: false,
    warnings: ["No se pudo resolver historical_range; no afirmes que faltan datos sin consultar el tenant."],
  };
}

function temporalContract(
  input: EngineerDateFilters,
  filters: EngineerResolvedFilters,
  historicalRange: HistoricalRange,
  truncated: boolean,
  extraWarnings: string[] = [],
): EngineerTemporalContract {
  const historical = dateRangeContract(historicalRange);
  const applied = dateRangeContract(filters);
  const periodCoversFullHistory =
    (!historical.date_from || historical.date_from === applied.date_from) &&
    (!historical.date_to || historical.date_to === applied.date_to);
  const scope = periodCoversFullHistory && !hasNonDateFilters(filters) ? "full_history" : "filtered_period";
  const warnings = [...extraWarnings];

  if (!periodCoversFullHistory) {
    warnings.push(
      "El periodo aplicado no cubre todo el historial disponible. Consulta historical_range antes de afirmar que faltan datos.",
    );
  }

  return {
    requested_date_range: requestedDateRange(input),
    applied_date_range: applied,
    historical_range: historical,
    scope,
    truncated,
    warnings,
  };
}

function buildBoundedTrend(points: Array<EngineerKpis & { date: string }>, requestedInterval: EngineerTrendInterval) {
  const requestedPoints = aggregateTrendPoints(points, requestedInterval);
  if (requestedPoints.length <= MAX_HISTORY_LIMIT) {
    return {
      interval: requestedInterval,
      points: requestedPoints,
      truncated: false,
      warnings: [],
    };
  }

  if (requestedInterval === "day") {
    const weeklyPoints = aggregateTrendPoints(points, "week");
    if (weeklyPoints.length <= MAX_HISTORY_LIMIT) {
      return {
        interval: "week" as const,
        points: weeklyPoints,
        truncated: false,
        warnings: [`La tendencia solicitada en dias excedia ${MAX_HISTORY_LIMIT} buckets y fue agregada por semana.`],
      };
    }
  }

  if (requestedInterval !== "month") {
    const monthlyPoints = aggregateTrendPoints(points, "month");
    if (monthlyPoints.length <= MAX_HISTORY_LIMIT) {
      return {
        interval: "month" as const,
        points: monthlyPoints,
        truncated: false,
        warnings: [`La tendencia solicitada excedia ${MAX_HISTORY_LIMIT} buckets y fue agregada por mes.`],
      };
    }
  }

  const monthlyPoints = aggregateTrendPoints(points, "month");
  return {
    interval: "month" as const,
    points: monthlyPoints.slice(-MAX_HISTORY_LIMIT),
    truncated: true,
    warnings: [`La tendencia se trunco a los ultimos ${MAX_HISTORY_LIMIT} buckets mensuales.`],
  };
}

function requestedDateRange(filters: EngineerDateFilters): EngineerDateRangeContract {
  return {
    date_from: normalizeDateKey(filters.dateFrom) || null,
    date_to: normalizeDateKey(filters.dateTo) || null,
  };
}

function safeRequestedDateRange(filters: EngineerDateFilters): EngineerDateRangeContract {
  try {
    return requestedDateRange(filters);
  } catch {
    return { date_from: null, date_to: null };
  }
}

function dateRangeContract(range: HistoricalRange | EngineerResolvedFilters): EngineerDateRangeContract {
  return {
    date_from: range.dateFrom || null,
    date_to: range.dateTo || null,
  };
}

function hasNonDateFilters(filters: EngineerDateFilters) {
  return Boolean(filters.customerId || filters.productId || filters.operationId || filters.failureModeId);
}

function withTruncationWarning(warnings: string[], truncated: boolean, message: string) {
  return truncated ? [...warnings, message] : warnings;
}

function withNoDataWarning(warnings: string[], count: number) {
  return count === 0 ? [...warnings, "No hay datos en el periodo seleccionado. Revisa applied_date_range e historical_range."] : warnings;
}

function assertValidDateOrder(dateFrom: string, dateTo: string) {
  if (dateFrom && dateTo && dateFrom > dateTo) {
    throw new Error("dateFrom no puede ser posterior a dateTo.");
  }
}

type ControlledAnalysisRequest = {
  measures: EngineerAnalysisMeasure[];
  groupBy: EngineerAnalysisDimension[];
  filters: Omit<EngineerAnalysisFilters, "dateFrom" | "dateTo">;
  applied: HistoricalRange;
  orderBy: { measure: EngineerAnalysisMeasure; direction: "asc" | "desc" };
  limit: number;
};

type ControlledAnalysisPayload = {
  rows: unknown[];
  rowCount: number;
  truncated: boolean;
  totalDefects: number;
};

type NormalizedAnalyzeInput = {
  measures: EngineerAnalysisMeasure[];
  groupBy: EngineerAnalysisDimension[];
  filters: EngineerAnalysisFilters;
  orderBy: { measure: EngineerAnalysisMeasure; direction: "asc" | "desc" };
  limit: number;
};

type NormalizedCompareInput = {
  periodA: HistoricalRange;
  periodB: HistoricalRange;
  measures: EngineerAnalysisMeasure[];
  groupBy?: EngineerAnalysisDimension;
  filters: EngineerAnalysisFilters;
  limit: number;
};

type NormalizedParetoInput = {
  dimension: EngineerAnalysisDimension;
  measure: "defects";
  dateFrom: string;
  dateTo: string;
  filters: EngineerAnalysisFilters;
  threshold: number;
  limit: number;
};

function normalizeAnalyzeInput(input: EngineerAnalyzeQualityInput): NormalizedAnalyzeInput {
  const measures = normalizeMeasures(input.measures);
  const groupBy = normalizeGroupBy(input.groupBy ?? [], 2);
  const filters = normalizeAnalysisFilters(input.filters ?? {}, true);
  const limit = normalizeAnalysisLimit(input.limit);
  const orderBy = input.orderBy
    ? {
        measure: normalizeMeasure(input.orderBy.measure),
        direction: normalizeDirection(input.orderBy.direction),
      }
    : { measure: measures[0], direction: "desc" as const };
  return { measures, groupBy, filters, orderBy, limit };
}

function normalizeCompareInput(input: EngineerCompareQualityPeriodsInput): NormalizedCompareInput {
  const measures = normalizeMeasures(input.measures);
  const periodA = normalizeRequiredPeriod(input.periodA, "periodA");
  const periodB = normalizeRequiredPeriod(input.periodB, "periodB");
  const filters = normalizeAnalysisFilters(input.filters ?? {}, false);
  const groupBy = input.groupBy ? normalizeGroupBy([input.groupBy], 1)[0] : undefined;
  const limit = normalizeAnalysisLimit(input.limit);
  return { measures, periodA, periodB, filters, groupBy, limit };
}

function normalizeParetoInput(input: EngineerQualityParetoInput): NormalizedParetoInput {
  if (input.measure !== "defects") throw new Error("getQualityPareto solo permite measure=defects.");
  const dimension = normalizeDimension(input.dimension);
  const filters = normalizeAnalysisFilters(input.filters ?? {}, false);
  const threshold = decimalNumberValue(input.threshold, 0.8);
  if (threshold < 0.5 || threshold > 0.95) throw new Error("threshold debe estar entre 0.5 y 0.95.");
  const limit = normalizeAnalysisLimit(input.limit);
  return {
    dimension,
    measure: "defects",
    dateFrom: normalizeDateKey(input.dateFrom) || "",
    dateTo: normalizeDateKey(input.dateTo) || "",
    filters,
    threshold,
    limit,
  };
}

function normalizeMeasures(measures: EngineerAnalysisMeasure[] | undefined) {
  if (!Array.isArray(measures) || measures.length === 0) throw new Error("DA-05 requiere al menos una medida.");
  const normalized = measures.map(normalizeMeasure);
  return uniqueValues(normalized);
}

function normalizeMeasure(measure: unknown): EngineerAnalysisMeasure {
  if (typeof measure !== "string" || !analysisMeasures.includes(measure as EngineerAnalysisMeasure)) {
    throw new Error(`Medida no permitida: ${String(measure)}.`);
  }
  return measure as EngineerAnalysisMeasure;
}

function normalizeGroupBy(groupBy: EngineerAnalysisDimension[], max: 1 | 2) {
  if (!Array.isArray(groupBy)) throw new Error("groupBy debe ser un array.");
  if (groupBy.length > max) throw new Error(`groupBy permite maximo ${max} dimension(es).`);
  const normalized = groupBy.map(normalizeDimension);
  if (uniqueValues(normalized).length !== normalized.length) throw new Error("groupBy no permite dimensiones repetidas.");
  return normalized;
}

function normalizeDimension(dimension: unknown): EngineerAnalysisDimension {
  if (typeof dimension !== "string" || !analysisDimensions.includes(dimension as EngineerAnalysisDimension)) {
    throw new Error(`Dimension no permitida: ${String(dimension)}.`);
  }
  return dimension as EngineerAnalysisDimension;
}

function normalizeDirection(direction: unknown): "asc" | "desc" {
  if (direction !== "asc" && direction !== "desc") throw new Error("orderBy.direction debe ser asc o desc.");
  return direction;
}

function normalizeAnalysisFilters(filters: EngineerAnalysisFilters, allowDates: boolean): EngineerAnalysisFilters {
  const allowedKeys = new Set([
    ...(allowDates ? ["dateFrom", "dateTo"] : []),
    "customerIds",
    "productIds",
    "operationIds",
    "failureModeIds",
  ]);
  for (const key of Object.keys(filters)) {
    if (!allowedKeys.has(key)) throw new Error(`Filtro no permitido: ${key}.`);
  }
  return {
    dateFrom: allowDates ? normalizeDateKey(filters.dateFrom) || undefined : undefined,
    dateTo: allowDates ? normalizeDateKey(filters.dateTo) || undefined : undefined,
    customerIds: normalizeUuidArray(filters.customerIds, "customerIds"),
    productIds: normalizeUuidArray(filters.productIds, "productIds"),
    operationIds: normalizeUuidArray(filters.operationIds, "operationIds"),
    failureModeIds: normalizeUuidArray(filters.failureModeIds, "failureModeIds"),
  };
}

function normalizeRequiredPeriod(period: { dateFrom: string; dateTo: string }, label: string): HistoricalRange {
  const dateFrom = normalizeDateKey(period?.dateFrom);
  const dateTo = normalizeDateKey(period?.dateTo);
  if (!dateFrom || !dateTo) throw new Error(`${label} requiere dateFrom y dateTo.`);
  assertValidDateOrder(dateFrom, dateTo);
  return { dateFrom, dateTo };
}

function normalizeAnalysisLimit(limit: unknown) {
  const value = numberValue(limit, 50);
  if (value > MAX_ANALYSIS_LIMIT) throw new Error(`limit no puede superar ${MAX_ANALYSIS_LIMIT}.`);
  return Math.max(1, value);
}

function normalizeUuidArray(values: string[] | undefined, label: string) {
  if (values === undefined) return undefined;
  if (!Array.isArray(values)) throw new Error(`${label} debe ser un array de UUID.`);
  for (const value of values) {
    if (typeof value !== "string" || !UUID_PATTERN.test(value)) throw new Error(`${label} contiene un UUID invalido.`);
  }
  return uniqueValues(values);
}

function resolveAnalysisDateRange(filters: EngineerAnalysisFilters, historicalRange: HistoricalRange): HistoricalRange {
  const dateFrom = normalizeDateKey(filters.dateFrom) || historicalRange.dateFrom || "";
  const dateTo = normalizeDateKey(filters.dateTo) || historicalRange.dateTo || "";
  assertValidDateOrder(dateFrom, dateTo);
  return { dateFrom, dateTo };
}

async function fetchControlledQualityAnalysis(
  supabase: SupabaseClient,
  tenant: TenantScope,
  request: ControlledAnalysisRequest,
): Promise<ControlledAnalysisPayload> {
  const { data, error } = await supabase.rpc("da_05_controlled_quality_analysis", {
    target_company_id: tenant.companyId,
    target_plant_id: tenant.plantId,
    target_date_from: nullIfEmpty(request.applied.dateFrom ?? ""),
    target_date_to: nullIfEmpty(request.applied.dateTo ?? ""),
    target_measures: request.measures,
    target_group_by: request.groupBy,
    target_customer_ids: request.filters.customerIds ?? null,
    target_product_ids: request.filters.productIds ?? null,
    target_operation_ids: request.filters.operationIds ?? null,
    target_failure_mode_ids: request.filters.failureModeIds ?? null,
    target_order_measure: request.orderBy.measure,
    target_order_direction: request.orderBy.direction,
    target_limit: request.limit,
  });

  if (error) throw new Error(`No se pudo leer DA-05 controlled analytics: ${error.message}`);
  const payload = (data ?? {}) as { rows?: unknown; rowCount?: unknown; truncated?: unknown; totalDefects?: unknown };
  return {
    rows: Array.isArray(payload.rows) ? payload.rows : [],
    rowCount: numberValue(payload.rowCount, 0),
    truncated: payload.truncated === true,
    totalDefects: numberValue(payload.totalDefects, 0),
  };
}

function normalizeAnalysisRows(rows: unknown[], measures: EngineerAnalysisMeasure[]): EngineerAnalysisRow[] {
  return rows.map((row) => {
    const item = row as { dimensions?: unknown; measures?: Record<string, unknown> };
    const sourceMeasures = item.measures ?? {};
    return {
      dimensions: normalizeAnalysisDimensions(item.dimensions),
      measures: Object.fromEntries(
        measures.map((measure) => [measure, decimalNumberValue(sourceMeasures[measure], 0)]),
      ) as Record<EngineerAnalysisMeasure, number>,
    };
  });
}

function normalizeAnalysisDimensions(value: unknown) {
  const dimensions = value as Record<string, { id?: unknown; label?: unknown }> | null;
  const output: EngineerAnalysisRow["dimensions"] = {};
  if (!dimensions) return output;
  for (const dimension of analysisDimensions) {
    const item = dimensions[dimension];
    if (item?.id && item?.label) output[dimension] = { id: String(item.id), label: String(item.label) };
  }
  return output;
}

function analysisContext(
  tenant: TenantScope,
  filters: EngineerAnalysisFilters,
  applied: HistoricalRange,
  historicalRange: HistoricalRange,
) {
  const temporal = temporalContract(
    {
      dateFrom: applied.dateFrom ?? undefined,
      dateTo: applied.dateTo ?? undefined,
      customerId: filters.customerIds?.[0],
      productId: filters.productIds?.[0],
      operationId: filters.operationIds?.[0],
      failureModeId: filters.failureModeIds?.[0],
    },
    {
      dateFrom: applied.dateFrom ?? "",
      dateTo: applied.dateTo ?? "",
      customerId: "",
      productId: "",
      operationId: "",
      failureModeId: "",
    },
    historicalRange,
    false,
  );
  return {
    company: { id: tenant.companyId, name: tenant.companyName },
    plant: { id: tenant.plantId, name: tenant.plantName },
    requested_date_range: dateRangeContract({ dateFrom: filters.dateFrom ?? null, dateTo: filters.dateTo ?? null }),
    applied_date_range: temporal.applied_date_range,
    historical_range: temporal.historical_range,
    filters_applied: {
      customerIds: filters.customerIds,
      productIds: filters.productIds,
      operationIds: filters.operationIds,
      failureModeIds: filters.failureModeIds,
    },
    scope: temporal.scope,
  };
}

function buildAnalysisWarnings(input: {
  filters: EngineerAnalysisFilters;
  applied: HistoricalRange;
  historicalRange: HistoricalRange;
  rowCount: number;
  truncated: boolean;
}) {
  const warnings = buildPeriodWarnings(input.applied, input.historicalRange, "applied_date_range");
  if (input.truncated) warnings.push(`El resultado fue truncado al limite solicitado de ${MAX_ANALYSIS_LIMIT} filas o menos.`);
  if (input.rowCount === 0) warnings.push("No hay datos en el periodo y filtros seleccionados.");
  if (hasArrayFilters(input.filters)) warnings.push("Se aplicaron filtros dimensionales; el resultado no representa todo el tenant.");
  return warnings;
}

function buildPeriodWarnings(period: HistoricalRange, historicalRange: HistoricalRange, label: string) {
  const warnings: string[] = [];
  if (!period.dateFrom || !period.dateTo || !historicalRange.dateFrom || !historicalRange.dateTo) return warnings;
  if (period.dateTo < historicalRange.dateFrom || period.dateFrom > historicalRange.dateTo) {
    warnings.push(`${label} esta fuera del historical_range disponible.`);
  } else if (period.dateFrom < historicalRange.dateFrom || period.dateTo > historicalRange.dateTo) {
    warnings.push(`${label} esta parcialmente cubierto por el historical_range disponible.`);
  }
  return warnings;
}

function hasArrayFilters(filters: EngineerAnalysisFilters) {
  return Boolean(filters.customerIds?.length || filters.productIds?.length || filters.operationIds?.length || filters.failureModeIds?.length);
}

function compareAnalysisRows(
  periodA: EngineerAnalysisRow[],
  periodB: EngineerAnalysisRow[],
  measures: EngineerAnalysisMeasure[],
  groupBy?: EngineerAnalysisDimension,
): EngineerCompareQualityRow[] {
  const rows = new Map<string, EngineerCompareQualityRow>();
  for (const row of periodA) {
    rows.set(analysisRowKey(row, groupBy), { dimensions: row.dimensions, measures: {} });
  }
  for (const row of periodB) {
    const key = analysisRowKey(row, groupBy);
    rows.set(key, rows.get(key) ?? { dimensions: row.dimensions, measures: {} });
  }

  for (const [key, output] of rows) {
    const a = periodA.find((row) => analysisRowKey(row, groupBy) === key);
    const b = periodB.find((row) => analysisRowKey(row, groupBy) === key);
    for (const measure of measures) {
      output.measures[measure] = compareMeasure(measure, a?.measures[measure] ?? 0, b?.measures[measure] ?? 0);
    }
  }
  return Array.from(rows.values());
}

function compareMeasure(measure: EngineerAnalysisMeasure, periodAValue: number, periodBValue: number) {
  const absoluteDelta = periodBValue - periodAValue;
  const percentageDelta = periodAValue === 0 ? (periodBValue === 0 ? 0 : null) : absoluteDelta / periodAValue;
  return {
    periodAValue,
    periodBValue,
    absoluteDelta,
    percentageDelta,
    direction: compareDirection(measure, absoluteDelta, periodAValue, periodBValue),
  };
}

function compareDirection(
  measure: EngineerAnalysisMeasure,
  delta: number,
  periodAValue: number,
  periodBValue: number,
): EngineerCompareDirection {
  if (periodAValue === 0 && periodBValue !== 0 && (measure === "dpu" || measure === "defects")) return "worsened";
  if (delta === 0) return "unchanged";
  if (measure === "dpu" || measure === "defects") return delta < 0 ? "improved" : "worsened";
  return delta > 0 ? "improved" : "worsened";
}

function analysisRowKey(row: EngineerAnalysisRow, groupBy?: EngineerAnalysisDimension) {
  if (!groupBy) return "__all__";
  return row.dimensions[groupBy]?.id ?? "__missing__";
}

function analysisError(input: Partial<EngineerAnalyzeQualityInput>, message: string, tenant: TenantScope | null): EngineerAnalyzeQualityResult {
  const measures = Array.isArray(input.measures) ? input.measures.filter((measure) => analysisMeasures.includes(measure)) : [];
  const groupBy = Array.isArray(input.groupBy) ? input.groupBy.filter((dimension) => analysisDimensions.includes(dimension)) : [];
  return {
    status: "error",
    context: emptyAnalysisContext(tenant),
    data: [],
    metadata: emptyAnalysisMetadata(measures, groupBy),
    warnings: [],
    error: message,
  };
}

function compareError(input: Partial<EngineerCompareQualityPeriodsInput>, message: string, tenant: TenantScope | null): EngineerCompareQualityPeriodsResult {
  const measures = Array.isArray(input.measures) ? input.measures.filter((measure) => analysisMeasures.includes(measure)) : [];
  const groupBy = input.groupBy && analysisDimensions.includes(input.groupBy) ? [input.groupBy] : [];
  return {
    status: "error",
    context: {
      ...emptyAnalysisContext(tenant),
      periodA: { date_from: input.periodA?.dateFrom ?? null, date_to: input.periodA?.dateTo ?? null },
      periodB: { date_from: input.periodB?.dateFrom ?? null, date_to: input.periodB?.dateTo ?? null },
    },
    data: [],
    metadata: emptyAnalysisMetadata(measures, groupBy),
    warnings: [],
    error: message,
  };
}

function paretoError(input: Partial<EngineerQualityParetoInput>, message: string, tenant: TenantScope | null): EngineerQualityParetoResult {
  const groupBy = input.dimension && analysisDimensions.includes(input.dimension) ? [input.dimension] : [];
  return {
    status: "error",
    context: emptyAnalysisContext(tenant),
    data: [],
    metadata: {
      ...emptyAnalysisMetadata(["defects"], groupBy),
      threshold: typeof input.threshold === "number" ? input.threshold : 0.8,
      cutoffIndex: null,
      totalDefects: 0,
    },
    warnings: [],
    error: message,
  };
}

function emptyAnalysisContext(tenant: TenantScope | null) {
  return {
    company: tenant ? { id: tenant.companyId, name: tenant.companyName } : null,
    plant: tenant ? { id: tenant.plantId, name: tenant.plantName } : null,
    requested_date_range: { date_from: null, date_to: null },
    applied_date_range: { date_from: null, date_to: null },
    historical_range: { date_from: null, date_to: null },
    filters_applied: {},
    scope: "filtered_period" as const,
  };
}

function emptyAnalysisMetadata(measures: EngineerAnalysisMeasure[], groupBy: EngineerAnalysisDimension[]) {
  return {
    generated_at: new Date().toISOString(),
    row_count: 0,
    truncated: false,
    measures,
    group_by: groupBy,
  };
}

function uniqueValues<T>(values: T[]) {
  return Array.from(new Set(values));
}

async function resolveTenant(context: EngineerClientContext): Promise<TenantScope | { status: "unauthenticated" | "unauthorized"; tenant: null; error: string }> {
  const tenant = await getActiveTenantContext(context.supabase, { accessToken: context.accessToken });

  if (tenant.status !== "ready") {
    return {
      status: tenant.status,
      tenant: null,
      error: tenant.message,
    };
  }

  return {
    companyId: tenant.company.id,
    companyName: tenant.company.name,
    plantId: tenant.plant.id,
    plantName: tenant.plant.name,
    role: tenant.role,
  };
}

async function fetchDashboardSummary(
  supabase: SupabaseClient,
  tenant: TenantScope,
  filters: EngineerResolvedFilters,
): Promise<DashboardSummaryPayload> {
  const { data, error } = await supabase.rpc("da_03_dashboard_summary", {
    target_company_id: tenant.companyId,
    target_plant_id: tenant.plantId,
    target_date_from: nullIfEmpty(filters.dateFrom),
    target_date_to: nullIfEmpty(filters.dateTo),
    target_customer_id: nullIfEmpty(filters.customerId),
    target_product_id: nullIfEmpty(filters.productId),
    target_operation_id: nullIfEmpty(filters.operationId),
    target_failure_mode_id: nullIfEmpty(filters.failureModeId),
  });

  if (error) throw new Error(`No se pudo leer DA-03 dashboard summary: ${error.message}`);
  return (data ?? {}) as DashboardSummaryPayload;
}

async function fetchControlHistoryPage(
  supabase: SupabaseClient,
  tenant: TenantScope,
  filters: EngineerResolvedFilters,
  page: number,
  pageSize: number,
) {
  const { data, error } = await supabase.rpc("da_03_control_history_page", {
    target_company_id: tenant.companyId,
    target_plant_id: tenant.plantId,
    target_date_from: filters.dateFrom,
    target_date_to: filters.dateTo,
    target_customer_id: nullIfEmpty(filters.customerId),
    target_product_id: nullIfEmpty(filters.productId),
    target_operation_id: nullIfEmpty(filters.operationId),
    target_failure_mode_id: nullIfEmpty(filters.failureModeId),
    target_page: page,
    target_page_size: pageSize,
  });

  if (error) throw new Error(`No se pudo leer DA-03 control history: ${error.message}`);

  const payload = data as { rows?: unknown; total?: unknown; page?: unknown; pageSize?: unknown } | null;
  return {
    rows: Array.isArray(payload?.rows) ? payload.rows : [],
    total: numberValue(payload?.total, 0),
    page: numberValue(payload?.page, page),
    pageSize: numberValue(payload?.pageSize, pageSize),
  };
}

async function fetchCatalogEntity(
  supabase: SupabaseClient,
  tenant: TenantScope,
  entity: EngineerCatalogEntity,
  search: string,
  limit: number,
): Promise<EngineerCatalogItem[]> {
  const pattern = `%${search.replace(/[%_]/g, "\\$&")}%`;

  if (entity === "customer") {
    let query = supabase
      .from("customers")
      .select("id, name")
      .eq("company_id", tenant.companyId)
      .eq("plant_id", tenant.plantId)
      .eq("source_record_status", "imported")
      .order("name", { ascending: true })
      .limit(limit);
    if (search) query = query.ilike("name", pattern);
    const { data, error } = await query;
    if (error) throw new Error(`No se pudieron buscar clientes: ${error.message}`);
    return ((data ?? []) as Array<{ id: string; name: string }>).map((item) => ({
      entity,
      id: item.id,
      name: item.name,
    }));
  }

  if (entity === "product") {
    let query = supabase
      .from("products")
      .select("id, code, name, customer_id")
      .eq("company_id", tenant.companyId)
      .eq("plant_id", tenant.plantId)
      .eq("source_record_status", "imported")
      .order("code", { ascending: true })
      .limit(limit);
    if (search) query = query.or(`code.ilike.${pattern},name.ilike.${pattern}`);
    const { data, error } = await query;
    if (error) throw new Error(`No se pudieron buscar piezas: ${error.message}`);
    return ((data ?? []) as Array<{ id: string; code: string; name: string; customer_id: string }>).map((item) => ({
      entity,
      id: item.id,
      code: item.code,
      name: item.name,
      parentId: item.customer_id,
    }));
  }

  if (entity === "operation") {
    let query = supabase
      .from("operations")
      .select("id, code, name, product_id")
      .eq("company_id", tenant.companyId)
      .eq("plant_id", tenant.plantId)
      .eq("source_record_status", "imported")
      .order("code", { ascending: true })
      .limit(limit);
    if (search) query = query.or(`code.ilike.${pattern},name.ilike.${pattern}`);
    const { data, error } = await query;
    if (error) throw new Error(`No se pudieron buscar operaciones: ${error.message}`);
    return ((data ?? []) as Array<{ id: string; code: string; name: string; product_id: string }>).map((item) => ({
      entity,
      id: item.id,
      code: item.code,
      name: item.name,
      parentId: item.product_id,
    }));
  }

  let query = supabase
    .from("failure_modes")
    .select("id, name, operation_id")
    .eq("company_id", tenant.companyId)
    .eq("plant_id", tenant.plantId)
    .eq("source_record_status", "imported")
    .order("name", { ascending: true })
    .limit(limit);
  if (search) query = query.ilike("name", pattern);
  const { data, error } = await query;
  if (error) throw new Error(`No se pudieron buscar modos de falla: ${error.message}`);
  return ((data ?? []) as Array<{ id: string; name: string; operation_id: string }>).map((item) => ({
    entity,
    id: item.id,
    name: item.name,
    parentId: item.operation_id,
  }));
}

async function fetchControlDetail(
  supabase: SupabaseClient,
  tenant: TenantScope,
  controlId: string,
): Promise<EngineerControlListItem | null> {
  const { data: control, error: controlError } = await supabase
    .from("controls")
    .select(
      [
        "id",
        "operation_id",
        "date",
        "shift",
        "operator",
        "inspected_quantity",
        "observations",
        "import_file_id",
        "source_sheet_name",
        "source_row_number",
        "source_cell_address",
        "source_record_id",
      ].join(", "),
    )
    .eq("id", controlId)
    .eq("company_id", tenant.companyId)
    .eq("plant_id", tenant.plantId)
    .eq("source_record_status", "imported")
    .maybeSingle();

  if (controlError) throw new Error(`No se pudo leer el control: ${controlError.message}`);
  if (!control) return null;
  const controlRow = control as unknown as ControlDetailRow;

  const [operation, failures, importFile] = await Promise.all([
    fetchOperationTree(supabase, tenant, controlRow.operation_id),
    fetchFailuresForControl(supabase, tenant, controlId),
    fetchImportFile(supabase, tenant, controlRow.import_file_id ?? ""),
  ]);

  return {
    id: controlRow.id,
    date: controlRow.date,
    shift: controlRow.shift,
    operator: controlRow.operator,
    inspectedQuantity: numberValue(controlRow.inspected_quantity, 0),
    observations: nullableString(controlRow.observations),
    customer: operation.customer,
    product: operation.product,
    operation: operation.operation,
    failures,
    source: {
      fileName: importFile?.file_name ?? null,
      sheetName: nullableString(controlRow.source_sheet_name),
      rowNumber: nullableNumber(controlRow.source_row_number),
      cellAddress: nullableString(controlRow.source_cell_address),
      sourceRecordId: nullableString(controlRow.source_record_id),
    },
  };
}

async function fetchOperationTree(supabase: SupabaseClient, tenant: TenantScope, operationId: string) {
  const { data: operation, error: operationError } = await supabase
    .from("operations")
    .select("id, code, name, product_id")
    .eq("id", operationId)
    .eq("company_id", tenant.companyId)
    .eq("plant_id", tenant.plantId)
    .maybeSingle();
  if (operationError) throw new Error(`No se pudo leer la operacion: ${operationError.message}`);
  if (!operation) return { operation: null, product: null, customer: null };

  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id, code, name, customer_id")
    .eq("id", String(operation.product_id))
    .eq("company_id", tenant.companyId)
    .eq("plant_id", tenant.plantId)
    .maybeSingle();
  if (productError) throw new Error(`No se pudo leer la pieza: ${productError.message}`);

  const { data: customer, error: customerError } = product
    ? await supabase
        .from("customers")
        .select("id, name")
        .eq("id", String(product.customer_id))
        .eq("company_id", tenant.companyId)
        .eq("plant_id", tenant.plantId)
        .maybeSingle()
    : { data: null, error: null };
  if (customerError) throw new Error(`No se pudo leer el cliente: ${customerError.message}`);

  return {
    operation: {
      id: String(operation.id),
      code: String(operation.code),
      name: String(operation.name),
    },
    product: product
      ? {
          id: String(product.id),
          code: String(product.code),
          name: String(product.name),
        }
      : null,
    customer: customer
      ? {
          id: String(customer.id),
          name: String(customer.name),
        }
      : null,
  };
}

async function fetchFailuresForControl(supabase: SupabaseClient, tenant: TenantScope, controlId: string) {
  const { data, error } = await supabase
    .from("control_failures")
    .select("id, failure_mode_id, quantity")
    .eq("control_id", controlId)
    .eq("company_id", tenant.companyId)
    .eq("plant_id", tenant.plantId)
    .eq("source_record_status", "imported")
    .order("id", { ascending: true })
    .limit(MAX_CATALOG_LIMIT);

  if (error) throw new Error(`No se pudieron leer las fallas del control: ${error.message}`);

  const failures = (data ?? []) as Array<{ id: string; failure_mode_id: string; quantity: number }>;
  const failureModeIds = failures.map((failure) => failure.failure_mode_id);
  const failureModes = await fetchFailureModeNames(supabase, tenant, failureModeIds);

  return failures.map((failure) => ({
    id: failure.failure_mode_id,
    name: failureModes.get(failure.failure_mode_id) ?? failure.failure_mode_id,
    quantity: numberValue(failure.quantity, 0),
  }));
}

async function fetchFailureModeNames(supabase: SupabaseClient, tenant: TenantScope, failureModeIds: string[]) {
  if (failureModeIds.length === 0) return new Map<string, string>();

  const { data, error } = await supabase
    .from("failure_modes")
    .select("id, name")
    .eq("company_id", tenant.companyId)
    .eq("plant_id", tenant.plantId)
    .in("id", failureModeIds);

  if (error) throw new Error(`No se pudieron leer nombres de fallas: ${error.message}`);
  return new Map(((data ?? []) as Array<{ id: string; name: string }>).map((item) => [item.id, item.name]));
}

async function fetchImportFile(supabase: SupabaseClient, tenant: TenantScope, importFileId: string) {
  if (!importFileId) return null;

  const { data, error } = await supabase
    .from("import_files")
    .select("id, file_name")
    .eq("id", importFileId)
    .eq("company_id", tenant.companyId)
    .maybeSingle();
  if (error) throw new Error(`No se pudo leer el archivo fuente: ${error.message}`);
  return data as { id: string; file_name: string } | null;
}

async function countRows(supabase: SupabaseClient, table: string, tenant: TenantScope) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", tenant.companyId)
    .eq("plant_id", tenant.plantId)
    .eq("source_record_status", "imported");

  if (error) throw new Error(`No se pudo contar ${table}: ${error.message}`);
  return count ?? 0;
}

async function fetchHistoricalRange(supabase: SupabaseClient, tenant: TenantScope) {
  const [first, last] = await Promise.all([
    supabase
      .from("controls")
      .select("date")
      .eq("company_id", tenant.companyId)
      .eq("plant_id", tenant.plantId)
      .eq("source_record_status", "imported")
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("controls")
      .select("date")
      .eq("company_id", tenant.companyId)
      .eq("plant_id", tenant.plantId)
      .eq("source_record_status", "imported")
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (first.error) throw new Error(`No se pudo leer fecha minima de controles: ${first.error.message}`);
  if (last.error) throw new Error(`No se pudo leer fecha maxima de controles: ${last.error.message}`);

  return {
    dateFrom: first.data ? String((first.data as { date: string }).date) : null,
    dateTo: last.data ? String((last.data as { date: string }).date) : null,
  };
}

function normalizeControlRecords(rows: unknown[]): EngineerControlListItem[] {
  return (rows as ControlRecord[]).map((control) => ({
    id: control.id,
    date: control.date,
    shift: control.shift,
    operator: control.operator,
    inspectedQuantity: numberValue(control.inspected_quantity, 0),
    observations: control.observations,
    customer: control.operations?.products?.customers
      ? {
          id: control.operations.products.customers.id,
          name: control.operations.products.customers.name,
        }
      : null,
    product: control.operations?.products
      ? {
          id: control.operations.products.id,
          code: control.operations.products.code,
          name: control.operations.products.name,
        }
      : null,
    operation: control.operations
      ? {
          id: control.operations.id,
          code: control.operations.code,
          name: control.operations.name,
        }
      : null,
    failures: control.control_failures.map((failure) => ({
      id: failure.failure_mode_id,
      name: failure.failure_modes?.name ?? failure.failure_mode_id,
      quantity: numberValue(failure.quantity, 0),
    })),
    source: {
      fileName: control.import_files?.file_name ?? null,
      sheetName: control.source_sheet_name,
      rowNumber: control.source_row_number,
      cellAddress: control.source_cell_address,
      sourceRecordId: control.source_record_id,
    },
  }));
}

function normalizeRankingItems(value: unknown, dimension: EngineerRankingDimension): EngineerRankingItem[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => {
    const row = item as Record<string, unknown>;
    if (dimension === "operation_dpu") {
      return {
        id: String(row.operationId ?? ""),
        label: String(row.label ?? ""),
        value: decimalNumberValue(row.value, 0),
        inspectedQuantity: numberValue(row.inspectedQuantity, 0),
        defects: numberValue(row.defects, 0),
      };
    }

    return {
      id: String(row.failureModeId ?? ""),
      label: String(row.label ?? ""),
      value: numberValue(row.quantity, 0),
    };
  });
}

function normalizeTrendPoints(value: unknown): Array<EngineerKpis & { date: string }> {
  if (!Array.isArray(value)) return [];

  return value.map((item) => ({
    ...normalizeKpis(item),
    date: String((item as { label?: unknown }).label ?? ""),
  }));
}

function aggregateTrendPoints(points: Array<EngineerKpis & { date: string }>, interval: EngineerTrendInterval) {
  if (interval === "day") return points;

  const groups = new Map<string, EngineerKpis>();
  for (const point of points) {
    const key = interval === "week" ? weekKey(point.date) : point.date.slice(0, 7);
    const current = groups.get(key) ?? { controls: 0, inspectedQuantity: 0, defects: 0, dpu: 0 };
    current.controls += point.controls;
    current.inspectedQuantity += point.inspectedQuantity;
    current.defects += point.defects;
    current.dpu = current.inspectedQuantity > 0 ? current.defects / current.inspectedQuantity : 0;
    groups.set(key, current);
  }

  return Array.from(groups.entries()).map(([date, kpis]) => ({
    date,
    ...kpis,
  }));
}

function normalizeKpis(value: unknown): EngineerKpis {
  const item = value as Record<string, unknown> | null;
  return {
    controls: numberValue(item?.controls, 0),
    inspectedQuantity: numberValue(item?.inspectedQuantity, 0),
    defects: numberValue(item?.defects, 0),
    dpu: decimalNumberValue(item?.dpu, 0),
  };
}

function normalizeCatalogEntities(entities: EngineerCatalogEntity[] | undefined) {
  if (!entities || entities.length === 0) return catalogEntities;
  return entities.filter((entity, index) => catalogEntities.includes(entity) && entities.indexOf(entity) === index);
}

function normalizeSearch(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 100) : "";
}

function normalizeDateKey(value: unknown) {
  if (typeof value !== "string" || !value) return "";
  if (!DATE_KEY_PATTERN.test(value)) throw new Error(`Fecha invalida: ${value}. Usa YYYY-MM-DD.`);
  return value;
}

function numberValue(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}

function decimalNumberValue(value: unknown, fallback: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function nullableString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function nullableNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function nullIfEmpty(value: string) {
  return value || null;
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateKeyDaysBefore(dateKey: string, days: number) {
  const date = new Date(`${dateKey}T00:00:00`);
  date.setDate(date.getDate() - days);
  return toDateKey(date);
}

function daysBetween(dateFrom: string, dateTo: string) {
  const from = new Date(`${dateFrom}T00:00:00`).getTime();
  const to = new Date(`${dateTo}T00:00:00`).getTime();
  return Math.floor((to - from) / 86_400_000);
}

function weekKey(dateKey: string) {
  const date = new Date(`${dateKey}T00:00:00`);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  return toDateKey(date);
}

function limits() {
  return {
    catalog: MAX_CATALOG_LIMIT,
    ranking: MAX_RANKING_LIMIT,
    history: MAX_HISTORY_LIMIT,
    defaultWindowDays: DEFAULT_WINDOW_DAYS,
  };
}

function zeroCatalogCounts() {
  return {
    customer: 0,
    product: 0,
    operation: 0,
    failure_mode: 0,
  };
}

function errorSummary(filters: EngineerDateFilters, message: string): EngineerQualitySummary {
  const temporal = emptyTemporalContract(filters);
  return {
    status: "error",
    tenant: null,
    requested_date_range: temporal.requested_date_range,
    applied_date_range: temporal.applied_date_range,
    historical_range: temporal.historical_range,
    scope: temporal.scope,
    truncated: temporal.truncated,
    warnings: temporal.warnings,
    filters: temporal.filters,
    kpis: null,
    todaySummary: null,
    transferredRows: 0,
    error: message,
  };
}

function safeResolveDateFilters(filters: EngineerDateFilters = {}, maxDays = DEFAULT_WINDOW_DAYS): EngineerResolvedFilters {
  try {
    return resolveDateFilters(filters, maxDays);
  } catch {
    return resolveDateFilters({}, maxDays);
  }
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return "Ocurrio un error inesperado.";
}
