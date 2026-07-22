import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import ExcelJS from "exceljs";
import { stringify } from "yaml";

import { executeSemanticMappingPreview } from "./executor";
import { loadSemanticMapping, loadSourceSelection } from "./loader";
import { buildApprovedSourceSelections } from "./approved-source-selection";
import { validateSemanticMapping } from "./engine";
import type { SemanticMappingConfig, SourceSelectionConfig } from "./types";

async function main(): Promise<void> {
  testMatchingSelectionAndMapping();
  testSourceMissingInSelection();
  testSourceNotApproved();
  testSheetMismatch();
  testHeaderMismatch();
  testRangeMismatch();
  testSupportedLayoutCarried();
  testMultipleApprovedSources();
  await testRometConfiguration();
  await testPreviewEquivalentWhenPhysicalConfigMatches();
  await testValidationAndContractRejectSamePhysicalMismatches();
  console.log("Approved source selection tests passed");
}

function testMatchingSelectionAndMapping(): void {
  const result = buildApprovedSourceSelections({
    sourceSelection: selection([{ name: "Products", sourceId: "products", range: "A1:B3", headerRow: 1 }]),
    semanticMapping: mapping([source({ id: "products", sheet: "Products", range: "A1:B3" })]),
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.approvedSources[0], {
    sourceId: "products",
    physical: { sheet: "Products", headerRow: 1, finalRange: "A1:B3" },
    semantic: {
      layout: "row_table",
      mappingId: "test-mapping",
      mappingVersion: "semantic-mapping-v1",
    },
  });
}

function testSourceMissingInSelection(): void {
  const result = buildApprovedSourceSelections({
    sourceSelection: selection([{ name: "Other", range: "A1:B3", headerRow: 1 }]),
    semanticMapping: mapping([source({ id: "products", sheet: "Products", range: "A1:B3" })]),
  });

  assertIssue(result.errors, "SOURCE_NOT_IN_SELECTION");
}

function testSourceNotApproved(): void {
  const result = buildApprovedSourceSelections({
    sourceSelection: selection([{ name: "Products", range: "A1:B3", headerRow: 1, decision: "exclude" }]),
    semanticMapping: mapping([source({ id: "products", sheet: "Products", range: "A1:B3" })]),
  });

  assertIssue(result.errors, "SOURCE_NOT_APPROVED");
}

function testSheetMismatch(): void {
  const result = buildApprovedSourceSelections({
    sourceSelection: selection([{ name: "ApprovedProducts", sourceId: "products", range: "A1:B3", headerRow: 1 }]),
    semanticMapping: mapping([source({ id: "products", sheet: "Products", range: "A1:B3" })]),
  });

  assertIssue(result.errors, "SHEET_SELECTION_MISMATCH");
}

function testHeaderMismatch(): void {
  const result = buildApprovedSourceSelections({
    sourceSelection: selection([{ name: "Products", range: "A1:B3", headerRow: 2 }]),
    semanticMapping: mapping([source({ id: "products", sheet: "Products", range: "A1:B3" })]),
  });

  assertIssue(result.errors, "HEADER_ROW_SELECTION_MISMATCH");
}

function testRangeMismatch(): void {
  const result = buildApprovedSourceSelections({
    sourceSelection: selection([{ name: "Products", range: "A1:C3", headerRow: 1 }]),
    semanticMapping: mapping([source({ id: "products", sheet: "Products", range: "A1:B3" })]),
  });

  assertIssue(result.errors, "RANGE_SELECTION_MISMATCH");
}

function testSupportedLayoutCarried(): void {
  const result = buildApprovedSourceSelections({
    sourceSelection: selection([{ name: "Operations", range: "A1:B3", headerRow: 1 }]),
    semanticMapping: mapping([source({ id: "operations", sheet: "Operations", range: "A1:B3", layout: "wide_columns_to_rows" })]),
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.approvedSources[0].semantic.layout, "wide_columns_to_rows");
}

function testMultipleApprovedSources(): void {
  const result = buildApprovedSourceSelections({
    sourceSelection: selection([
      { name: "Products", range: "A1:B3", headerRow: 1 },
      { name: "Operations", range: "A1:B3", headerRow: 1 },
    ]),
    semanticMapping: mapping([
      source({ id: "products", sheet: "Products", range: "A1:B3" }),
      source({ id: "operations", sheet: "Operations", range: "A1:B3", layout: "wide_columns_to_rows" }),
    ]),
  });

  assert.deepEqual(result.errors, []);
  assert.equal(result.approvedSources.length, 2);
}

async function testRometConfiguration(): Promise<void> {
  const root = path.resolve(__dirname, "../../..");
  const [mappingLoad, selectionLoad] = await Promise.all([
    loadSemanticMapping(path.join(root, "config/ingestion/companies/romet/semantic-mapping.yaml")),
    loadSourceSelection(path.join(root, "config/ingestion/companies/romet/source-selection.yaml")),
  ]);

  const result = buildApprovedSourceSelections({
    sourceSelection: selectionLoad.value,
    semanticMapping: mappingLoad.value,
  });

  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.approvedSources.map((approved) => approved.sourceId), [
    "products",
    "operations",
    "failure_modes",
    "controls",
  ]);
}

async function testPreviewEquivalentWhenPhysicalConfigMatches(): Promise<void> {
  const dir = await mkdtemp(path.join(tmpdir(), "approved-selection-preview-"));
  const workbookPath = path.join(dir, "source.xlsx");
  const selectionPath = path.join(dir, "source-selection.yaml");
  const mappingPath = path.join(dir, "semantic-mapping.yaml");
  const workbook = new ExcelJS.Workbook();
  const products = workbook.addWorksheet("Products");
  products.addRow(["Code", "Name"]);
  products.addRow(["P1", "Part 1"]);
  products.addRow(["P2", "Part 2"]);
  await workbook.xlsx.writeFile(workbookPath);
  await writeFile(selectionPath, stringify(selection([{ name: "Products", range: "A1:B3", headerRow: 1 }])), "utf8");
  await writeFile(mappingPath, stringify(mapping([source({ id: "products", sheet: "Products", range: "A1:B3" })])), "utf8");

  const summary = await executeSemanticMappingPreview({
    inputFilePath: workbookPath,
    sourceSelectionPath: selectionPath,
    semanticMappingPath: mappingPath,
    outputDirectory: path.join(dir, "preview"),
  });

  assert.equal(summary.counts_by_status.valid, 2);
  assert.equal(summary.counts_by_source_id.products, 2);
  const jsonl = await readFile(summary.output_files.jsonl, "utf8");
  const records = jsonl.trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(records.every((record) => record.source_locator.selected_range === "A1:B3"));
  assert.ok(records.every((record) => record.source_locator.header_row === 1));
}

async function testValidationAndContractRejectSamePhysicalMismatches(): Promise<void> {
  const cases = [
    {
      code: "SHEET_SELECTION_MISMATCH",
      selection: selection([{ name: "ApprovedProducts", sourceId: "products", range: "A1:B3", headerRow: 1 }]),
      mapping: mapping([source({ id: "products", sheet: "Products", range: "A1:B3" })]),
    },
    {
      code: "HEADER_ROW_SELECTION_MISMATCH",
      selection: selection([{ name: "Products", range: "A1:B3", headerRow: 2 }]),
      mapping: mapping([source({ id: "products", sheet: "Products", range: "A1:B3" })]),
    },
    {
      code: "RANGE_SELECTION_MISMATCH",
      selection: selection([{ name: "Products", range: "A1:C3", headerRow: 1 }]),
      mapping: mapping([source({ id: "products", sheet: "Products", range: "A1:B3" })]),
    },
  ];

  for (const testCase of cases) {
    const contractResult = buildApprovedSourceSelections({
      sourceSelection: testCase.selection,
      semanticMapping: testCase.mapping,
    });
    assertIssue(contractResult.errors, testCase.code);

    const validation = await validateFixture(testCase.selection, testCase.mapping);
    assertIssue(validation.errors, testCase.code);
  }
}

function mapping(sources: SemanticMappingConfig["sources"]): SemanticMappingConfig {
  return {
    mapping_version: "semantic-mapping-v1",
    mapping_id: "test-mapping",
    status: "draft",
    sources,
  };
}

function source(input: {
  id: string;
  sheet: string;
  range: string;
  layout?: "row_table" | "wide_columns_to_rows";
}): SemanticMappingConfig["sources"][number] {
  return {
    id: input.id,
    layout: input.layout ?? "row_table",
    sheet: input.sheet,
    header_row: 1,
    data_range: input.range,
    fields: [
      {
        source_column: "Code",
        semantic_field: "product.external_code",
        data_type: "string",
        required: true,
        treatment: "direct",
        transformations: ["trim", "preserve_string"],
        preserve_raw_value: true,
      },
      {
        source_column: "Name",
        semantic_field: "product.name",
        data_type: "string",
        required: true,
        treatment: "direct",
        transformations: ["trim", "preserve_string"],
        preserve_raw_value: true,
      },
    ],
  };
}

function selection(
  sheets: Array<{
    name: string;
    sourceId?: string;
    range: string;
    headerRow: number;
    decision?: string;
  }>,
): SourceSelectionConfig {
  return {
    file_name: "source.xlsx",
    file_sha256: "test",
    sheets: sheets.map((sheet) => ({
      name: sheet.name,
      source_id: sheet.sourceId,
      final_decision: sheet.decision ?? "include",
      final_range: sheet.range,
      final_header_row: sheet.headerRow,
    })),
  };
}

function assertIssue(errors: Array<{ code: string; severity: string }>, code: string): void {
  assert.ok(errors.some((error) => error.code === code && error.severity === "error"));
}

async function validateFixture(
  sourceSelection: SourceSelectionConfig,
  semanticMapping: SemanticMappingConfig,
): Promise<{ errors: Array<{ code: string; severity: string }> }> {
  const dir = await mkdtemp(path.join(tmpdir(), "approved-selection-validation-"));
  const workbookPath = path.join(dir, "source.xlsx");
  const selectionPath = path.join(dir, "source-selection.yaml");
  const mappingPath = path.join(dir, "semantic-mapping.yaml");
  const workbook = new ExcelJS.Workbook();
  const products = workbook.addWorksheet("Products");
  products.addRow(["Code", "Name", "Extra"]);
  products.addRow(["P1", "Part 1", "x"]);
  products.addRow(["P2", "Part 2", "y"]);
  const approvedProducts = workbook.addWorksheet("ApprovedProducts");
  approvedProducts.addRow(["Code", "Name"]);
  approvedProducts.addRow(["P1", "Part 1"]);
  await workbook.xlsx.writeFile(workbookPath);
  await writeFile(selectionPath, stringify(sourceSelection), "utf8");
  await writeFile(mappingPath, stringify(semanticMapping), "utf8");

  return validateSemanticMapping({
    inputPath: workbookPath,
    sourceSelectionPath: selectionPath,
    mappingPath,
  });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
