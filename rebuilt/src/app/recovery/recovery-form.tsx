"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { questions } from "@/lib/auth/security-validation";
import { recoveryRequestSchema } from "@/lib/auth/recovery-validation";
import { useRecoverySubmission } from "./use-recovery-submission";
import { RecoveryFeedback } from "./recovery-feedback";
import styles from "./recovery.module.css";
import { FloatingLabel } from "@/components/ui/floating-label";

export function RecoveryForm() {
  const [manual, setManual] = useState(false),
    [sent, setSent] = useState(false);
  const [question, setQuestion] = useState<string>(questions[0].code);
  const state = useRecoverySubmission("/api/auth/recovery");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.locked || sent) return;
    const form = e.currentTarget;
    const input = recoveryRequestSchema.safeParse({
      ...Object.fromEntries(new FormData(form)),
      method: manual ? "manual" : "question",
    });
    if (!input.success) {
      state.fail(
        "Isi username, jenis permintaan, serta pertanyaan dan jawaban bila dipilih.",
      );
      return;
    }
    void state.run(
      input.data,
      (status) => status === 202,
      () => {
        form.reset();
        setManual(false);
        setQuestion(questions[0].code);
        setSent(true);
      },
    );
  }
  return (
    <div className={styles.stack}>
      <RecoveryFeedback {...state} />
      {sent ? (
        <>
          <p className={styles.note}>
            Hubungi petugas madrasah untuk melanjutkan pemeriksaan identitas.
            Jangan memberikan password atau kode pemulihan kepada siapa pun.
          </p>
          <Button
            className={styles.action}
            variant="outline"
            onClick={() => {
              setSent(false);
              state.clear();
            }}
          >
            Buat permintaan lain
          </Button>
        </>
      ) : (
        <form
          method="post"
          action="/api/auth/recovery"
          className={styles.form}
          onSubmit={submit}
          aria-busy={state.pending}
        >
          <fieldset disabled={state.locked} className={styles.fields}>
            <div><FloatingLabel htmlFor="recovery-username" label={<>Username
              </>}><input placeholder=" "
                id="recovery-username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={styles.input}
                required
                maxLength={100}
              /></FloatingLabel>
            </div>
            <label htmlFor="recovery-type">
              Bantuan yang dibutuhkan
              <select
                id="recovery-type"
                name="requestType"
                className={styles.input}
              >
                <option value="password">Lupa password</option>
                <option value="session">Tidak dapat mengakses sesi lama</option>
              </select>
            </label>
            <label className={styles.check}>
              <input
                type="checkbox"
                checked={manual}
                onChange={(e) => {
                  setManual(e.target.checked);
                  setQuestion(questions[0].code);
                  state.clear();
                }}
              />
              <span>
                Saya belum mengatur atau lupa jawaban keamanan. Saya ingin
                diperiksa langsung oleh petugas.
              </span>
            </label>
            {!manual && (
              <>
                <label htmlFor="recovery-question">
                  Pertanyaan keamanan
                  <select
                    id="recovery-question"
                    name="question"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    aria-describedby="recovery-question-help"
                    className={styles.input}
                  >
                    {questions.map((q) => (
                      <option key={q.code} value={q.code}>
                        {q.label}
                      </option>
                    ))}
                  </select>
                </label>
                <p id="recovery-question-help" className={styles.note}>
                  {questions.find((q) => q.code === question)?.label}
                </p>
                <div><FloatingLabel htmlFor="recovery-answer" label={<>Jawaban keamanan
                  </>}><input placeholder=" "
                    id="recovery-answer"
                    name="answer"
                    type="password"
                    autoComplete="off"
                    className={styles.input}
                    maxLength={256}
                    required
                  /></FloatingLabel>
                </div>
              </>
            )}
          </fieldset>
          <Button
            type="submit"
            className={styles.action}
            disabled={state.locked}
          >
            {state.pending ? "Mengirim…" : "Minta bantuan Admin"}
          </Button>
        </form>
      )}
      {state.phase === "uncertain" && (
        <a className={styles.link} href="/recovery">
          Hubungi Admin melalui permintaan baru
        </a>
      )}
    </div>
  );
}
