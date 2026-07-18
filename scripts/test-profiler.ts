import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";

import { profileXlsxFile } from "../src/ingestion";

async function main(): Promise<void> {
  await testFullRangeGreaterThanSampledRange();
  await testEmptySheet();
  await testFormLikeSheet();
  await testContinuousTable();
  await testConfiguredHeaderRowTakesPriority();
  await testMultipleBlocks();
  console.log("Profiler tests passed");
}

async function testFullRangeGreaterThanSampledRange(): Promise<void> {
  const { filePath, outputDir } = await createWorkbook("sampled", async (workbook) => {
    const sheet = workbook.addWorksheet("Long table");
    sheet.addRow(["A", "B"]);
    for (let index = 1; index <= 19; index += 1) {
      sheet.addRow([index, `value-${index}`]);
    }
  });

  const report = await profileXlsxFile(filePath, outputDir, { scanRowsLimit: 5, samplePolicy: "none" });
  const block = report.profile.sheets[0].candidateDataBlocks[0];
  assert.equal(block.fullRange, "A1:B20");
  assert.equal(block.scannedRange, "A1:B5");
  assert.equal(report.profile.sheets[0].samplingApplied, true);
}

async function testEmptySheet(): Promise<void> {
  const { filePath, outputDir } = await createWorkbook("empty", async (workbook) => {
    workbook.addWorksheet("Empty");
  });

  const report = await profileXlsxFile(filePath, outputDir);
  assert.equal(report.profile.sheets[0].suggestedClass, "empty");
  assert.equal(report.profile.sheets[0].candidateDataBlocks.length, 0);
}

async function testFormLikeSheet(): Promise<void> {
  const { filePath, outputDir } = await createWorkbook("form", async (workbook) => {
    const sheet = workbook.addWorksheet("Form");
    sheet.mergeCells("A1:C1");
    sheet.getCell("A1").value = "Inspection form";
    sheet.getCell("A3").value = "Operator";
    sheet.getCell("B3").value = "Shift";
  });

  const report = await profileXlsxFile(filePath, outputDir);
  assert.equal(report.profile.sheets[0].suggestedClass, "form_like");
  assert.equal(report.profile.sheets[0].needsHumanReview, true);
}

async function testContinuousTable(): Promise<void> {
  const { filePath, outputDir } = await createWorkbook("table", async (workbook) => {
    const sheet = workbook.addWorksheet("Table");
    sheet.addRow(["Date", "Part", "Quantity"]);
    sheet.addRow([new Date("2026-07-01T00:00:00Z"), "A", 10]);
    sheet.addRow([new Date("2026-07-02T00:00:00Z"), "B", 12]);
  });

  const report = await profileXlsxFile(filePath, outputDir);
  const sheet = report.profile.sheets[0];
  assert.equal(sheet.suggestedClass, "tabular_candidate");
  assert.equal(sheet.candidateDataBlocks[0].fullRange, "A1:C3");
}

async function testConfiguredHeaderRowTakesPriority(): Promise<void> {
  const { filePath, outputDir } = await createWorkbook("configured-header", async (workbook) => {
    const sheet = workbook.addWorksheet("Configured");
    sheet.addRow(["Report", "Generated", "Owner"]);
    sheet.addRow(["Date", "Part", "Quantity"]);
    sheet.addRow([new Date("2026-07-01T00:00:00Z"), "A", 10]);
    sheet.addRow([new Date("2026-07-02T00:00:00Z"), "B", 12]);
  });

  const report = await profileXlsxFile(filePath, outputDir, {
    sheets: {
      Configured: {
        headerRow: 2,
      },
    },
  });
  const sheet = report.profile.sheets[0];
  assert.equal(sheet.headerRow, 2);
  assert.equal(sheet.columns[0].header, "Date");
  assert.equal(sheet.suggestedRange, "A2:C4");
}

async function testMultipleBlocks(): Promise<void> {
  const { filePath, outputDir } = await createWorkbook("multiple-blocks", async (workbook) => {
    const sheet = workbook.addWorksheet("Blocks");
    sheet.getRow(1).values = ["", "A", "B", "", "", "C", "D"];
    sheet.getRow(2).values = ["", 1, 2, "", "", 3, 4];
    sheet.getRow(3).values = ["", 5, 6, "", "", 7, 8];
  });

  const report = await profileXlsxFile(filePath, outputDir);
  const sheet = report.profile.sheets[0];
  assert.ok(sheet.candidateDataBlocks.length >= 2);
  assert.equal(sheet.needsHumanReview, true);
}

async function createWorkbook(
  name: string,
  build: (workbook: ExcelJS.Workbook) => Promise<void> | void,
): Promise<{ filePath: string; outputDir: string }> {
  const dir = await mkdtemp(path.join(tmpdir(), `quality-ai-profiler-${name}-`));
  const filePath = path.join(dir, `${name}.xlsx`);
  const outputDir = path.join(dir, "reports");
  const workbook = new ExcelJS.Workbook();
  await build(workbook);
  await workbook.xlsx.writeFile(filePath);
  return { filePath, outputDir };
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
