import test from "node:test";
import assert from "node:assert/strict";
import {
  aiPolicy,
  prepareAiSample,
  redactAiText,
  safeAiUsage,
} from "../src/lib/services/ai-controls.ts";
test("AI activation requires explicit valid bounded policy and model allowlist", () => {
  const good = {
    AI_ANALYSIS_ENABLED: "true",
    AI_DAILY_REQUEST_LIMIT: "2",
    AI_ALLOWED_MODELS: "openai:approved-model",
  };
  assert.equal(aiPolicy({}), null);
  assert.equal(aiPolicy({ ...good, AI_DAILY_REQUEST_LIMIT: "21" }), null);
  assert.equal(aiPolicy({ ...good, AI_ALLOWED_MODELS: "https://evil" }), null);
  assert.equal(aiPolicy(good)?.dailyLimit, 2);
});
test("AI redacts known identity literals including regex metacharacters and contact patterns", () => {
  const text = redactAiText(
    "Siti A.+ menyebut siti a.+, unit@example.org, OTP: 123456 password: PRIVATEPASSWORD sk-synthetic_secret_key +62 812-1234-5678 dan https://example.org/private",
    ["Siti A.+"],
  );
  for (const privateValue of [
    "Siti",
    "siti",
    "unit@",
    "812",
    "https",
    "123456",
    "PRIVATEPASSWORD",
    "sk-synthetic",
  ])
    assert.ok(!text.includes(privateValue));
  assert.ok(text.includes("disunting"));
});
test("AI rejects oversized sample rather than silently misrepresenting scope", () => {
  assert.throws(() => prepareAiSample(["one"]));
  assert.throws(() => prepareAiSample(Array(150).fill("a".repeat(1500))));
  assert.throws(() => prepareAiSample(Array(5).fill(" ")));
  assert.equal(prepareAiSample(Array(5).fill("Data sintetis")).length, 5);
});
test("provider metadata allowlist discards opaque data, IDs and invalid usage", () => {
  assert.deepEqual(
    safeAiUsage({
      input_tokens: 1,
      output_tokens: -1,
      total_tokens: Infinity,
      private: "SECRET",
      request_id: "id",
    }),
    { input_tokens: 1 },
  );
});
