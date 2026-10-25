/** AI control policy. No prompts, credentials or identities belong in telemetry. */
export const AI_POLICY = "P12-1";
export const AI_INPUT_CHARS = 24000;
export const AI_OUTPUT_TOKENS = 2048;
export function aiPolicy(
  env: Record<string, string | undefined> = process.env,
) {
  const dailyLimit = Number(env.AI_DAILY_REQUEST_LIMIT);
  const models = (env.AI_ALLOWED_MODELS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (
    env.AI_ANALYSIS_ENABLED !== "true" ||
    !Number.isInteger(dailyLimit) ||
    dailyLimit < 1 ||
    dailyLimit > 20 ||
    !models.length ||
    models.length > 20 ||
    models.some(
      (v) => !/^(openai|anthropic|gemini):[a-zA-Z0-9._:-]{1,150}$/.test(v),
    )
  )
    return null;
  return { dailyLimit, models };
}
export function redactAiText(
  text: string,
  identifiers: readonly string[] = [],
) {
  let value = text;
  for (const word of [...new Set(identifiers)]
    .filter((v) => v.length >= 3)
    .sort((a, b) => b.length - a.length)) {
    value = value.replace(
      new RegExp(word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "giu"),
      "[identitas disunting]",
    );
  }
  return value
    .replace(
      /\b(?:password|kata\s+sandi|otp|api[_ -]?key|token|cookie)\s*[:=]\s*[^\s,;]+/gi,
      "[kredensial disunting]",
    )
    .replace(
      /\b(?:sk-[a-z0-9_-]{10,}|eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+)\b/gi,
      "[kredensial disunting]",
    )
    .replace(/https?:\/\/\S+|www\.\S+/gi, "[tautan disunting]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email disunting]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f-]{27,}\b/gi, "[ID disunting]")
    .replace(/\+?\d[\d ().-]{4,}\d/g, "[nomor disunting]");
}
export function prepareAiSample(
  essays: string[],
  identifiers: readonly string[] = [],
) {
  if (
    essays.length < 5 ||
    essays.length > 150 ||
    essays.some((v) => v.length > 1500 || !v.trim())
  )
    throw Error("Invalid sample");
  const sample = essays.map((v) => redactAiText(v, identifiers));
  // Reject oversize, never silently claim a full-period analysis of a truncated sample.
  if (JSON.stringify(sample).length > AI_INPUT_CHARS)
    throw Error("Sample exceeds policy");
  return sample;
}
export function safeAiUsage(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>,
    usage: Record<string, number> = {};
  for (const key of [
    "input_tokens",
    "output_tokens",
    "total_tokens",
    "promptTokenCount",
    "candidatesTokenCount",
    "totalTokenCount",
  ]) {
    const n = row[key];
    if (typeof n === "number" && Number.isSafeInteger(n) && n >= 0)
      usage[key] = n;
  }
  return usage;
}
