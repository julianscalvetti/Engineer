"use client";

import { useState } from "react";
import { analyzeQuality } from "@/lib/analyzeQuality";
import type { CsvFileResult, ValidationStatus } from "@/types/quality";
import ResultsTables from "./ResultsTables";

const STATUS_CONTENT: Record<ValidationStatus, { title: string; description: string }> = {
  invalid: {
    title: "No se puede procesar",
    description: "El archivo no contiene todas las columnas obligatorias.",
  },
  warning: {
    title: "Archivo válido con advertencias",
    description: "La estructura mínima es correcta, pero faltan columnas recomendadas.",
  },
  valid: {
    title: "Archivo válido",
    description: "El archivo contiene todas las columnas obligatorias y recomendadas.",
  },
};

function ColumnList({ title, columns, tone }: { title: string; columns: string[]; tone: string }) {
  return (
    <div className="column-group">
      <div className="column-heading">
        <h3>{title}</h3>
        <span>{columns.length}</span>
      </div>
      {columns.length > 0 ? (
        <ul className="tag-list">
          {columns.map((column) => <li className={`tag ${tone}`} key={column}>{column}</li>)}
        </ul>
      ) : (
        <p className="empty-list">Ninguna</p>
      )}
    </div>
  );
}

export default function ValidationPanel({ result }: { result: CsvFileResult }) {
  const [analysis, setAnalysis] = useState<ReturnType<typeof analyzeQuality> | null>(null);
  const statusContent = STATUS_CONTENT[result.status];
  const canContinue = result.status !== "invalid";

  return (
    <>
    <div className="validation-panel" aria-live="polite">
      <div className={`status-banner ${result.status}`}>
        <span className="status-mark" aria-hidden="true">
          {result.status === "invalid" ? "×" : result.status === "warning" ? "!" : "✓"}
        </span>
        <div>
          <h2>{statusContent.title}</h2>
          <p>{statusContent.description}</p>
        </div>
      </div>

      <div className="file-summary">
        <div><span>Archivo</span><strong title={result.fileName}>{result.fileName}</strong></div>
        <div><span>Filas detectadas</span><strong>{result.rowCount.toLocaleString("es-AR")}</strong></div>
        <div><span>Columnas</span><strong>{result.columns.length}</strong></div>
      </div>

      <ColumnList title="Columnas encontradas" columns={result.columns} tone="neutral" />
      <ColumnList title="Obligatorias faltantes" columns={result.missingRequired} tone="danger" />
      <ColumnList title="Recomendadas faltantes" columns={result.missingRecommended} tone="warning" />

      <div className="panel-actions">
        <button
          className="primary-button"
          type="button"
          disabled={!canContinue}
          onClick={() => setAnalysis(analyzeQuality(result.rows, result.columns))}
        >
          Continuar al procesamiento
        </button>
      </div>
    </div>
    {analysis && <ResultsTables analysis={analysis} />}
    </>
  );
}
