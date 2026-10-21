"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
function PdfCanvas({
  document,
  page,
  scale,
}: {
  document: PDFDocumentProxy;
  page: number;
  scale: number;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    let task:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    void (async () => {
      try {
        const p = await document.getPage(page);
        if (cancelled || !canvas.current) return;
        const viewport = p.getViewport({ scale });
        canvas.current.width = viewport.width;
        canvas.current.height = viewport.height;
        task = p.render({ canvas: canvas.current, viewport });
        await task.promise;
      } catch {
        if (!cancelled) setError("Halaman belum dapat dirender.");
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [document, page, scale]);
  return (
    <div>
      {error && <p role="status">{error}</p>}
      <canvas
        aria-label={"Halaman " + page}
        ref={canvas}
        className="mx-auto border"
      />
    </div>
  );
}
export function BookReader({
  assetId,
  external,
}: {
  assetId?: string | undefined;
  external?: string | undefined;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [scale, setScale] = useState(1),
    [mode, setMode] = useState("flip"),
    [error, setError] = useState("");
  const source = assetId ? "/api/learning/assets/" + assetId : external;
  useEffect(() => {
    if (!assetId) return;
    let cancel = false;
    let task:
      | ReturnType<(typeof import("pdfjs-dist"))["getDocument"]>
      | undefined;
    void (async () => {
      try {
        const pdf = await import("pdfjs-dist");
        pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        task = pdf.getDocument({
          url: "/api/learning/assets/" + assetId,
          disableRange: true,
        });
        const doc = await task.promise;
        if (cancel) {
          await task.destroy();
          return;
        }
        setDocument(doc);
        setPage(1);
      } catch {
        if (!cancel)
          setError(
            "Pembaca tidak dapat membuka PDF. Gunakan tampilan standar bila tersedia.",
          );
      }
    })();
    return () => {
      cancel = true;
      void task?.destroy();
    };
  }, [assetId]);
  if (!source) return <p>Belum ada berkas atau URL buku.</p>;
  return (
    <section className="space-y-3 rounded border p-3">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => setMode(mode === "flip" ? "scroll" : "flip")}
        >
          {mode === "flip" ? "Mode gulir" : "Mode halaman"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setScale((v) => Math.max(0.5, v - 0.25))}
        >
          Perkecil
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setScale((v) => Math.min(2, v + 0.25))}
        >
          Perbesar
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setMode("native")}
        >
          Tampilan standar
        </Button>
        <a
          href={source}
          target="_blank"
          rel="noreferrer"
          className="self-center underline"
        >
          Buka terpisah
        </a>
      </div>
      {error && <p role="status">{error}</p>}
      {!assetId || mode === "native" ? (
        <iframe
          title="Pembaca buku digital"
          src={source}
          className="h-[70vh] w-full"
          sandbox="allow-scripts allow-same-origin allow-downloads"
        />
      ) : document ? (
        <>
          {mode === "flip" ? (
            <>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((v) => v - 1)}
                >
                  Sebelumnya
                </Button>
                <span>
                  {page}/{document.numPages}
                </span>
                <Button
                  type="button"
                  disabled={page >= document.numPages}
                  onClick={() => setPage((v) => v + 1)}
                >
                  Berikutnya
                </Button>
              </div>
              <PdfCanvas document={document} page={page} scale={scale} />
            </>
          ) : (
            <div className="max-h-[75vh] space-y-4 overflow-auto">
              <div className="flex gap-3">
                <Button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((v) => Math.max(1, v - 20))}
                >
                  20 halaman sebelumnya
                </Button>
                <span>
                  {page}–{Math.min(document.numPages, page + 19)} /{" "}
                  {document.numPages}
                </span>
                <Button
                  type="button"
                  disabled={page + 20 > document.numPages}
                  onClick={() => setPage((v) => v + 20)}
                >
                  20 halaman berikutnya
                </Button>
              </div>
              {Array.from(
                { length: Math.min(document.numPages - page + 1, 20) },
                (_, i) => (
                  <PdfCanvas
                    key={page + i}
                    document={document}
                    page={page + i}
                    scale={scale}
                  />
                ),
              )}
            </div>
          )}
        </>
      ) : (
        <p>Memuat buku…</p>
      )}
    </section>
  );
}
