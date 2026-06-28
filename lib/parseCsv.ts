import Papa from "papaparse";
import type { CsvFileResult, RawCsvRow } from "@/types/quality";
import { validateColumns } from "./validateColumns";

const REPLACEMENT_CHARACTER = "�";
const GENERATED_COLUMN_PATTERN = /^_\d+$/;

function cleanHeader(header: string): string {
  return header.replace(/^\uFEFF/, "").replace(/^ï»¿/, "").trim();
}

function parseText(text: string): Papa.ParseResult<RawCsvRow> {
  return Papa.parse<RawCsvRow>(text, {
    header: true,
    skipEmptyLines: "greedy",
    delimitersToGuess: [",", ";", "\t"],
    transformHeader: cleanHeader,
  });
}

function getVisibleColumns(result: Papa.ParseResult<RawCsvRow>): string[] {
  return (result.meta.fields ?? []).filter(
    (column) =>
      Boolean(column) &&
      !GENERATED_COLUMN_PATTERN.test(column) &&
      column !== "__parsed_extra",
  );
}

export async function parseCsv(file: File): Promise<CsvFileResult> {
  try {
    const bytes = await file.arrayBuffer();
    let parsed = parseText(new TextDecoder("utf-8").decode(bytes));
    let columns = getVisibleColumns(parsed);

    if (columns.some((column) => column.includes(REPLACEMENT_CHARACTER))) {
      parsed = parseText(new TextDecoder("windows-1252").decode(bytes));
      columns = getVisibleColumns(parsed);
    }

    if (parsed.errors.some((error) => error.type === "Delimiter")) {
      throw new Error("No se pudo reconocer la estructura del CSV.");
    }

    return {
      fileName: file.name,
      rowCount: parsed.data.length,
      columns,
      rows: parsed.data,
      ...validateColumns(columns),
    };
  } catch (error) {
    if (error instanceof Error && error.message === "No se pudo reconocer la estructura del CSV.") {
      throw error;
    }

    throw new Error("No se pudo leer el archivo CSV.");
  }
}
