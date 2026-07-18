import path from "node:path";

import { validateSemanticMapping, writeMappingValidationReport } from "../src/ingestion";

interface CliArgs {
  input?: string;
  selection?: string;
  mapping?: string;
  profile?: string;
  output?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.input || !args.selection || !args.mapping || !args.output) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const report = await validateSemanticMapping({
    inputPath: args.input,
    sourceSelectionPath: args.selection,
    mappingPath: args.mapping,
    profilePath: args.profile,
    outputDir: args.output,
  });
  const artifacts = await writeMappingValidationReport(report, path.resolve(args.output));

  console.log(`Wrote ${artifacts.jsonPath}`);
  console.log(`Wrote ${artifacts.markdownPath}`);
  console.log(`Errors: ${report.errors.length}`);
  console.log(`Warnings: ${report.warnings.length}`);
  console.log(`Informational: ${report.informational.length}`);

  if (report.errors.length > 0) {
    process.exitCode = 1;
  }
}

function parseArgs(values: string[]): CliArgs {
  const args: CliArgs = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    const value = values[index + 1];
    if (!key.startsWith("--") || !value) continue;
    index += 1;
    if (key === "--input") args.input = value;
    if (key === "--selection") args.selection = value;
    if (key === "--mapping") args.mapping = value;
    if (key === "--profile") args.profile = value;
    if (key === "--output") args.output = value;
  }
  return args;
}

function printUsage(): void {
  console.error(
    [
      "Usage:",
      "npm.cmd run ingestion:mapping:validate -- \\",
      '  --input "<archivo.xlsx>" \\',
      '  --selection "<source-selection.yaml>" \\',
      '  --mapping "<semantic-mapping.yaml>" \\',
      '  --profile "<source-profile.json>" \\',
      '  --output "<directorio>"',
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
