export type MutationPhase =
  | "idle"
  | "pending"
  | "success"
  | "error"
  | "blocked"
  | "uncertain";
const correctable = new Set([
  "invalid",
  "duplicate",
  "overlap",
  "invalid_membership",
  "class_in_use",
  "insufficient",
  "incomplete",
  "rate_limited",
  "archived",
]);
/** Only an explicit business rejection allows correction and another write. */
export function rejectionPhase(status: number, code: unknown): MutationPhase {
  if (status >= 500 || status < 400) return "uncertain";
  if (status === 401 || status === 403) return "blocked";
  return typeof code === "string" && correctable.has(code)
    ? "error"
    : "blocked";
}
export function savedAcknowledgement(
  body: Record<string, unknown>,
  snapshot: unknown,
  previousRevision: number,
) {
  const result = body.result;
  if (
    body.code !== "saved" ||
    (result !== undefined &&
      (typeof result !== "object" ||
        result === null ||
        !("code" in result) ||
        result.code !== "saved"))
  )
    return false;
  if (
    typeof snapshot !== "object" ||
    snapshot === null ||
    !("revision" in snapshot)
  )
    return false;
  return (
    Number.isSafeInteger(previousRevision) &&
    previousRevision >= 0 &&
    Number.isSafeInteger(snapshot.revision) &&
    Number(snapshot.revision) > previousRevision
  );
}
