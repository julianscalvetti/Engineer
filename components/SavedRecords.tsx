import type { FailureRecord, Product } from "@/types/failure";

type Props = {
  records: FailureRecord[];
  products: Product[];
};

export default function SavedRecords({ records, products }: Props) {
  return (
    <section className="records-panel" aria-labelledby="records-title">
      <div className="records-heading">
        <div>
          <div className="panel-kicker">HISTORIAL LOCAL</div>
          <h2 id="records-title">Registros guardados</h2>
        </div>
        <span>{records.length}</span>
      </div>

      {records.length === 0 ? (
        <p className="records-empty">Todavia no hay registros en este navegador.</p>
      ) : (
        <div className="records-list">
          {records.slice(0, 6).map((record) => {
            const product = products.find((item) => item.code === record.productCode);
            return (
              <article key={record.id} className="record-item">
                <div className="record-code"><strong>{record.productCode}</strong><span>{product?.name}</span></div>
                <div><span>Estacion</span><strong>{record.operationStation}</strong></div>
                <div><span>Turno / Operador</span><strong>{record.shift} · {record.operator}</strong></div>
                <div><span>Fecha</span><strong>{new Intl.DateTimeFormat("es-AR", { dateStyle: "short", timeStyle: "short" }).format(new Date(record.timestamp))}</strong></div>
                <div className="record-total"><span>Total</span><strong>{record.total}</strong></div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
