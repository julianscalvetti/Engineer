import { executeImportDryRun } from "../src/ingestion/persistence/dry-run";

interface CliArgs {
  previewJsonl?: string;
  previewSummary?: string;
  output?: string;
  companyId?: string;
  plantId?: string;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.previewJsonl || !args.previewSummary || !args.output) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const summary = await executeImportDryRun({
    previewJsonlPath: args.previewJsonl,
    previewSummaryPath: args.previewSummary,
    outputDirectory: args.output,
    companyId: args.companyId,
    plantId: args.plantId,
  });

  console.log(`Wrote ${summary.output_files.plan_json}`);
  console.log(`Wrote ${summary.output_files.summary_json}`);
  console.log(`Wrote ${summary.output_files.summary_md}`);
  console.log(`Commit allowed: ${summary.commit_allowed}`);
  console.log(`Preview status: ${JSON.stringify(summary.preview_counts.by_status)}`);
  console.log(`Dry-run entities: ${JSON.stringify(summary.dry_run_counts.by_entity)}`);
  console.log(`Import issues: ${summary.dry_run_counts.import_issues}`);
}

function parseArgs(values: string[]): CliArgs {
  const args: CliArgs = {};
  for (let index = 0; index < values.length; index += 1) {
    const key = values[index];
    const value = values[index + 1];
    if (!key.startsWith("--") || !value) continue;
    index += 1;
    if (key === "--preview-jsonl") args.previewJsonl = value;
    if (key === "--preview-summary") args.previewSummary = value;
    if (key === "--output") args.output = value;
    if (key === "--company-id") args.companyId = value;
    if (key === "--plant-id") args.plantId = value;
  }
  return args;
}

function printUsage(): void {
  console.error(
    [
      "Usage:",
      "npm.cmd exec tsx scripts/import-dry-run.ts -- \\",
      '  --preview-jsonl "data/reports/example/mapping-preview/mapping-preview.jsonl" \\',
      '  --preview-summary "data/reports/example/mapping-preview/mapping-preview-summary.json" \\',
      '  --output "data/reports/example/import-dry-run"',
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
