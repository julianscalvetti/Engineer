"use client";

import { useRef, useState } from "react";
import { runOcr } from "@/lib/runOcr";

type Props = {
  fileName: string;
  ocrText: string;
  onFileNameChange: (name: string) => void;
  onTextChange: (text: string) => void;
  onApply: () => void;
};

const ACCEPTED_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"];

export default function UploadOcrPanel({
  fileName,
  ocrText,
  onFileNameChange,
  onTextChange,
  onApply,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Listo para procesar");
  const [error, setError] = useState("");

  const processFile = async (file?: File) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato no admitido. Usa PDF, PNG, JPG o WEBP.");
      return;
    }

    setError("");
    setIsProcessing(true);
    setProgress(0);
    setStatus("Iniciando OCR local");
    onFileNameChange(file.name);

    try {
      const text = await runOcr(file, (value, nextStatus) => {
        setProgress(Math.round(value * 100));
        setStatus(nextStatus);
      });
      if (!text.trim()) throw new Error("No se detecto texto legible en el archivo.");
      onTextChange(text);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo procesar el archivo.");
      setStatus("OCR interrumpido");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <aside className="ocr-panel" aria-labelledby="ocr-title">
      <div className="panel-kicker">ENTRADA DE DOCUMENTO</div>
      <h2 id="ocr-title">Captura por OCR</h2>
      <p className="panel-copy">Procesamiento local. El archivo no sale de este navegador.</p>

      <div
        className={`upload-zone ${isDragging ? "is-dragging" : ""}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          void processFile(event.dataTransfer.files[0]);
        }}
      >
        <div className="upload-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5h14v-5" /></svg>
        </div>
        <strong>{fileName || "Arrastra una orden o parte"}</strong>
        <span>PDF, PNG, JPG o WEBP</span>
        <button className="outline-button" type="button" onClick={() => inputRef.current?.click()} disabled={isProcessing}>
          {fileName ? "Cambiar archivo" : "Seleccionar archivo"}
        </button>
        <input
          ref={inputRef}
          className="visually-hidden"
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          onChange={(event) => void processFile(event.target.files?.[0])}
        />
      </div>

      {(isProcessing || progress > 0) && (
        <div className="ocr-progress" aria-live="polite">
          <div><span>{status}</span><strong>{progress}%</strong></div>
          <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        </div>
      )}

      {error && <p className="inline-error" role="alert">{error}</p>}

      <label className="field-label" htmlFor="ocrText">Texto reconocido</label>
      <textarea
        id="ocrText"
        className="ocr-text"
        value={ocrText}
        onChange={(event) => onTextChange(event.target.value)}
        placeholder="El texto extraido aparecera aqui. Tambien puedes pegar o corregir contenido manualmente."
      />
      <button className="secondary-button full-width" type="button" onClick={onApply} disabled={!ocrText.trim() || isProcessing}>
        Aplicar datos al formulario
      </button>
    </aside>
  );
}
