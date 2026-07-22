import Link from "next/link";
import { ControlDetailPanel } from "@/components/controls/control-history";
import { getControlRecordsData } from "@/lib/controls/get-control-records";
import { createClient } from "@/lib/supabase/server";
import styles from "@/components/controls/control-history.module.css";

export const dynamic = "force-dynamic";

export default async function ControlDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const data = await getControlRecordsData(supabase, { controlId: id });
  const control = data.controls[0] ?? null;

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <p className={styles.eyebrow}>Controles</p>
          <h1 className={styles.title}>Detalle de control</h1>
          <p className={styles.contextLine}>
            {data.tenant ? `${data.tenant.companyName} / ${data.tenant.plantName}` : "Sin contexto activo"}
          </p>
        </div>
      </header>

      <div className={styles.content}>
        <div className={styles.actions}>
          <Link className={`${styles.button} ${styles.secondaryButton}`} href="/controles">
            Volver al historial
          </Link>
        </div>

        {data.status !== "ready" ? (
          <p className={`${styles.message} ${data.status === "error" ? styles.error : ""}`}>
            {data.error || "El usuario no tiene acceso a este control."}
          </p>
        ) : null}

        {data.status === "ready" && !control ? (
          <p className={styles.empty}>No se encontro el control solicitado para la empresa y planta activas.</p>
        ) : null}

        {data.status === "ready" ? <ControlDetailPanel control={control} /> : null}
      </div>
    </main>
  );
}
