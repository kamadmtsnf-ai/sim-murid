"use client";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import { MonitorSmartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import {
  effectiveSessionStatus,
  sessionCommand,
  sessionListSchema,
  sessionRevokeSchema,
  type SessionList,
} from "@/lib/auth/sessions";
const formatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Jakarta",
});
const format = (value: string) => formatter.format(new Date(value));
const statusLabels = {
  active: "Aktif",
  expired: "Berakhir",
  revoked: "Dicabut",
} as const;
type Confirmation = {
  username: string;
  sessionId?: string;
  device?: string;
  self: boolean;
};
export function SessionPanel({
  canManageOthers,
  ownUsername,
}: {
  canManageOthers: boolean;
  ownUsername: string;
}) {
  const router = useRouter();
  const [target, setTarget] = useState(""),
    [input, setInput] = useState(""),
    [data, setData] = useState<SessionList | null>(null),
    [loading, setLoading] = useState(true),
    [mutating, setMutating] = useState(false),
    [message, setMessage] = useState("Memuat daftar sesi…"),
    [failed, setFailed] = useState(false),
    [inputError, setInputError] = useState(""),
    [needsSync, setNeedsSync] = useState(false),
    [confirmation, setConfirmation] = useState<Confirmation | null>(null),
    [now, setNow] = useState(0);
  const mounted = useRef(true),
    generation = useRef(0),
    reader = useRef<AbortController | null>(null),
    mutation = useRef(false),
    selected = useRef(""),
    confirmRef = useRef<Confirmation | null>(null),
    offset = useRef(0),
    notice = useRef<HTMLDivElement>(null),
    searchInput = useRef<HTMLInputElement>(null),
    focusNotice = useRef(false),
    returnFocus = useRef<HTMLButtonElement | null>(null);
  const busy = loading || mutating;
  const tell = useCallback((text: string, error = false) => {
    if (!mounted.current) return;
    setMessage(text);
    setFailed(error);
    focusNotice.current = error;
  }, []);
  const leave = useCallback(
    (url: string) => {
      if (!mounted.current) return;
      setData(null);
      router.replace(url);
      router.refresh();
    },
    [router],
  );
  const load = useCallback(
    async (
      owner: string,
      background = false,
      afterMutation = false,
      successMessage?: string,
    ) => {
      if (
        !mounted.current ||
        (mutation.current && !afterMutation) ||
        confirmRef.current
      )
        return;
      const sequence = ++generation.current;
      reader.current?.abort();
      const controller = new AbortController();
      reader.current = controller;
      setLoading(true);
      if (!background) tell("Memuat daftar sesi…");
      try {
        const r = await fetch("/api/auth/sessions", {
          cache: "no-store",
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(30000),
          ]),
          ...(owner
            ? {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "list", username: owner }),
              }
            : {}),
        });
        if (
          !mounted.current ||
          sequence !== generation.current ||
          controller.signal.aborted
        )
          return false;
        if (r.status === 401) {
          leave("/login?expired=1");
          return;
        }
        const body: unknown = await r.json();
        if (
          !mounted.current ||
          sequence !== generation.current ||
          controller.signal.aborted
        )
          return false;
        if (
          r.status === 403 &&
          typeof body === "object" &&
          body !== null &&
          "destination" in body &&
          body.destination === "/account/security"
        ) {
          leave("/account/security");
          return;
        }
        if (!r.ok) throw Error("Unavailable");
        const next = sessionListSchema.parse(body);
        if (next.username !== (owner || ownUsername))
          throw Error("Unexpected owner");
        if (next.serverTime)
          offset.current = Date.parse(next.serverTime) - Date.now();
        setNow(Date.now() + offset.current);
        setData(next);
        setNeedsSync(false);
        tell(
          successMessage ??
            (background
              ? "Status sesi diperbarui otomatis."
              : "Daftar sesi diperbarui."),
        );
        return true;
      } catch {
        if (
          mounted.current &&
          sequence === generation.current &&
          !controller.signal.aborted
        ) {
          setNeedsSync(true);
          tell(
            "Daftar sesi belum dapat diperiksa. Periksa koneksi atau hak akses, lalu muat ulang. Pencabutan dinonaktifkan sampai status terbaru tersedia.",
            true,
          );
        }
        return false;
      } finally {
        if (mounted.current && sequence === generation.current)
          setLoading(false);
      }
    },
    [leave, ownUsername, tell],
  );
  useWriteGuard(() => mutation.current);
  useEffect(() => {
    mounted.current = true;
    void load(selected.current);
    const poll = () => {
      if (!document.hidden && !mutation.current && !confirmRef.current)
        void load(selected.current, true);
    };
    const timer = setInterval(poll, 60000),
      clock = setInterval(() => setNow(Date.now() + offset.current), 1000);
    document.addEventListener("visibilitychange", poll);
    return () => {
      mounted.current = false;
      reader.current?.abort();
      clearInterval(timer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [load]);
  useEffect(() => {
    if (!busy && message && focusNotice.current && !confirmation) {
      notice.current?.focus();
      focusNotice.current = false;
    }
  }, [busy, message, confirmation]);
  function invalidate() {
    generation.current++;
    reader.current?.abort();
    setLoading(false);
  }
  function choose(owner: string) {
    if (mutation.current || confirmRef.current) return;
    invalidate();
    selected.current = owner;
    setTarget(owner);
    setData(null);
    setNeedsSync(false);
    setInputError("");
    void load(owner);
  }
  function search(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mutation.current || confirmRef.current) return;
    const command = sessionCommand.safeParse({
      action: "list",
      username: input,
    });
    if (!command.success) {
      setInputError(
        "Masukkan username persis, tanpa spasi di awal atau akhir.",
      );
      searchInput.current?.focus();
      return;
    }
    choose(input);
  }
  function openConfirmation(button: HTMLButtonElement, sessionId?: string) {
    if (
      mutation.current ||
      confirmRef.current ||
      busy ||
      needsSync ||
      !data ||
      data.username !== (selected.current || ownUsername)
    )
      return;
    const session = sessionId
      ? data.sessions.find((s) => s.id === sessionId)
      : undefined;
    if (
      sessionId &&
      (!session || effectiveSessionStatus(session, now) !== "active")
    )
      return;
    const next = {
      username: data.username,
      ...(session ? { sessionId: session.id, device: session.device } : {}),
      self: session ? session.current : data.username === ownUsername,
    };
    invalidate();
    confirmRef.current = next;
    setConfirmation(next);
    returnFocus.current = button;
  }
  function closeConfirmation() {
    if (mutation.current) return;
    confirmRef.current = null;
    setConfirmation(null);
  }
  async function revoke() {
    const command = confirmRef.current;
    if (
      mutation.current ||
      !command ||
      !data ||
      command.username !== data.username ||
      data.username !== (selected.current || ownUsername)
    )
      return;
    const live = data.sessions.filter(
      (s) =>
        effectiveSessionStatus(s, Date.now() + offset.current) === "active",
    );
    if (
      !(command.sessionId
        ? live.some((s) => s.id === command.sessionId)
        : live.length)
    ) {
      closeConfirmation();
      setNeedsSync(true);
      tell(
        "Sesi yang dipilih sudah berakhir. Muat ulang daftar sebelum melanjutkan.",
        true,
      );
      return;
    }
    mutation.current = true;
    invalidate();
    setMutating(true);
    tell("Mencabut akses sesi…");
    const owner = selected.current;
    try {
      const r = await fetch("/api/auth/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "revoke",
          username: command.username,
          ...(command.sessionId
            ? { scope: "one", sessionId: command.sessionId }
            : { scope: "all" }),
        }),
        signal: AbortSignal.timeout(30000),
      });
      if (!mounted.current) return;
      if (r.status === 401) {
        leave("/login?expired=1");
        return;
      }
      const body: unknown = await r.json();
      if (!mounted.current) return;
      if (
        r.status === 403 &&
        typeof body === "object" &&
        body !== null &&
        "destination" in body &&
        body.destination === "/account/security"
      ) {
        leave("/account/security");
        return;
      }
      if (!r.ok) throw Error("Revoke denied");
      const result = sessionRevokeSchema.parse(body);
      if (result.signed_out) {
        leave("/login?logout=1");
        return;
      }
      confirmRef.current = null;
      setConfirmation(null);
      setNeedsSync(true);
      const text = result.revoked
        ? `${result.revoked} sesi berhasil dicabut.`
        : "Sesi sudah tidak aktif. Tidak ada sesi baru yang dicabut.";
      tell(text);
      const refreshed = await load(owner, true, true, text);
      if (refreshed === true) focusNotice.current = true;
      if (refreshed === false && mounted.current)
        tell(
          text +
            " Daftar terbaru belum dapat dimuat. Muat ulang sebelum tindakan berikutnya.",
          true,
        );
    } catch {
      if (mounted.current) {
        setNeedsSync(true);
        tell(
          "Hasil pencabutan belum dapat dipastikan. Muat ulang daftar sebelum mencoba kembali; permintaan tidak dikirim ulang otomatis.",
          true,
        );
      }
    } finally {
      mutation.current = false;
      if (mounted.current) {
        setMutating(false);
        confirmRef.current = null;
        setConfirmation(null);
      }
    }
  }
  const displayed = data?.username === (target || ownUsername) ? data : null;
  const active =
    displayed?.sessions.filter(
      (s) => effectiveSessionStatus(s, now) === "active",
    ).length ?? 0;
  return (
    <>
      <main
        id="main-content"
        tabIndex={-1}
        className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 [overflow-wrap:anywhere]"
      >
        <header className="space-y-2">
          <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight sm:text-3xl">
            <MonitorSmartphone
              aria-hidden="true"
              className="size-6 shrink-0 text-primary"
            />
            Sesi dan perangkat
          </h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Periksa perangkat yang pernah masuk dan cabut akses sesi bila
            diperlukan. Satu sesi aktif per akun; maksimal 1 jam, atau 7 hari
            jika memilih Ingat saya.
          </p>
        </header>
        {canManageOthers && (
          <Card className="min-w-0">
            <CardHeader className="grid-cols-1 px-4 sm:px-6">
              <CardTitle>
                <h2>Periksa akun pengguna</h2>
              </CardTitle>
              <p
                id="session-search-help"
                className="text-sm text-muted-foreground"
              >
                Gunakan username persis. Angka nol di awal dan tanda minus tetap
                dipertahankan.
              </p>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <form noValidate className="min-w-0 space-y-3" onSubmit={search}>
                <label
                  className="block text-sm font-medium"
                  htmlFor="session-username"
                >
                  Username
                  <input
                    ref={searchInput}
                    id="session-username"
                    name="username"
                    required
                    maxLength={100}
                    value={input}
                    disabled={mutating || !!confirmation}
                    onChange={(e) => {
                      setInput(e.target.value);
                      setInputError("");
                    }}
                    className="mt-2 min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    aria-invalid={!!inputError}
                    aria-describedby={
                      "session-search-help" +
                      (inputError ? " session-search-error" : "")
                    }
                  />
                </label>
                {inputError && (
                  <p
                    id="session-search-error"
                    role="alert"
                    className="text-sm text-destructive"
                  >
                    {inputError}
                  </p>
                )}
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <Button disabled={mutating || !!confirmation} type="submit">
                    Cari sesi
                  </Button>
                  <Button
                    disabled={mutating || !!confirmation}
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setInput("");
                      choose("");
                    }}
                  >
                    Akun saya
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
        <div
          ref={notice}
          tabIndex={-1}
          role={failed ? "alert" : "status"}
          aria-live={failed ? "assertive" : "polite"}
          aria-atomic="true"
          className={
            "rounded-lg border p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring " +
            (failed ? "border-destructive text-destructive" : "bg-muted/20")
          }
        >
          {message}
        </div>
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Button
            variant="outline"
            disabled={busy || !!confirmation}
            onClick={() => void load(selected.current)}
          >
            Muat ulang
          </Button>
          {displayed && (
            <Button
              variant="destructive"
              className="whitespace-normal"
              disabled={busy || !!confirmation || needsSync || !active}
              onClick={(e) => openConfirmation(e.currentTarget)}
            >
              Cabut seluruh sesi
            </Button>
          )}
        </div>
        <section
          aria-label="Daftar sesi"
          aria-busy={busy}
          className="min-w-0 space-y-4"
        >
          {loading && !displayed && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Memuat sesi akun {target || ownUsername}…
              </p>
              <div className="skeleton h-40 w-full" />
            </div>
          )}
          {!loading && !displayed && (
            <div className="rounded-xl border p-5">
              <h2 className="font-semibold">Daftar sesi belum tersedia</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Gunakan Muat ulang untuk memeriksa kembali. Admin dapat
                memeriksa username lain atau kembali ke Akun saya.
              </p>
            </div>
          )}
          {displayed && (
            <>
              <header className="min-w-0 space-y-2 rounded-xl border bg-muted/30 p-4">
                <h2 className="font-semibold">Akun: {displayed.username}</h2>
                <p className="text-sm text-muted-foreground">
                  {displayed.sessions.length} riwayat ditampilkan · {active}{" "}
                  aktif pada daftar ini. Maksimal 20 sesi terbaru; seluruh waktu
                  dalam WIB.
                </p>
                {needsSync && (
                  <p className="text-sm text-destructive">
                    Data terakhir belum terkonfirmasi ulang. Pencabutan
                    dinonaktifkan sampai daftar berhasil dimuat.
                  </p>
                )}
              </header>
              {displayed.sessions.length === 0 && (
                <div className="rounded-xl border border-dashed p-6 text-center">
                  <ShieldCheck
                    aria-hidden="true"
                    className="mx-auto mb-3 size-7 text-muted-foreground"
                  />
                  <h3 className="font-semibold">Belum ada riwayat sesi</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Riwayat akan muncul setelah akun digunakan untuk masuk.
                  </p>
                </div>
              )}
              {displayed.sessions.map((s) => {
                const status = effectiveSessionStatus(s, now);
                return (
                  <Card key={s.id} className="min-w-0">
                    <CardHeader className="min-w-0 grid-cols-1 gap-3 px-4 sm:px-6">
                      <CardTitle>
                        <h3 className="text-base leading-6 [overflow-wrap:anywhere]">
                          {s.device || "Perangkat tidak dikenal"}
                        </h3>
                      </CardTitle>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span
                          className={
                            "rounded-full border px-2.5 py-1 font-medium " +
                            (status === "active"
                              ? "bg-success-subtle text-success"
                              : "bg-muted text-muted-foreground")
                          }
                        >
                          {statusLabels[status]}
                        </span>
                        {s.current && (
                          <span className="rounded-full border px-2.5 py-1 font-medium">
                            Sesi Anda saat ini
                          </span>
                        )}
                        <span className="text-muted-foreground">
                          {s.remember ? "Ingat saya" : "Sesi biasa"}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="min-w-0 space-y-4 px-4 sm:px-6">
                      <dl className="grid min-w-0 gap-x-5 gap-y-2 text-sm sm:grid-cols-[auto_minmax(0,1fr)]">
                        <dt className="text-muted-foreground">Masuk</dt>
                        <dd>
                          <time dateTime={s.issued_at}>
                            {format(s.issued_at)} WIB
                          </time>
                        </dd>
                        <dt className="text-muted-foreground">
                          Terakhir diperiksa
                        </dt>
                        <dd>
                          <time dateTime={s.last_seen_at}>
                            {format(s.last_seen_at)} WIB
                          </time>
                        </dd>
                        <dt className="text-muted-foreground">Batas sesi</dt>
                        <dd>
                          <time dateTime={s.expires_at}>
                            {format(s.expires_at)} WIB
                          </time>
                        </dd>
                      </dl>
                      {status === "active" && (
                        <Button
                          variant="outline"
                          className="w-full sm:w-auto"
                          disabled={busy || needsSync || !!confirmation}
                          onClick={(e) =>
                            openConfirmation(e.currentTarget, s.id)
                          }
                          aria-label={
                            s.current
                              ? "Cabut sesi Anda saat ini"
                              : `Cabut sesi ${s.device || "perangkat tidak dikenal"}`
                          }
                        >
                          Cabut sesi
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </>
          )}
        </section>
      </main>
      <Dialog
        open={!!confirmation}
        closeDisabled={mutating}
        onOpenChange={(open) => {
          if (!open) closeConfirmation();
        }}
        title={
          confirmation?.sessionId
            ? "Cabut akses sesi ini?"
            : "Cabut seluruh sesi akun?"
        }
        description={
          confirmation?.self
            ? "Sesi Anda saat ini juga akan dicabut. Anda akan keluar dan perlu masuk kembali."
            : "Perangkat dengan akses yang dicabut harus masuk kembali untuk menggunakan aplikasi."
        }
        returnFocusRef={returnFocus}
        className="max-w-lg [overflow-wrap:anywhere]"
      >
        {confirmation && (
          <div className="min-w-0 space-y-4">
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Akun</dt>
                <dd className="mt-1 font-semibold">{confirmation.username}</dd>
              </div>
              {confirmation.device && (
                <div>
                  <dt className="text-muted-foreground">Perangkat</dt>
                  <dd className="mt-1">{confirmation.device}</dd>
                </div>
              )}
            </dl>
            {!confirmation.sessionId && (
              <p className="text-sm">
                Tindakan ini mencabut seluruh sesi akun, termasuk sesi yang
                tidak masuk dalam 20 riwayat terbaru.
              </p>
            )}
            {confirmation.self && (
              <p className="rounded-lg border bg-muted/30 p-3 text-sm font-medium">
                Pastikan Anda masih memiliki username dan password untuk masuk
                kembali.
              </p>
            )}
            {mutating && (
              <p role="status" className="text-sm text-muted-foreground">
                Pencabutan sedang diproses. Tunggu hingga hasilnya
                terkonfirmasi.
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                variant="outline"
                type="button"
                disabled={mutating}
                onClick={closeConfirmation}
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                type="button"
                disabled={mutating}
                onClick={() => void revoke()}
              >
                {mutating ? "Mencabut sesi…" : "Ya, cabut akses"}
              </Button>
            </div>
          </div>
        )}
      </Dialog>
    </>
  );
}
