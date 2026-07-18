import ExcelJS from "exceljs";

import type { SourceColumnSelector } from "./types";
import { columnNameToNumber, columnNumberToName, stringifyCell } from "./executor-utils";

export interface HeaderIndex {
  byHeader: Map<string, number[]>;
  headersByColumn: Map<number, string>;
  startColumn: number;
  endColumn: number;
}

export interface ColumnReferenceConfig {
  source_column?: string;
  source_column_selector?: SourceColumnSelector;
}

export interface ResolvedColumn {
  columnNumber?: number;
  columnLetter?: string;
  header?: string;
  key: string;
}

export function buildHeaderIndex(headerRow: ExcelJS.Row, startColumn: number, endColumn: number): HeaderIndex {
  const byHeader = new Map<string, number[]>();
  const headersByColumn = new Map<number, string>();
  for (let column = startColumn; column <= endColumn; column += 1) {
    const header = stringifyCell(headerRow.getCell(column).value).trim();
    if (!header) continue;
    headersByColumn.set(column, header);
    byHeader.set(header, [...(byHeader.get(header) ?? []), column]);
  }
  return { byHeader, headersByColumn, startColumn, endColumn };
}

export function resolveConfiguredColumn(config: ColumnReferenceConfig, headerIndex: HeaderIndex): ResolvedColumn {
  const selector = config.source_column_selector;
  if (selector?.column_index !== undefined) {
    return toResolvedColumn(selector.column_index, headerIndex, `column_index:${selector.column_index}`);
  }
  if (selector?.column_letter) {
    const columnNumber = columnNameToNumber(selector.column_letter);
    return toResolvedColumn(columnNumber, headerIndex, `column_letter:${selector.column_letter}`);
  }
  if (selector?.header) {
    const occurrence = selector.occurrence ?? 1;
    const columnNumber = headerIndex.byHeader.get(selector.header)?.[occurrence - 1];
    return toResolvedColumn(columnNumber, headerIndex, `header:${selector.header}#${occurrence}`);
  }
  if (config.source_column) {
    const matches = headerIndex.byHeader.get(config.source_column) ?? [];
    return toResolvedColumn(matches.at(-1), headerIndex, config.source_column);
  }
  return { key: "unconfigured" };
}

export function columnSelectorKey(config: ColumnReferenceConfig): string {
  const selector = config.source_column_selector;
  if (selector?.column_index !== undefined) return `column_index:${selector.column_index}`;
  if (selector?.column_letter) return `column_letter:${selector.column_letter}`;
  if (selector?.header) return `header:${selector.header}#${selector.occurrence ?? 1}`;
  return config.source_column ?? "unconfigured";
}

function toResolvedColumn(columnNumber: number | undefined, headerIndex: HeaderIndex, fallbackKey: string): ResolvedColumn {
  if (columnNumber === undefined) return { key: fallbackKey };
  return {
    columnNumber,
    columnLetter: columnNumberToName(columnNumber),
    header: headerIndex.headersByColumn.get(columnNumber),
    key: headerIndex.headersByColumn.get(columnNumber) ?? fallbackKey,
  };
}
