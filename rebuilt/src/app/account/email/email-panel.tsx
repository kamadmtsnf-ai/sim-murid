"use client";
import { AccountCompletion } from "@/components/account/account-completion";
import type { SecurityState } from "@/lib/auth/security-validation";
import {confirmAction} from "@/components/ui/confirm-action";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  emailStateSchema,
  emailCommand,
  emailTiming,
  type EmailState,
} from "@/lib/email/validation";
import { FloatingLabel } from "@/components/ui/floating-label";

const responseSchema = z.object({
  state: emailStateSchema,
  serverTime: z.iso.datetime({ offset: true }).optional(),
});
export function EmailPanel({
  initialState,
  initialServerTime,
  accountState,
}: {
  initialState: EmailState;
  accountState?: SecurityState;
  initialServerTime?: string;
}) {
  const router = useRouter(),
    [state, setState] = useState(initialState),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [now, setNow] = useState(
      initialServerTime ? Date.parse(initialServerTime) : 0,
    ),
    [address, setAddress] = useState(initialState.email),
    [code, setCode] = useState(""),
    [codeError, setCodeError] = useState(""),
    [needsSync, setNeedsSync] = useState(false),
    [retryUntil, setRetryUntil] = useState(0);
  const focusCode = useRef(false);
  const lock = useRef(false),
    mounted = useRef(true),
    stateRef = useRef(initialState),
    offset = useRef(0),
    input = useRef<HTMLInputElement>(null);
  useWriteGuard(
    () => lock.current,
    () => !!code || address !== state.email || needsSync,
  );
  useEffect(() => {
    mounted.current = true;
    const tick = () => setNow(Date.now() + offset.current),
      first = setTimeout(() => {
        offset.current = initialServerTime
          ? Date.parse(initialServerTime) - Date.now()
          : 0;
        tick();
      }, 0),
      timer = setInterval(tick, 1000);
    return () => {
      mounted.current = false;
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [initialServerTime]);
  useEffect(() => {
    if (
      !busy &&
      focusCode.current &&
      state.challenge?.delivery_state === "accepted"
    ) {
      input.current?.focus();
      focusCode.current = false;
    }
  }, [busy, state.challenge?.id, state.challenge?.delivery_state]);
  const timing = now
    ? emailTiming(state, now, retryUntil)
    : { remaining: 0, expired: false, canVerify: false };
  function notice(text: string, error = false) {
    if (mounted.current) {
      setMessage(text);
      setFailed(error);
    }
  }
  function expiredSession() {
    if (mounted.current) {
      router.replace("/login?expired=1");
      router.refresh();
    }
  }
  async function load() {
    const r = await fetch("/api/account/email", { cache: "no-store" });
    if (!mounted.current) throw Error("Unmounted");
    if (r.status === 401) {
      expiredSession();
      throw Error("Sesi berakhir. Silakan masuk kembali.");
    }
    const body: unknown = await r.json();
    if (!r.ok)
      throw Error(
        "Status verifikasi belum dapat dimuat. Periksa sesi dan langkah keamanan akun.",
      );
    const result = responseSchema.parse(body);
    if (!mounted.current) return result.state;
    if (result.serverTime)
      offset.current = Date.parse(result.serverTime) - Date.now();
    const previous = stateRef.current;
    if (previous.challenge?.id !== result.state.challenge?.id)
      focusCode.current = true;
    if (
      previous.challenge?.id !== result.state.challenge?.id ||
      previous.email !== result.state.email ||
      result.state.verified
    ) {
      setCode("");
      setCodeError("");
    }
    stateRef.current = result.state;
    setState(result.state);
    setAddress(result.state.email);
    setNow(Date.now() + offset.current);
    setNeedsSync(false);
    return result.state;
  }
  async function refresh() {
    if (lock.current) return;
    if(!needsSync && address!==state.email && !await confirmAction("Muat ulang status dan abaikan alamat email yang belum disimpan?"))return;
    if(lock.current)return;
    lock.current = true;
    setBusy(true);
    notice("Memeriksa status email…");
    try {
      const fresh = await load();
      notice(
        fresh.verified
          ? "Email kontak sudah terverifikasi."
          : "Status verifikasi diperbarui.",
      );
    } catch {
      if (mounted.current) setNeedsSync(true);
      notice(
        "Status belum dapat diperiksa. Muat ulang status sebelum mengirim atau memverifikasi kode lagi.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function run(command: z.infer<typeof emailCommand>) {
    if (lock.current || needsSync || !now || state.verified || address.trim().toLowerCase()!==state.email) return;
    if (
      command.action === "send" &&
      (timing.remaining > 0 ||
        state.sent_today >= 5 ||
        !state.email ||
        address.trim().toLowerCase() !== state.email)
    )
      return;
    if (
      command.action === "verify" &&
      (!timing.canVerify || command.challengeId !== state.challenge?.id)
    )
      return;
    lock.current = true;
    setBusy(true);
    notice(
      command.action === "send"
        ? "Mengirim permintaan kode…"
        : "Memeriksa kode verifikasi…",
    );
    try {
      const r = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(command),
      });
      if (!mounted.current) return;
      if (r.status === 401) {
        expiredSession();
        notice("Sesi berakhir. Silakan masuk kembali.", true);
        return;
      }
      const body: unknown = await r.json();
      const parsed = z
        .object({
          message: z.string().optional(),
          retry_after: z.number().nonnegative().optional(),
        })
        .passthrough()
        .parse(body);
      if (!mounted.current) return;
      if (parsed.retry_after !== undefined)
        setRetryUntil(Date.now() + offset.current + parsed.retry_after * 1000);
      const fresh = await load();
      if (!mounted.current) return;
      if (command.action === "verify" && fresh.verified) {
        setCode("");
        notice("Email berhasil diverifikasi.");
        router.replace("/account");
        router.refresh();
        return;
      }
      if (command.action === "verify" && r.ok) {
        notice(
          "Status verifikasi belum terkonfirmasi. Periksa status sebelum mencoba lagi.",
          true,
        );
        setNeedsSync(true);
        return;
      }
      if (
        command.action === "send" &&
        r.ok &&
        !fresh.verified &&
        fresh.challenge?.delivery_state !== "accepted"
      ) {
        notice(
          "Pengiriman belum terkonfirmasi. Periksa status dan kotak masuk; jangan meminta kode berulang.",
          true,
        );
        return;
      }
      notice(
        parsed.message ??
          (r.ok ? "Status email diperbarui." : "Permintaan belum berhasil."),
        !r.ok,
      );
    } catch {
      if (mounted.current) setNeedsSync(true);
      notice(
        "Hasil permintaan belum dapat dipastikan. Kode tetap dipertahankan. Periksa status dan kotak masuk sebelum mencoba lagi.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  async function saveAddress(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (lock.current || needsSync) return;
    const parsed = emailCommand.safeParse({
      action: "address",
      email: address.trim(),
      expectedEmail: state.email,
    });
    if (!parsed.success || parsed.data.action !== "address") {
      notice("Masukkan alamat email aktif yang valid.", true);
      return;
    }
    lock.current = true;
    setBusy(true);
    try {
      const r = await fetch("/api/account/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(30000),
      });
      if (r.status === 401) {
        expiredSession();
        return;
      }
      const b = await r.json();
      if (!mounted.current) return;
      if (!r.ok) {
        notice(
          typeof b.message === "string" ? b.message : "Email belum tersimpan.",
          true,
        );
        if (r.status >= 409) setNeedsSync(true);
        return;
      }
      const result = responseSchema.parse(b);
      if (result.state.email !== parsed.data.email)
        throw Error("Unconfirmed email");
      stateRef.current = result.state;
      setState(result.state);
      setAddress(result.state.email);
      setCode("");
      setCodeError("");
      notice("Email kontak tersimpan. Selanjutnya kirim kode verifikasi.");
    } catch {
      if (mounted.current) setNeedsSync(true);
      notice(
        "Hasil penyimpanan email belum pasti. Periksa status sebelum mencoba lagi.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  }
  function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!state.challenge || lock.current) return;
    const parsed = emailCommand.safeParse({
      action: "verify",
      challengeId: state.challenge.id,
      code: code.trim(),
    });
    if (!parsed.success) {
      setCodeError("Masukkan enam digit angka dari email Anda.");
      input.current?.focus();
      return;
    }
    setCodeError("");
    void run(parsed.data);
  }
  let detail = "Belum ada kode verifikasi. Kirim kode ke email kontak Anda.";
  if (state.challenge) {
    detail = timing.expired
      ? "Kode sudah kedaluwarsa. Minta kode baru jika batas pengiriman mengizinkan."
      : state.challenge.status === "locked" ||
          state.challenge.attempts_remaining === 0
        ? "Batas percobaan kode ini tercapai. Minta kode baru jika batas pengiriman mengizinkan."
        : state.challenge.status === "superseded"
          ? "Kode ini sudah tidak berlaku. Periksa status atau minta kode baru."
          : state.challenge.delivery_state === "failed"
            ? "Layanan pengiriman belum menerima kode. Periksa alamat kontak atau hubungi Admin."
            : state.challenge.delivery_state === "queued"
              ? "Pengiriman belum terkonfirmasi. Periksa status dan kotak masuk sebelum meminta kode baru."
              : state.challenge.status === "pending"
                ? "Kode siap digunakan. Periksa kotak masuk dan folder spam."
                : "Periksa status verifikasi terbaru.";
  }
  return (
    <div className="min-w-0 space-y-5" aria-busy={busy}>
      {accountState && <AccountCompletion state={accountState} emailVerified={state.verified} needsSync={needsSync} />}
      <Card className="min-w-0">
        <CardHeader className="min-w-0 grid-cols-1 px-4 sm:px-6">
          <CardTitle>
            <h2>Email kontak</h2>
          </CardTitle>
          <p className="min-w-0 break-words text-sm font-medium [overflow-wrap:anywhere]">
            {state.email || "Belum diisi"}
          </p>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4 px-4 sm:px-6">
          <form onSubmit={saveAddress} className="space-y-3">

            <FloatingLabel htmlFor="verification-address" label={<>Alamat email kontak
            </>}><input placeholder=" "
              id="verification-address"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={320}
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              disabled={busy || needsSync}
              className="min-h-12 w-full min-w-0 rounded-md border bg-background px-3 text-base focus-visible:ring-2 focus-visible:ring-ring"
              aria-describedby="verification-address-help"
            /></FloatingLabel>
            <p
              id="verification-address-help"
              className="text-sm text-muted-foreground"
            >
              Gunakan email aktif milik Anda. Mengubah email membatalkan kode
              lama dan memerlukan verifikasi ulang.
            </p>
            <Button
              type="submit"
              variant="outline"
              disabled={
                busy ||
                needsSync ||
                address.trim().toLowerCase() === state.email
              }
            >
              Simpan email kontak
            </Button>
          </form>
          {state.verified ? (
            <div className="rounded-lg border bg-muted/30 p-4">
              <h3 className="font-semibold">Email sudah terverifikasi</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Email kontak ini telah diverifikasi untuk akun Anda.
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm leading-6 text-muted-foreground">
                Kode berlaku maksimal 10 menit dan hanya sekali pakai. Maksimal
                5 percobaan per kode serta 5 permintaan per hari WIB. Jeda kirim
                ulang minimal 60 detik.
              </p>
              <div className="space-y-2">
                <Button
                  type="button"
                  className="w-full max-w-full whitespace-normal sm:w-auto"
                  disabled={
                    busy ||
                    needsSync ||
                    !now ||
                    timing.remaining > 0 ||
                    state.sent_today >= 5 ||
                    !state.email ||
                    address.trim().toLowerCase() !== state.email
                  }
                  onClick={() => void run({ action: "send" })}
                >
                  {busy
                    ? "Memproses…"
                    : timing.remaining > 0
                      ? `Kirim ulang dalam ${timing.remaining} detik`
                      : "Kirim kode verifikasi"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  Permintaan hari ini: {state.sent_today}/5. Pengiriman ulang
                  membatalkan kode lama.
                </p>
                {state.sent_today >= 5 && (
                  <p className="text-sm">
                    Batas harian tercapai. Muat ulang status setelah pergantian
                    hari WIB.
                  </p>
                )}
              </div>
              <section
                aria-label="Status kode"
                className="space-y-2 rounded-lg border bg-muted/20 p-3"
              >
                <p className="text-sm">{detail}</p>
                {state.challenge && (
                  <p className="text-xs text-muted-foreground">
                    Sisa percobaan: {state.challenge.attempts_remaining}.{" "}
                    {now &&
                    !timing.expired &&
                    state.challenge.status === "pending"
                      ? `Berlaku ${Math.max(0, Math.ceil((Date.parse(state.challenge.expires_at) - now) / 1000))} detik lagi.`
                      : ""}
                  </p>
                )}
              </section>
              {state.challenge && (
                <form
                  onSubmit={verify}
                  noValidate
                  className="min-w-0 space-y-4"
                >
                  <div>

                    <FloatingLabel htmlFor="email-otp" label={<>Kode enam digit
                    </>}><input placeholder=" "
                      ref={input}
                      id="email-otp"
                      name="code"
                      type="text"
                      className="mt-2 min-h-12 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-center text-xl tracking-[0.3em] outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      required
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setCodeError("");
                      }}
                      onPaste={(e) => {
                        const text = e.clipboardData.getData("text").trim();
                        if (/^\d{6}$/.test(text)) {
                          e.preventDefault();
                          setCode(text);
                          setCodeError("");
                        }
                      }}
                      aria-invalid={!!codeError}
                      aria-describedby={
                        "email-otp-help" + (codeError ? " email-otp-error" : "")
                      }
                      disabled={busy || needsSync || !timing.canVerify}
                    /></FloatingLabel>
                    <p
                      id="email-otp-help"
                      className="mt-2 text-xs text-muted-foreground"
                    >
                      Gunakan kode terbaru. Jangan membagikan kode kepada siapa
                      pun.
                    </p>
                    {codeError && (
                      <p
                        id="email-otp-error"
                        role="alert"
                        className="mt-2 text-sm text-destructive"
                      >
                        {codeError}
                      </p>
                    )}
                  </div>
                  <Button
                    type="submit"
                    className="w-full sm:w-auto"
                    disabled={busy || needsSync || !now || !timing.canVerify}
                  >
                    Verifikasi email
                  </Button>
                </form>
              )}
            </>
          )}
        </CardContent>
      </Card>
      <div
        role={failed ? "alert" : "status"}
        aria-live={failed ? "assertive" : "polite"}
        className={
          message
            ? "rounded-lg border p-3 text-sm break-words " +
              (failed ? "border-destructive text-destructive" : "bg-muted/30")
            : ""
        }
      >
        {message}
      </div>
      {needsSync && (
        <p className="text-sm">
          Pengiriman dan verifikasi dinonaktifkan sampai status berhasil
          diperiksa.
        </p>
      )}
      <Button
        type="button"
        variant="outline"
        disabled={busy}
        onClick={() => void refresh()}
      >
        Muat ulang status
      </Button>
    </div>
  );
}
