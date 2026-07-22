import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = resolve(repoRoot, "mcp/bundle/manifest.json");
const bundleRoot = resolve(repoRoot, "mcp/bundle");
const serverEntry = resolve(bundleRoot, "server/index.js");
const mcpbPath = resolve(repoRoot, "dist/engineer-quality.mcpb");
const envPath = resolve(repoRoot, ".env.local");

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

const expectedResource = "engineer://industrial-context/current";
const runtimeChecks = {
  tenant: null,
  summary: null,
  analysis: null,
};

if (!existsSync(manifestPath)) throw new Error(`No existe manifest: ${manifestPath}`);
if (!existsSync(serverEntry)) throw new Error(`No existe server bundle: ${serverEntry}`);

loadLocalEnvForValidation();
validateManifest();
validateBundleFiles();
validateNoWritesInEngineerSources();
await validateRuntime();

console.log(
  JSON.stringify(
    {
      manifest: "valid",
      serverStarts: true,
      tools: expectedTools,
      resource: expectedResource,
      tenant: runtimeChecks.tenant,
      summary: runtimeChecks.summary,
      analysis: runtimeChecks.analysis,
      secretsFound: false,
      absolutePathsFound: false,
      writesDetected: false,
      bundleExists: existsSync(mcpbPath),
      bundleSizeBytes: existsSync(mcpbPath) ? statSync(mcpbPath).size : null,
    },
    null,
    2,
  ),
);

function validateManifest() {
  execFileSync(process.env.ComSpec ?? "cmd.exe", ["/d", "/s", "/c", "npm.cmd exec --package @anthropic-ai/mcpb -- mcpb validate mcp/bundle/manifest.json"], {
    cwd: repoRoot,
    stdio: "inherit",
  });

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (manifest.manifest_version !== "0.3") throw new Error("manifest_version debe ser 0.3.");
  if (manifest.name !== "engineer-quality") throw new Error("manifest name inesperado.");
  if (manifest.server?.mcp_config?.command !== "node") throw new Error("mcp_config.command debe ser node.");
  if (manifest.server?.mcp_config?.args?.[0] !== "${__dirname}/server/index.js") {
    throw new Error("mcp_config.args debe usar ${__dirname}/server/index.js.");
  }
  if (manifest.user_config?.ENGINEER_SUPABASE_PASSWORD?.sensitive !== true) {
    throw new Error("ENGINEER_SUPABASE_PASSWORD debe ser sensitive.");
  }
  assertNoAbsolutePaths(JSON.stringify(manifest));
}

function validateBundleFiles() {
  const forbiddenNames = new Set([".env.local"]);
  const forbiddenFragments = [
    "SUPABASE_SERVICE_ROLE_KEY=",
    "SUPABASE_DB_URL=",
    "ENGINEER_SUPABASE_ACCESS_TOKEN=",
    "data/raw",
    "data/reports",
    "C:\\Users\\",
    "C:/Users/",
    "OneDrive",
    "Program Files",
  ];
  const secretValues = [
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.SUPABASE_DB_URL,
    process.env.ENGINEER_SUPABASE_ACCESS_TOKEN,
    process.env.SUPABASE_ACCESS_TOKEN,
    process.env.ENGINEER_SUPABASE_PASSWORD,
  ].filter((value) => typeof value === "string" && value.length > 0);

  for (const file of walk(bundleRoot)) {
    const name = file.split(sep).at(-1);
    if (name && forbiddenNames.has(name)) throw new Error(`Archivo prohibido en bundle: ${name}`);
    const content = readFileSync(file, "utf8");
    for (const fragment of forbiddenFragments) {
      if (content.includes(fragment)) throw new Error(`Fragmento prohibido en bundle: ${fragment}`);
    }
    for (const secret of secretValues) {
      if (secret && content.includes(secret)) throw new Error("Se detecto un valor secreto dentro del bundle.");
    }
  }
}

function validateNoWritesInEngineerSources() {
  const sourceRoots = [
    resolve(repoRoot, "mcp/engineer-server.ts"),
    resolve(repoRoot, "lib/engineer"),
    resolve(repoRoot, "lib/tenant/context.ts"),
  ];
  const writePatterns = [".insert(", ".update(", ".upsert(", ".delete("];

  for (const target of sourceRoots) {
    const files = statSync(target).isDirectory() ? Array.from(walk(target)) : [target];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const pattern of writePatterns) {
        if (content.includes(pattern)) {
          throw new Error(`Operacion de escritura detectada en ${file}: ${pattern}`);
        }
      }
    }
  }
}

async function validateRuntime() {
  const env = requiredRuntimeEnv();
  const client = new Client({ name: "engineer-quality-mcpb-validation", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: "node",
    args: [serverEntry],
    cwd: tmpdir(),
    env: {
      PATH: process.env.PATH ?? "",
      Path: process.env.Path ?? "",
      TEMP: process.env.TEMP ?? tmpdir(),
      TMP: process.env.TMP ?? tmpdir(),
      ...env,
    },
    stderr: "pipe",
  });
  const stderr = [];
  transport.stderr?.on("data", (chunk) => stderr.push(String(chunk)));

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    const toolNames = tools.tools.map((tool) => tool.name);
    if (JSON.stringify(toolNames) !== JSON.stringify(expectedTools)) {
      throw new Error(`tools/list inesperado: ${JSON.stringify(toolNames)}`);
    }

    const resources = await client.listResources();
    if (!resources.resources.some((resource) => resource.uri === expectedResource)) {
      throw new Error(`No se encontro resource ${expectedResource}.`);
    }

    const context = await readIndustrialContext(client);
    if (context.status !== "ready") {
      throw new Error(`industrial context no devolvio status ready: ${JSON.stringify({ status: context.status, error: context.error })}`);
    }
    if (context.tenant?.companyName !== "ROMET") throw new Error("Empresa esperada: ROMET.");
    if (context.tenant?.plantName !== "Planta Principal") throw new Error("Planta esperada: Planta Principal.");
    runtimeChecks.tenant = context.tenant;

    const summary = await callTool(client, "get_quality_summary", {});
    if (summary.status !== "ready") throw new Error("get_quality_summary no devolvio status ready.");
    if (summary.scope !== "full_history") throw new Error("get_quality_summary sin fechas debe usar scope full_history.");
    if (summary.truncated !== false) throw new Error("get_quality_summary sin fechas no debe truncar.");
    if (summary.kpis?.controls !== 19_425) throw new Error("controls no coincide con DA-03.");
    if (summary.kpis?.inspectedQuantity !== 2_225_365) throw new Error("inspectedQuantity no coincide con DA-03.");
    if (summary.kpis?.defects !== 257_090) throw new Error("defects no coincide con DA-03.");
    if (Math.abs((summary.kpis?.dpu ?? 0) - 0.11552711577651306) > 1e-15) {
      throw new Error("DPU no coincide con DA-03.");
    }
    runtimeChecks.summary = summary.kpis;

    const analysis = await callTool(client, "analyze_quality", {
      measures: ["controls", "inspected_quantity", "defects", "dpu"],
      limit: 100,
    });
    if (analysis.status !== "ready") throw new Error("analyze_quality no devolvio status ready.");
    const measures = analysis.data?.[0]?.measures;
    if (measures?.controls !== 19_425) throw new Error("analyze_quality controls no coincide con DA-03.");
    if (measures?.inspected_quantity !== 2_225_365) throw new Error("analyze_quality inspected_quantity no coincide con DA-03.");
    if (measures?.defects !== 257_090) throw new Error("analyze_quality defects no coincide con DA-03.");
    if (Math.abs((measures?.dpu ?? 0) - 0.11552711577651306) > 1e-15) {
      throw new Error("analyze_quality DPU no coincide con DA-03.");
    }
    runtimeChecks.analysis = measures;
  } catch (error) {
    const details = stderr.join("").trim();
    throw new Error(`No se pudo validar runtime MCPB.${details ? ` stderr: ${details}` : ""}`, {
      cause: error,
    });
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function callTool(client, name, args) {
  const result = await client.callTool({ name, arguments: args });
  if (result.isError) throw new Error(`Tool ${name} devolvio error.`);
  return result.structuredContent?.result ?? {};
}

async function readIndustrialContext(client) {
  const result = await client.readResource({ uri: expectedResource });
  const text = result.contents.find((item) => "text" in item)?.text;
  if (!text) throw new Error("Resource sin contenido textual.");
  return JSON.parse(text);
}

function loadLocalEnvForValidation() {
  if (existsSync(envPath)) process.loadEnvFile(envPath);
}

function requiredRuntimeEnv() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.ENGINEER_SUPABASE_EMAIL;
  const password = process.env.ENGINEER_SUPABASE_PASSWORD;

  if (!supabaseUrl) throw new Error("Falta SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL para validar runtime.");
  if (!publishableKey) throw new Error("Falta SUPABASE_PUBLISHABLE_KEY/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY para validar runtime.");
  if (!email) throw new Error("Falta ENGINEER_SUPABASE_EMAIL para validar runtime.");
  if (!password) throw new Error("Falta ENGINEER_SUPABASE_PASSWORD para validar runtime.");

  return {
    SUPABASE_URL: supabaseUrl,
    SUPABASE_PUBLISHABLE_KEY: publishableKey,
    ENGINEER_SUPABASE_EMAIL: email,
    ENGINEER_SUPABASE_PASSWORD: password,
  };
}

function assertNoAbsolutePaths(value) {
  const forbidden = [/C:\\\\/i, /C:\//i, /Users\\julia/i, /OneDrive/i];
  for (const pattern of forbidden) {
    if (pattern.test(value)) throw new Error(`Ruta absoluta prohibida en manifest: ${pattern}`);
  }
}

function* walk(root) {
  for (const item of readdirSync(root, { withFileTypes: true })) {
    const fullPath = resolve(root, item.name);
    if (item.isDirectory()) {
      yield* walk(fullPath);
    } else {
      yield fullPath;
    }
  }
}
