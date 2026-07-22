import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "node_modules/**",
    "archive/**",
    "data/raw/**",
    "data/reports/**",
    "design/references/template-v0/**",
    "mcp/bundle/server/**",
    "dist/**",
    "tsconfig.tsbuildinfo",
  ]),
]);
