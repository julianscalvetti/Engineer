import type { QualityNoticeData } from "@/types/quality";

const NUMBER_FORMAT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const PERCENT_FORMAT = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export default function QualityNotice({ notice }: { notice: QualityNoticeData }) {
  return (
    <aside className="quality-notice" aria-labelledby="quality-notice-title">
      <div className="notice-heading">
        <span className="notice-icon" aria-hidden="true">!</span>
        <div>
          <span className="eyebrow">Resumen automático por reglas</span>
          <h2 id="quality-notice-title">Aviso de calidad</h2>
        </div>
      </div>

      <div className="notice-body">
        <p>
          Se registraron <strong>{NUMBER_FORMAT.format(notice.totalNoOk)}</strong> unidades no OK.
          El mayor volumen se concentra en <strong>{notice.piece}</strong>, con{" "}
          <strong>{NUMBER_FORMAT.format(notice.pieceNoOk)}</strong> unidades no conformes.
        </p>
        <p>
          El modo de falla principal es <strong>{notice.failureMode}</strong>, representando{" "}
          <strong>{PERCENT_FORMAT.format(notice.failureModePercentage)}%</strong> del total de
          unidades no OK registradas.
        </p>
        {notice.operation && (
          <p>La operación más asociada al problema es <strong>{notice.operation}</strong>.</p>
        )}
        {notice.shift && (
          <p>El turno con mayor volumen de no OK es <strong>{notice.shift}</strong>.</p>
        )}
        {notice.estimatedRate && (
          <p>
            Usando <strong>{notice.estimatedRate.denominatorColumn}</strong> como denominador, la
            tasa estimada es <strong>{PERCENT_FORMAT.format(notice.estimatedRate.percentage)}%</strong>.
          </p>
        )}
      </div>

      <div className="notice-priority">
        <span>Prioridad sugerida</span>
        <strong>Revisar {notice.priority.join(" / ")}.</strong>
      </div>
    </aside>
  );
}
