"use client";

import { useMemo, useState, useTransition } from "react";
import { analyzeQualityQuestion } from "@/app/asistente/actions";
import {
  assistantQuestions,
  type AssistantFilterOptions,
  type AssistantFilters,
  type AssistantQuestionId,
  type AssistantResponse,
} from "@/lib/assistant/types";
import styles from "./quality-assistant.module.css";

const emptyFilters: AssistantFilters = {
  plantId: "",
  customerId: "",
  productId: "",
  operationId: "",
  shift: "",
  dateFrom: "",
  dateTo: "",
};

type QualityAssistantProps = {
  filterOptions: AssistantFilterOptions;
  initialError: string;
};

export function QualityAssistant({ filterOptions, initialError }: QualityAssistantProps) {
  const [questionId, setQuestionId] = useState<AssistantQuestionId>(assistantQuestions[0].id);
  const [filters, setFilters] = useState<AssistantFilters>(emptyFilters);
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [error, setError] = useState(initialError);
  const [isPending, startTransition] = useTransition();

  const options = useMemo(
    () => buildDependentOptions(filterOptions, filters),
    [filterOptions, filters],
  );

  function analyze() {
    setError("");

    startTransition(async () => {
      try {
        const response = await analyzeQualityQuestion(questionId, filters);
        setResult(response);
      } catch (analysisError) {
        setResult(null);
        setError(getErrorMessage(analysisError));
      }
    });
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Engineer</p>
          <h1 className={styles.title}>Asistente de calidad</h1>
        </div>
      </header>

      <div className={styles.content}>
        {error ? <p className={styles.message}>{error}</p> : null}

        <section className={styles.panel} aria-labelledby="assistant-query-title">
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle} id="assistant-query-title">
                Consulta deterministica
              </h2>
              <p className={styles.panelMeta}>
                Consultas predefinidas sobre controles, defectos y unidades controladas.
              </p>
            </div>
            <button className={styles.button} type="button" onClick={analyze} disabled={isPending}>
              {isPending ? "Analizando..." : "Analizar"}
            </button>
          </div>

          <div className={styles.formGrid}>
            <div className={`${styles.fieldGroup} ${styles.wideField}`}>
              <label className={styles.label} htmlFor="question">
                Pregunta
              </label>
              <select
                className={styles.select}
                id="question"
                value={questionId}
                onChange={(event) => setQuestionId(event.target.value as AssistantQuestionId)}
                disabled={isPending}
              >
                {assistantQuestions.map((question) => (
                  <option key={question.id} value={question.id}>
                    {question.label}
                  </option>
                ))}
              </select>
            </div>

            <FilterSelect
              id="plant-filter"
              label="Planta"
              value={filters.plantId}
              options={options.plants}
              onChange={(plantId) =>
                setFilters((current) => ({
                  ...current,
                  plantId,
                  customerId: "",
                  productId: "",
                  operationId: "",
                }))
              }
              disabled={isPending}
            />
            <FilterSelect
              id="customer-filter"
              label="Cliente"
              value={filters.customerId}
              options={options.customers}
              onChange={(customerId) =>
                setFilters((current) => ({
                  ...current,
                  customerId,
                  productId: "",
                  operationId: "",
                }))
              }
              disabled={isPending}
            />
            <FilterSelect
              id="product-filter"
              label="Pieza"
              value={filters.productId}
              options={options.products}
              onChange={(productId) =>
                setFilters((current) => ({ ...current, productId, operationId: "" }))
              }
              disabled={isPending}
            />
            <FilterSelect
              id="operation-filter"
              label="Operacion"
              value={filters.operationId}
              options={options.operations}
              onChange={(operationId) => setFilters((current) => ({ ...current, operationId }))}
              disabled={isPending}
            />
            <FilterSelect
              id="shift-filter"
              label="Turno"
              value={filters.shift}
              options={options.shifts.map((shift) => ({ id: shift, name: shift }))}
              onChange={(shift) => setFilters((current) => ({ ...current, shift }))}
              disabled={isPending}
            />
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="date-from">
                Desde
              </label>
              <input
                className={styles.input}
                id="date-from"
                type="date"
                value={filters.dateFrom}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateFrom: event.target.value }))
                }
                disabled={isPending}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label className={styles.label} htmlFor="date-to">
                Hasta
              </label>
              <input
                className={styles.input}
                id="date-to"
                type="date"
                value={filters.dateTo}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, dateTo: event.target.value }))
                }
                disabled={isPending}
              />
            </div>
          </div>
        </section>

        <section className={styles.resultGrid} aria-live="polite">
          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <h2 className={styles.panelTitle}>Respuesta</h2>
                <p className={styles.panelMeta}>
                  Resultado calculado con reglas deterministicas.
                </p>
              </div>
            </div>

            {!result ? (
              <p className={styles.empty}>Selecciona una pregunta y presiona Analizar.</p>
            ) : (
              <div className={styles.answerBody}>
                <p className={styles.question}>{result.question}</p>
                <p className={styles.result}>{result.result}</p>
                <p className={styles.explanation}>{result.explanation}</p>
              </div>
            )}
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle}>Metricas principales</h2>
            </div>
            <div className={styles.kpiGrid}>
              <Metric label="Defectos" value={formatInteger(result?.metrics.defects ?? 0)} />
              <Metric
                label="Unidades controladas"
                value={formatInteger(result?.metrics.inspectedQuantity ?? 0)}
              />
              <Metric label="DPU" value={formatDpu(result?.metrics.dpu ?? 0)} />
            </div>
          </article>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <h2 className={styles.panelTitle}>Evidencia</h2>
              <p className={styles.panelMeta}>Registros y agrupaciones que sostienen el calculo.</p>
            </div>
          </div>

          {!result || result.evidence.length === 0 ? (
            <p className={styles.empty}>No hay evidencia para mostrar.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Elemento</th>
                    <th>Defectos</th>
                    <th>Unidades</th>
                    <th>DPU</th>
                    <th>Contexto</th>
                  </tr>
                </thead>
                <tbody>
                  {result.evidence.map((item) => (
                    <tr key={item.id}>
                      <td>{item.label}</td>
                      <td>{formatInteger(item.metrics.defects)}</td>
                      <td>{formatInteger(item.metrics.inspectedQuantity)}</td>
                      <td>{formatDpu(item.metrics.dpu)}</td>
                      <td>
                        {item.context.map((context) => (
                          <p className={styles.contextLine} key={context}>
                            {context}
                          </p>
                        ))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select
        className={styles.select}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
      >
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.metric}>
      <p className={styles.metricLabel}>{label}</p>
      <p className={styles.metricValue}>{value}</p>
    </div>
  );
}

function buildDependentOptions(filterOptions: AssistantFilterOptions, filters: AssistantFilters) {
  const customers = filterOptions.customers.filter(
    (customer) => !filters.plantId || customer.plantId === filters.plantId,
  );
  const products = filterOptions.products.filter(
    (product) =>
      (!filters.plantId || product.plantId === filters.plantId) &&
      (!filters.customerId || product.customerId === filters.customerId),
  );
  const operations = filterOptions.operations.filter(
    (operation) =>
      (!filters.plantId || operation.plantId === filters.plantId) &&
      (!filters.customerId || operation.customerId === filters.customerId) &&
      (!filters.productId || operation.productId === filters.productId),
  );

  return {
    plants: filterOptions.plants,
    customers,
    products: products.map((product) => ({
      id: product.id,
      name: `${product.code} - ${product.name}`,
    })),
    operations: operations.map((operation) => ({
      id: operation.id,
      name: `${operation.code} - ${operation.name}`,
    })),
    shifts: filterOptions.shifts,
  };
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es").format(value);
}

function formatDpu(value: number) {
  return value.toFixed(3);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Ocurrio un error inesperado.";
}
