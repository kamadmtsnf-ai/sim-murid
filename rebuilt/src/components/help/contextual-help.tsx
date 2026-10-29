"use client";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { helpFor, supportTemplate } from "@/config/contextual-help";
import { errorDigest, requestReference } from "@/lib/observability/reference";
import { FloatingLabel } from "@/components/ui/floating-label";


export function ContextualHelp({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  const id = useId();
  const [reference, setReference] = useState("");
  const [feedback, setFeedback] = useState("");
  const topic = helpFor(href);
  const cleanReference = reference.trim();
  const validReference =
    requestReference(cleanReference) ?? errorDigest(cleanReference);
  const invalid = cleanReference !== "" && !validReference;
  const template = supportTemplate(label, validReference);
  async function copy() {
    setFeedback("");
    try {
      await navigator.clipboard.writeText(template);
      setFeedback(
        "Templat disalin. Lengkapi lalu kirim melalui saluran resmi admin madrasah yang biasa Anda gunakan.",
      );
    } catch {
      setFeedback(
        "Belum dapat menyalin. Pilih dan salin templat di bawah secara manual.",
      );
    }
  }
  return (
    <aside
      aria-label="Bantuan halaman"
      className="min-w-0 rounded-xl border bg-card text-card-foreground"
    >
      <details className="group">
        <summary className="min-h-11 cursor-pointer rounded-xl px-[16px] py-[12px] text-sm font-medium focus-visible:outline-2 focus-visible:outline-ring">
          Bantuan untuk {label}
        </summary>
        <div className="space-y-4 border-t p-[16px] text-sm [overflow-wrap:anywhere]">
          <h2 className="font-semibold">{topic.title}</h2>
          <ol className="list-decimal space-y-2 pl-5">
            {topic.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <section
            aria-labelledby={`${id}-report`}
            className="space-y-3 border-t pt-4"
          >
            <h3 id={`${id}-report`} className="font-semibold">
              Laporkan kendala kepada admin madrasah
            </h3>
            <p>
              Templat ini tidak dikirim otomatis. Gunakan saluran resmi admin
              yang sudah Anda kenal. Jangan sertakan password, OTP, cookie,
              kunci API atau data pribadi siswa.
            </p>
            <div className="block space-y-1"><FloatingLabel htmlFor={`${id}-reference`} label={<><span>Kode laporan (opsional)</span></>}><input placeholder=" "
                id={`${id}-reference`}
                value={reference}
                maxLength={64}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => {
                  setReference(event.target.value);
                  setFeedback("");
                }}
                aria-invalid={invalid}
                aria-describedby={`${id}-hint`}
                className="min-h-11 w-full min-w-0 rounded-md border bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring"
              /></FloatingLabel>
            </div>
            <p id={`${id}-hint`} className="text-muted-foreground">
              {invalid
                ? "Gunakan hanya kode UUID atau digest yang ditampilkan aplikasi; jangan isi pesan error atau data akun."
                : "Salin kode yang tampil pada pesan error, jika tersedia."}
            </p>
            <Button
              type="button"
              className="min-w-0 max-w-full whitespace-normal px-[12px]"
              variant="outline"
              disabled={invalid}
              onClick={() => void copy()}
            >
              Salin templat laporan
            </Button>
            <div className="block space-y-1"><FloatingLabel htmlFor={`${id}-template`} label={<><span>Templat laporan untuk disalin</span></>}><textarea placeholder=" "
                id={`${id}-template`}
                readOnly
                value={template}
                rows={10}
                className="w-full min-w-0 resize-y rounded-md border bg-background p-[12px] text-sm"
              /></FloatingLabel>
            </div>
            <p role="status" aria-live="polite">
              {feedback}
            </p>
          </section>
        </div>
      </details>
    </aside>
  );
}
