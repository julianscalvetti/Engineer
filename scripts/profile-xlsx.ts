import { existsSync } from "node:fs";
import { mkdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import { profileXlsxFile } from "../src/ingestion";
import type { ProfilingOptions, SamplePolicy, SourceProfilingConfig } from "../src/ingestion";

interface CliArgs {
  input?: string;
  output?: string;
  samples?: SamplePolicy;
  config?: string;
  selectionOutput?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  if (!args.input || !args.output) {
    throw new Error(
      "Usage: npm run ingestion:profile -- --input <file.xlsx> --output <output-dir> [--config <source.yaml>] [--samples none|masked|full] [--selection-output <manifest.yaml>]",
    );
  }

  const inputPath = path.resolve(args.input);
  const outputDir = path.resolve(args.output);
  const configPath = args.config ? path.resolve(args.config) : undefined;
  const selectionOutputPath = args.selectionOutput ? path.resolve(args.selectionOutput) : undefined;

  if (!existsSync(inputPath)) {
    throw new Error(`Input file does not exist: ${inputPath}`);
  }

  const inputStat = await stat(inputPath);

  if (!inputStat.isFile()) {
    throw new Error(`Input path is not a file: ${inputPath}`);
  }

  if (path.extname(inputPath).toLowerCase() !== ".xlsx") {
    throw new Error("Only .xlsx files are supported by this local profiler CLI.");
  }

  await mkdir(outputDir, { recursive: true });
  const configOptions = configPath ? await loadProfilingOptionsFromConfig(configPath) : {};

  const report = await profileXlsxFile(inputPath, outputDir, {
    ...configOptions,
    relativePathRoot: process.cwd(),
    samplePolicy: args.samples ?? configOptions.samplePolicy ?? "masked",
    selectionOutputPath,
  });

  const totalRows = report.profile.sheets.reduce((sum, sheet) => sum + sheet.rowCount, 0);
  const totalIssues = report.profile.issues.length + report.profile.sheets.reduce(
    (sum, sheet) =>
      sum +
      sheet.issues.length +
      sheet.columns.reduce((columnSum, column) => columnSum + column.issues.length, 0),
    0,
  );

  console.log("Technical profile generated");
  console.log(`File: ${report.profile.sourceFile.originalFilename}`);
  console.log(`Sheets: ${report.profile.sheets.length}`);
  console.log(`Total rows: ${totalRows}`);
  console.log(`Total issues: ${totalIssues}`);
  console.log(`Sample policy: ${report.profile.samplePolicy}`);
  console.log(`JSON: ${report.jsonArtifactPath}`);
  console.log(`Markdown: ${report.markdownArtifactPath}`);
  console.log(`Selection manifest: ${report.selectionManifestPath}`);
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === "--input") {
      args.input = readOptionValue(current, next);
      index += 1;
      continue;
    }

    if (current === "--output") {
      args.output = readOptionValue(current, next);
      index += 1;
      continue;
    }

    if (current === "--samples") {
      args.samples = parseSamplePolicy(readOptionValue(current, next));
      index += 1;
      continue;
    }

    if (current === "--config") {
      args.config = readOptionValue(current, next);
      index += 1;
      continue;
    }

    if (current === "--selection-output") {
      args.selectionOutput = readOptionValue(current, next);
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return args;
}

async function loadProfilingOptionsFromConfig(configPath: string): Promise<ProfilingOptions> {
  const config = parseYaml(await readFile(configPath, "utf8")) as SourceProfilingConfig | undefined;
  if (!config) return {};

  if (config.source?.format && config.source.format !== "xlsx") {
    throw new Error(`Only xlsx source configs are supported by this profiler. Received: ${config.source.format}`);
  }

  if ((config.profiling as { execute_macros?: boolean } | undefined)?.execute_macros === true) {
    throw new Error("execute_macros must be false. The Technical Profiler never executes macros or embedded code.");
  }

  return {
    companyId: config.source?.company_key,
    sampleValuesLimit: config.profiling?.sample_values_limit,
    samplePolicy: config.profiling?.sample_policy,
    scanRowsLimit: config.profiling?.scan_rows_limit,
    calculateSha256: config.profiling?.calculate_sha256,
    inspectFormulas: config.profiling?.inspect_formulas,
    catalogMaxUniqueValues: config.profiling?.catalog_max_unique_values,
    catalogMaxUniquenessRatio: config.profiling?.catalog_max_uniqueness_ratio,
    sheets: Object.fromEntries(
      (config.source?.sheets ?? []).map((sheet) => [sheet.name, { headerRow: sheet.header_row }]),
    ),
  };
}

function readOptionValue(option: string, value: string | undefined): string {
  if (!value || value.startsWith("--")) {
    throw new Error(`Missing value for ${option}`);
  }

  return value;
}

function parseSamplePolicy(value: string): SamplePolicy {
  if (value === "none" || value === "masked" || value === "full") {
    return value;
  }

  throw new Error("Invalid --samples value. Expected one of: none, masked, full");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown profiler CLI error";
  console.error(`Error: ${message}`);
  process.exitCode = 1;
});
