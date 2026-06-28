import type { QualityAnalysis, RankingItem } from "@/types/quality";
import { generateNotice } from "@/lib/generateNotice";
import QualityNotice from "./QualityNotice";

const NUMBER_FORMAT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const PERCENT_FORMAT = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

function RankingTable({ title, items }: { title: string; items: RankingItem[] }) {
  return (
    <section className="ranking-card">
      <h3>{title}</h3>
      {items.length > 0 ? (
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Ítem</th>
                <th className="numeric-cell">No OK</th>
                <th className="numeric-cell">Participación</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.label}>
                  <td>{index + 1}</td>
                  <td>{item.label}</td>
                  <td className="numeric-cell">{NUMBER_FORMAT.format(item.totalNoOk)}</td>
                  <td className="numeric-cell">{PERCENT_FORMAT.format(item.percentage)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="empty-ranking">No hay datos válidos para este ranking.</p>
      )}
    </section>
  );
}

export default function ResultsTables({ analysis }: { analysis: QualityAnalysis }) {
  const notice = generateNotice(analysis);

  return (
    <section className="results-panel" aria-labelledby="results-title">
      <div className="results-heading">
        <span className="eyebrow">Procesamiento completado</span>
        <h2 id="results-title">Resultados básicos</h2>
      </div>

      <div className="metrics-grid">
        <div className="metric-card primary-metric">
          <span>Total de unidades no OK</span>
          <strong>{NUMBER_FORMAT.format(analysis.totalNoOk)}</strong>
        </div>
        <div className="metric-card">
          <span>Filas válidas</span>
          <strong>{NUMBER_FORMAT.format(analysis.validRows)}</strong>
        </div>
        <div className="metric-card">
          <span>Filas descartadas</span>
          <strong>{NUMBER_FORMAT.format(analysis.discardedRows)}</strong>
        </div>
      </div>

      {analysis.estimatedRate ? (
        <div className="rate-summary">
          <div>
            <span>Denominador utilizado</span>
            <strong>{analysis.estimatedRate.denominatorColumn}</strong>
            <small>Suma válida: {NUMBER_FORMAT.format(analysis.estimatedRate.denominatorTotal)}</small>
          </div>
          <div>
            <span>Tasa estimada</span>
            <strong>{PERCENT_FORMAT.format(analysis.estimatedRate.percentage)}%</strong>
          </div>
        </div>
      ) : (
        <div className="rate-warning" role="status">
          No se calculó una tasa estimada porque no hay un denominador numérico positivo válido.
        </div>
      )}

      <p className="estimate-note">
        Los rankings por cantidad no OK son el resultado principal. La tasa es estimada y puede
        incluir totales repetidos cuando un mismo control aparece en varias filas.
      </p>

      {notice && <QualityNotice notice={notice} />}

      <div className="rankings-grid">
        <RankingTable title="Top 5 modos de falla" items={analysis.failureModes} />
        <RankingTable title="Top 5 piezas" items={analysis.pieces} />
        {analysis.operations !== null && (
          <RankingTable title="Top 5 operaciones" items={analysis.operations} />
        )}
        {analysis.shifts !== null && (
          <RankingTable title="Top 5 turnos" items={analysis.shifts} />
        )}
      </div>
    </section>
  );
}
