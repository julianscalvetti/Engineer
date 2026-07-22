import type {
  ApprovedSourceSelection,
  MappingIssue,
  MappingSourceConfig,
  SemanticMappingConfig,
  SourceProfileSummary,
  SourceSelectionConfig,
  SourceSelectionSheet,
} from "./types";

export interface ApprovedSourceSelectionBuildResult {
  approvedSources: ApprovedSourceSelection[];
  errors: MappingIssue[];
}

export function buildApprovedSourceSelections(input: {
  sourceSelection?: SourceSelectionConfig;
  semanticMapping?: SemanticMappingConfig;
  sourceProfile?: SourceProfileSummary;
}): ApprovedSourceSelectionBuildResult {
  const approvedSources: ApprovedSourceSelection[] = [];
  const errors: MappingIssue[] = [];
  const mapping = input.semanticMapping;
  const selection = input.sourceSelection;

  if (!mapping || !selection) return { approvedSources, errors };

  for (const source of mapping.sources ?? []) {
    const selected = findSelectedSource(source, selection);
    if (!selected) {
      errors.push(issue("SOURCE_NOT_IN_SELECTION", "Source sheet is not present in source-selection.yaml.", source.id));
      continue;
    }

    const selectedSourceId = selected.source_id ?? selected.sourceId;
    if (selectedSourceId && selectedSourceId !== source.id) {
      errors.push(
        issue("SOURCE_ID_SELECTION_MISMATCH", "Configured source id differs from source selection.", source.id, {
          mapping_source_id: source.id,
          selected_source_id: selectedSourceId,
        }),
      );
      continue;
    }

    if (selected.final_decision !== "include") {
      errors.push(issue("SOURCE_NOT_APPROVED", "Source sheet is not approved as include in source-selection.yaml.", source.id));
      continue;
    }

    if (!selected.final_range) {
      errors.push(issue("SOURCE_FINAL_RANGE_MISSING", "Approved source selection must declare final_range.", source.id));
      continue;
    }

    if (!selected.final_header_row) {
      errors.push(issue("SOURCE_FINAL_HEADER_ROW_MISSING", "Approved source selection must declare final_header_row.", source.id));
      continue;
    }

    if (source.sheet !== selected.name) {
      errors.push(
        issue("SHEET_SELECTION_MISMATCH", "Configured source sheet differs from source selection.", source.id, {
          mapping_sheet: source.sheet,
          selected_sheet: selected.name,
        }),
      );
      continue;
    }

    if (source.header_row !== selected.final_header_row) {
      errors.push(
        issue("HEADER_ROW_SELECTION_MISMATCH", "Configured header_row differs from source selection.", source.id, {
          mapping_header_row: source.header_row,
          selected_header_row: selected.final_header_row,
        }),
      );
      continue;
    }

    if (source.data_range && source.data_range !== selected.final_range) {
      errors.push(
        issue("RANGE_SELECTION_MISMATCH", "Configured data_range differs from source selection.", source.id, {
          mapping_data_range: source.data_range,
          selected_final_range: selected.final_range,
        }),
      );
      continue;
    }

    approvedSources.push({
      sourceId: source.id,
      physical: {
        sheet: selected.name,
        headerRow: selected.final_header_row,
        finalRange: selected.final_range,
      },
      semantic: {
        layout: source.layout,
        mappingId: mapping.mapping_id,
        mappingVersion: mapping.mapping_version,
      },
    });
  }

  return { approvedSources, errors };
}

function findSelectedSource(source: MappingSourceConfig, selection: SourceSelectionConfig): SourceSelectionSheet | undefined {
  return (
    selection.sheets.find((sheet) => sheet.source_id === source.id || sheet.sourceId === source.id) ??
    selection.sheets.find((sheet) => sheet.name === source.sheet)
  );
}

function issue(
  code: string,
  message: string,
  sourceId?: string,
  details?: Record<string, unknown>,
): MappingIssue {
  return { code, severity: "error", message, sourceId, details };
}
