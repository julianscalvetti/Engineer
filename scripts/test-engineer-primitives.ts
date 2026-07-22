import { analyzeQuality, clampLimit, compareQualityPeriods, getQualityPareto, resolveDateFilters } from "@/lib/engineer/analytics";
import type { EngineerClientContext } from "@/lib/engineer/types";

function assertEqual(actual: unknown, expected: unknown, message: string) {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`${message}\nExpected: ${expectedJson}\nActual:   ${actualJson}`);
  }
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

assertEqual(clampLimit(999, 50), 50, "ranking/catalog limit must clamp to 50");
assertEqual(clampLimit(0, 200), 1, "history limit must clamp to at least 1");

assertEqual(
  resolveDateFilters({ dateTo: "2026-07-18" }),
  {
    dateFrom: "2026-07-05",
    dateTo: "2026-07-18",
    customerId: "",
    productId: "",
    operationId: "",
    failureModeId: "",
  },
  "default date window must be the last 14 days",
);

assertEqual(
  resolveDateFilters({ dateFrom: "2025-01-01", dateTo: "2026-07-18" }, 200).dateFrom,
  "2025-12-31",
  "history windows must clamp to 200 days",
);

let rejectedInvalidOrder = false;
try {
  resolveDateFilters({ dateFrom: "2026-07-19", dateTo: "2026-07-18" });
} catch {
  rejectedInvalidOrder = true;
}
assert(rejectedInvalidOrder, "dateFrom after dateTo must be rejected");

const fakeContext = {} as EngineerClientContext;

async function assertPrimitiveError(label: string, callback: () => Promise<{ status: string; error: string }>) {
  const result = await callback();
  assert(result.status === "error", `${label} must return status=error`);
  assert(Boolean(result.error), `${label} must include an error message`);
}

void main().catch((error) => {
  throw error;
});

async function main() {
  await assertPrimitiveError("invalid measure", () =>
    analyzeQuality(fakeContext, { measures: ["invalid" as never] }),
  );

  await assertPrimitiveError("invalid dimension", () =>
    analyzeQuality(fakeContext, { measures: ["defects"], groupBy: ["invalid" as never] }),
  );

  await assertPrimitiveError("more than two dimensions", () =>
    analyzeQuality(fakeContext, { measures: ["defects"], groupBy: ["customer", "product", "operation"] }),
  );

  await assertPrimitiveError("duplicated dimension", () =>
    analyzeQuality(fakeContext, { measures: ["defects"], groupBy: ["product", "product"] }),
  );

  await assertPrimitiveError("analysis limit over 100", () =>
    analyzeQuality(fakeContext, { measures: ["defects"], limit: 101 }),
  );

  await assertPrimitiveError("invalid date", () =>
    analyzeQuality(fakeContext, { measures: ["defects"], filters: { dateFrom: "2026-99-99" } }),
  );

  await assertPrimitiveError("invalid uuid", () =>
    analyzeQuality(fakeContext, { measures: ["defects"], filters: { productIds: ["not-a-uuid"] } }),
  );

  await assertPrimitiveError("compare invalid period order", () =>
    compareQualityPeriods(fakeContext, {
      periodA: { dateFrom: "2026-01-02", dateTo: "2026-01-01" },
      periodB: { dateFrom: "2026-01-01", dateTo: "2026-01-02" },
      measures: ["defects"],
    }),
  );

  await assertPrimitiveError("pareto invalid threshold", () =>
    getQualityPareto(fakeContext, { dimension: "failure_mode", measure: "defects", threshold: 0.99 }),
  );

  console.log("Engineer primitive boundary tests passed.");
}
