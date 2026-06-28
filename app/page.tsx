import FileUploader from "@/components/FileUploader";

export default function Home() {
  return (
    <main className="page-shell">
      <section className="hero" aria-labelledby="page-title">
        <span className="eyebrow">Quality AI · MVP</span>
        <h1 id="page-title">Validá tu base de calidad</h1>
        <p>
          Cargá el CSV exportado desde <strong>BASE DE REGISTRO</strong> para comprobar
          si contiene la estructura mínima requerida.
        </p>
      </section>

      <FileUploader />

      <p className="privacy-note">
        El archivo se procesa únicamente en este navegador y no se almacena.
      </p>
    </main>
  );
}
