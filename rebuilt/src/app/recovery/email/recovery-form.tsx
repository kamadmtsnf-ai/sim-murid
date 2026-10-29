"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import {
  recoveryEmailRequest,
  recoveryEmailReset,
} from "@/lib/email/validation";
import { passwordValueSchema } from "@/lib/auth/security-validation";
import { useRecoverySubmission } from "../use-recovery-submission";
import { RecoveryFeedback } from "../recovery-feedback";
import styles from "../recovery.module.css";
import { FloatingLabel } from "@/components/ui/floating-label";

export function EmailRecoveryForm() {
  const router = useRouter(),
    codeRef = useRef<HTMLInputElement>(null);
  const [username, setUsername] = useState(""),
    [challenge, setChallenge] = useState(""),
    [done, setDone] = useState(false);
  const state = useRecoverySubmission("/api/auth/email-recovery");
  useEffect(() => {
    if (challenge) codeRef.current?.focus();
  }, [challenge]);
  function submit(e: FormEvent<HTMLFormElement>, action: "send" | "reset") {
    e.preventDefault();
    if (state.locked || done) return;
    const form = e.currentTarget,
      fields = Object.fromEntries(new FormData(form));
    const input =
      action === "send"
        ? recoveryEmailRequest.safeParse({ ...fields, action })
        : recoveryEmailReset.safeParse({
            ...fields,
            username,
            challengeId: challenge,
            action,
          });
    if (!input.success) {
      state.fail("Periksa username, kode enam digit, dan password.");
      return;
    }
    if (
      input.data.action === "reset" &&
      (!passwordValueSchema(username).safeParse(input.data.newPassword)
        .success ||
        input.data.newPassword !== input.data.confirmPassword)
    ) {
      state.fail("Periksa kekuatan dan konfirmasi password sesuai ketentuan.");
      return;
    }
    void state.run(
      input.data,
      (status, data) =>
        action === "send"
          ? status === 202 && z.uuid().safeParse(data.challengeId).success
          : status === 200 && data.destination === "/login?password=changed",
      (data) => {
        form.reset();
        if (input.data.action === "send") {
          setUsername(input.data.username);
          setChallenge(data.challengeId as string);
        } else {
          setDone(true);
          setChallenge("");
          try {
            router.replace("/login?password=changed");
          } catch {
            /* Native link completes navigation if client routing fails. */
          }
        }
      },
    );
  }
  return (
    <div className={styles.stack}>
      <ol className={styles.steps} aria-label="Tahap pemulihan">
        <li aria-current={!challenge && !done ? "step" : undefined}>
          1. Minta kode
        </li>
        <li aria-current={challenge ? "step" : undefined}>2. Ganti password</li>
        <li aria-current={done ? "step" : undefined}>3. Masuk kembali</li>
      </ol>
      <RecoveryFeedback {...state} />
      {done ? (
        <a className={styles.link} href="/login?password=changed">
          Masuk dengan password baru
        </a>
      ) : !challenge ? (
        <form
          method="post"
          action="/api/auth/email-recovery"
          className={styles.form}
          onSubmit={(e) => submit(e, "send")}
          aria-busy={state.pending}
        >
          <div><FloatingLabel htmlFor="email-recovery-user" label={<>Username
            </>}><input placeholder=" "
              id="email-recovery-user"
              name="username"
              className={styles.input}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={100}
              required
              disabled={state.locked}
            /></FloatingLabel>
          </div>
          <Button
            type="submit"
            className={styles.action}
            disabled={state.locked}
          >
            {state.pending ? "Memproses…" : "Minta kode pemulihan"}
          </Button>
        </form>
      ) : (
        <>
          <p className={styles.note}>
            Akun: <strong>{username}</strong>. Gunakan kode terbaru dari email
            Anda. Kode berlaku maksimal 10 menit dan 5 percobaan. Jangan
            membagikan kode kepada siapa pun.
          </p>
          <form
            method="post"
            action="/api/auth/email-recovery"
            className={styles.form}
            onSubmit={(e) => submit(e, "reset")}
            aria-busy={state.pending}
          >
            <fieldset disabled={state.locked} className={styles.fields}>
              <div><FloatingLabel htmlFor="recovery-email-code" label={<>Kode enam digit
                </>}><input placeholder=" "
                  ref={codeRef}
                  id="recovery-email-code"
                  name="code"
                  className={styles.input}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  required
                /></FloatingLabel>
              </div>
              <p id="reset-password-rules" className={styles.note}>
                Password minimal 8 karakter, maksimal 72 byte; huruf
                besar/kecil, angka dan simbol. Hindari username dan tiga
                karakter sama berurutan.
              </p>
              <div><FloatingLabel htmlFor="recovery-new-password" label={<>Password baru
                </>}><input placeholder=" "
                  id="recovery-new-password"
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  className={styles.input}
                  minLength={8}
                  maxLength={72}
                  aria-describedby="reset-password-rules"
                  required
                /></FloatingLabel>
              </div>
              <div><FloatingLabel htmlFor="recovery-confirm-password" label={<>Konfirmasi password
                </>}><input placeholder=" "
                  id="recovery-confirm-password"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  className={styles.input}
                  maxLength={1024}
                  required
                /></FloatingLabel>
              </div>
            </fieldset>
            <Button
              type="submit"
              className={styles.action}
              disabled={state.locked}
            >
              {state.pending ? "Memproses…" : "Simpan password baru"}
            </Button>
          </form>
          <Button
            variant="outline"
            className={styles.action}
            disabled={state.locked}
            onClick={() => {
              setChallenge("");
              state.clear();
            }}
          >
            Minta kode baru atau ganti username
          </Button>
          <p className={styles.note}>
            Pengiriman ulang minimal berjarak 60 detik; maksimal 5 permintaan
            per hari WIB. Setelah proses reset yang tidak pasti, tunggu dua
            menit atau hubungi Admin.
          </p>
        </>
      )}
      {state.phase === "uncertain" && (
        <a className={styles.link} href="/login">
          Periksa dengan login
        </a>
      )}
    </div>
  );
}
