# DA-04 Engineer MCP

## Scope

DA-04A creates deterministic, read-only Engineer analytical primitives under `lib/engineer`.
DA-04B exposes only those primitives through a local MCP stdio server for Claude Desktop.
DA-04C adds local Supabase user authentication and real-data smoke validation.
DA-05A adds controlled multidimensional analytics, period comparison and Pareto tools without enabling free SQL.

Architecture:

```text
Claude Desktop
-> local MCP stdio
-> Engineer primitives
-> DA-03/DA-05 RPC / scoped Supabase reads
-> Supabase JWT + RLS
```

No Anthropic API, local LLM, service role key, arbitrary SQL, arbitrary table access, writes, exports, or model-selected `company_id` are used.

## SDK

MCP TypeScript SDK: `@modelcontextprotocol/sdk@1.29.0`.

## Runtime Command

From the repository root:

```powershell
npm.cmd run mcp:engineer
```

Direct Windows command for Claude Desktop:

```powershell
& "<NODE_EXECUTABLE>" "<REPOSITORY_ROOT>\node_modules\tsx\dist\cli.mjs" "<REPOSITORY_ROOT>\mcp\engineer-server.ts"
```

The server loads `.env.local` from the repository root, regardless of Claude Desktop's current working directory:

```text
<REPOSITORY_ROOT>\.env.local
```

Required `.env.local` variables:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. `SUPABASE_URL` is also accepted. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable/anon key. `SUPABASE_PUBLISHABLE_KEY` is also accepted. |
| `ENGINEER_SUPABASE_EMAIL` | Pilot Supabase Auth user configured locally. |
| `ENGINEER_SUPABASE_PASSWORD` | Pilot Supabase Auth password. Never commit it. |

Authentication modes:

1. `ENGINEER_SUPABASE_ACCESS_TOKEN`, when present.
2. `ENGINEER_SUPABASE_EMAIL` plus `ENGINEER_SUPABASE_PASSWORD` as fallback.

Do not use `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `service_role`, or `sb_secret_*` keys. The MCP loader ignores `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` if they exist in `.env.local`.

## Registered Tools

| Tool | Primitive | Limits |
| --- | --- | --- |
| `get_quality_summary` | `getQualitySummary` | Full `historicalRange` by default. |
| `get_quality_ranking` | `getQualityRanking` | `limit <= 50`. |
| `get_quality_trend` | `getQualityTrend` | Full `historicalRange` by default; max 200 buckets after aggregation. |
| `search_quality_catalog` | `searchQualityCatalog` | `limit <= 50`; fixed entity allowlist. |
| `search_controls` | `searchControls` | DA-03 paginated RPC; `limit <= 200`. |
| `get_control_detail` | `getControlDetail` | One scoped control by id. |
| `analyze_quality` | `analyzeQuality` | Measures allowlist; max two dimensions; `limit <= 100`. |
| `compare_quality_periods` | `compareQualityPeriods` | Two explicit periods; optional one dimension; `limit <= 100`. |
| `get_quality_pareto` | `getQualityPareto` | `measure=defects`; threshold `0.5..0.95`; `limit <= 100`. |

DA-05 tools use `public.da_05_controlled_quality_analysis`. The RPC validates `company_members` with `auth.uid()`, uses fixed joins and allowlists for measures/dimensions, accepts filters as typed parameters, and never receives SQL, table names, column names, `company_id`, or `plant_id` from Claude.

DA-05 common response shape:

```json
{
  "context": {
    "company": { "id": "...", "name": "ROMET" },
    "plant": { "id": "...", "name": "Planta Principal" },
    "requested_date_range": { "date_from": null, "date_to": null },
    "applied_date_range": { "date_from": "2024-01-29", "date_to": "2026-07-01" },
    "historical_range": { "date_from": "2024-01-29", "date_to": "2026-07-01" },
    "filters_applied": {},
    "scope": "full_history"
  },
  "data": [],
  "metadata": {
    "generated_at": "...",
    "row_count": 0,
    "truncated": false,
    "measures": ["defects"],
    "group_by": []
  },
  "warnings": []
}
```

Do not ask Claude to generate SQL or download controls. For ROMET-wide historical KPIs, use `get_quality_summary` or `analyze_quality` without dates, not `search_controls`.

Registered resource:

```text
engineer://industrial-context/current
```

## Claude Desktop Configuration

Use `config/mcp/claude-desktop.engineer.example.json` as the template for Claude Desktop's `claude_desktop_config.json`. It contains no secrets; secrets stay in `.env.local`.

Typical Windows location:

```text
%APPDATA%\Claude\claude_desktop_config.json
```

JSON block:

```json
{
  "mcpServers": {
    "quality-ai-engineer": {
      "command": "<NODE_EXECUTABLE>",
      "args": [
        "<REPOSITORY_ROOT>\\node_modules\\tsx\\dist\\cli.mjs",
        "<REPOSITORY_ROOT>\\mcp\\engineer-server.ts"
      ]
    }
  }
}
```

Manual steps:

1. Open Claude Desktop.
2. Go to `Settings > Developer > Edit Config`.
3. Copy or merge the `quality-ai-engineer` block into `claude_desktop_config.json`.
4. Close Claude Desktop completely from the tray/taskbar.
5. Reopen Claude Desktop.
6. Verify that the nine tools appear: `get_quality_summary`, `get_quality_ranking`, `get_quality_trend`, `search_quality_catalog`, `search_controls`, `get_control_detail`, `analyze_quality`, `compare_quality_periods`, and `get_quality_pareto`.
7. Test with: `Usa Engineer para resumir la calidad historica de ROMET y listar los principales modos de falla.`
8. If it fails, inspect `%APPDATA%\Claude\logs\` and look for MCP log files containing `quality-ai-engineer`.

## MCP Inspector

Example commands:

```powershell
npx.cmd @modelcontextprotocol/inspector --cli "<NODE_EXECUTABLE>" "<REPOSITORY_ROOT>\node_modules\tsx\dist\cli.mjs" "<REPOSITORY_ROOT>\mcp\engineer-server.ts" --method tools/list
```

```powershell
npx.cmd @modelcontextprotocol/inspector --cli "<NODE_EXECUTABLE>" "<REPOSITORY_ROOT>\node_modules\tsx\dist\cli.mjs" "<REPOSITORY_ROOT>\mcp\engineer-server.ts" --method resources/list
```

The server reads `.env.local`; no PowerShell env inheritance is required. Invoke:

```powershell
npx.cmd @modelcontextprotocol/inspector --cli "<NODE_EXECUTABLE>" "<REPOSITORY_ROOT>\node_modules\tsx\dist\cli.mjs" "<REPOSITORY_ROOT>\mcp\engineer-server.ts" --method tools/call --tool-name get_quality_summary --tool-arg dateTo=2026-07-18
```

Repeat `tools/call` for:

- `get_quality_ranking` with `dimension=failure_mode`, `limit=50`.
- `get_quality_trend` with `interval=day`, `interval=week`, and `interval=month`; the date range is clamped to at most 200 days.
- `search_quality_catalog` with `query=pieza`, `limit=50`.
- `search_controls` with `limit=200`.
- `get_control_detail` with a real `controlId` returned by `search_controls`.
- `analyze_quality` with `measures=["defects","dpu"]`, `groupBy=["product","operation"]`, `limit=100`.
- `compare_quality_periods` with explicit period A and B, `measures=["defects","dpu"]`, `groupBy="product"`.
- `get_quality_pareto` with `dimension="failure_mode"`, `measure="defects"`, `threshold=0.8`, `limit=100`.

Read the resource:

```powershell
npx.cmd @modelcontextprotocol/inspector --cli "<NODE_EXECUTABLE>" "<REPOSITORY_ROOT>\node_modules\tsx\dist\cli.mjs" "<REPOSITORY_ROOT>\mcp\engineer-server.ts" --method resources/read --uri engineer://industrial-context/current
```

## Real Smoke Test

Run:

```powershell
npm.cmd run mcp:engineer:smoke
```

The smoke test:

- Starts the server through stdio using the same absolute command used by Claude Desktop.
- Uses `%TEMP%` as cwd to prove `.env.local` loading does not depend on cwd.
- Lists tools and resources.
- Reads `engineer://industrial-context/current`.
- Uses the historical range from the resource for real-data calls.
- Invokes all nine tools.
- Reconciles unfiltered `get_quality_summary` against DA-03 expected totals:
  - controls: `19425`
  - inspected quantity: `2225365`
  - defects: `257090`
  - DPU: `0.11552711577651306`
- Tests invalid credentials, missing variable, limit overflow, invalid UUID, and nonexistent control.
