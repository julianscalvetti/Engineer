#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  analyzeQuality,
  compareQualityPeriods,
  getControlDetail,
  getIndustrialContext,
  getQualityPareto,
  getQualityRanking,
  getQualitySummary,
  getQualityTrend,
  searchControls,
  searchQualityCatalog,
} from "../lib/engineer/analytics";
import { createEngineerClientContext, readEngineerRuntimeFromEnv, validateEngineerStartup } from "../lib/engineer/runtime";
import type {
  EngineerAnalysisDimension,
  EngineerAnalysisMeasure,
  EngineerCatalogEntity,
  EngineerClientContext,
  EngineerRankingDimension,
} from "../lib/engineer/types";

const dateFiltersSchema = {
  dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Start date as YYYY-MM-DD."),
  dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("End date as YYYY-MM-DD."),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Alias for dateFrom."),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Alias for dateTo."),
  customerId: z.string().uuid().optional().describe("Customer UUID. Do not use this for ROMET."),
  productId: z.string().uuid().optional(),
  operationId: z.string().uuid().optional(),
  failureModeId: z.string().uuid().optional(),
};

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
};

const analysisMeasureSchema = z.enum(["controls", "inspected_quantity", "defects", "dpu"]);
const analysisDimensionSchema = z.enum(["customer", "product", "operation", "failure_mode"]);
const analysisFiltersSchema = z
  .object({
    dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    customerIds: z.array(z.string().uuid()).optional(),
    productIds: z.array(z.string().uuid()).optional(),
    operationIds: z.array(z.string().uuid()).optional(),
    failureModeIds: z.array(z.string().uuid()).optional(),
  })
  .strict();
const dimensionalFiltersSchema = analysisFiltersSchema.omit({
  dateFrom: true,
  dateTo: true,
  date_from: true,
  date_to: true,
});

const server = new McpServer({
  name: "quality-ai-engineer",
  version: "0.1.0",
});
let engineerContextPromise: Promise<EngineerClientContext> | null = null;

server.registerTool(
  "get_quality_summary",
  {
    title: "Get Quality Summary",
    description:
      "Read KPI summary for ROMET / Planta Principal, the authenticated industrial tenant. With no date range, returns the full historical range, not the last 14 days. ROMET is the tenant, not a catalog value. Check historical_range before claiming data is missing.",
    inputSchema: dateFiltersSchema,
    annotations: readOnlyAnnotations,
  },
  async (args) => jsonResult(await withEngineerContext((context) => getQualitySummary(context, normalizeDateFilterAliases(args)))),
);

server.registerTool(
  "get_quality_ranking",
  {
    title: "Get Quality Ranking",
    description:
      "Read a bounded quality ranking for ROMET / Planta Principal. Supported dimensions: failure_mode and operation_dpu. Maximum limit is 50. ROMET is the tenant, not a catalog value; do not search ROMET in the catalog.",
    inputSchema: {
      ...dateFiltersSchema,
      dimension: z.enum(["failure_mode", "operation_dpu"]).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    annotations: readOnlyAnnotations,
  },
  async (args) =>
    jsonResult(
      await withEngineerContext((context) =>
        getQualityRanking(context, {
          ...args,
          ...normalizeDateFilterAliases(args),
          dimension: args.dimension as EngineerRankingDimension | undefined,
        }),
      ),
    ),
);

server.registerTool(
  "get_quality_trend",
  {
    title: "Get Quality Trend",
    description:
      "Read KPI trend for ROMET / Planta Principal. With no date range, uses the full historical range. If there are too many buckets, Engineer aggregates buckets and reports warnings/truncated instead of silently shortening the date range.",
    inputSchema: {
      ...dateFiltersSchema,
      interval: z.enum(["day", "week", "month"]).optional(),
    },
    annotations: readOnlyAnnotations,
  },
  async (args) => jsonResult(await withEngineerContext((context) => getQualityTrend(context, normalizeDateFilterAliases(args)))),
);

server.registerTool(
  "search_quality_catalog",
  {
    title: "Search Quality Catalog",
    description:
      "Search scoped customers, products, operations and failure modes for the ROMET tenant. ROMET is the authenticated company/plant, not a catalog value; do not use this tool to search for the tenant name. Maximum limit is 50.",
    inputSchema: {
      query: z.string().max(100).optional(),
      entities: z.array(z.enum(["customer", "product", "operation", "failure_mode"])).max(4).optional(),
      limit: z.number().int().min(1).max(50).optional(),
    },
    annotations: readOnlyAnnotations,
  },
  async (args) =>
    jsonResult(
      await withEngineerContext((context) =>
        searchQualityCatalog(context, {
          ...args,
          entities: args.entities as EngineerCatalogEntity[] | undefined,
        }),
      ),
    ),
);

server.registerTool(
  "search_controls",
  {
    title: "Search Controls",
    description:
      "Search paginated control history for ROMET / Planta Principal through DA-03 RPC. Defaults to the last 14 days and returns at most 200 controls per page. This is not a full historical summary; use get_quality_summary with no dates for full-history KPIs.",
    inputSchema: {
      ...dateFiltersSchema,
      page: z.number().int().min(1).optional(),
      limit: z.number().int().min(1).max(200).optional(),
    },
    annotations: readOnlyAnnotations,
  },
  async (args) => jsonResult(await withEngineerContext((context) => searchControls(context, normalizeDateFilterAliases(args)))),
);

server.registerTool(
  "get_control_detail",
  {
    title: "Get Control Detail",
    description: "Read one control detail by control id within ROMET / Planta Principal, the authenticated user's tenant.",
    inputSchema: {
      controlId: z.string().uuid(),
    },
    annotations: readOnlyAnnotations,
  },
  async (args) => jsonResult(await withEngineerContext((context) => getControlDetail(context, args))),
);

server.registerTool(
  "analyze_quality",
  {
    title: "Analyze Quality",
    description:
      "Run controlled multidimensional analytics for ROMET / Planta Principal without SQL. Supports measures controls, inspected_quantity, defects and dpu; at most two groupBy dimensions; full historical range by default; maximum 100 rows.",
    inputSchema: {
      measures: z.array(analysisMeasureSchema).min(1).max(4),
      groupBy: z
        .array(analysisDimensionSchema)
        .max(2)
        .refine((items) => new Set(items).size === items.length, "groupBy no permite dimensiones repetidas.")
        .optional(),
      filters: analysisFiltersSchema.optional(),
      orderBy: z
        .object({
          measure: analysisMeasureSchema,
          direction: z.enum(["asc", "desc"]),
        })
        .strict()
        .optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    annotations: readOnlyAnnotations,
  },
  async (args) =>
    jsonResult(
      await withEngineerContext((context) =>
        analyzeQuality(context, {
          measures: args.measures as EngineerAnalysisMeasure[],
          groupBy: args.groupBy as EngineerAnalysisDimension[] | undefined,
          filters: args.filters ? normalizeAnalysisFilterAliases(args.filters) : undefined,
          orderBy: args.orderBy as { measure: EngineerAnalysisMeasure; direction: "asc" | "desc" } | undefined,
          limit: args.limit,
        }),
      ),
    ),
);

server.registerTool(
  "compare_quality_periods",
  {
    title: "Compare Quality Periods",
    description:
      "Compare two explicit date periods for ROMET / Planta Principal using controlled measures and optional one-dimensional grouping. Does not accept SQL or tenant ids. Maximum 100 rows.",
    inputSchema: {
      periodA: z
        .object({
          dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .strict(),
      periodB: z
        .object({
          dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        })
        .strict(),
      measures: z.array(analysisMeasureSchema).min(1).max(4),
      groupBy: analysisDimensionSchema.optional(),
      filters: dimensionalFiltersSchema.optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    annotations: readOnlyAnnotations,
  },
  async (args) =>
    jsonResult(
      await withEngineerContext((context) =>
        compareQualityPeriods(context, {
          periodA: args.periodA,
          periodB: args.periodB,
          measures: args.measures as EngineerAnalysisMeasure[],
          groupBy: args.groupBy as EngineerAnalysisDimension | undefined,
          filters: args.filters,
          limit: args.limit,
        }),
      ),
    ),
);

server.registerTool(
  "get_quality_pareto",
  {
    title: "Get Quality Pareto",
    description:
      "Compute a defects Pareto for ROMET / Planta Principal on one allowed dimension. The server computes share, cumulativeShare and threshold cutoff; Claude should not recompute the cumulative Pareto.",
    inputSchema: {
      dimension: analysisDimensionSchema,
      measure: z.literal("defects"),
      dateFrom: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      dateTo: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      filters: dimensionalFiltersSchema.optional(),
      threshold: z.number().min(0.5).max(0.95).optional(),
      limit: z.number().int().min(1).max(100).optional(),
    },
    annotations: readOnlyAnnotations,
  },
  async (args) =>
    jsonResult(
      await withEngineerContext((context) => {
        const dates = normalizeDateFilterAliases(args);
        return getQualityPareto(context, {
          dimension: args.dimension as EngineerAnalysisDimension,
          measure: "defects",
          dateFrom: dates.dateFrom,
          dateTo: dates.dateTo,
          filters: args.filters,
          threshold: args.threshold,
          limit: args.limit,
        });
      }),
    ),
);

server.registerResource(
  "engineer-industrial-context-current",
  "engineer://industrial-context/current",
  {
    title: "Current Engineer Industrial Context",
    description:
      "Current authenticated tenant, available capabilities, bounded limits, row counts and historical_range. Read this before claiming that ROMET is missing data.",
    mimeType: "application/json",
  },
  async (uri) => {
    const context = await withEngineerContext((engineerContext) => getIndustrialContext(engineerContext));
    return {
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(context, null, 2),
        },
      ],
    };
  },
);

async function withEngineerContext<T>(callback: (context: EngineerClientContext) => Promise<T>) {
  const context = await getEngineerContext();
  return callback(context);
}

async function getEngineerContext() {
  engineerContextPromise ??= createEngineerContext();
  return engineerContextPromise;
}

async function createEngineerContext() {
  const runtime = readEngineerRuntimeFromEnv();
  const context = await createEngineerClientContext(runtime);
  await validateEngineerStartup(context);
  return context;
}

function jsonResult(value: unknown) {
  return {
    structuredContent: {
      result: value,
    },
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function normalizeDateFilterAliases<T extends { dateFrom?: string; dateTo?: string; date_from?: string; date_to?: string }>(
  args: T,
) {
  const dateFrom = args.dateFrom ?? args.date_from;
  const dateTo = args.dateTo ?? args.date_to;

  if (args.dateFrom && args.date_from && args.dateFrom !== args.date_from) {
    throw new Error("dateFrom y date_from no pueden diferir.");
  }
  if (args.dateTo && args.date_to && args.dateTo !== args.date_to) {
    throw new Error("dateTo y date_to no pueden diferir.");
  }

  return {
    ...args,
    dateFrom,
    dateTo,
  };
}

function normalizeAnalysisFilterAliases<
  T extends { dateFrom?: string; dateTo?: string; date_from?: string; date_to?: string },
>(filters: T) {
  const normalized = normalizeDateFilterAliases(filters);
  const withoutAliases = { ...normalized };
  delete withoutAliases.date_from;
  delete withoutAliases.date_to;
  return {
    ...withoutAliases,
  };
}

async function main() {
  await getEngineerContext();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
