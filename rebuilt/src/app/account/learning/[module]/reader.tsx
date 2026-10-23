"use client";
import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Button } from "@/components/ui/button";
import { bookLocator } from "@/lib/learning/books";
/** Each render owns its canvas so a cancelled PDF.js task cannot reuse a live canvas. */
function PdfCanvas({
  document,
  page,
  scale,
  width,
}: {
  document: PDFDocumentProxy;
  page: number;
  scale: number;
  width: number;
}) {
  const host = useRef<HTMLDivElement>(null),
    [error, setError] = useState(""),
    [visible, setVisible] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || !width) return;
    let cancelled = false;
    let task:
      | ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]>
      | undefined;
    const node = host.current,
      canvas = window.document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", `Halaman ${page}`);
    void (async () => {
      try {
        const p = await document.getPage(page);
        if (cancelled || !node) return;
        setError("");
        const original = p.getViewport({ scale: 1 }),
          cssScale = (Math.max(1, width - 16) / original.width) * scale,
          css = p.getViewport({ scale: cssScale });
        const density = Math.min(
            window.devicePixelRatio || 1,
            2,
            Math.sqrt(4000000 / (css.width * css.height)),
          ),
          viewport = p.getViewport({ scale: cssScale * density });
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        canvas.style.width = `${css.width}px`;
        canvas.style.height = `${css.height}px`;
        node.append(canvas);
        task = p.render({ canvas, viewport });
        await task.promise;
      } catch {
        if (!cancelled)
          setError("Halaman belum dapat dirender. Coba tampilan standar.");
      }
    })();
    return () => {
      cancelled = true;
      task?.cancel();
      canvas.remove();
    };
  }, [document, page, scale, width, visible]);
  return (
    <div
      ref={host}
      className="book-canvas"
      style={{ minHeight: width ? Math.min(width * 1.4, 900) : 200 }}
    >
      {error && <p role="status">{error}</p>}
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
  // Source identity also resets page/mode/error when used outside the catalog dialog.
  return (
    <Reader
      key={assetId ?? external ?? "empty"}
      assetId={assetId}
      external={external}
    />
  );
}
function Reader({
  assetId,
  external,
}: {
  assetId?: string | undefined;
  external?: string | undefined;
}) {
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null),
    [page, setPage] = useState(1),
    [scale, setScale] = useState(1),
    [mode, setMode] = useState<"flip" | "scroll" | "native">(
      assetId ? "flip" : "native",
    ),
    [error, setError] = useState(""),
    [width, setWidth] = useState(0);
  const viewport = useRef<HTMLDivElement>(null),
    source = assetId ? "/api/learning/assets/" + assetId : null,
    locator = bookLocator(external);
  useEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.floor(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!assetId) return;
    let cancelled = false;
    let task:
      | ReturnType<(typeof import("pdfjs-dist"))["getDocument"]>
      | undefined;
    const timer = setTimeout(() => {
      if (!cancelled) {
        setError(
          "PDF belum selesai dimuat. Periksa koneksi atau gunakan tampilan standar.",
        );
        void task?.destroy().catch(() => {});
      }
    }, 30000);
    void (async () => {
      try {
        const pdf = await import("pdfjs-dist");
        if (cancelled) return;
        pdf.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        task = pdf.getDocument({
          url: "/api/learning/assets/" + assetId,
          disableRange: true,
        });
        const doc = await task.promise;
        if (cancelled) {
          await task.destroy();
          return;
        }
        clearTimeout(timer);
        setDocument(doc);
      } catch {
        if (!cancelled) {
          clearTimeout(timer);
          setError(
            "PDF belum dapat dibuka. Akses mungkin berubah atau berkas tidak tersedia. Coba tampilan standar.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      void task?.destroy().catch(() => {});
    };
  }, [assetId]);
  const href = source ?? locator?.href,
    preview = source ?? locator?.preview;
  if (!href || !preview)
    return <p role="status">Belum ada PDF atau URL HTTPS buku yang valid.</p>;
  return (
    <section aria-label="Pembaca buku" className="min-w-0 space-y-3">
      <div className="flex flex-wrap gap-2">
        {assetId && (
          <>
            <Button
              type="button"
              variant="outline"
              aria-pressed={mode === "flip"}
              onClick={() => setMode("flip")}
            >
              Mode halaman
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-pressed={mode === "scroll"}
              onClick={() => setMode("scroll")}
            >
              Mode gulir
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!document || mode === "native" || scale <= 0.5}
              onClick={() => setScale((v) => Math.max(0.5, v - 0.25))}
            >
              Perkecil
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!document || mode === "native" || scale >= 2}
              onClick={() => setScale((v) => Math.min(2, v + 0.25))}
            >
              Perbesar
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={mode === "native"}
              onClick={() => setScale(1)}
            >
              Sesuaikan lebar
            </Button>
            <Button
              type="button"
              variant="outline"
              aria-pressed={mode === "native"}
              onClick={() => setMode("native")}
            >
              Tampilan standar
            </Button>
          </>
        )}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-sm underline"
        >
          Buka terpisah (tab baru)
        </a>
      </div>
      {!assetId && (
        <p className="text-sm text-muted-foreground">
          Sumber eksternal. Jika pratinjau ditolak, buka terpisah dan periksa
          izin pada penyedia buku.
        </p>
      )}
      {error && (
        <p role="status" className="text-sm">
          {error}
        </p>
      )}
      {document && mode !== "native" && (
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Navigasi halaman"
        >
          <Button
            type="button"
            variant="outline"
            disabled={page <= 1}
            onClick={() => {
              setPage((v) => Math.max(1, v - (mode === "scroll" ? 20 : 1)));
              viewport.current?.scrollTo(0, 0);
            }}
          >
            Halaman sebelumnya
          </Button>
          <span aria-live="polite" className="text-sm">
            {mode === "scroll"
              ? `${page}–${Math.min(document.numPages, page + 19)}`
              : page}{" "}
            / {document.numPages} · {Math.round(scale * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            disabled={page + (mode === "scroll" ? 20 : 1) > document.numPages}
            onClick={() => {
              setPage((v) =>
                Math.min(document.numPages, v + (mode === "scroll" ? 20 : 1)),
              );
              viewport.current?.scrollTo(0, 0);
            }}
          >
            Halaman berikutnya
          </Button>
        </div>
      )}
      <div
        ref={viewport}
        className="book-viewport rounded-lg border"
        role="region"
        aria-label="Area dokumen buku, dapat digulir"
        tabIndex={0}
      >
        {mode === "native" ? (
          <iframe
            title="Pratinjau buku digital"
            src={preview}
            referrerPolicy="no-referrer"
            className="h-[60dvh] w-full border-0"
            sandbox="allow-scripts allow-same-origin allow-downloads"
          />
        ) : document ? (
          <div className="space-y-4">
            {Array.from(
              {
                length:
                  mode === "flip"
                    ? 1
                    : Math.min(20, document.numPages - page + 1),
              },
              (_, i) => (
                <PdfCanvas
                  key={page + i}
                  document={document}
                  page={page + i}
                  width={width}
                  scale={scale}
                />
              ),
            )}
          </div>
        ) : !error ? (
          <p role="status">Memuat PDF…</p>
        ) : (
          <p>Gunakan tampilan standar atau buka buku terpisah.</p>
        )}
      </div>
    </section>
  );
}
