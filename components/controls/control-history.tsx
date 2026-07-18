"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ControlHistoryData, ControlHistoryFilters, ControlRecord } from "@/lib/controls/types";
import styles from "./control-history.module.css";

export type { ControlRecord };

type ControlHistoryProps = ControlHistoryData;

export function ControlHistory({
  status,
  tenant,
  controls,
  total,
  page,
  pageSize,
  filters,
  options,
  transferredRows,
  error,
}: ControlHistoryProps) {
  const [selectedControlId, setSelectedControlId] = useState(controls[0]?.id ?? "");
  const selectedControl = useMemo(
    () => controls.find((control) => control.id === selectedControlId) ?? controls[0] ?? null,
    [controls, selectedControlId],
  );
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const detailTotalDefects = selectedControl ? getTotalDefects(selectedControl) : 0;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Controles</p>
          <h1 className={styles.title}>Historial de controles</h1>
          <p className={styles.contextLine}>
            {tenant ? `${tenant.companyName} / ${tenant.plantName}` : "Sin contexto activo"}
          </p>
        </div>
      </header>

      <div className={styles.content}>
        {status !== "ready" ? <StateMessage status={status} message={error} /> : null}

        <div className={styles.layout}>
          <section className={styles.panel} aria-labelledby="records-title">
            <div className={styles.panelHeader}>
              <h2 className={styles.panelTitle} id="records-title">
                Controles registrados
              </h2>
              <p className={styles.panelMeta}>
                {formatInteger(total)} resultados. Pagina {page} de {totalPages}. {transferredRows} filas transferidas.
              </p>
            </div>

            <form className={styles.filters} action="/controles">
              <FilterSelect
                id="customer-filter"
                name="customerId"
                label="Cliente"
                value={filters.customerId}
                options={options.customers}
              />
              <FilterSelect
                id="product-filter"
                name="productId"
                label="Pieza"
                value={filters.productId}
                options={options.products.map((product) => ({
                  id: product.id,
                  name: `${product.code} - ${product.name}`,
                }))}
              />
              <FilterSelect
                id="operation-filter"
                name="operationId"
                label="Operacion"
                value={filters.operationId}
                options={options.operations.map((operation) => ({
                  id: operation.id,
                  name: `${operation.code} - ${operation.name}`,
                }))}
              />
              <FilterSelect
                id="failure-mode-filter"
                name="failureModeId"
                label="Modo de falla"
                value={filters.failureModeId}
                options={options.failureModes}
              />

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="date-from-filter">
                  Desde
                </label>
                <input
                  className={styles.input}
                  id="date-from-filter"
                  name="dateFrom"
                  type="date"
                  defaultValue={filters.dateFrom}
                />
              </div>

              <div className={styles.fieldGroup}>
                <label className={styles.label} htmlFor="date-to-filter">
                  Hasta
                </label>
                <input
                  className={styles.input}
                  id="date-to-filter"
                  name="dateTo"
                  type="date"
                  defaultValue={filters.dateTo}
                />
              </div>

              <input name="pageSize" type="hidden" value={String(pageSize)} />
              <div className={styles.actions}>
                <button className={styles.button} type="submit">
                  Aplicar filtros
                </button>
                <Link className={`${styles.button} ${styles.secondaryButton}`} href="/controles">
                  Limpiar
                </Link>
              </div>
            </form>

            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Empresa</th>
                    <th>Planta</th>
                    <th>Cliente</th>
                    <th>Pieza</th>
                    <th>Operacion</th>
                    <th>Fecha</th>
                    <th>Turno</th>
                    <th>Operario</th>
                    <th>Cantidad</th>
                    <th>Defectos</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {controls.map((control) => {
                    const product = control.operations?.products;
                    const customer = product?.customers;
                    const plant = customer?.plants;
                    const company = plant?.companies;

                    return (
                      <tr className={control.id === selectedControl?.id ? styles.selectedRow : ""} key={control.id}>
                        <td>{company?.name ?? "-"}</td>
                        <td>{plant?.name ?? "-"}</td>
                        <td>{customer?.name ?? "-"}</td>
                        <td>
                          <p className={styles.primaryText}>{product?.name ?? "-"}</p>
                          <p className={styles.mutedText}>{product?.code ?? ""}</p>
                        </td>
                        <td>
                          <p className={styles.primaryText}>{control.operations?.name ?? "-"}</p>
                          <p className={styles.mutedText}>{control.operations?.code ?? ""}</p>
                        </td>
                        <td>{control.date}</td>
                        <td>{control.shift}</td>
                        <td>{control.operator}</td>
                        <td>{formatInteger(control.inspected_quantity)}</td>
                        <td>{formatInteger(getTotalDefects(control))}</td>
                        <td>
                          <button
                            className={`${styles.button} ${styles.secondaryButton}`}
                            type="button"
                            onClick={() => setSelectedControlId(control.id)}
                          >
                            Ver
                          </button>
                          <Link className={`${styles.button} ${styles.secondaryButton}`} href={`/controles/${control.id}`}>
                            Abrir
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {controls.length === 0 ? <p className={styles.empty}>No hay controles para los filtros seleccionados.</p> : null}

            <Pagination filters={filters} page={page} pageSize={pageSize} totalPages={totalPages} />
          </section>

          <ControlDetailPanel control={selectedControl} totalDefects={detailTotalDefects} />
        </div>
      </div>
    </main>
  );
}

export function ControlDetailPanel({
  control,
  totalDefects,
}: {
  control: ControlRecord | null;
  totalDefects?: number;
}) {
  if (!control) {
    return (
      <section className={styles.panel} aria-labelledby="detail-title">
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle} id="detail-title">
            Detalle de control
          </h2>
          <p className={styles.panelMeta}>Selecciona un control.</p>
        </div>
        <p className={styles.empty}>No hay un control seleccionado.</p>
      </section>
    );
  }

  const defects = totalDefects ?? getTotalDefects(control);

  return (
    <section className={styles.panel} aria-labelledby="detail-title">
      <div className={styles.panelHeader}>
        <h2 className={styles.panelTitle} id="detail-title">
          Detalle de control
        </h2>
        <p className={styles.panelMeta}>{control.id}</p>
      </div>

      <div className={styles.detailBody}>
        <div className={styles.detailGrid}>
          <DataItem label="Empresa" value={getCompanyName(control)} />
          <DataItem label="Planta" value={getPlantName(control)} />
          <DataItem label="Cliente" value={getCustomerName(control)} />
          <DataItem
            label="Pieza"
            value={`${control.operations?.products?.code ?? "-"} - ${control.operations?.products?.name ?? "-"}`}
          />
          <DataItem label="Operacion" value={`${control.operations?.code ?? "-"} - ${control.operations?.name ?? "-"}`} />
          <DataItem label="Fecha" value={control.date} />
          <DataItem label="Turno" value={control.shift} />
          <DataItem label="Operario" value={control.operator} />
          <DataItem label="Cantidad controlada" value={formatInteger(control.inspected_quantity)} />
          <DataItem label="Total defectos" value={formatInteger(defects)} />
          <DataItem label="Creado" value={formatDateTime(control.created_at)} />
          <DataItem label="Actualizado" value={formatDateTime(control.updated_at)} />
          <DataItem label="Observaciones" value={control.observations || "-"} wide />
        </div>

        <div className={styles.failureList}>
          <div className={styles.failureHeader}>
            <span>Falla detectada</span>
            <span>Cantidad</span>
          </div>
          {control.control_failures.length === 0 ? (
            <p className={styles.empty}>Control sin fallas detectadas.</p>
          ) : null}
          {control.control_failures.map((failure) => (
            <div className={styles.failureRow} key={failure.id}>
              <span>{failure.failure_modes?.name ?? "-"}</span>
              <span>{formatInteger(failure.quantity)}</span>
            </div>
          ))}
        </div>

        <div className={styles.detailGrid}>
          <DataItem label="Archivo origen" value={control.import_files?.file_name ?? "-"} wide />
          <DataItem label="Hoja" value={control.source_sheet_name ?? "-"} />
          <DataItem label="Fila" value={control.source_row_number ? String(control.source_row_number) : "-"} />
          <DataItem label="Celda" value={control.source_cell_address ?? "-"} />
          <DataItem label="Registro fuente" value={control.source_record_id ?? "-"} />
          <DataItem label="Mapping" value={control.mapping_id ?? "-"} />
          <DataItem label="Version mapping" value={control.mapping_version ?? "-"} />
          <DataItem label="Estado fuente" value={control.source_record_status ?? "-"} />
          <DataItem label="Batch" value={control.import_batch_id ?? "-"} wide />
        </div>
      </div>
    </section>
  );
}

function FilterSelect({
  id,
  name,
  label,
  value,
  options,
}: {
  id: string;
  name: string;
  label: string;
  value: string;
  options: Array<{ id: string; name: string }>;
}) {
  return (
    <div className={styles.fieldGroup}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select className={styles.select} id={id} name={name} defaultValue={value}>
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

function Pagination({
  filters,
  page,
  pageSize,
  totalPages,
}: {
  filters: ControlHistoryFilters;
  page: number;
  pageSize: number;
  totalPages: number;
}) {
  return (
    <div className={styles.pagination}>
      <Link
        aria-disabled={page <= 1}
        className={`${styles.button} ${styles.secondaryButton} ${page <= 1 ? styles.disabledLink : ""}`}
        href={page <= 1 ? "#" : historyHref(filters, page - 1, pageSize)}
      >
        Anterior
      </Link>
      <span className={styles.pageLabel}>
        Pagina {page} / {totalPages}
      </span>
      <Link
        aria-disabled={page >= totalPages}
        className={`${styles.button} ${styles.secondaryButton} ${page >= totalPages ? styles.disabledLink : ""}`}
        href={page >= totalPages ? "#" : historyHref(filters, page + 1, pageSize)}
      >
        Siguiente
      </Link>
    </div>
  );
}

function historyHref(filters: ControlHistoryFilters, page: number, pageSize: number) {
  const params = new URLSearchParams();
  params.set("dateFrom", filters.dateFrom);
  params.set("dateTo", filters.dateTo);
  params.set("page", String(page));
  params.set("pageSize", String(pageSize));
  if (filters.customerId) params.set("customerId", filters.customerId);
  if (filters.productId) params.set("productId", filters.productId);
  if (filters.operationId) params.set("operationId", filters.operationId);
  if (filters.failureModeId) params.set("failureModeId", filters.failureModeId);
  return `/controles?${params.toString()}`;
}

function StateMessage({ status, message }: { status: ControlHistoryProps["status"]; message: string }) {
  const fallback =
    status === "unauthenticated"
      ? "Inicia sesion para ver datos reales."
      : status === "unauthorized"
        ? "El usuario no tiene acceso a la empresa activa."
        : "No se pudieron cargar los datos reales.";

  return <p className={`${styles.message} ${status === "error" ? styles.error : ""}`}>{message || fallback}</p>;
}

function DataItem({ label, value, wide = false }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={`${styles.dataItem} ${wide ? styles.wideField : ""}`}>
      <p className={styles.dataLabel}>{label}</p>
      <p className={styles.dataValue}>{value}</p>
    </div>
  );
}

function getTotalDefects(control: ControlRecord) {
  return control.control_failures.reduce((total, failure) => total + failure.quantity, 0);
}

function getCompanyName(control: ControlRecord) {
  return control.operations?.products?.customers?.plants?.companies?.name ?? "-";
}

function getPlantName(control: ControlRecord) {
  return control.operations?.products?.customers?.plants?.name ?? "-";
}

function getCustomerName(control: ControlRecord) {
  return control.operations?.products?.customers?.name ?? "-";
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("es", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("es").format(value);
}
