import { commitImportPlan, type CommitCounts } from "../src/ingestion/persistence/supabase-commit";
import { loadImportDryRunPlan } from "../src/ingestion/persistence/dry-run";
import {
  checkSupabaseAdminEnv,
  createSupabaseAdminClient,
} from "../src/ingestion/persistence/supabase-admin";

interface CliArgs {
  plan?: string;
  companyId?: string;
  plantId?: string;
  ownerUserId?: string;
  chunkSize?: number;
}

const expectedCounts: CommitCounts = {
  customers: 5,
  products: 18,
  operations: 37,
  failure_modes: 319,
  controls: 19425,
  control_failures: 18672,
  import_issues: 771,
};

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  if (!args.plan || !args.companyId || !args.plantId || !args.ownerUserId) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const env = checkSupabaseAdminEnv();
  if (!env.NEXT_PUBLIC_SUPABASE_URL_PRESENT || !env.SUPABASE_SERVICE_ROLE_KEY_PRESENT) {
    console.log(JSON.stringify({ env, status: "blocked" }, null, 2));
    process.exitCode = 1;
    return;
  }

  const supabase = createSupabaseAdminClient();
  const plan = await loadImportDryRunPlan(args.plan);
  const result = await commitImportPlan({
    supabase,
    plan,
    companyId: args.companyId,
    plantId: args.plantId,
    ownerUserId: args.ownerUserId,
    expectedCounts,
    chunkSize: args.chunkSize,
  });

  console.log(JSON.stringify(result, null, 2));
  if (result.final_status !== "committed" || Object.keys(result.differences).length > 0) {
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
    if (key === "--plan") args.plan = value;
    if (key === "--company-id") args.companyId = value;
    if (key === "--plant-id") args.plantId = value;
    if (key === "--owner-user-id") args.ownerUserId = value;
    if (key === "--chunk-size") args.chunkSize = Number(value);
  }
  return args;
}

function printUsage(): void {
  console.error(
    [
      "Usage:",
      "npm.cmd exec tsx scripts/import-commit.ts -- \\",
      '  --plan "data/reports/romet/da-02a-dry-run/import-dry-run-plan.json" \\',
      '  --company-id "<ROMET_COMPANY_ID>" \\',
      '  --plant-id "<ROMET_PLANT_ID>" \\',
      '  --owner-user-id "<ROMET_OWNER_USER_ID>"',
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
