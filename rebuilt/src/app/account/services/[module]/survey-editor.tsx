"use client";
import {confirmAction} from "@/components/ui/confirm-action";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import { listenForUnsavedChanges } from "@/lib/forms/leave-guard";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/domain-controls";
import { requiredMissing } from "@/lib/services/validation";
import {
  localSurveyDraft,
  validAnswers,
  validPeers,
  type Answers,
  type PeerAnswers,
  type SurveyResponse,
} from "@/lib/services/surveys";
import extras from "@/lib/services/instrument-extras.json";
type Draft = {
  version: number;
  answers: Answers;
  peerAnswers: PeerAnswers;
  mainDirty: boolean;
  peerDirty: boolean;
  seq: number;
  peerSeq: number;
};
export function SurveyEditor({
  period,
  response,
  userId,
  busy,
  blocked,
  mutate,
  peers,
  onDirty,
}: {
  period: Record<string, unknown>;
  response: SurveyResponse;
  userId: string;
  busy: boolean;
  blocked: boolean;
  mutate: (c: unknown) => Promise<boolean>;
  peers: Record<string, unknown>[];
  onDirty: (dirty: boolean) => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
      version: response.revision,
      answers: response.answers,
      peerAnswers: response.peer_answers,
      mainDirty: false,
      peerDirty: false,
      seq: 0,
      peerSeq: 0,
    })),
    [status, setStatus] = useState(""),
    [storageError, setStorageError] = useState(""),
    [page, setPage] = useState(1),
    [isFinalizing, setFinalizing] = useState(false);
  const finalizing = useRef(false),
    loggingOut = useRef(false),
    state = useRef(draft),
    saving = useRef(false),
    halt = useRef(false),
    mounted = useRef(true),
    timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    actions = useRef<{ save: (type: string) => Promise<void> }>({
      save: async () => {},
    }),
    prefix = useId();
  const key = `sim-survey:${userId}:${String(period.id)}:${String(period.instrument_version)}`,
    locked = !!response.submitted_at || period.status === "closed",
    peerLocked = locked || !!response.peer_submitted_at,
    dirty = draft.mainDirty || draft.peerDirty;
  function update(d: Draft) {
    state.current = d;
    if (mounted.current) setDraft(d);
  }
  function persist(d: Draft) {
    try {
      if (!d.mainDirty && !d.peerDirty) localStorage.removeItem(key);
      else
        localStorage.setItem(
          key,
          JSON.stringify({
            version: d.version,
            answers: d.answers,
            peerAnswers: d.peerAnswers,
            mainDirty: d.mainDirty,
            peerDirty: d.peerDirty,
          }),
        );
      setStorageError("");
    } catch {
      if (mounted.current)
        setStorageError(
          "Penyimpanan perangkat tidak tersedia. Pertahankan halaman ini dan simpan ke server.",
        );
    }
  }
  function schedule() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (navigator.onLine && !halt.current) void actions.current.save("auto");
    }, 2000);
  }
  useWriteGuard(() => saving.current || finalizing.current);
  useEffect(() => {
    mounted.current = true;
    void (async () => {
      try {
        for (const k of Object.keys(localStorage))
          if (
            k.startsWith("sim-survey:") &&
            !k.startsWith(`sim-survey:${userId}:`)
          )
            localStorage.removeItem(k);
        const raw = localStorage.getItem(key);
        if (!raw) return;
        const cache = localSurveyDraft.safeParse(JSON.parse(raw));
        if (
          !cache.success ||
          !validAnswers(response.instrument, cache.data.answers) ||
          !validPeers(response.peers, cache.data.peerAnswers)
        ) {
          setStatus(
            "Draft perangkat tidak valid; jawaban server dipertahankan.",
          );
          return;
        }
        if (cache.data.version !== response.revision) {
          setStatus(
            "Draft perangkat berasal dari versi berbeda. Jawaban server dipertahankan; draft tidak diterapkan otomatis.",
          );
          return;
        }
        const d = {
          ...cache.data,
          mainDirty: cache.data.mainDirty && !locked,
          peerDirty: cache.data.peerDirty && !peerLocked,
          seq: 0,
          peerSeq: 0,
        };
        if (locked) {
          localStorage.removeItem(key);
          return;
        }
        update(d);
        setStatus(
          "Draft perangkat dipulihkan. Menunggu sinkronisasi ke server.",
        );
        schedule();
      } catch {
        setStorageError(
          "Draft perangkat belum dapat dipulihkan. Jawaban server tetap tersedia.",
        );
      }
    })();
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
    // Identity is fixed for this instance; successful saves rebase the canonical draft below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    const stopUnloadGuard = listenForUnsavedChanges(warn);
    return () => stopUnloadGuard();
  }, [dirty]);
  useEffect(() => {
    const online = () => {
      if (state.current.mainDirty || state.current.peerDirty)
        void actions.current.save("auto");
    };
    const logout = (e: Event) => {
      if (e.defaultPrevented) return;
      if (
        e.target instanceof HTMLFormElement &&
        new URL(e.target.action).pathname === "/api/auth/logout"
      ) {
        if (timer.current) clearTimeout(timer.current);
        halt.current = true;
        loggingOut.current = true;
      }
    };
    window.addEventListener("online", online);
    document.addEventListener("submit", logout);
    return () => {
      window.removeEventListener("online", online);
      document.removeEventListener("submit", logout);
    };
  }, []);
  async function save(type: string): Promise<void> {
    if (saving.current || blocked || locked) return;
    const s = state.current,
      peer = type.startsWith("peer_"),
      final = type === "submit" || type === "peer_submit";
    if (type === "auto") {
      if (halt.current) return;
      if (s.mainDirty) return await save("save");
      if (s.peerDirty && !peerLocked) return await save("peer_save");
      return;
    }
    if (peer && peerLocked) return;
    if (timer.current) clearTimeout(timer.current);
    if (
      !validAnswers(response.instrument, s.answers) ||
      !validPeers(response.peers, s.peerAnswers)
    ) {
      setStatus("Periksa jenis dan rentang jawaban.");
      return;
    }
    if (final && !peer) {
      const missing = requiredMissing(response.instrument, s.answers);
      if (missing.length) {
        const first = response.instrument.findIndex(
          (q) => q.code === missing[0],
        );
        setPage(Math.floor(first / 10) + 1);
        setStatus(`Pertanyaan wajib belum lengkap: ${missing.join(", ")}`);
        requestAnimationFrame(() =>
          window.document.getElementById(prefix + missing[0])?.focus(),
        );
        return;
      }
      if (
        response.role === "teacher" &&
        response.peers.length &&
        !response.peer_submitted_at
      ) {
        setStatus(
          "Kirim penilaian seluruh rekan terlebih dahulu sebelum jawaban utama.",
        );
        return;
      }
    }
    if (final && peer) {
      const missing = response.peers.flatMap((id) =>
        extras.peer
          .filter((q) => s.peerAnswers[id]?.[q.kode] === undefined)
          .map(
            (q) =>
              `${peers.find((p) => p.id === id)?.name ?? "Rekan"}: ${q.kode}`,
          ),
      );
      if (missing.length) {
        setStatus("Lengkapi penilaian rekan: " + missing.join(", "));
        return;
      }
    }
    if (
      final &&
      !await confirmAction(
        peer
          ? "Kirim penilaian rekan final? Jawaban rekan akan terkunci."
          : "Kirim jawaban final? Setelah dikirim jawaban terkunci.",
      )
    ) {
      schedule();
      return;
    }
    saving.current = true;
    finalizing.current = final;
    setFinalizing(final);
    halt.current = false;
    setStatus("Menyimpan ke server…");
    try {
      const ok = await mutate({
        type,
        periodId: period.id,
        version: s.version,
        answers: peer ? s.peerAnswers : s.answers,
      });
      if (!mounted.current || loggingOut.current) return;
      if (!ok) {
        halt.current = true;
        setStatus(
          "Belum tersimpan. Draft dipertahankan. Periksa pesan layanan dan muat ulang bila terjadi konflik versi.",
        );
        return;
      }
      const current = state.current,
        next = {
          ...current,
          version: s.version + 1,
          mainDirty: peer ? current.mainDirty : current.seq !== s.seq,
          peerDirty: peer ? current.peerSeq !== s.peerSeq : current.peerDirty,
        };
      update(next);
      persist(next);
      setStatus(
        final
          ? "Jawaban final berhasil dikirim."
          : next.mainDirty || next.peerDirty
            ? "Sebagian tersimpan; perubahan terbaru menunggu sinkronisasi."
            : "Seluruh draft tersimpan di server.",
      );
    } finally {
      saving.current = false;
      finalizing.current = false;
      if (mounted.current) setFinalizing(false);
      if (
        mounted.current &&
        !halt.current &&
        (state.current.mainDirty || state.current.peerDirty)
      )
        schedule();
    }
  }
  useEffect(() => {
    actions.current = { save };
  });
  function change(code: string, value: string | number, peerId?: string) {
    if (blocked || locked || finalizing.current || (peerId && peerLocked))
      return;
    const s = state.current;
    let next: Draft;
    if (peerId) {
      const values = { ...s.peerAnswers[peerId] };
      if (value === "") delete values[code];
      else values[code] = value;
      next = {
        ...s,
        peerAnswers: { ...s.peerAnswers, [peerId]: values },
        peerDirty: true,
        peerSeq: s.peerSeq + 1,
      };
    } else {
      const answers = { ...s.answers };
      if (
        value === "" &&
        response.instrument.find((q) => q.code === code)?.kind === "likert"
      )
        delete answers[code];
      else answers[code] = value;
      next = { ...s, answers, mainDirty: true, seq: s.seq + 1 };
    }
    update(next);
    persist(next);
    setStatus(
      navigator.onLine
        ? "Perubahan menunggu sinkronisasi…"
        : "Offline. Perubahan belum tersinkron ke server.",
    );
    schedule();
  }
  const missing = requiredMissing(response.instrument, draft.answers),
    total = response.instrument.filter((q) => q.required !== false).length,
    last = Math.max(1, Math.ceil(response.instrument.length / 10));
  return (
    <section
      className="survey-editor space-y-4 rounded-xl border bg-card p-4"
      aria-label="Jawaban survei"
    >
      <div>
        <h3 className="text-lg font-semibold">
          {locked ? "Jawaban tersimpan" : "Isi survei"}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Skala 1–5. Isi seluruh pertanyaan wajib; esai wajib mengikuti
          instrumen. TT pada penilaian rekan berarti Tidak Tahu.
        </p>
      </div>
      <p role="status" aria-live="polite" className="text-sm">
        {locked ? "Jawaban terkunci. " : ""}
        {status}
      </p>
      {storageError && (
        <p role="alert" className="text-sm">
          {storageError}
        </p>
      )}
      <div className="rounded-lg bg-muted p-3 text-sm">
        <p>
          {total - missing.length} dari {total} pertanyaan wajib terisi
        </p>
        <progress
          aria-label="Kemajuan pertanyaan wajib"
          value={total - missing.length}
          max={Math.max(1, total)}
          className="mt-2 w-full"
        />
      </div>
      <div className="space-y-4">
        {response.instrument.slice((page - 1) * 10, page * 10).map((q, i) => (
          <label
            key={q.code}
            className="block rounded-lg border p-4"
            htmlFor={prefix + q.code}
          >
            <span className="mb-2 block text-xs text-muted-foreground">
              Pertanyaan {(page - 1) * 10 + i + 1} · {q.code} ·{" "}
              {q.required ? "Wajib" : "Opsional"}
            </span>
            <span className="block text-sm font-medium">{q.question}</span>
            {q.kind === "essay" ? (
              <textarea
                id={prefix + q.code}
                data-code={q.code}
                className={controlClass}
                rows={4}
                maxLength={10000}
                value={String(draft.answers[q.code] ?? "")}
                disabled={locked || blocked || isFinalizing}
                required={q.required}
                onChange={(e) => change(q.code, e.target.value)}
              />
            ) : (
              <select
                id={prefix + q.code}
                data-code={q.code}
                className={controlClass}
                value={String(draft.answers[q.code] ?? "")}
                disabled={locked || blocked || isFinalizing}
                required={q.required}
                onChange={(e) =>
                  change(q.code, e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">Pilih jawaban</option>
                {[
                  "Sangat Tidak Setuju",
                  "Tidak Setuju",
                  "Netral",
                  "Setuju",
                  "Sangat Setuju",
                ].map((t, i) => (
                  <option key={t} value={i + 1}>
                    {i + 1} — {t}
                  </option>
                ))}
              </select>
            )}
          </label>
        ))}
      </div>
      <nav
        aria-label="Halaman pertanyaan"
        className="flex flex-wrap items-center justify-between gap-2"
      >
        <Button
          type="button"
          variant="outline"
          disabled={page <= 1}
          onClick={() => setPage((v) => v - 1)}
        >
          Pertanyaan sebelumnya
        </Button>
        <span className="text-sm">
          Halaman {page} / {last}
        </span>
        <Button
          type="button"
          variant="outline"
          disabled={page >= last}
          onClick={() => setPage((v) => v + 1)}
        >
          Pertanyaan berikutnya
        </Button>
      </nav>
      {response.role === "teacher" && response.peers.length > 0 && (
        <fieldset className="space-y-4 rounded-lg border p-4">
          <legend className="px-2 font-semibold">
            Penilaian teman sejawat
          </legend>
          <p className="text-sm text-muted-foreground">
            Enam dimensi wajib untuk setiap rekan. Apresiasi PTS-7 opsional.
            Identitas penilai tidak ditampilkan pada laporan personal.
          </p>
          {response.peers.map((id) => (
            <details key={id} className="rounded-lg border p-3">
              <summary className="cursor-pointer font-medium">
                {String(peers.find((p) => p.id === id)?.name ?? "Rekan guru")}
              </summary>
              <div className="mt-3 space-y-3">
                {extras.peer.map((q) => (
                  <label className="block text-sm" key={q.kode}>
                    {q.dimensi}: {q.pertanyaan}
                    <select
                      className={controlClass}
                      disabled={peerLocked || blocked || isFinalizing}
                      value={String(draft.peerAnswers[id]?.[q.kode] ?? "")}
                      onChange={(e) =>
                        change(
                          q.kode,
                          e.target.value === "TT"
                            ? "TT"
                            : e.target.value
                              ? Number(e.target.value)
                              : "",
                          id,
                        )
                      }
                    >
                      <option value="">Pilih jawaban</option>
                      {[1, 2, 3, 4, 5, "TT"].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className="block text-sm">
                  Apresiasi atau masukan (opsional)
                  <textarea
                    className={controlClass}
                    rows={3}
                    maxLength={10000}
                    disabled={peerLocked || blocked || isFinalizing}
                    value={String(draft.peerAnswers[id]?.["PTS-7"] ?? "")}
                    onChange={(e) => change("PTS-7", e.target.value, id)}
                  />
                </label>
              </div>
            </details>
          ))}
          {response.peer_submitted_at ? (
            <p className="text-sm">
              Penilaian rekan sudah dikirim dan terkunci.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy || peerLocked || blocked}
                onClick={() => void save("peer_save")}
              >
                Simpan draft rekan
              </Button>
              <Button
                type="button"
                disabled={busy || peerLocked || blocked}
                onClick={() => void save("peer_submit")}
              >
                Kirim penilaian rekan
              </Button>
            </div>
          )}
        </fieldset>
      )}
      {!locked && (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={busy || blocked}
            onClick={() => void save("save")}
          >
            Simpan sekarang
          </Button>
          <Button
            type="button"
            disabled={busy || blocked}
            onClick={() => void save("submit")}
          >
            Kirim final
          </Button>
        </div>
      )}
    </section>
  );
}
