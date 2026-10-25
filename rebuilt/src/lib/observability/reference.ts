/** Trace identifiers only; never accept an error message, URL or user identity. */
export function requestReference(value: unknown): string | null {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
    ? value.toLowerCase()
    : null;
}
export function errorDigest(value: unknown): string | null {
  return typeof value === "string" &&
    (/^[0-9]{1,20}$/.test(value) || /^[a-f0-9]{8,64}$/i.test(value))
    ? value
    : null;
}
export function withReference(message: string, reference: string | null) {
  return reference ? `${message} Kode laporan: ${reference}.` : message;
}
