import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { stringify } from "yaml";

import {
  applyRegexReplace,
  executeSemanticMappingPreview,
  evaluateResolverPipeline,
  resolveLongestCatalogPrefix,
  resolveScopedCatalogLookup,
  validateSemanticMapping,
} from "../src/ingestion";
import { executeImportDryRun } from "../src/ingestion/persistence/dry-run";

interface FixtureField {
  source_column?: string;
  semantic_field: string;
  data_type: string;
  required: boolean;
  treatment: string;
  transformations: string[];
  preserve_raw_value: boolean;
  lookup?: Record<string, unknown>;
}

interface FixtureSource {
  id: string;
  layout: string;
  sheet: string;
  header_row: number;
  data_range: string;
  fields?: FixtureField[];
  column_header?: Omit<FixtureField, "source_column">;
  cell_value?: Omit<FixtureField, "source_column">;
  depends_on?: string[];
  resolver?: {
    type: string;
    catalog_source: string;
    catalog_field: string;
    remainder_field: string;
  } | Record<string, unknown>;
  semantic_review_values?: string[];
}

async function main(): Promise<void> {
  await testValidRowTableMapping();
  await testValidWideColumnsMapping();
  await testMissingColumn();
  await testUnsupportedLayout();
  await testUnsupportedTransformation();
  await testMissingCatalogReference();
  await testCircularDependency();
  await testFullRangeCoverage();
  await testRangeOmittingPopulatedColumns();
  await testRangeOmittingPopulatedRows();
  await testCorrectHeaderPlausibility();
  await testDataRowUsedAsHeader();
  await testAdjacentRowMorePlausible();
  await testWideLayoutHighCatalogMatch();
  await testWideLayoutLowCatalogMatch();
  testValidThreeStepPipeline();
  testPrefixThenRegexReplace();
  testScopedLookupResolved();
  testScopedLookupAmbiguous();
  testScopedLookupUnresolved();
  testSameValueInTwoDifferentScopes();
  testLookupWithoutScope();
  await testLookupScopeFieldMissing();
  await testLookupCatalogMissing();
  await testPipelineOutputConflict();
  await testInvalidRegexReplace();
  await testLookupDependencyCycle();
  await testLookupUnresolvedPolicy();
  await testSecondCompanyPipelineConfiguration();
  await testPreviewRowTableAndJsonl();
  await testPreviewWidePipelineAndTraceability();
  await testPreviewSecondCompany();
  await testLookupValueOverridesForRometIndustrialDecisions();
  await testMeasurementModelWithSyntheticIndustry();
  await testDuplicateHeaderColumnSelectors();
  testLongestCatalogPrefixResolved();
  testLongestCatalogPrefixAmbiguous();
  testLongestCatalogPrefixUnresolved();
  await testSecondCompanyConfiguration();
  console.log("Semantic mapping tests passed");
}

async function testValidRowTableMapping(): Promise<void> {
  const fixture = await createFixture();
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [productsSource()] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.deepEqual(report.errors, []);
  assert.equal(report.sources[0].layout, "row_table");
}

async function testValidWideColumnsMapping(): Promise<void> {
  const fixture = await createFixture();
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [productsSource(), operationsSource()] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.deepEqual(report.errors, []);
  assert.equal(report.sources[1].layout, "wide_columns_to_rows");
}

async function testMissingColumn(): Promise<void> {
  const fixture = await createFixture();
  const source = productsSource();
  source.fields![0].source_column = "Missing";
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.errors.some((error) => error.code === "SOURCE_COLUMN_NOT_FOUND"));
}

async function testUnsupportedLayout(): Promise<void> {
  const fixture = await createFixture();
  const source = { ...productsSource(), layout: "unsupported_layout" };
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.errors.some((error) => error.code === "UNSUPPORTED_SOURCE_LAYOUT"));
}

async function testUnsupportedTransformation(): Promise<void> {
  const fixture = await createFixture();
  const source = productsSource();
  source.fields![0].transformations = ["custom_code"];
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.errors.some((error) => error.code === "UNSUPPORTED_TRANSFORMATION"));
}

async function testMissingCatalogReference(): Promise<void> {
  const fixture = await createFixture();
  const source = failureModesSource();
  source.resolver!.catalog_source = "missing_catalog";
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.errors.some((error) => error.code === "CATALOG_SOURCE_NOT_FOUND"));
}

async function testCircularDependency(): Promise<void> {
  const fixture = await createFixture();
  const productSource = productsSource();
  productSource.depends_on = ["operations"];
  const operationSource = operationsSource();
  operationSource.depends_on = ["products"];
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [productSource, operationSource] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.errors.some((error) => error.code === "CIRCULAR_SOURCE_DEPENDENCY"));
}

async function testFullRangeCoverage(): Promise<void> {
  const fixture = await createCustomWorkbook("full-coverage", async (workbook) => {
    const sheet = workbook.addWorksheet("Table");
    sheet.addRow(["Code", "Name"]);
    sheet.addRow(["A1", "Item"]);
  }, selectionYamlFrom([{ name: "Table", range: "A1:B2", headerRow: 1 }]));
  const mappingPath = await writeMapping(
    fixture.dir,
    buildMapping({ sources: [productsSource({ sheet: "Table", nameColumn: "Name" })] }),
  );
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.equal(report.sources[0].columnCoverageRatio, 1);
  assert.equal(report.sources[0].rowCoverageRatio, 1);
}

async function testRangeOmittingPopulatedColumns(): Promise<void> {
  const fixture = await createCustomWorkbook("omit-columns", async (workbook) => {
    const sheet = workbook.addWorksheet("Wide");
    sheet.addRow(["P1", "P2", "P3", "P4"]);
    sheet.addRow(["Op1", "Op2", "Op3", "Op4"]);
  }, selectionYamlFrom([{ name: "Wide", range: "A1:B2", headerRow: 1 }]));
  const source = operationsSource();
  source.sheet = "Wide";
  source.data_range = "A1:B2";
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.warnings.some((error) => error.code === "LOW_SELECTED_COLUMN_COVERAGE"));
  assert.ok(report.warnings.some((error) => error.code === "POPULATED_DATA_OUTSIDE_SELECTED_RANGE"));
}

async function testRangeOmittingPopulatedRows(): Promise<void> {
  const fixture = await createCustomWorkbook("omit-rows", async (workbook) => {
    const sheet = workbook.addWorksheet("Table");
    sheet.addRow(["Code", "Name"]);
    sheet.addRow(["A1", "Item"]);
    sheet.addRow(["A2", "Other"]);
  }, selectionYamlFrom([{ name: "Table", range: "A1:B2", headerRow: 1 }]));
  const source = productsSource({ sheet: "Table", nameColumn: "Name" });
  source.data_range = "A1:B2";
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.warnings.some((error) => error.code === "LOW_SELECTED_ROW_COVERAGE"));
  assert.ok(report.warnings.some((error) => error.code === "POPULATED_DATA_OUTSIDE_SELECTED_RANGE"));
}

async function testCorrectHeaderPlausibility(): Promise<void> {
  const fixture = await createFixture();
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [productsSource()] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.sources[0].headerPlausibilityScore >= 0.8);
}

async function testDataRowUsedAsHeader(): Promise<void> {
  const fixture = await createCustomWorkbook("data-row-header", async (workbook) => {
    const sheet = workbook.addWorksheet("Table");
    sheet.addRow(["Code", "Name"]);
    sheet.addRow(["A1", "Item"]);
  }, selectionYamlFrom([{ name: "Table", range: "A1:B2", headerRow: 2 }]));
  const source = productsSource({ sheet: "Table", nameColumn: "Name" });
  source.header_row = 2;
  source.data_range = "A1:B2";
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.warnings.some((error) => error.code === "LOW_HEADER_PLAUSIBILITY"));
}

async function testAdjacentRowMorePlausible(): Promise<void> {
  const fixture = await createCustomWorkbook("adjacent-header", async (workbook) => {
    const sheet = workbook.addWorksheet("Table");
    sheet.addRow(["Code", "Name"]);
    sheet.addRow(["A1", "Item"]);
  }, selectionYamlFrom([{ name: "Table", range: "A1:B2", headerRow: 2 }]));
  const source = productsSource({ sheet: "Table", nameColumn: "Name" });
  source.header_row = 2;
  source.data_range = "A1:B2";
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.warnings.some((error) => error.code === "ADJACENT_ROW_MORE_PLAUSIBLE"));
}

async function testWideLayoutHighCatalogMatch(): Promise<void> {
  const fixture = await createFixture();
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [productsSource(), operationsSource()] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.equal(report.sources[1].catalogHeaderMatchRatio, 1);
}

async function testWideLayoutLowCatalogMatch(): Promise<void> {
  const fixture = await createCustomWorkbook("low-catalog", async (workbook) => {
    const products = workbook.addWorksheet("Products");
    products.addRow(["Code", "Name"]);
    products.addRow(["P100", "Part"]);
    const operations = workbook.addWorksheet("Operations");
    operations.addRow(["X100", "Y200"]);
    operations.addRow(["Op1", "Op2"]);
  }, selectionYamlFrom([
    { name: "Products", range: "A1:B2", headerRow: 1 },
    { name: "Operations", range: "A1:B2", headerRow: 1 },
  ]));
  const productSource = productsSource({ nameColumn: "Name" });
  productSource.data_range = "A1:B2";
  const operationSource = operationsSource();
  operationSource.data_range = "A1:B2";
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [productSource, operationSource] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.equal(report.sources[1].catalogHeaderMatchRatio, 0);
  assert.ok(report.warnings.some((error) => error.code === "LOW_CATALOG_HEADER_MATCH"));
}

function testValidThreeStepPipeline(): void {
  const result = evaluateResolverPipeline({
    resolver: {
      type: "pipeline",
      steps: [
        {
          type: "longest_catalog_prefix",
          input_field: "source.header",
          catalog_source: "items",
          catalog_field: "item.code",
          output_field: "item.code",
          remainder_output_field: "remaining",
        },
        {
          type: "transform_value",
          input_field: "remaining",
          output_field: "clean_remaining",
          transformations: [{ type: "regex_replace", pattern: "^-+", replacement: "" }],
        },
        {
          type: "scoped_catalog_lookup",
          input_field: "clean_remaining",
          catalog_source: "steps",
          catalog_match_field: "step.code",
          output_field: "step.code",
          scope: [{ catalog_field: "item.code", value_field: "item.code" }],
        },
      ],
    },
    initialValues: { "source.header": "A-10" },
    catalogs: new Map([
      ["items", [{ "item.code": "A" }]],
      ["steps", [{ "item.code": "A", "step.code": "10" }]],
    ]),
  });
  assert.equal(result.status, "resolved");
  assert.equal(result.values["item.code"], "A");
  assert.equal(result.values["step.code"], "10");
}

function testPrefixThenRegexReplace(): void {
  const result = evaluateResolverPipeline({
    resolver: {
      type: "pipeline",
      steps: [
        {
          type: "longest_catalog_prefix",
          input_field: "source.header",
          catalog_source: "families",
          catalog_field: "family.code",
          output_field: "family.code",
          remainder_output_field: "tail",
        },
        {
          type: "transform_value",
          input_field: "tail",
          output_field: "clean_tail",
          transformations: [{ type: "regex_replace", pattern: "^_+", replacement: "" }],
        },
      ],
    },
    initialValues: { "source.header": "FAM_ABC" },
    catalogs: new Map([["families", [{ "family.code": "FAM" }]]]),
  });
  assert.equal(result.values.clean_tail, "ABC");
  assert.equal(applyRegexReplace("__ABC", "^_+", ""), "ABC");
}

function testScopedLookupResolved(): void {
  const result = resolveScopedCatalogLookup(
    {
      type: "scoped_catalog_lookup",
      input_field: "task.code",
      catalog_source: "tasks",
      catalog_match_field: "task.code",
      output_field: "task.id",
      scope: [{ catalog_field: "line.code", value_field: "line.code" }],
    },
    { "task.code": "CUT", "line.code": "L1" },
    [{ "task.code": "CUT", "line.code": "L1", "task.id": "1" }],
  );
  assert.equal(result.status, "resolved");
}

function testScopedLookupAmbiguous(): void {
  const result = resolveScopedCatalogLookup(
    {
      type: "scoped_catalog_lookup",
      input_field: "task.code",
      catalog_source: "tasks",
      catalog_match_field: "task.code",
      output_field: "task.id",
      scope: [{ catalog_field: "line.code", value_field: "line.code" }],
    },
    { "task.code": "CUT", "line.code": "L1" },
    [
      { "task.code": "CUT", "line.code": "L1", "task.id": "1" },
      { "task.code": "CUT", "line.code": "L1", "task.id": "2" },
    ],
  );
  assert.equal(result.status, "ambiguous");
}

function testScopedLookupUnresolved(): void {
  const result = resolveScopedCatalogLookup(
    {
      type: "scoped_catalog_lookup",
      input_field: "task.code",
      catalog_source: "tasks",
      catalog_match_field: "task.code",
      output_field: "task.id",
      scope: [{ catalog_field: "line.code", value_field: "line.code" }],
    },
    { "task.code": "DRILL", "line.code": "L1" },
    [{ "task.code": "CUT", "line.code": "L1", "task.id": "1" }],
  );
  assert.equal(result.status, "unresolved");
}

function testSameValueInTwoDifferentScopes(): void {
  const result = resolveScopedCatalogLookup(
    {
      type: "scoped_catalog_lookup",
      input_field: "task.code",
      catalog_source: "tasks",
      catalog_match_field: "task.code",
      output_field: "task.id",
      scope: [{ catalog_field: "line.code", value_field: "line.code" }],
    },
    { "task.code": "CUT", "line.code": "L2" },
    [
      { "task.code": "CUT", "line.code": "L1", "task.id": "1" },
      { "task.code": "CUT", "line.code": "L2", "task.id": "2" },
    ],
  );
  assert.equal(result.status, "resolved");
  assert.equal(result.resolved, "2");
}

function testLookupWithoutScope(): void {
  const result = resolveScopedCatalogLookup(
    {
      type: "scoped_catalog_lookup",
      input_field: "item.code",
      catalog_source: "items",
      catalog_match_field: "item.code",
      output_field: "item.code",
    },
    { "item.code": "A" },
    [{ "item.code": "A" }],
  );
  assert.equal(result.status, "resolved");
}

async function testLookupScopeFieldMissing(): Promise<void> {
  const fixture = await createFixture();
  const source = productsSource();
  source.fields![0].lookup = {
    catalog_source: "products",
    catalog_match_field: "product.external_code",
    input_field: "product.external_code",
    scope: [{ catalog_field: "missing.scope", value_field: "missing.scope" }],
  };
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.errors.some((error) => error.code === "LOOKUP_SCOPE_FIELD_NOT_FOUND"));
}

async function testLookupCatalogMissing(): Promise<void> {
  const fixture = await createFixture();
  const source = productsSource();
  source.fields![0].lookup = {
    catalog_source: "missing",
    catalog_match_field: "product.external_code",
    input_field: "product.external_code",
  };
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.errors.some((error) => error.code === "LOOKUP_CATALOG_NOT_FOUND"));
}

async function testPipelineOutputConflict(): Promise<void> {
  const fixture = await createFixture();
  const source = failureModesSource();
  source.resolver = {
    type: "pipeline",
    steps: [
      {
        type: "longest_catalog_prefix",
        input_field: "source_composite_header",
        catalog_source: "products",
        catalog_field: "product.external_code",
        output_field: "dup",
        remainder_output_field: "tail",
      },
      {
        type: "transform_value",
        input_field: "tail",
        output_field: "dup",
        transformations: [{ type: "regex_replace", pattern: "^_", replacement: "" }],
      },
    ],
  };
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [productsSource(), source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.errors.some((error) => error.code === "RESOLVER_OUTPUT_CONFLICT"));
}

async function testInvalidRegexReplace(): Promise<void> {
  const fixture = await createFixture();
  const source = failureModesSource();
  source.resolver = {
    type: "pipeline",
    steps: [
      {
        type: "transform_value",
        input_field: "source_composite_header",
        output_field: "clean",
        transformations: [{ type: "regex_replace", pattern: "(", replacement: "" }],
      },
    ],
  };
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.errors.some((error) => error.code === "INVALID_REGEX_REPLACE"));
}

async function testLookupDependencyCycle(): Promise<void> {
  const fixture = await createFixture();
  const first = productsSource();
  const second = operationsSource();
  first.fields![0].lookup = {
    catalog_source: "operations",
    catalog_match_field: "operation.raw_name",
    input_field: "product.external_code",
  };
  second.depends_on = ["products"];
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [first, second] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.ok(report.errors.some((error) => error.code === "CIRCULAR_SOURCE_DEPENDENCY"));
}

async function testLookupUnresolvedPolicy(): Promise<void> {
  const fixture = await createFixture();
  const source = productsSource();
  source.fields![0].lookup = {
    catalog_source: "products",
    catalog_match_field: "product.external_code",
    input_field: "product.external_code",
    on_unresolved: "warning",
    on_ambiguous: "rejected",
    preserve_input_value: true,
  };
  const mappingPath = await writeMapping(fixture.dir, buildMapping({ sources: [source] }));
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.equal(report.lookups[0].onUnresolved, "warning");
}

async function testSecondCompanyPipelineConfiguration(): Promise<void> {
  const fixture = await createCustomWorkbook("zephyr", async (workbook) => {
    const assets = workbook.addWorksheet("Assets");
    assets.addRow(["Asset", "Label"]);
    assets.addRow(["AX", "Press"]);
    const stages = workbook.addWorksheet("Stages");
    stages.addRow(["AX"]);
    stages.addRow(["S1"]);
    const reasons = workbook.addWorksheet("Reasons");
    reasons.addRow(["AX-S1"]);
    reasons.addRow(["Jam"]);
  }, selectionYamlFrom([
    { name: "Assets", range: "A1:B2", headerRow: 1 },
    { name: "Stages", range: "A1:A2", headerRow: 1 },
    { name: "Reasons", range: "A1:A2", headerRow: 1 },
  ]));

  const assetSource: FixtureSource = {
    id: "asset_catalog",
    layout: "row_table",
    sheet: "Assets",
    header_row: 1,
    data_range: "A1:B2",
    fields: [field("Asset", "asset.code", ["trim", "preserve_string"])],
  };
  const stageSource: FixtureSource = {
    id: "stage_catalog",
    layout: "wide_columns_to_rows",
    sheet: "Stages",
    header_row: 1,
    data_range: "A1:A2",
    depends_on: ["asset_catalog"],
    column_header: wideField("asset.code"),
    cell_value: wideField("stage.code"),
  };
  const reasonSource: FixtureSource = {
    id: "reason_catalog",
    layout: "wide_columns_to_rows",
    sheet: "Reasons",
    header_row: 1,
    data_range: "A1:A2",
    depends_on: ["asset_catalog", "stage_catalog"],
    column_header: wideField("source.header"),
    cell_value: wideField("reason.name"),
    resolver: {
      type: "pipeline",
      steps: [
        {
          type: "longest_catalog_prefix",
          input_field: "source.header",
          catalog_source: "asset_catalog",
          catalog_field: "asset.code",
          output_field: "asset.code",
          remainder_output_field: "tail",
        },
        {
          type: "transform_value",
          input_field: "tail",
          output_field: "clean_tail",
          transformations: [{ type: "regex_replace", pattern: "^-+", replacement: "" }],
        },
        {
          type: "scoped_catalog_lookup",
          input_field: "clean_tail",
          catalog_source: "stage_catalog",
          catalog_match_field: "stage.code",
          output_field: "stage.code",
          scope: [{ catalog_field: "asset.code", value_field: "asset.code" }],
        },
      ],
    },
  };

  const mappingPath = await writeMapping(
    fixture.dir,
    buildMapping({
      mappingId: "zephyr-semantic-mapping-v1",
      companyContext: "ZEPHYR",
      sources: [assetSource, stageSource, reasonSource],
    }),
  );
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.deepEqual(report.errors, []);
  assert.equal(report.resolverTests[0].resolved, 1);
}

async function testPreviewRowTableAndJsonl(): Promise<void> {
  const fixture = await createPreviewFixture("preview-row");
  const outputDir = path.join(fixture.dir, "preview");
  const summary = await executeSemanticMappingPreview({
    inputFilePath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    semanticMappingPath: fixture.mappingPath,
    outputDirectory: outputDir,
    maxRecords: 3,
  });
  assert.equal(summary.sources.find((source) => source.source_id === "items")?.generated_records, 2);
  assert.equal(summary.sources.find((source) => source.source_id === "events")?.generated_records, 3);
  assert.ok(summary.counts_by_issue.INVALID_INTEGER >= 1);
  assert.ok(summary.counts_by_issue.INVALID_DATE >= 1);
  assert.ok(summary.counts_by_issue.SEMANTIC_REVIEW_VALUE >= 1);
  assert.ok(summary.counts_by_issue.LOOKUP_SCOPE_UNAVAILABLE >= 1);
  assert.equal(summary.sources.find((source) => source.source_id === "events")?.truncated, true);

  const jsonl = await import("node:fs/promises").then((fs) => fs.readFile(summary.output_files.jsonl, "utf8"));
  const records = jsonl.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(records[0].source_id, "items");
  assert.ok(records.every((record) => record.source_locator.sheet_name));
  assert.ok(records.some((record) => record.preserved_values["ignored:derived.ignore"] !== undefined));
  assert.ok(records.some((record) => record.status === "rejected"));
}

async function testPreviewWidePipelineAndTraceability(): Promise<void> {
  const fixture = await createPreviewFixture("preview-wide");
  const summary = await executeSemanticMappingPreview({
    inputFilePath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    semanticMappingPath: fixture.mappingPath,
    outputDirectory: path.join(fixture.dir, "preview-wide-output"),
    sourceIds: ["items", "steps", "reasons"],
  });
  const reasonStats = summary.sources.find((source) => source.source_id === "reasons");
  assert.equal(reasonStats?.generated_records, 2);
  assert.equal(summary.resolver_results.resolved, 4);
  const jsonl = await import("node:fs/promises").then((fs) => fs.readFile(summary.output_files.jsonl, "utf8"));
  const records = jsonl.trim().split("\n").map((line) => JSON.parse(line));
  const wideRecord = records.find((record) => record.source_id === "reasons");
  assert.ok(wideRecord.source_locator.cell_address);
  assert.ok(wideRecord.resolutions.length > 0);
}

async function testPreviewSecondCompany(): Promise<void> {
  const fixture = await createCustomWorkbook("preview-zephyr", async (workbook) => {
    const catalog = workbook.addWorksheet("Catalog");
    catalog.addRow(["Asset", "Name"]);
    catalog.addRow(["Z1", "Station"]);
    const checks = workbook.addWorksheet("Checks");
    checks.addRow(["Asset", "Qty"]);
    checks.addRow(["Z1", "4"]);
  }, selectionYamlFrom([
    { name: "Catalog", range: "A1:B2", headerRow: 1 },
    { name: "Checks", range: "A1:B2", headerRow: 1 },
  ]));
  const mappingPath = await writeMapping(
    fixture.dir,
    buildMapping({
      mappingId: "preview-zephyr-v1",
      companyContext: "ZEPHYR",
      sources: [
        {
          id: "asset_catalog",
          layout: "row_table",
          sheet: "Catalog",
          header_row: 1,
          data_range: "A1:B2",
          fields: [field("Asset", "asset.code", ["trim", "preserve_string"])],
        },
        {
          id: "checks",
          layout: "row_table",
          sheet: "Checks",
          header_row: 1,
          data_range: "A1:B2",
          depends_on: ["asset_catalog"],
          fields: [
            {
              ...field("Asset", "asset.code", ["trim", "preserve_string"]),
              treatment: "lookup",
              lookup: {
                catalog_source: "asset_catalog",
                catalog_match_field: "asset.code",
                input_field: "asset.code",
                on_unresolved: "pending_review",
                on_ambiguous: "rejected",
              },
            },
            { ...field("Qty", "check.quantity", ["trim", "parse_integer"]), data_type: "integer" },
          ],
        },
      ],
    }),
  );
  const summary = await executeSemanticMappingPreview({
    inputFilePath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    semanticMappingPath: mappingPath,
    outputDirectory: path.join(fixture.dir, "preview"),
  });
  assert.equal(summary.counts_by_status.valid, 2);
}

async function testLookupValueOverridesForRometIndustrialDecisions(): Promise<void> {
  const fixture = await createCustomWorkbook("romet-industrial-overrides", async (workbook) => {
    const products = workbook.addWorksheet("Products");
    products.addRow(["Code", "Name"]);
    products.addRow(["_A9076804902", "Sprinter"]);
    products.addRow(["_MB3B_2104545_EG", "Ranger"]);
    products.addRow(["_OTHER_SCOPE", "Other"]);

    const operations = workbook.addWorksheet("Operations");
    operations.addRow(["Product", "Operation", "OperationCode"]);
    operations.addRow(["_A9076804902", "OP_40 - CONTROL FINAL", "OP_40"]);
    operations.addRow(["_A9076804902", "OP_50 - RETRABAJO SOLD MAN.", "OP_50"]);
    operations.addRow(["_A9076804902", "OP_100 - CONTROL FINAL INSPECTOR", "OP_100"]);
    operations.addRow(["_MB3B_2104545_EG", "OP_50 - CONTROL SOLDADURA", "OP_50"]);
    operations.addRow(["_OTHER_SCOPE", "OP_50 - CONTROL SOLDADURA", "OP_50"]);

    const failureModes = workbook.addWorksheet("FailureModes");
    failureModes.addRow(["Product", "OperationCode", "Failure"]);
    failureModes.addRow(["_OTHER_SCOPE", "OP_50", "CORDON DESPLAZADO"]);
    failureModes.addRow(["_OTHER_SCOPE", "OP_50", "SOLDADURA NO OK"]);
    failureModes.addRow(["_OTHER_SCOPE", "OP_50", "POSICION SOPORTE STEREO"]);
    failureModes.addRow(["_OTHER_SCOPE", "OP_50", "SPATTER EN ORIFICIOS"]);

    const controls = workbook.addWorksheet("Controls");
    controls.addRow(["Date", "Product", "Operation", "Failure", "Qty", "Inspected"]);
    controls.addRow(["2026-07-01", "_A9076804902", "OP_100 - CONTROL FINAL", "", "0", "10"]);
    controls.addRow(["2026-07-01", "_A9076804902", "OP_50 - RETRABAJO SOLD MAN.", "CORDON DESPLAZADO", "5", "10"]);
    controls.addRow(["2026-07-01", "_MB3B_2104545_EG", "OP_50 - CONTROL SOLDADURA", "SOLDADURA NO OK", "4", "10"]);
    controls.addRow(["2026-07-01", "_MB3B_2104545_EG", "OP_50 - CONTROL SOLDADURA", "POSICION SOPORTE STEREO", "3", "10"]);
    controls.addRow(["2026-07-01", "_MB3B_2104545_EG", "OP_50 - CONTROL SOLDADURA", "SPATTER EN ORIFICIOS", "2", "10"]);
    controls.addRow(["2026-07-01", "_A9076804902", "OP_40 - CONTROL FINAL", "SIN DEFECTO", "0", "10"]);
    controls.addRow(["2026-07-01", "_A9076804902", "OP_40 - CONTROL FINAL", "PUNZONADO OK", "1", "10"]);
    controls.addRow(["2026-07-01", "_A9076804902", "OP_50 - RETRABAJO SOLD MAN.", "OTROS *", "1", "10"]);
    controls.addRow(["2026-07-01", "_A9076804902", "OP_50 - RETRABAJO SOLD MAN.", "CORDON DESVIADO", "1", "10"]);
    controls.addRow(["2026-07-01", "_OTHER_SCOPE", "OP_50 - CONTROL SOLDADURA", "SOLDADURA NO OK", "7", "10"]);
  }, selectionYamlFrom([
    { name: "Products", range: "A1:B4", headerRow: 1 },
    { name: "Operations", range: "A1:C6", headerRow: 1 },
    { name: "FailureModes", range: "A1:C5", headerRow: 1 },
    { name: "Controls", range: "A1:F11", headerRow: 1 },
  ]));
  const mappingPath = await writeMapping(
    fixture.dir,
    buildMapping({
      mappingId: "romet-industrial-overrides-v1",
      companyContext: "ROMET",
      sources: [
        {
          id: "products",
          layout: "row_table",
          sheet: "Products",
          header_row: 1,
          data_range: "A1:B4",
          fields: [
            field("Code", "product.external_code", ["trim", "preserve_string"]),
            field("Name", "product.name", ["trim", "preserve_string"]),
          ],
        },
        {
          id: "operations",
          layout: "row_table",
          sheet: "Operations",
          header_row: 1,
          data_range: "A1:C6",
          depends_on: ["products"],
          fields: [
            field("Product", "product.external_code", ["trim", "preserve_string"]),
            field("Operation", "operation.raw_name", ["trim", "normalize_whitespace"]),
            field("OperationCode", "operation.external_code", ["trim", "preserve_string"]),
          ],
        },
        {
          id: "failure_modes",
          layout: "row_table",
          sheet: "FailureModes",
          header_row: 1,
          data_range: "A1:C5",
          depends_on: ["products", "operations"],
          fields: [
            field("Product", "product.external_code", ["trim", "preserve_string"]),
            field("OperationCode", "operation.external_code", ["trim", "preserve_string"]),
            field("Failure", "failure_mode.name", ["trim", "normalize_whitespace"]),
          ],
        },
        {
          id: "controls",
          layout: "row_table",
          sheet: "Controls",
          header_row: 1,
          data_range: "A1:F11",
          depends_on: ["products", "operations", "failure_modes"],
          fields: [
            { ...field("Date", "control.occurred_at", ["trim", "parse_date"]), data_type: "date" },
            {
              ...field("Product", "product.external_code", ["trim", "preserve_string"]),
              treatment: "lookup",
              lookup: {
                catalog_source: "products",
                catalog_match_field: "product.external_code",
                input_field: "product.external_code",
                on_unresolved: "pending_review",
                on_ambiguous: "rejected",
              },
            },
            {
              ...field("Operation", "operation.raw_name", ["trim", "normalize_whitespace"]),
              treatment: "lookup",
              lookup: {
                catalog_source: "operations",
                catalog_match_field: "operation.raw_name",
                input_field: "operation.raw_name",
                scope: [{ catalog_field: "product.external_code", value_field: "product.external_code" }],
                value_overrides: [
                  {
                    input: "OP_100 - CONTROL FINAL",
                    action: "resolve",
                    output: "OP_100 - CONTROL FINAL INSPECTOR",
                    scope: { "product.external_code": "_A9076804902" },
                  },
                ],
                on_unresolved: "pending_review",
                on_ambiguous: "rejected",
              },
            },
            {
              ...field("Operation", "operation.external_code", ["extract_regex"]),
              required: false,
              treatment: "pending",
              regex: "^(OP_[A-Za-z0-9]+(?:_[A-Za-z0-9]+)*)",
              fallback_value: null,
              on_no_match: "pending_review",
            },
            {
              ...field("Failure", "failure_mode.name", ["trim", "normalize_whitespace"]),
              required: false,
              treatment: "lookup",
              lookup: {
                catalog_source: "failure_modes",
                catalog_match_field: "failure_mode.name",
                input_field: "failure_mode.name",
                scope: [
                  { catalog_field: "product.external_code", value_field: "product.external_code" },
                  { catalog_field: "operation.external_code", value_field: "operation.external_code" },
                ],
                value_overrides: [
                  {
                    input: "CORDON DESPLAZADO",
                    action: "exclude",
                    scope: { "product.external_code": "_A9076804902", "operation.external_code": "OP_50" },
                    issue_code: "LOOKUP_VALUE_EXCLUDED",
                  },
                  {
                    input: "SOLDADURA NO OK",
                    action: "exclude",
                    scope: { "product.external_code": "_MB3B_2104545_EG", "operation.external_code": "OP_50" },
                    issue_code: "LOOKUP_VALUE_EXCLUDED",
                  },
                  {
                    input: "POSICION SOPORTE STEREO",
                    action: "exclude",
                    scope: { "product.external_code": "_MB3B_2104545_EG", "operation.external_code": "OP_50" },
                    issue_code: "LOOKUP_VALUE_EXCLUDED",
                  },
                  {
                    input: "SPATTER EN ORIFICIOS",
                    action: "exclude",
                    scope: { "product.external_code": "_MB3B_2104545_EG", "operation.external_code": "OP_50" },
                    issue_code: "LOOKUP_VALUE_EXCLUDED",
                  },
                  { input: "SIN DEFECTO", action: "conforming" },
                  { input: "PUNZONADO OK", action: "conforming" },
                ],
                required: false,
                on_unresolved: "pending_review",
                on_ambiguous: "rejected",
              },
            },
            { ...field("Qty", "control_failure.quantity", ["trim", "parse_integer"]), data_type: "integer", required: false },
            { ...field("Inspected", "control.inspected_quantity", ["trim", "parse_integer"]), data_type: "integer" },
          ],
        },
      ],
    }),
  );

  const preview = await executeSemanticMappingPreview({
    inputFilePath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    semanticMappingPath: mappingPath,
    outputDirectory: path.join(fixture.dir, "preview"),
  });
  type PreviewRecordForTest = {
    record_id: string;
    source_id: string;
    status: string;
    raw_values: Record<string, string>;
    semantic_values: Record<string, unknown>;
    preserved_values: Record<string, unknown>;
    issues: Array<{ code: string }>;
  };
  type PlanItemForTest = {
    key: string;
    source_record_id: string;
    values: Record<string, unknown>;
  };
  const records = (await readFile(preview.output_files.jsonl, "utf8"))
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as PreviewRecordForTest);
  const controlRecords = records.filter((record) => record.source_id === "controls");
  const dryRun = await executeImportDryRun({
    previewJsonlPath: preview.output_files.jsonl,
    previewSummaryPath: preview.output_files.summary_json,
    outputDirectory: path.join(fixture.dir, "dry-run"),
  });
  const plan = JSON.parse(await readFile(dryRun.output_files.plan_json, "utf8")) as {
    entities: {
      operations: PlanItemForTest[];
      controls: PlanItemForTest[];
      control_failures: PlanItemForTest[];
    };
  };

  const aliasRecord = controlRecords.find((record) => record.raw_values.Operation === "OP_100 - CONTROL FINAL");
  assert.ok(aliasRecord);
  assert.equal(aliasRecord.semantic_values["operation.raw_name"], "OP_100 - CONTROL FINAL INSPECTOR");
  assert.equal(aliasRecord.preserved_values["operation.raw_name"], "OP_100 - CONTROL FINAL");
  assert.equal(aliasRecord.semantic_values["operation.external_code"], "OP_100");
  assert.equal(plan.entities.operations.filter((item) => item.key === "_A9076804902::OP_100").length, 1);
  assert.equal(
    plan.entities.operations.some((item) => item.values.name === "OP_100 - CONTROL FINAL"),
    false,
  );

  const excludedValues = new Set(["CORDON DESPLAZADO", "SOLDADURA NO OK", "POSICION SOPORTE STEREO", "SPATTER EN ORIFICIOS"]);
  const excludedRecords = controlRecords.filter(
    (record) =>
      excludedValues.has(record.raw_values.Failure) &&
      (record.semantic_values["product.external_code"] === "_A9076804902" ||
        record.semantic_values["product.external_code"] === "_MB3B_2104545_EG"),
  );
  assert.equal(excludedRecords.length, 4);
  assert.ok(excludedRecords.every((record) => record.status === "warning"));
  assert.ok(excludedRecords.every((record) => record.semantic_values["failure_mode.name"] === null));
  assert.ok(excludedRecords.every((record) => record.issues.some((item) => item.code === "LOOKUP_VALUE_EXCLUDED")));
  assert.ok(excludedRecords.every((record) => plan.entities.controls.some((item) => item.source_record_id === record.record_id)));
  assert.ok(excludedRecords.every((record) => !plan.entities.control_failures.some((item) => item.source_record_id === record.record_id)));

  const conformingRecords = controlRecords.filter((record) => ["SIN DEFECTO", "PUNZONADO OK"].includes(record.raw_values.Failure));
  assert.equal(conformingRecords.length, 2);
  assert.ok(conformingRecords.every((record) => record.status === "valid"));
  assert.ok(conformingRecords.every((record) => record.semantic_values["failure_mode.name"] === null));
  assert.ok(conformingRecords.every((record) => plan.entities.controls.some((item) => item.source_record_id === record.record_id)));
  assert.ok(conformingRecords.every((record) => !plan.entities.control_failures.some((item) => item.source_record_id === record.record_id)));

  const otros = controlRecords.find((record) => record.raw_values.Failure === "OTROS *");
  assert.ok(otros);
  assert.equal(otros.status, "pending_review");
  const notApproved = controlRecords.find((record) => record.raw_values.Failure === "CORDON DESVIADO");
  assert.ok(notApproved);
  assert.equal(notApproved.status, "pending_review");

  const validOtherScope = controlRecords.find((record) => record.semantic_values["product.external_code"] === "_OTHER_SCOPE");
  assert.ok(validOtherScope);
  assert.equal(validOtherScope.status, "valid");
  assert.equal(validOtherScope.semantic_values["failure_mode.name"], "SOLDADURA NO OK");
  assert.ok(plan.entities.control_failures.some((item) => item.source_record_id === validOtherScope.record_id));
}

async function testMeasurementModelWithSyntheticIndustry(): Promise<void> {
  const fixture = await createCustomWorkbook("measurement-foundry", async (workbook) => {
    const sheet = workbook.addWorksheet("FoundryChecks");
    sheet.addRow(["Batch", "Operator", "ReadingA", "ReadingB", "OverallStatus"]);
    sheet.addRow(["B-1", "Alex", "12.5", "7", "OK"]);
  }, selectionYamlFrom([{ name: "FoundryChecks", range: "A1:E2", headerRow: 1 }]));

  const mappingPath = await writeMapping(
    fixture.dir,
    buildMapping({
      mappingId: "measurement-foundry-v1",
      companyContext: "FOUNDRY_SYNTHETIC",
      sources: [
        {
          id: "controls",
          layout: "row_table",
          sheet: "FoundryChecks",
          header_row: 1,
          data_range: "A1:E2",
          fields: [
            field("Batch", "control.lot_code", ["trim", "preserve_string"]),
            field("Operator", "control.operator", ["trim", "normalize_whitespace"]),
            field("OverallStatus", "control.conformity_status", ["trim", "preserve_string"]),
          ],
          measurements: [
            {
              id: "reading_a",
              characteristic: { external_code: "reading_a" },
              value: {
                source_column: "ReadingA",
                data_type: "decimal",
                required: true,
                transformations: ["trim", "parse_decimal"],
                preserve_raw_value: true,
              },
              unit: "unit_a",
              acceptance_criterion: {
                external_code: "reading_a_window",
                min_value: 10,
                max_value: 15,
                unit: "unit_a",
              },
            },
            {
              id: "reading_b",
              characteristic: { name: "Reading B" },
              value: {
                source_column: "ReadingB",
                data_type: "integer",
                required: true,
                transformations: ["trim", "parse_integer"],
                preserve_raw_value: true,
              },
              conformity_status: {
                source_column: "OverallStatus",
                transformations: ["trim", "preserve_string"],
              },
            },
          ],
        },
      ],
    }),
  );

  const validation = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.deepEqual(validation.errors, []);

  const summary = await executeSemanticMappingPreview({
    inputFilePath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    semanticMappingPath: mappingPath,
    outputDirectory: path.join(fixture.dir, "preview"),
  });
  assert.equal(summary.measurement_counts_by_source_id.controls, 2);
  assert.equal(summary.counts_by_semantic_entity.control_measurement, 2);

  const jsonl = await import("node:fs/promises").then((fs) => fs.readFile(summary.output_files.jsonl, "utf8"));
  const [record] = jsonl.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(record.semantic_values["control.conformity_status"], "OK");
  assert.equal(record.measurements.length, 2);
  assert.equal(record.measurements[0].semantic_entity, "control_measurement");
  assert.equal(record.measurements[0].typed_value, 12.5);
  assert.equal(record.measurements[0].acceptance_criterion.external_code, "reading_a_window");
  assert.equal(record.measurements[0].source.cell_address, "C2");
  assert.equal(record.measurements[1].characteristic.name, "Reading B");
  assert.equal(record.measurements[1].conformity_status, "OK");
  assert.equal(record.measurements[1].source.cell_address, "D2");
}

async function testDuplicateHeaderColumnSelectors(): Promise<void> {
  const fixture = await createCustomWorkbook("duplicate-selectors", async (workbook) => {
    const sheet = workbook.addWorksheet("Checks");
    sheet.addRow(["Lot", "Value", "Value", "Value"]);
    sheet.addRow(["L1", "A", "12.5", "Z"]);
  }, selectionYamlFrom([{ name: "Checks", range: "A1:D2", headerRow: 1 }]));

  const mappingPath = await writeMapping(
    fixture.dir,
    buildMapping({
      mappingId: "duplicate-selectors-v1",
      companyContext: "DUPLICATE_SELECTORS",
      sources: [
        {
          id: "controls",
          layout: "row_table",
          sheet: "Checks",
          header_row: 1,
          data_range: "A1:D2",
          fields: [
            field("Lot", "control.lot_code", ["trim", "preserve_string"]),
            {
              source_column_selector: { header: "Value", occurrence: 1 },
              semantic_field: "check.value_first",
              data_type: "string",
              required: false,
              treatment: "direct",
              transformations: ["trim", "preserve_string"],
              preserve_raw_value: true,
            },
            {
              source_column_selector: { column_index: 4 },
              semantic_field: "check.value_by_index",
              data_type: "string",
              required: false,
              treatment: "direct",
              transformations: ["trim", "preserve_string"],
              preserve_raw_value: true,
            },
          ],
          measurements: [
            {
              id: "second_value",
              characteristic: { external_code: "second_value" },
              value: {
                source_column_selector: { column_letter: "C" },
                data_type: "decimal",
                required: true,
                transformations: ["trim", "parse_decimal"],
                preserve_raw_value: true,
              },
            },
          ],
        },
      ],
    }),
  );

  const validation = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.deepEqual(validation.errors, []);

  const summary = await executeSemanticMappingPreview({
    inputFilePath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    semanticMappingPath: mappingPath,
    outputDirectory: path.join(fixture.dir, "preview"),
  });
  const jsonl = await import("node:fs/promises").then((fs) => fs.readFile(summary.output_files.jsonl, "utf8"));
  const [record] = jsonl.trim().split("\n").map((line) => JSON.parse(line));
  assert.equal(record.semantic_values["check.value_first"], "A");
  assert.equal(record.semantic_values["check.value_by_index"], "Z");
  assert.equal(record.measurements[0].typed_value, 12.5);
  assert.equal(record.measurements[0].source.cell_address, "C2");
}

async function createPreviewFixture(name: string): Promise<{ dir: string; workbookPath: string; selectionPath: string; mappingPath: string }> {
  const fixture = await createCustomWorkbook(name, async (workbook) => {
    const items = workbook.addWorksheet("Items");
    items.addRow(["Code", "Name", "Aux"]);
    items.addRow(["A", "Alpha", "ignore"]);
    items.addRow(["B", "Beta", "ignore"]);

    const steps = workbook.addWorksheet("Steps");
    steps.addRow(["A", "B"]);
    steps.addRow(["S1", "S1"]);

    const reasons = workbook.addWorksheet("Reasons");
    reasons.addRow(["A-S1", "B-S1"]);
    reasons.addRow(["Jam", "REVIEW"]);

    const events = workbook.addWorksheet("Events");
    events.addRow(["Code", "Step", "Reason", "Qty", "Date", "Aux"]);
    events.addRow(["A", "S1", "Jam", "2", "2026-07-01", "ignored"]);
    events.addRow(["A", "", "Jam", "bad", "2026-07-02", "ignored"]);
    events.addRow(["B", "S1", "REVIEW", "3", "bad-date", "ignored"]);
    events.addRow(["B", "S1", "Jam", "4", "2026-07-04", "ignored"]);
    events.addRow(["", "", "", "", "", ""]);
  }, selectionYamlFrom([
    { name: "Items", range: "A1:C3", headerRow: 1 },
    { name: "Steps", range: "A1:B2", headerRow: 1 },
    { name: "Reasons", range: "A1:B2", headerRow: 1 },
    { name: "Events", range: "A1:F6", headerRow: 1 },
  ]));
  const mappingPath = await writeMapping(
    fixture.dir,
    buildMapping({
      mappingId: `${name}-mapping`,
      companyContext: "PREVIEW_TEST",
      sources: previewSources(),
    }),
  );
  return { ...fixture, mappingPath };
}

function previewSources(): unknown[] {
  return [
    {
      id: "items",
      layout: "row_table",
      sheet: "Items",
      header_row: 1,
      data_range: "A1:C3",
      fields: [
        field("Code", "item.code", ["trim", "preserve_string"]),
        field("Name", "item.name", ["trim", "normalize_whitespace"]),
        { ...field("Aux", "derived.ignore", []), treatment: "derived_ignore" },
      ],
    },
    {
      id: "steps",
      layout: "wide_columns_to_rows",
      sheet: "Steps",
      header_row: 1,
      data_range: "A1:B2",
      depends_on: ["items"],
      column_header: wideField("item.code"),
      cell_value: wideField("step.code"),
    },
    {
      id: "reasons",
      layout: "wide_columns_to_rows",
      sheet: "Reasons",
      header_row: 1,
      data_range: "A1:B2",
      depends_on: ["items", "steps"],
      column_header: wideField("source.header"),
      cell_value: wideField("reason.name"),
      semantic_review_values: ["REVIEW"],
      resolver: {
        type: "pipeline",
        steps: [
          {
            type: "longest_catalog_prefix",
            input_field: "source.header",
            catalog_source: "items",
            catalog_field: "item.code",
            output_field: "item.code",
            remainder_output_field: "tail",
          },
          {
            type: "transform_value",
            input_field: "tail",
            output_field: "clean_tail",
            transformations: [{ type: "regex_replace", pattern: "^-+", replacement: "" }],
          },
          {
            type: "scoped_catalog_lookup",
            input_field: "clean_tail",
            catalog_source: "steps",
            catalog_match_field: "step.code",
            output_field: "step.code",
            scope: [{ catalog_field: "item.code", value_field: "item.code" }],
          },
        ],
      },
    },
    {
      id: "events",
      layout: "row_table",
      sheet: "Events",
      header_row: 1,
      data_range: "A1:F6",
      depends_on: ["items", "steps", "reasons"],
      semantic_review_values: ["REVIEW"],
      fields: [
        {
          ...field("Code", "item.code", ["trim", "preserve_string"]),
          treatment: "lookup",
          lookup: {
            catalog_source: "items",
            catalog_match_field: "item.code",
            input_field: "item.code",
            on_unresolved: "pending_review",
            on_ambiguous: "rejected",
          },
        },
        {
          ...field("Step", "step.code", ["trim", "preserve_string"]),
          treatment: "lookup",
          lookup: {
            catalog_source: "steps",
            catalog_match_field: "step.code",
            input_field: "step.code",
            scope: [{ catalog_field: "item.code", value_field: "item.code" }],
            on_unresolved: "pending_review",
            on_ambiguous: "rejected",
          },
        },
        {
          ...field("Reason", "reason.name", ["trim", "preserve_string"]),
          treatment: "lookup",
          lookup: {
            catalog_source: "reasons",
            catalog_match_field: "reason.name",
            input_field: "reason.name",
            scope: [
              { catalog_field: "item.code", value_field: "item.code" },
              { catalog_field: "step.code", value_field: "step.code" },
            ],
            on_unresolved: "pending_review",
            on_ambiguous: "rejected",
          },
        },
        { ...field("Qty", "event.quantity", ["trim", "parse_integer"]), data_type: "integer" },
        { ...field("Date", "event.date", ["trim", "parse_date"]), data_type: "date" },
        { ...field("Aux", "derived.ignore", []), treatment: "derived_ignore" },
      ],
    },
  ];
}

function testLongestCatalogPrefixResolved(): void {
  const result = resolveLongestCatalogPrefix("ABC-10", ["A", "ABC"]);
  assert.equal(result.status, "resolved");
  assert.equal(result.resolved, "ABC");
  assert.equal(result.remainder, "-10");
}

function testLongestCatalogPrefixAmbiguous(): void {
  const result = resolveLongestCatalogPrefix("ABC-10", ["ABC", "ABC"]);
  assert.equal(result.status, "ambiguous");
}

function testLongestCatalogPrefixUnresolved(): void {
  const result = resolveLongestCatalogPrefix("XYZ-10", ["ABC"]);
  assert.equal(result.status, "unresolved");
}

async function testSecondCompanyConfiguration(): Promise<void> {
  const fixture = await createFixture("acme");
  const mappingPath = await writeMapping(
    fixture.dir,
    buildMapping({
      mappingId: "acme-semantic-mapping-v1",
      companyContext: "ACME",
      sources: [productsSource({ sheet: "Items", codeColumn: "Item", nameColumn: "Description" })],
    }),
  );
  const report = await validateSemanticMapping({
    inputPath: fixture.workbookPath,
    sourceSelectionPath: fixture.selectionPath,
    mappingPath,
  });
  assert.deepEqual(report.errors, []);
  assert.equal(report.mapping.mappingId, "acme-semantic-mapping-v1");
}

async function createFixture(kind = "default"): Promise<{ dir: string; workbookPath: string; selectionPath: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), `quality-ai-mapping-${kind}-`));
  const workbookPath = path.join(dir, "source.xlsx");
  const selectionPath = path.join(dir, "source-selection.yaml");
  const workbook = new ExcelJS.Workbook();

  if (kind === "acme") {
    const items = workbook.addWorksheet("Items");
    items.addRow(["Item", "Description"]);
    items.addRow(["A1", "Widget"]);
    await workbook.xlsx.writeFile(workbookPath);
    await writeFile(selectionPath, selectionYaml(["Items"]), "utf8");
    return { dir, workbookPath, selectionPath };
  }

  const products = workbook.addWorksheet("Products");
  products.addRow(["Code", "Name", "Customer"]);
  products.addRow(["P100", "Part", "Customer A"]);
  products.addRow(["P200", "Other part", "Customer A"]);

  const operations = workbook.addWorksheet("Operations");
  operations.addRow(["P100", "P200"]);
  operations.addRow(["10 Cut", "20 Drill"]);

  const failureModes = workbook.addWorksheet("FailureModes");
  failureModes.addRow(["P10010", "P20020"]);
  failureModes.addRow(["Scratch", "Burr"]);

  await workbook.xlsx.writeFile(workbookPath);
  await writeFile(selectionPath, selectionYaml(["Products", "Operations", "FailureModes"]), "utf8");
  return { dir, workbookPath, selectionPath };
}

async function createCustomWorkbook(
  name: string,
  build: (workbook: ExcelJS.Workbook) => Promise<void> | void,
  selection: string,
): Promise<{ dir: string; workbookPath: string; selectionPath: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), `quality-ai-mapping-${name}-`));
  const workbookPath = path.join(dir, "source.xlsx");
  const selectionPath = path.join(dir, "source-selection.yaml");
  const workbook = new ExcelJS.Workbook();
  await build(workbook);
  await workbook.xlsx.writeFile(workbookPath);
  await writeFile(selectionPath, selection, "utf8");
  return { dir, workbookPath, selectionPath };
}

function selectionYaml(sheetNames: string[]): string {
  const sheets = sheetNames
    .map((sheet) => {
      const range = sheet === "Operations" || sheet === "FailureModes" ? "A1:B10" : "A1:C10";
      return `  - name: "${sheet}"
    final_decision: include
    final_range: "${range}"
    final_header_row: 1`;
    })
    .join("\n");
  return `file_name: "source.xlsx"
file_sha256: "test"
sheets:
${sheets}
`;
}

function selectionYamlFrom(sheets: Array<{ name: string; range: string; headerRow: number }>): string {
  const rendered = sheets
    .map(
      (sheet) => `  - name: "${sheet.name}"
    final_decision: include
    final_range: "${sheet.range}"
    final_header_row: ${sheet.headerRow}`,
    )
    .join("\n");
  return `file_name: "source.xlsx"
file_sha256: "test"
sheets:
${rendered}
`;
}

function buildMapping(input: {
  mappingId?: string;
  companyContext?: string;
  sources: unknown[];
}): string {
  return stringify({
    mapping_version: "semantic-mapping-v1",
    mapping_id: input.mappingId ?? "test-semantic-mapping-v1",
    status: "draft",
    company_context: input.companyContext ?? "TEST",
    unresolved_decisions: [],
    sources: input.sources,
  });
}

function productsSource(input: { sheet?: string; codeColumn?: string; nameColumn?: string } = {}): FixtureSource {
  return {
    id: "products",
    layout: "row_table",
    sheet: input.sheet ?? "Products",
    header_row: 1,
    data_range: "A1:C10",
    fields: [
      field(input.codeColumn ?? "Code", "product.external_code", ["trim", "preserve_string"]),
      field(input.nameColumn ?? "Name", "product.name", ["trim", "normalize_whitespace"]),
    ],
  };
}

function operationsSource(): FixtureSource {
  return {
    id: "operations",
    layout: "wide_columns_to_rows",
    sheet: "Operations",
    header_row: 1,
    data_range: "A1:B10",
    depends_on: ["products"],
    column_header: wideField("product.external_code"),
    cell_value: wideField("operation.raw_name"),
  };
}

function failureModesSource(): FixtureSource {
  return {
    id: "failure_modes",
    layout: "wide_columns_to_rows",
    sheet: "FailureModes",
    header_row: 1,
    data_range: "A1:B10",
    depends_on: ["products"],
    column_header: wideField("source_composite_header"),
    cell_value: wideField("failure_mode.name"),
    resolver: {
      type: "longest_catalog_prefix",
      catalog_source: "products",
      catalog_field: "product.external_code",
      remainder_field: "operation.external_code",
    },
  };
}

function field(sourceColumn: string, semanticField: string, transformations: string[]) {
  return {
    source_column: sourceColumn,
    semantic_field: semanticField,
    data_type: "string",
    required: true,
    treatment: "direct",
    transformations,
    preserve_raw_value: true,
  };
}

function wideField(semanticField: string) {
  return {
    semantic_field: semanticField,
    data_type: "string",
    required: true,
    treatment: "direct",
    transformations: ["trim", "preserve_string"],
    preserve_raw_value: true,
  };
}

async function writeMapping(dir: string, content: string): Promise<string> {
  const mappingPath = path.join(dir, "semantic-mapping.yaml");
  await writeFile(mappingPath, content, "utf8");
  return mappingPath;
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
