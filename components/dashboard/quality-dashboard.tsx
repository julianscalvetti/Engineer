"use client";

import { useMemo, useState } from "react";
import type { DashboardData, DashboardSummary } from "@/lib/dashboard/types";
import styles from "./quality-dashboard.module.css";

const horizons = [1, 3, 6, 12] as const;

type QualityDashboardProps = DashboardData;

export function QualityDashboard({
  status,
  tenant,
  summary,
  initialError,
}: QualityDashboardProps) {
  const [horizonMonths, setHorizonMonths] = useState<(typeof horizons)[number]>(12);
  const visibleEvolution = useMemo(
    () => filterEvolution(summary?.evolution ?? [], horizonMonths),
    [summary, horizonMonths],
  );

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Engineer</p>
          <h1 className={styles.title}>Dashboard de calidad industrial</h1>
          <p className={styles.contextLine}>
            {tenant ? `${tenant.companyName} / ${tenant.plantName}` : "Sin contexto activo"}
          </p>
        </div>
      </header>

      <div className={styles.content}>
        {status !== "ready" ? <StateMessage status={status} message={initialError} /> : null}
        {status === "ready" && !summary ? (
          <p className={styles.empty}>No hay metricas disponibles para la empresa y planta activas.</p>
        ) : null}

        <section className={styles.kpiGrid} aria-label="KPIs principales">
          <KpiCard label="DPU Total" value={formatDpu(summary?.kpis.dpu ?? 0)} meta="Defectos / unidades" />
          <KpiCard
            label="Unidades controladas"
            value={formatInteger(summary?.kpis.inspectedQuantity ?? 0)}
            meta="Suma inspeccionada"
          />
          <KpiCard label="Defectos" value={formatInteger(summary?.kpis.defects ?? 0)} meta="Fallas detectadas" />
          <KpiCard
            label="Controles realizados"
            value={formatInteger(summary?.kpis.controls ?? 0)}
            meta="Registros importados"
          />
        </section>

        <section className={styles.grid}>
          <Panel
            title="Evolucion DPU"
            meta="Serie diaria agregada desde Supabase."
            action={
              <div className={styles.horizon}>
                {horizons.map((horizon) => (
                  <button
                    className={`${styles.horizonButton} ${
                      horizon === horizonMonths ? styles.activeHorizon : ""
                    }`}
                    key={horizon}
                    type="button"
                    onClick={() => setHorizonMonths(horizon)}
                  >
                    {horizon} mes{horizon === 1 ? "" : "es"}
                  </button>
                ))}
              </div>
            }
          >
            <LineChart data={visibleEvolution} />
          </Panel>

          <Panel title="DPU por operacion" meta="Top 10 operaciones por indice de defectos.">
            <BarList
              data={(summary?.operationDpu ?? []).map((item) => ({
                label: item.label,
                value: item.value,
                valueLabel: formatDpu(item.value),
              }))}
            />
          </Panel>
        </section>

        <section className={styles.grid}>
          <Panel title="Top modos de falla" meta="Top 10 fallas por cantidad detectada.">
            <BarList
              data={(summary?.failureRanking ?? []).map((item) => ({
                label: item.label,
                value: item.quantity,
                valueLabel: formatInteger(item.quantity),
              }))}
            />
          </Panel>

          <Panel title="Pareto de fallas" meta="Barras por cantidad y linea acumulada porcentual.">
            <ParetoChart data={summary?.failureRanking ?? []} />
          </Panel>
        </section>

        <section className={styles.grid}>
          <Panel title="Controles del dia" meta="Resumen agregado de la fecha actual.">
            <TodaySummary summary={summary} />
          </Panel>
          <Panel title="Transferencia" meta="Filas agregadas devueltas por la RPC.">
            <MetricList
              items={[
                {
                  label: "Filas transferidas",
                  value: formatInteger(summary?.transferredRows ?? 0),
                  meta: "Sin controles individuales",
                },
              ]}
            />
          </Panel>
        </section>
      </div>
    </main>
  );
}

function KpiCard({ label, value, meta }: { label: string; value: string; meta: string }) {
  return (
    <article className={styles.kpiCard}>
      <p className={styles.kpiLabel}>{label}</p>
      <p className={styles.kpiValue}>{value}</p>
      <p className={styles.kpiMeta}>{meta}</p>
    </article>
  );
}

function StateMessage({ status, message }: { status: QualityDashboardProps["status"]; message: string }) {
  const fallback =
    status === "unauthenticated"
      ? "Inicia sesion para ver datos reales."
      : status === "unauthorized"
        ? "El usuario no tiene acceso a la empresa activa."
        : "No se pudieron cargar los datos reales.";

  return <p className={styles.message}>{message || fallback}</p>;
}

function Panel({
  title,
  meta,
  action,
  children,
}: {
  title: string;
  meta: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelHeader}>
        <div>
          <h2 className={styles.panelTitle}>{title}</h2>
          <p className={styles.panelMeta}>{meta}</p>
        </div>
        {action}
      </div>
      <div className={styles.panelBody}>{children}</div>
    </section>
  );
}

function LineChart({ data }: { data: Array<{ label: string; dpu: number }> }) {
  if (data.length === 0) return <p className={styles.empty}>No hay datos para graficar.</p>;

  const maxValue = Math.max(...data.map((item) => item.dpu), 0.001);
  const points = data.map((item, index) => {
    const x = data.length === 1 ? 50 : (index / (data.length - 1)) * 100;
    const y = (item.dpu / maxValue) * 100;
    return { ...item, x, y };
  });

  return (
    <div className={styles.lineChart}>
      <div className={styles.axis}>
        <span>{formatDpu(maxValue)}</span>
        <span>{formatDpu(maxValue / 2)}</span>
        <span>0</span>
      </div>
      <div className={styles.plot}>
        {points.slice(1).map((point, index) => {
          const previous = points[index];
          const dx = point.x - previous.x;
          const dy = previous.y - point.y;
          const length = Math.sqrt(dx * dx + dy * dy);
          const angle = Math.atan2(dy, dx) * (180 / Math.PI);

          return (
            <span
              aria-hidden="true"
              className={styles.lineSegment}
              key={`${previous.label}-${point.label}`}
              style={{
                bottom: `${previous.y}%`,
                left: `${previous.x}%`,
                transform: `rotate(${angle}deg)`,
                width: `${length}%`,
              }}
            />
          );
        })}
        {points.map((point) => (
          <span
            aria-label={`${point.label}: ${formatDpu(point.dpu)}`}
            className={styles.point}
            key={point.label}
            style={{ bottom: `${point.y}%`, left: `${point.x}%` }}
            title={`${point.label}: ${formatDpu(point.dpu)}`}
          />
        ))}
      </div>
      <div className={styles.xLabels} style={{ "--label-count": String(Math.min(data.length, 6)) } as React.CSSProperties}>
        {pickLabels(data).map((item) => (
          <span key={item.label}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}

function BarList({ data }: { data: Array<{ label: string; value: number; valueLabel: string }> }) {
  if (data.length === 0) return <p className={styles.empty}>No hay datos para mostrar.</p>;

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className={styles.barList}>
      {data.map((item) => (
        <div className={styles.barRow} key={item.label}>
          <div>
            <p className={styles.barLabel}>{item.label}</p>
            <div className={styles.barTrack}>
              <div className={styles.barFill} style={{ width: `${(item.value / maxValue) * 100}%` }} />
            </div>
          </div>
          <span className={styles.barValue}>{item.valueLabel}</span>
        </div>
      ))}
    </div>
  );
}

function ParetoChart({ data }: { data: Array<{ label: string; quantity: number }> }) {
  if (data.length === 0) return <p className={styles.empty}>No hay fallas detectadas.</p>;

  const total = data.reduce((sum, item) => sum + item.quantity, 0);
  const maxValue = Math.max(...data.map((item) => item.quantity), 1);
  const paretoData = data.reduce<Array<{ label: string; quantity: number; cumulativePercent: number }>>(
    (items, item) => {
      const previousTotal = items.at(-1)?.cumulativePercent ?? 0;
      const itemPercent = total > 0 ? (item.quantity / total) * 100 : 0;
      return [...items, { ...item, cumulativePercent: previousTotal + itemPercent }];
    },
    [],
  );

  return (
    <div className={styles.barList}>
      {paretoData.map((item) => (
        <div className={styles.paretoRow} key={item.label}>
          <div>
            <p className={styles.barLabel}>{item.label}</p>
            <div className={styles.paretoTrack}>
              <div className={styles.paretoBar} style={{ width: `${(item.quantity / maxValue) * 100}%` }} />
              <span className={styles.paretoLine} style={{ left: `${item.cumulativePercent}%` }} />
            </div>
          </div>
          <span className={styles.barValue}>{formatInteger(item.quantity)}</span>
          <span className={styles.barValue}>{item.cumulativePercent.toFixed(0)}%</span>
        </div>
      ))}
    </div>
  );
}

function TodaySummary({ summary }: { summary: DashboardSummary | null }) {
  const today = summary?.todaySummary;
  if (!today || today.controls === 0) return <p className={styles.empty}>No hay controles cargados en la fecha actual.</p>;

  return (
    <MetricList
      items={[
        { label: "Controles", value: formatInteger(today.controls), meta: "Fecha actual" },
        { label: "Unidades", value: formatInteger(today.inspectedQuantity), meta: "Inspeccionadas" },
        { label: "Defectos", value: formatInteger(today.defects), meta: "Detectados" },
        { label: "DPU", value: formatDpu(today.dpu), meta: "Defectos / unidades" },
      ]}
    />
  );
}

function MetricList({ items }: { items: Array<{ label: string; value: string; meta: string }> }) {
  return (
    <div className={styles.summaryGrid}>
      {items.map((item) => (
        <div className={styles.summaryMetric} key={item.label}>
          <p className={styles.kpiLabel}>{item.label}</p>
          <p className={styles.summaryValue}>{item.value}</p>
          <p className={styles.kpiMeta}>{item.meta}</p>
        </div>
      ))}
    </div>
  );
}

function filterEvolution(data: DashboardSummary["evolution"], horizonMonths: number) {
  if (data.length === 0) return [];

  const end = data[data.length - 1]?.label;
  const endDate = end ? new Date(`${end}T00:00:00`) : new Date();
  const startDate = new Date(endDate);
  startDate.setMonth(startDate.getMonth() - horizonMonths);
  const startKey = toDateKey(startDate);

  return data.filter((item) => item.label >= startKey);
}

function pickLabels(data: Array<{ label: string }>) {
  if (data.length <= 6) return data;

  const result = [];
  const step = (data.length - 1) / 5;
  for (let index = 0; index < 6; index += 1) result.push(data[Math.round(index * step)]);

  return result;
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es").format(value);
}

function formatDpu(value: number) {
  return value.toFixed(3);
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
