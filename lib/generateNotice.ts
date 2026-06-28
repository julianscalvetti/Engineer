import type { QualityAnalysis, QualityNoticeData, RankingItem } from "@/types/quality";

function firstUsableLabel(items: RankingItem[] | null): string | null {
  return items?.find((item) => item.label !== "Sin dato")?.label ?? null;
}

export function generateNotice(analysis: QualityAnalysis): QualityNoticeData | null {
  const topPiece = analysis.pieces[0];
  const topFailureMode = analysis.failureModes[0];

  if (!topPiece || !topFailureMode) return null;

  const piece = analysis.topPieceDisplayName ?? topPiece.label;
  const operation = firstUsableLabel(analysis.operations);
  const shift = firstUsableLabel(analysis.shifts);

  return {
    totalNoOk: analysis.totalNoOk,
    piece,
    pieceNoOk: topPiece.totalNoOk,
    failureMode: topFailureMode.label,
    failureModePercentage: topFailureMode.percentage,
    operation,
    shift,
    estimatedRate: analysis.estimatedRate,
    priority: [piece, operation, topFailureMode.label].filter(
      (value): value is string => Boolean(value),
    ),
  };
}
