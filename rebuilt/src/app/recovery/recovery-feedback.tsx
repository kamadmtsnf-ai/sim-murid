import type { RefObject } from "react";
import { Status } from "@/components/ui/status";
import styles from "./recovery.module.css";
export function RecoveryFeedback({
  message,
  phase,
  feedback,
}: {
  message: string;
  phase: string;
  feedback: RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      {phase === "pending" && (
        <p role="status" className={styles.note}>
          Permintaan sedang diproses. Tunggu sebentar…
        </p>
      )}
      {message && (
        <div ref={feedback} tabIndex={-1} className={styles.feedback}>
          <Status tone={phase === "success" ? "success" : "error"}>
            {message}
          </Status>
        </div>
      )}
    </>
  );
}
