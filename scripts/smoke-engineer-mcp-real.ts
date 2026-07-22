import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";

type ToolResult = {
  status?: string;
  tenant?: {
    companyName?: string;
    plantName?: string;
    role?: string;
  } | null;
  kpis?: {
    controls: number;
    inspectedQuantity: number;
    defects: number;
    dpu: number;
  } | null;
  items?: unknown[];
  points?: unknown[];
  interval?: "day" | "week" | "month";
  controls?: Array<{ id: string }>;
  control?: unknown;
  requested_date_range?: {
    date_from: string | null;
    date_to: string | null;
  };
  applied_date_range?: {
    date_from: string | null;
    date_to: string | null;
  };
  historical_range?: {
    date_from: string | null;
    date_to: string | null;
  };
  scope?: "full_history" | "filtered_period";
  truncated?: boolean;
  warnings?: string[];
  historicalRange?: {
    dateFrom: string | null;
    dateTo: string | null;
  };
  context?: {
    scope?: "full_history" | "filtered_period";
    applied_date_range?: {
      date_from: string | null;
      date_to: string | null;
    };
  };
  data?: Array<{
    dimensions?: Record<string, { id: string; label: string }>;
    measures?: Record<string, number | null | Record<string, unknown>>;
    value?: number;
    share?: number;
    cumulativeShare?: number;
    includedInThreshold?: boolean;
  }>;
  metadata?: {
    row_count?: number;
    truncated?: boolean;
    totalDefects?: number;
    cutoffIndex?: number | null;
  };
};

type McpTextContent = {
  type: "text";
  text: string;
};

type McpCallResult = {
  isError?: boolean;
  content?: unknown;
  structuredContent?: {
    result?: unknown;
  };
};

const repoRoot = resolve(process.env.ENGINEER_REPO_ROOT ?? process.cwd());
const nodeCommand = process.env.ENGINEER_NODE_COMMAND ?? process.execPath;
const tsxCli = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");
const serverEntry = resolve(repoRoot, "mcp/engineer-server.ts");
const expectedTools = [
  "get_quality_summary",
  "get_quality_ranking",
  "get_quality_trend",
  "search_quality_catalog",
  "search_controls",
  "get_control_detail",
  "analyze_quality",
  "compare_quality_periods",
  "get_quality_pareto",
];
const expectedKpis = {
  controls: 19_425,
  inspectedQuantity: 2_225_365,
  defects: 257_090,
  dpu: 0.11552711577651306,
};

if (!existsSync(nodeCommand)) throw new Error(`No existe node.exe: ${nodeCommand}`);
if (!existsSync(tsxCli)) throw new Error(`No existe tsx CLI: ${tsxCli}`);
if (!existsSync(serverEntry)) throw new Error(`No existe MCP server: ${serverEntry}`);

const report: Record<string, unknown> = {
  command: nodeCommand,
  args: [tsxCli, serverEntry],
  cwd: tmpdir(),
  checks: {},
  timingsMs: {},
};

const client = new Client({ name: "quality-ai-engineer-real-smoke", version: "0.1.0" });
const transport = new StdioClientTransport({
  command: nodeCommand,
  args: [tsxCli, serverEntry],
  cwd: tmpdir(),
  env: sanitizedEnv(),
  stderr: "pipe",
});
const startupStderr: string[] = [];
transport.stderr?.on("data", (chunk) => startupStderr.push(String(chunk)));

void main().catch((error) => {
  throw error;
});

async function main() {
try {
  await time("connect", async () => {
    try {
      await client.connect(transport);
    } catch (error) {
      throw new Error(`No se pudo iniciar MCP Engineer: ${startupStderr.join("").trim() || getErrorMessage(error)}`);
    }
  });

  const tools = await time("tools/list", () => client.listTools());
  const toolNames = tools.tools.map((tool) => tool.name);
  assertEqual(toolNames, expectedTools, "tools/list no coincide con las nueve tools esperadas.");

  const resources = await time("resources/list", () => client.listResources());
  assert(
    resources.resources.some((resource) => resource.uri === "engineer://industrial-context/current"),
    "No se registro engineer://industrial-context/current.",
  );

  const industrialContext = await time("resources/read", () => readIndustrialContext());
  assertReady(industrialContext, "industrial context");
  assert(industrialContext.tenant?.companyName === "ROMET", "Empresa esperada: ROMET.");
  assert(industrialContext.tenant?.plantName === "Planta Principal", "Planta esperada: Planta Principal.");

  const dateFrom = industrialContext.historicalRange?.dateFrom;
  const dateTo = industrialContext.historicalRange?.dateTo;
  assert(dateFrom && dateTo, "industrial context no devolvio rango historico.");

  const summary = await time("get_quality_summary", () => callTool("get_quality_summary", {}));
  assertReady(summary, "get_quality_summary");
  assert(summary.scope === "full_history", "get_quality_summary sin fechas debe usar scope full_history.");
  assert(summary.truncated === false, "get_quality_summary sin fechas no debe truncar.");
  assert(summary.applied_date_range?.date_from === dateFrom, "summary applied_date_range.date_from debe cubrir historicalRange.");
  assert(summary.applied_date_range?.date_to === dateTo, "summary applied_date_range.date_to debe cubrir historicalRange.");
  reconcileSummary(summary);

  const ranking = await time("get_quality_ranking", () =>
    callTool("get_quality_ranking", { dateFrom, dateTo, dimension: "failure_mode", limit: 50 }),
  );
  assertReady(ranking, "get_quality_ranking");
  assert((ranking.items?.length ?? 0) > 0, "get_quality_ranking no devolvio resultados.");
  assert((ranking.items?.length ?? 0) <= 50, "get_quality_ranking supero limite 50.");

  const trendIntervals: Array<"day" | "week" | "month"> = ["day", "week", "month"];
  for (const interval of trendIntervals) {
    const trend: ToolResult = await time(`get_quality_trend:${interval}`, () =>
      callTool("get_quality_trend", { dateFrom, dateTo, interval }),
    );
    assertReady(trend, `get_quality_trend ${interval}`);
    assert((trend.points?.length ?? 0) > 0, `get_quality_trend ${interval} no devolvio serie.`);
    assert((trend.points?.length ?? 0) <= 200, `get_quality_trend ${interval} supero 200 buckets.`);
    assert(trend.applied_date_range?.date_from === dateFrom, `get_quality_trend ${interval} no conservo dateFrom historico.`);
    assert(trend.applied_date_range?.date_to === dateTo, `get_quality_trend ${interval} no conservo dateTo historico.`);
    if (interval === "day" && trend.interval !== "day") {
      assert((trend.warnings?.length ?? 0) > 0, "get_quality_trend day agregado debe informar warning.");
    }
  }

  const catalogProducts = await time("search_quality_catalog:products", () =>
    callTool("search_quality_catalog", { entities: ["product"], limit: 50 }),
  );
  assertReady(catalogProducts, "search_quality_catalog products");
  assert((catalogProducts.items?.length ?? 0) > 0, "search_quality_catalog no encontro piezas.");
  assert((catalogProducts.items?.length ?? 0) <= 50, "search_quality_catalog products supero limite 50.");

  const catalogOperations = await time("search_quality_catalog:operations", () =>
    callTool("search_quality_catalog", { entities: ["operation"], limit: 50 }),
  );
  assertReady(catalogOperations, "search_quality_catalog operations");
  assert((catalogOperations.items?.length ?? 0) > 0, "search_quality_catalog no encontro operaciones.");

  const controls = await time("search_controls", () =>
    callTool("search_controls", { dateFrom, dateTo, limit: 5 }),
  );
  assertReady(controls, "search_controls");
  assert((controls.controls?.length ?? 0) > 0, "search_controls no devolvio controles.");
  assert((controls.controls?.length ?? 0) <= 5, "search_controls supero limit 5.");
  assert(controls.truncated === true, "search_controls con limit 5 debe informar truncamiento de pagina.");

  const controlId = controls.controls?.[0]?.id;
  assert(controlId, "No hay control real para get_control_detail.");

  const detail = await time("get_control_detail", () => callTool("get_control_detail", { controlId }));
  assertReady(detail, "get_control_detail");
  assert(Boolean(detail.control), "get_control_detail no abrio el control real.");

  const missingControl = await time("get_control_detail:missing", () =>
    callTool("get_control_detail", { controlId: "00000000-0000-0000-0000-000000000000" }),
  );
  assertReady(missingControl, "get_control_detail missing");
  assert(missingControl.control === null, "control inexistente debe devolver control null.");

  const analysis = await time("analyze_quality", () =>
    callTool("analyze_quality", {
      measures: ["controls", "inspected_quantity", "defects", "dpu"],
      limit: 100,
    }),
  );
  assertReady(analysis, "analyze_quality");
  assert(analysis.context?.scope === "full_history", "analyze_quality sin fechas debe usar full_history.");
  const analysisMeasures = analysis.data?.[0]?.measures;
  assert(analysisMeasures?.controls === expectedKpis.controls, "analyze_quality controls no coincide con DA-03.");
  assert(analysisMeasures?.inspected_quantity === expectedKpis.inspectedQuantity, "analyze_quality inspected_quantity no coincide con DA-03.");
  assert(analysisMeasures?.defects === expectedKpis.defects, "analyze_quality defects no coincide con DA-03.");
  assert(Math.abs(Number(analysisMeasures?.dpu ?? 0) - expectedKpis.dpu) < 1e-15, "analyze_quality dpu no coincide con DA-03.");

  const analysisByProductOperation = await time("analyze_quality:product_operation", () =>
    callTool("analyze_quality", {
      measures: ["defects", "dpu"],
      groupBy: ["product", "operation"],
      orderBy: { measure: "defects", direction: "desc" },
      limit: 100,
    }),
  );
  assertReady(analysisByProductOperation, "analyze_quality product/operation");
  assert((analysisByProductOperation.data?.length ?? 0) > 0, "analyze_quality product/operation no devolvio datos.");
  assert((analysisByProductOperation.data?.length ?? 0) <= 100, "analyze_quality product/operation supero 100 filas.");

  const compareSamePeriod = await time("compare_quality_periods:same_period", () =>
    callTool("compare_quality_periods", {
      periodA: { dateFrom, dateTo },
      periodB: { dateFrom, dateTo },
      measures: ["defects", "dpu"],
      groupBy: "product",
      limit: 100,
    }),
  );
  assertReady(compareSamePeriod, "compare_quality_periods same period");
  assert((compareSamePeriod.data?.length ?? 0) > 0, "compare_quality_periods no devolvio datos.");
  const firstCompareMeasures = compareSamePeriod.data?.[0]?.measures ?? {};
  for (const measure of Object.values(firstCompareMeasures)) {
    const comparison = measure as { absoluteDelta?: number };
    assert(comparison.absoluteDelta === 0, "comparar un periodo contra si mismo debe devolver delta 0.");
  }

  const pareto = await time("get_quality_pareto", () =>
    callTool("get_quality_pareto", {
      dimension: "failure_mode",
      measure: "defects",
      dateFrom,
      dateTo,
      threshold: 0.8,
      limit: 100,
    }),
  );
  assertReady(pareto, "get_quality_pareto");
  assert((pareto.data?.length ?? 0) > 0, "get_quality_pareto no devolvio datos.");
  const shareTotal = (pareto.data ?? []).reduce((sum, row) => sum + Number(row.share ?? 0), 0);
  assert(shareTotal > 0.99 && shareTotal <= 1.000001, "Pareto debe sumar participacion total cercana a 1.");
  assert(pareto.data?.some((row) => row.includedInThreshold === false), "Pareto debe indicar el corte de threshold.");

  await expectToolValidationError("search_controls limit > 200", "search_controls", { limit: 201 });
  await expectToolValidationError("get_control_detail UUID invalido", "get_control_detail", { controlId: "not-a-uuid" });
  await expectToolValidationError("analyze_quality dimension duplicada", "analyze_quality", {
    measures: ["defects"],
    groupBy: ["product", "product"],
  });
  await expectToolValidationError("analyze_quality limit > 100", "analyze_quality", {
    measures: ["defects"],
    limit: 101,
  });

  report.checks = {
    tools: toolNames,
    resource: "engineer://industrial-context/current",
    tenant: industrialContext.tenant,
    historicalRange: industrialContext.historicalRange,
    summary: summary.kpis,
    summaryScope: summary.scope,
    summaryAppliedDateRange: summary.applied_date_range,
    rankingItems: ranking.items?.length ?? 0,
    catalogProducts: catalogProducts.items?.length ?? 0,
    catalogOperations: catalogOperations.items?.length ?? 0,
    searchControls: controls.controls?.length ?? 0,
    controlDetailOpened: Boolean(detail.control),
    missingControlReturnsNull: missingControl.control === null,
    analyzeQuality: analysisMeasures,
    analyzeProductOperationRows: analysisByProductOperation.data?.length ?? 0,
    compareSamePeriodRows: compareSamePeriod.data?.length ?? 0,
    paretoRows: pareto.data?.length ?? 0,
    paretoShareTotal: shareTotal,
  };

  await client.close();
  await runStartupFailureChecks();
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  await client.close().catch(() => undefined);
  throw error;
}
}

async function callTool(name: string, args: Record<string, unknown>) {
  const result = (await client.callTool({ name, arguments: args })) as McpCallResult;
  if (result.isError) {
    const content = Array.isArray(result.content) ? (result.content as McpTextContent[]) : [];
    const text = content.find((item) => item.type === "text")?.text ?? "tool error";
    throw new Error(text);
  }
  return result.structuredContent?.result as ToolResult;
}

async function readIndustrialContext() {
  const result = await client.readResource({ uri: "engineer://industrial-context/current" });
  const text = result.contents.find((item) => "text" in item)?.text;
  if (!text) throw new Error("Resource sin contenido textual.");
  return JSON.parse(text) as ToolResult;
}

async function expectToolValidationError(label: string, name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  assert(result.isError === true, `${label} debia fallar validacion.`);
}

async function runStartupFailureChecks() {
  await expectStartupFailure("missing variable", {
    NEXT_PUBLIC_SUPABASE_URL: "",
    SUPABASE_URL: "",
  });
  await expectStartupFailure("invalid credentials", {
    ENGINEER_SUPABASE_ACCESS_TOKEN: "",
    SUPABASE_ACCESS_TOKEN: "",
    ENGINEER_SUPABASE_EMAIL: process.env.ENGINEER_SUPABASE_EMAIL ?? "engineer@example.invalid",
    ENGINEER_SUPABASE_PASSWORD: "invalid-password-for-smoke",
  });
}

async function expectStartupFailure(label: string, overrides: Record<string, string>) {
  const failureClient = new Client({ name: `quality-ai-engineer-${label}`, version: "0.1.0" });
  const failureTransport = new StdioClientTransport({
    command: nodeCommand,
    args: [tsxCli, serverEntry],
    cwd: tmpdir(),
    env: sanitizedEnv(overrides),
    stderr: "pipe",
  });

  try {
    await failureClient.connect(failureTransport);
    await failureClient.listTools();
    throw new Error(`${label} debia fallar al iniciar.`);
  } catch {
    report.checks = {
      ...(report.checks as Record<string, unknown>),
      [label]: "failed as expected",
    };
  } finally {
    await failureClient.close().catch(() => undefined);
  }
}

async function time<T>(label: string, callback: () => Promise<T>) {
  const started = performance.now();
  const value = await callback();
  (report.timingsMs as Record<string, number>)[label] = Math.round(performance.now() - started);
  return value;
}

function reconcileSummary(summary: ToolResult) {
  assert(summary.kpis?.controls === expectedKpis.controls, "controls no coincide con DA-03 esperado.");
  assert(
    summary.kpis?.inspectedQuantity === expectedKpis.inspectedQuantity,
    "inspected quantity no coincide con DA-03 esperado.",
  );
  assert(summary.kpis?.defects === expectedKpis.defects, "defects no coincide con DA-03 esperado.");
  assert(
    Math.abs((summary.kpis?.dpu ?? 0) - expectedKpis.dpu) < 1e-15,
    "DPU no coincide con DA-03 esperado.",
  );
}

function assertReady(result: ToolResult, label: string) {
  assert(result.status === "ready", `${label} no devolvio status ready.`);
}

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}\nExpected: ${JSON.stringify(expected)}\nActual: ${JSON.stringify(actual)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  return String(error);
}

function sanitizedEnv(overrides: Record<string, string> = {}) {
  return {
    PATH: process.env.PATH ?? "",
    Path: process.env.Path ?? "",
    TEMP: process.env.TEMP ?? tmpdir(),
    TMP: process.env.TMP ?? tmpdir(),
    USERPROFILE: process.env.USERPROFILE ?? "",
    APPDATA: process.env.APPDATA ?? "",
    ...overrides,
  };
}
