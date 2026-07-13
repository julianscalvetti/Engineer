type ProgressCallback = (progress: number, status: string) => void;

async function imageSourcesFromPdf(file: File, onProgress: ProgressCallback) {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const sources: string[] = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    onProgress((pageNumber - 1) / pdf.numPages, `Preparando pagina ${pageNumber} de ${pdf.numPages}`);
    const page = await pdf.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("No se pudo preparar el PDF para OCR.");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    sources.push(canvas.toDataURL("image/png"));
  }

  return sources;
}

export async function runOcr(file: File, onProgress: ProgressCallback) {
  const { createWorker } = await import("tesseract.js");
  const sources = file.type === "application/pdf" ? await imageSourcesFromPdf(file, onProgress) : [file];
  let currentPage = 0;
  const worker = await createWorker(["spa", "eng"], undefined, {
    logger: ({ progress, status }) => {
      const combined = (currentPage + progress) / sources.length;
      onProgress(combined, status === "recognizing text" ? "Reconociendo texto" : "Cargando OCR");
    },
  });

  try {
    const pages: string[] = [];
    for (currentPage = 0; currentPage < sources.length; currentPage += 1) {
      const result = await worker.recognize(sources[currentPage]);
      pages.push(result.data.text.trim());
    }
    onProgress(1, "OCR completado");
    return pages.filter(Boolean).join("\n\n--- PAGINA ---\n\n");
  } finally {
    await worker.terminate();
  }
}
