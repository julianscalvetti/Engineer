import { rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bundleRoot = resolve(repoRoot, "mcp/bundle");
const serverDir = resolve(bundleRoot, "server");
const outputFile = resolve(serverDir, "index.js");
const esbuildBin = resolve(repoRoot, "node_modules/esbuild/bin/esbuild");

rmSync(serverDir, { recursive: true, force: true });

const result = spawnSync(
  process.execPath,
  [
    esbuildBin,
    "mcp/engineer-server.ts",
    "--bundle",
    "--platform=node",
    "--format=esm",
    "--target=node20.6",
    "--packages=bundle",
    `--outfile=${outputFile}`,
    "--log-level=info",
  ],
  {
    cwd: repoRoot,
    stdio: "inherit",
    shell: false,
  },
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
