import { executeSemanticMappingPreview } from "../src/ingestion";

interface CliArgs {
  input?: string;
  selection?: string;
  mapping?: string;
  output?: string;
  maxRecords?: number;
  samples?: "none" | "masked" | "full";
  sources: string[];
  failOnValidationErrors?: boolean;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.selection || !args.mapping || !args.output) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const summary = await executeSemanticMappingPreview({
    inputFilePath: args.input,
    sourceSelectionPath: args.selection,
    semanticMappingPath: args.mapping,
    outputDirectory: args.output,
    maxRecords: args.maxRecords,
    sampleMode: args.samples ?? "masked",
    sourceIds: args.sources.length > 0 ? args.sources : undefined,
    failOnValidationErrors: args.failOnValidationErrors ?? true,
  });

  console.log(`Wrote ${summary.output_files.jsonl}`);
  console.log(`Wrote ${summary.output_files.summary_json}`);
  console.log(`Wrote ${summary.output_files.summary_md}`);
  console.log(`Records: ${Object.values(summary.counts_by_source_id).reduce((sum, count) => sum + count, 0)}`);
  console.log(`Status: ${JSON.stringify(summary.counts_by_status)}`);
}

function parseArgs(values: string[]): CliArgs {
  const args: CliArgs = { sources: [] };
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    const value = values[index + 1];
    if (key === "--no-fail-on-validation-errors") {
      args.failOnValidationErrors = false;
      continue;
    }
    if (!key.startsWith("--") || !value) continue;
    index += 1;
    if (key === "--input") args.input = value;
    if (key === "--selection") args.selection = value;
    if (key === "--mapping") args.mapping = value;
    if (key === "--output") args.output = value;
    if (key === "--max-records") args.maxRecords = Number(value);
    if (key === "--samples" && ["none", "masked", "full"].includes(value)) args.samples = value as CliArgs["samples"];
    if (key === "--source") args.sources.push(value);
  }
  return args;
}

function printUsage(): void {
  console.error(
    [
      "Usage:",
      "npm.cmd run ingestion:mapping:preview -- \\",
      '  --input "<archivo.xlsx>" \\',
      '  --selection "<source-selection.yaml>" \\',
      '  --mapping "<semantic-mapping.yaml>" \\',
      '  --output "<directorio>" \\',
      "  --samples masked",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
