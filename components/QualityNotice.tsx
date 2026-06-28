import type { QualityNoticeData } from "@/types/quality";

const NUMBER_FORMAT = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });
const PERCENT_FORMAT = new Intl.NumberFormat("es-AR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export default function QualityNotice({ notice }: { notice: QualityNoticeData }) {
  const priorityParts = [
    notice.combinedPriority.piece,
    notice.combinedPriority.operation,
    notice.combinedPriority.failureMode,
  ].filter((value): value is string => Boolean(value));

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
        <p className="global-findings-note">
          Los siguientes hallazgos corresponden a rankings globales independientes.
        </p>
        <p>
          Se registraron <strong>{NUMBER_FORMAT.format(notice.totalNoOk)}</strong> unidades no OK.
          La pieza con mayor volumen total no OK es <strong>{notice.piece}</strong>, con{" "}
          <strong>{NUMBER_FORMAT.format(notice.pieceNoOk)}</strong> unidades no conformes.
        </p>
        <p>
          El modo de falla más frecuente a nivel general es <strong>{notice.failureMode}</strong>,
          representando{" "}
          <strong>{PERCENT_FORMAT.format(notice.failureModePercentage)}%</strong> del total de
          unidades no OK registradas.
        </p>
        {notice.operation && (
          <p>
            La operación con mayor volumen registrado a nivel general es{" "}
            <strong>{notice.operation}</strong>.
          </p>
        )}
        {notice.shift && (
          <p>
            El turno con mayor volumen registrado a nivel general es <strong>{notice.shift}</strong>.
          </p>
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
        <strong>
          Revisar prioritariamente la combinación con mayor concentración registrada:{" "}
          {priorityParts.join(" / ")}, con{" "}
          {NUMBER_FORMAT.format(notice.combinedPriority.totalNoOk)} unidades no OK.
        </strong>
      </div>
    </aside>
  );
}
