"use client";
import { useWriteGuard } from "@/lib/forms/use-write-guard";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, KeyRound, MessageSquareLock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  questions,
  passwordChangeSchema,
  questionChangeSchema,
  securityStateSchema,
  type SecurityState,
} from "@/lib/auth/security-validation";
const guidance: Record<
  SecurityState["gate"],
  { title: string; detail: string }
> = {
  password: {
    title: "Ganti password sementara",
    detail:
      "Simpan password baru terlebih dahulu. Semua sesi akan diakhiri, lalu masuk kembali dengan password baru.",
  },
  profile_pending: {
    title: "Lengkapi biodata Anda",
    detail:
      "Gunakan menu Biodata dan dokumen pada sidebar. Draf dapat disimpan; kelengkapan diperiksa sesuai kondisi keluarga.",
  },
  security_question: {
    title: "Atur pertanyaan keamanan",
    detail:
      "Simpan pertanyaan dan jawaban untuk membantu proses pemulihan akun Anda.",
  },
  email_pending: {
    title: "Verifikasi email kontak",
    detail:
      "Perbarui email melalui Profil pribadi, lalu gunakan menu Verifikasi email pada sidebar. Verifikasi wajib untuk akun Guru.",
  },
  survey_pending: {
    title: "Selesaikan survei wajib",
    detail:
      "Gunakan menu Survei pada sidebar untuk menyelesaikan survei yang ditujukan kepada Anda.",
  },
  account_pending: {
    title: "Peran akun belum tersedia",
    detail: "Hubungi administrator madrasah untuk memeriksa peran akun Anda.",
  },
  ready: {
    title: "Akun siap digunakan",
    detail:
      "Anda dapat memperbarui password dan pertanyaan keamanan di sini. Pilih layanan lain melalui sidebar.",
  },
};
const field =
  "mt-2 min-h-11 w-full min-w-0 rounded-md border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
type Action = "password" | "question";
export function SecurityPanel({
  username,
  initialState,
}: {
  username: string;
  initialState: SecurityState;
}) {
  const router = useRouter();
  const [state, setState] = useState(initialState),
    [active, setActive] = useState<Action | "refresh" | null>(null),
    [message, setMessage] = useState(""),
    [failed, setFailed] = useState(false),
    [show, setShow] = useState(false),
    [needsSync, setNeedsSync] = useState(false),
    [errors, setErrors] = useState<Record<string, string>>({});
  const lock = useRef(false),
    mounted = useRef(true),
    notice = useRef<HTMLDivElement>(null),
    focusNotice = useRef(false);
  const busy = active !== null,
    blocked = busy || needsSync;
  useWriteGuard(() => lock.current, () => needsSync || ["password-current", "password-new", "password-confirm", "question-current", "security-answer"].some(id => { const field = document.getElementById(id); return field instanceof HTMLInputElement && !!field.value; }));
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!busy && message && focusNotice.current) {
      notice.current?.focus();
      focusNotice.current = false;
    }
  }, [busy, message, errors]);
  function feedback(text: string, error = false) {
    if (!mounted.current) return;
    setMessage(text);
    setFailed(error);
    focusNotice.current = error;
  }
  function signIn(destination = "/login?expired=1") {
    if (!mounted.current) return;
    router.replace(destination);
    router.refresh();
  }
  async function refresh() {
    if (lock.current) return;
    lock.current = true;
    setActive("refresh");
    try {
      const r = await fetch("/api/auth/security", {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      if (!mounted.current) return;
      if (r.status === 401) {
        signIn();
        return;
      }
      if (!r.ok) throw Error("Unavailable");
      const next = securityStateSchema.parse(await r.json());
      if (!mounted.current) return;
      setState(next);
      setNeedsSync(false);
      setErrors({});
      feedback("Status keamanan akun diperbarui.");
      router.refresh();
    } catch {
      feedback(
        "Status belum dapat diperiksa. Periksa koneksi lalu coba muat ulang status.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setActive(null);
    }
  }
  async function submit(event: FormEvent<HTMLFormElement>, action: Action) {
    event.preventDefault();
    if (lock.current || needsSync) return;
    const form = event.currentTarget,
      fields = Object.fromEntries(new FormData(form));
    delete fields.username;
    const input = { ...fields, action };
    const parsed = (
      action === "password"
        ? passwordChangeSchema(username)
        : questionChangeSchema
    ).safeParse(input);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        let key = String(issue.path[0] ?? "newPassword");
        if (action === "question" && key === "currentPassword")
          key = "questionPassword";
        next[key] ??= issue.message;
      }
      setErrors(next);
      feedback("Periksa kembali isian yang ditandai.", true);
      return;
    }
    lock.current = true;
    setActive(action);
    setErrors({});
    feedback(
      action === "password"
        ? "Menyimpan password baru…"
        : "Menyimpan pertanyaan keamanan…",
    );
    try {
      const r = await fetch("/api/auth/security", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
        signal: AbortSignal.timeout(30000),
      });
      if (!mounted.current) return;
      // Session expiry must work even when an intermediary returns a non-JSON body.
      if (r.status === 401) {
        form.reset();
        signIn();
        return;
      }
      const body: unknown = await r.json();
      if (!mounted.current) return;
      const data =
        typeof body === "object" && body !== null
          ? (body as Record<string, unknown>)
          : {};
      if (data.signed_out === true) {
        form.reset();
        setShow(false);
        signIn(r.ok ? "/login?password=changed" : "/login?password=pending");
        return;
      }
      if (!r.ok) {
        if (r.status >= 500 || r.status === 409) setNeedsSync(true);
        feedback(
          typeof data.message === "string"
            ? data.message
            : "Permintaan belum berhasil. Periksa isian Anda.",
          true,
        );
        return;
      }
      if (action === "password")
        throw Error("Missing password acknowledgement");
      const next = securityStateSchema.safeParse(data.state);
      if (!next.success) {
        setNeedsSync(true);
        if (data.saved === true) {
          form.reset();
          feedback(
            "Pertanyaan keamanan berhasil disimpan. Status terbaru belum dapat dimuat; muat ulang status sebelum melanjutkan.",
          );
        } else
          feedback(
            "Penyimpanan perlu dikonfirmasi. Muat ulang status sebelum mengirim kembali.",
            true,
          );
        return;
      }
      form.reset();
      setState(next.data);
      feedback("Pertanyaan keamanan berhasil disimpan.");
      router.refresh();
    } catch {
      if (mounted.current) setNeedsSync(true);
      feedback(
        "Hasil permintaan belum dapat dipastikan. Muat ulang status sebelum mencoba kembali. Jika password telah berubah, masuk kembali dengan password baru.",
        true,
      );
    } finally {
      lock.current = false;
      if (mounted.current) setActive(null);
    }
  }
  function errorFor(name: string) {
    return errors[name] ? (
      <p id={`${name}-error`} className="mt-2 text-sm text-destructive">
        {errors[name]}
      </p>
    ) : null;
  }
  const gate = guidance[state.gate];
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="mx-auto w-full min-w-0 max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8 [overflow-wrap:anywhere]"
    >
      <header className="space-y-2">
        <div className="flex items-center gap-3">
          <ShieldCheck
            aria-hidden="true"
            className="size-6 shrink-0 text-primary"
          />
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Keamanan akun
          </h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Kelola perlindungan akun{" "}
          <span className="font-medium text-foreground">{username}</span>.
        </p>
      </header>
      <section
        aria-labelledby="security-status"
        className="space-y-2 rounded-xl border bg-muted/30 p-4 sm:p-5"
      >
        <h2 id="security-status" className="font-semibold">
          {gate.title}
        </h2>
        <p className="text-sm leading-6 text-muted-foreground">{gate.detail}</p>
      </section>
      <div
        ref={notice}
        tabIndex={-1}
        role={failed ? "alert" : "status"}
        aria-live={failed ? "assertive" : "polite"}
        className={
          message
            ? "rounded-lg border p-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring " +
              (failed ? "border-destructive text-destructive" : "bg-muted/20")
            : ""
        }
      >
        {message}
      </div>
      {needsSync && (
        <p className="text-sm">
          Penyimpanan dinonaktifkan sampai status berhasil diperiksa. Isian
          belum dikirim ulang.
        </p>
      )}
      <div aria-busy={busy} className="min-w-0 space-y-6">
        <Card className="min-w-0">
          <CardHeader className="grid-cols-1 px-4 sm:px-6">
            <CardTitle>
              <h2 className="flex items-center gap-2">
                <KeyRound aria-hidden="true" className="size-5 shrink-0" />
                Ganti password
              </h2>
            </CardTitle>
            <p
              id="password-rules"
              className="text-sm leading-6 text-muted-foreground"
            >
              Minimal 8 karakter, maksimal 72 byte. Gunakan huruf besar, huruf
              kecil, angka, dan simbol. Hindari username, tiga karakter sama
              berurutan, dan password lama.
            </p>
          </CardHeader>
          <CardContent className="min-w-0 px-4 sm:px-6">
            <form
              className="min-w-0 space-y-4"
              noValidate
              onSubmit={(e) => void submit(e, "password")}
            >
              <input
                type="text"
                name="username"
                autoComplete="username"
                value={username}
                readOnly
                hidden
              />
              <label
                className="block text-sm font-medium"
                htmlFor="password-current"
              >
                Password saat ini
                <input
                  className={field}
                  id="password-current"
                  name="currentPassword"
                  type={show ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  disabled={blocked}
                  aria-invalid={!!errors.currentPassword}
                  aria-describedby={
                    errors.currentPassword ? "currentPassword-error" : undefined
                  }
                />
                {errorFor("currentPassword")}
              </label>
              <label
                className="block text-sm font-medium"
                htmlFor="password-new"
              >
                Password baru
                <input
                  className={field}
                  id="password-new"
                  name="newPassword"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={72}
                  aria-invalid={!!errors.newPassword}
                  aria-describedby={
                    "password-rules" +
                    (errors.newPassword ? " newPassword-error" : "")
                  }
                  required
                  disabled={blocked}
                />
                {errorFor("newPassword")}
              </label>
              <label
                className="block text-sm font-medium"
                htmlFor="password-confirm"
              >
                Konfirmasi password baru
                <input
                  className={field}
                  id="password-confirm"
                  name="confirmPassword"
                  type={show ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  disabled={blocked}
                  aria-invalid={!!errors.confirmPassword}
                  aria-describedby={
                    errors.confirmPassword ? "confirmPassword-error" : undefined
                  }
                />
                {errorFor("confirmPassword")}
              </label>
              <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={show}
                  disabled={busy}
                  onChange={(e) => setShow(e.target.checked)}
                />
                Tampilkan password
              </label>
              <p className="text-sm text-muted-foreground">
                Setelah password tersimpan, semua sesi akan diakhiri.
              </p>
              <Button
                className="w-full whitespace-normal sm:w-auto"
                disabled={blocked}
                type="submit"
              >
                {active === "password"
                  ? "Menyimpan password…"
                  : "Simpan password baru"}
              </Button>
            </form>
          </CardContent>
        </Card>
        {state.can_set_question && (
          <Card className="min-w-0">
            <CardHeader className="grid-cols-1 px-4 sm:px-6">
              <CardTitle>
                <h2 className="flex items-center gap-2">
                  <MessageSquareLock
                    aria-hidden="true"
                    className="size-5 shrink-0"
                  />
                  {state.question_code ? "Ubah" : "Atur"} pertanyaan keamanan
                </h2>
              </CardTitle>
              <p
                id="answer-rules"
                className="text-sm leading-6 text-muted-foreground"
              >
                Jawaban peka huruf besar dan kecil. Spasi di awal dan akhir
                diabaikan. Jawaban lama tidak ditampilkan; konfirmasi dengan
                password saat ini.
              </p>
            </CardHeader>
            <CardContent className="min-w-0 px-4 sm:px-6">
              <form
                className="min-w-0 space-y-4"
                noValidate
                onSubmit={(e) => void submit(e, "question")}
              >
                <input
                  type="text"
                  name="username"
                  autoComplete="username"
                  value={username}
                  readOnly
                  hidden
                  disabled
                />
                <label
                  className="block text-sm font-medium"
                  htmlFor="security-question"
                >
                  Pertanyaan
                  <select
                    key={state.question_code}
                    id="security-question"
                    name="question"
                    className={field}
                    defaultValue={state.question_code ?? "q1"}
                    disabled={blocked}
                  >
                    {questions.map((q) => (
                      <option key={q.code} value={q.code}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label
                  className="block text-sm font-medium"
                  htmlFor="security-answer"
                >
                  Jawaban
                  <input
                    id="security-answer"
                    name="answer"
                    className={field}
                    type="password"
                    autoComplete="off"
                    maxLength={256}
                    required
                    disabled={blocked}
                    aria-invalid={!!errors.answer}
                    aria-describedby={
                      "answer-rules" + (errors.answer ? " answer-error" : "")
                    }
                  />
                  {errorFor("answer")}
                </label>
                <label
                  className="block text-sm font-medium"
                  htmlFor="question-current"
                >
                  Password saat ini
                  <input
                    id="question-current"
                    name="currentPassword"
                    className={field}
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={blocked}
                    aria-invalid={!!errors.questionPassword}
                    aria-describedby={
                      errors.questionPassword
                        ? "questionPassword-error"
                        : undefined
                    }
                  />
                  {errorFor("questionPassword")}
                </label>
                <Button
                  className="w-full whitespace-normal sm:w-auto"
                  type="submit"
                  disabled={blocked}
                >
                  {active === "question"
                    ? "Menyimpan pertanyaan…"
                    : "Simpan pertanyaan keamanan"}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
      <footer className="flex min-w-0 flex-col gap-3 border-t pt-5 sm:flex-row sm:flex-wrap">
        <Button
          className="whitespace-normal"
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => void refresh()}
        >
          {active === "refresh" ? "Memeriksa status…" : "Muat ulang status"}
        </Button>
        <form action="/api/auth/logout" method="post">
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            type="submit"
            disabled={busy}
          >
            Keluar
          </Button>
        </form>
      </footer>
    </main>
  );
}
