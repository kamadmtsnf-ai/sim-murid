/** Only a duration: never expose identity, SQL, parameters or internal phases. */
export function serverTimingValue(start: number, end: number): string | null {
  const duration = end - start;
  if (!Number.isFinite(start) || !Number.isFinite(end) || !Number.isFinite(duration) || duration < 0 || duration > 3_600_000) return null;
  return `sim_app;dur=${duration.toFixed(1)}`;
}
export function withServerTiming<T extends Response>(response: T, start: number, end?: number): T {
  try {
    const value = serverTimingValue(start, end ?? performance.now());
    if (value) response.headers.append("Server-Timing", value);
  } catch { /* Measurement must never interrupt the response. */ }
  return response;
}
