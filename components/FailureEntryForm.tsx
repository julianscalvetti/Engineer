"use client";

import type { FormEvent } from "react";
import type { Product, Shift } from "@/types/failure";

export type FormState = {
  productCode: string;
  operationStation: string;
  shift: Shift;
  operator: string;
  quantities: Record<string, number>;
  observations: string;
};

type Props = {
  products: Product[];
  value: FormState;
  onChange: (value: FormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  error: string;
  savedMessage: string;
};

export default function FailureEntryForm({ products, value, onChange, onSubmit, error, savedMessage }: Props) {
  const product = products.find((item) => item.code === value.productCode);
  const operations = product?.operations ?? [];
  const operation = operations.find((item) => item.station === value.operationStation);
  const failureModes = operation?.failureModes ?? [];
  const total = failureModes.reduce((sum, mode) => sum + (value.quantities[mode] || 0), 0);

  const selectProduct = (productCode: string) => {
    const selected = products.find((item) => item.code === productCode);
    onChange({
      ...value,
      productCode,
      operationStation: selected?.operations[0]?.station ?? "",
      quantities: {},
    });
  };

  const selectOperation = (operationStation: string) => {
    onChange({ ...value, operationStation, quantities: {} });
  };

  return (
    <form className="failure-card" onSubmit={onSubmit} noValidate>
      <div className="card-heading">
        <div>
          <div className="panel-kicker accent">REGISTRO DE NO CONFORMIDAD</div>
          <h1>Parte de fallas</h1>
        </div>
        <span className="live-badge"><i /> CAPTURA LOCAL</span>
      </div>

      <div className="form-grid two-columns">
        <label>
          <span className="field-label">Codigo de producto</span>
          <select value={value.productCode} onChange={(event) => selectProduct(event.target.value)} required>
            <option value="">Seleccionar codigo</option>
            {products.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
          </select>
        </label>
        <label>
          <span className="field-label">Estacion de operacion</span>
          <select value={value.operationStation} onChange={(event) => selectOperation(event.target.value)} disabled={!product} required>
            <option value="">Seleccionar estacion</option>
            {operations.map((item) => <option key={item.station}>{item.station}</option>)}
          </select>
        </label>
      </div>

      {product && <p className="product-name">PRODUCTO ACTIVO <strong>{product.name}</strong></p>}

      <div className="form-grid shift-operator">
        <fieldset>
          <legend className="field-label">Turno</legend>
          <div className="segmented-control">
            {(["A", "B", "C"] as Shift[]).map((shift) => (
              <button key={shift} className={value.shift === shift ? "active" : ""} type="button" onClick={() => onChange({ ...value, shift })}>
                {shift}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          <span className="field-label">Operador / legajo</span>
          <input value={value.operator} onChange={(event) => onChange({ ...value, operator: event.target.value })} placeholder="Ej. 1842 - J. Perez" required />
        </label>
      </div>

      <section className="failure-section" aria-labelledby="failure-title">
        <div className="section-heading">
          <h2 id="failure-title">Modos de falla</h2>
          <span>{failureModes.length} modos habilitados</span>
        </div>

        {!operation ? (
          <div className="empty-state">Selecciona un producto y una estacion para cargar fallas.</div>
        ) : (
          <div className="failure-list">
            {failureModes.map((mode, index) => (
              <label className="failure-row" key={mode}>
                <span className="row-number">{String(index + 1).padStart(2, "0")}</span>
                <span>{mode}</span>
                <input
                  aria-label={`Cantidad para ${mode}`}
                  type="number"
                  min="0"
                  step="1"
                  inputMode="numeric"
                  value={value.quantities[mode] || ""}
                  placeholder="0"
                  onChange={(event) => onChange({
                    ...value,
                    quantities: { ...value.quantities, [mode]: Math.max(0, Number(event.target.value) || 0) },
                  })}
                />
              </label>
            ))}
          </div>
        )}

        <div className="total-row"><span>Total de unidades rechazadas</span><strong>{total}</strong></div>
      </section>

      <label className="observations-field">
        <span className="field-label">Observaciones</span>
        <textarea value={value.observations} onChange={(event) => onChange({ ...value, observations: event.target.value })} placeholder="Detalle de lote, equipo, condicion detectada o accion inmediata..." />
      </label>

      {error && <p className="form-message error" role="alert">{error}</p>}
      {savedMessage && <p className="form-message success" role="status">{savedMessage}</p>}

      <div className="form-footer">
        <span>Los campos pueden corregirse antes de guardar.</span>
        <button className="save-button" type="submit">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h12l2 2v14H5V4Zm3 0v6h8V4M8 20v-6h8v6" /></svg>
          Guardar registro
        </button>
      </div>
    </form>
  );
}
