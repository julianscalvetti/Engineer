"use client";

import { useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { parseCsv } from "@/lib/parseCsv";
import type { CsvFileResult } from "@/types/quality";
import ValidationPanel from "./ValidationPanel";

export default function FileUploader() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CsvFileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleFile(file?: File) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setResult(null);
      setError("El archivo debe tener extensión .csv.");
      return;
    }

    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      setResult(await parseCsv(file));
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "No se pudo leer el archivo.");
    } finally {
      setIsLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    void handleFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    void handleFile(event.dataTransfer.files[0]);
  }

  return (
    <section className="workspace" aria-label="Carga y validación del archivo">
      <div
        className={`drop-zone${isDragging ? " is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <div className="upload-icon" aria-hidden="true">↑</div>
        <h2>{isLoading ? "Leyendo archivo…" : "Cargá tu archivo CSV"}</h2>
        <p>Arrastralo hasta acá o seleccionalo desde tu equipo.</p>
        <input
          ref={inputRef}
          className="visually-hidden"
          id="csv-file"
          type="file"
          accept=".csv,text/csv"
          onChange={handleInputChange}
          disabled={isLoading}
        />
        <button
          className="primary-button"
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
        >
          Seleccionar CSV
        </button>
        <span className="file-hint">Formato admitido: .csv</span>
      </div>

      {error && <div className="file-error" role="alert">{error}</div>}
      {result && <ValidationPanel result={result} />}
    </section>
  );
}
