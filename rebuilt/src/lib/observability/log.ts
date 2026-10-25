import { errorDigest, requestReference } from "./reference";
/** All arguments are projected; no raw error/context/request is serialized. Logging must never break a request. */
export function logResponseFailure(reference: string, status: number) {
  if (
    status < 500 ||
    status > 599 ||
    !Number.isInteger(status) ||
    !requestReference(reference)
  )
    return;
  try {
    console.error(
      JSON.stringify({ event: "sim.http_error", reference, status }),
    );
  } catch {}
}
export function logRequestFailure(
  error: unknown,
  method: unknown,
  kind: unknown,
) {
  try {
    const digest = errorDigest(
      error && typeof error === "object" && "digest" in error
        ? error.digest
        : null,
    );
    const routeType =
      typeof kind === "string" &&
      ["render", "route", "action", "proxy"].includes(kind)
        ? kind
        : "unknown";
    const safeMethod =
      typeof method === "string" &&
      ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(
        method,
      )
        ? method
        : "unknown";
    console.error(
      JSON.stringify({
        event: "sim.request_error",
        digest,
        routeType,
        method: safeMethod,
      }),
    );
  } catch {}
}
