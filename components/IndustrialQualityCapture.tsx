"use client";

import { useEffect, useState, type FormEvent } from "react";
import productsData from "@/data/products.json";
import { parseOcrText } from "@/lib/parseOcrText";
import type { FailureRecord, Product } from "@/types/failure";
import FailureEntryForm, { type FormState } from "./FailureEntryForm";
import SavedRecords from "./SavedRecords";
import UploadOcrPanel from "./UploadOcrPanel";

const STORAGE_KEY = "quality-ai:failure-records";
const products = productsData as Product[];

const initialForm: FormState = {
  productCode: "",
  operationStation: "",
  shift: "A",
  operator: "",
  quantities: {},
  observations: "",
};

export default function IndustrialQualityCapture() {
  const [form, setForm] = useState<FormState>(initialForm);
  const [fileName, setFileName] = useState("");
  const [ocrText, setOcrText] = useState("");
  const [records, setRecords] = useState<FailureRecord[]>([]);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");

  useEffect(() => {
    const loadStoredRecords = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) setRecords(JSON.parse(stored) as FailureRecord[]);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }, 0);
    return () => window.clearTimeout(loadStoredRecords);
  }, []);

  const applyOcrData = () => {
    const parsed = parseOcrText(ocrText, products);
    const selectedProduct = products.find((item) => item.code === parsed.productCode);
    const selectedOperation = selectedProduct?.operations.find((item) => item.station === parsed.operationStation);

    setForm((current) => ({
      ...current,
      productCode: parsed.productCode ?? current.productCode,
      operationStation: parsed.operationStation ?? (parsed.productCode ? selectedProduct?.operations[0]?.station ?? "" : current.operationStation),
      shift: parsed.shift ?? current.shift,
      operator: parsed.operator ?? current.operator,
      observations: parsed.observations ?? current.observations,
      quantities: selectedOperation ? parsed.quantities : parsed.productCode ? {} : current.quantities,
    }));
    setSavedMessage("Datos OCR aplicados. Revisa los campos antes de guardar.");
    setError("");
  };

  const saveRecord = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const product = products.find((item) => item.code === form.productCode);
    const operation = product?.operations.find((item) => item.station === form.operationStation);
    const failures = (operation?.failureModes ?? []).map((mode) => ({ mode, quantity: form.quantities[mode] || 0 }));
    const total = failures.reduce((sum, item) => sum + item.quantity, 0);

    if (!product || !operation || !form.operator.trim()) {
      setError("Completa producto, estacion y operador antes de guardar.");
      setSavedMessage("");
      return;
    }
    if (total <= 0) {
      setError("Ingresa al menos una cantidad de falla mayor que cero.");
      setSavedMessage("");
      return;
    }

    const record: FailureRecord = {
      id: crypto.randomUUID(),
      productCode: form.productCode,
      operationStation: form.operationStation,
      shift: form.shift,
      operator: form.operator.trim(),
      failures,
      total,
      observations: form.observations.trim(),
      originalOcrText: ocrText,
      fileName,
      timestamp: new Date().toISOString(),
    };
    const nextRecords = [record, ...records];
    setRecords(nextRecords);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextRecords));
    setError("");
    setSavedMessage("Registro guardado localmente.");
  };

  return (
    <main className="app-shell">
      <header className="site-header">
        <div className="brand-mark">QA</div>
        <div>
          <strong>QUALITY CONTROL</strong>
          <span>Sistema de captura de fallas</span>
        </div>
        <div className="plant-status"><i /> PLANTA OPERATIVA</div>
      </header>

      <div className="capture-layout">
        <UploadOcrPanel
          fileName={fileName}
          ocrText={ocrText}
          onFileNameChange={setFileName}
          onTextChange={setOcrText}
          onApply={applyOcrData}
        />
        <FailureEntryForm
          products={products}
          value={form}
          onChange={(next) => {
            setForm(next);
            setError("");
            setSavedMessage("");
          }}
          onSubmit={saveRecord}
          error={error}
          savedMessage={savedMessage}
        />
      </div>

      <SavedRecords records={records} products={products} />
    </main>
  );
}
