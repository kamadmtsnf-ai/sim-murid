import test from "node:test";
import assert from "node:assert/strict";
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
registerHooks({
  resolve(s, c, n) {
    if (s === "server-only") return { url: "empty:server", shortCircuit: true };
    if (s === "./analysis-schema")
      return {
        url: new URL("./analysis-schema.ts", c.parentURL).href,
        shortCircuit: true,
      };
    return n(s, c);
  },
  load(u, c, n) {
    if (u === "empty:server")
      return { format: "module", source: "export{}", shortCircuit: true };
    if (u.endsWith(".ts"))
      return {
        format: "module",
        source: ts.transpileModule(readFileSync(new URL(u), "utf8"), {
          compilerOptions: {
            module: ts.ModuleKind.ESNext,
            target: ts.ScriptTarget.ES2022,
          },
        }).outputText,
        shortCircuit: true,
      };
    return n(u, c);
  },
});
const { analyzeEssays, encryptKey } = await import(
  "../src/lib/services/providers.ts"
);
const output = {
  ringkasan_umum: "Ringkasan",
  tema_positif: ["Baik"],
  tema_perlu_perhatian: [],
  kutipan_representatif: [],
  rekomendasi_tindakan: [],
  skor_sentimen_keseluruhan: "positif",
};
const essays = Array.from({ length: 5 }, () => "Data esai");
test("OpenAI uses server bearer key, strict Responses schema, no storage, and validated output", async () => {
  const old = globalThis.fetch,
    seed = process.env.EMAIL_OTP_SECRET;
  process.env.EMAIL_OTP_SECRET = "a".repeat(40);
  try {
    let sent;
    globalThis.fetch = async (url, init) => {
      sent = { url, init, body: JSON.parse(init.body) };
      return Response.json({
        status: "completed",
        output: [
          {
            type: "message",
            content: [{ type: "output_text", text: JSON.stringify(output) }],
          },
        ],
        usage: { input_tokens: 10 },
      });
    };
    const encrypted = encryptKey("synthetic-api-key");
    assert.ok(!encrypted.includes("synthetic"));
    const result = await analyzeEssays(
      "openai",
      encrypted,
      "account-model",
      essays,
    );
    assert.deepEqual(result.result, output);
    assert.equal(sent.url, "https://api.openai.com/v1/responses");
    assert.equal(sent.init.headers.Authorization, "Bearer synthetic-api-key");
    assert.equal(sent.body.store, false);
    assert.equal(sent.body.text.format.strict, true);
    assert.equal(sent.body.text.format.schema.additionalProperties, false);
    assert.equal(sent.body.model, "account-model");
    assert.deepEqual(result.tokens, { input_tokens: 10 });
  } finally {
    globalThis.fetch = old;
    if (seed === undefined) delete process.env.EMAIL_OTP_SECRET;
    else process.env.EMAIL_OTP_SECRET = seed;
  }
});
test("OpenAI fails closed on incomplete, refusal, malformed schema, HTTP error and oversized bodies", async () => {
  const old = globalThis.fetch,
    seed = process.env.EMAIL_OTP_SECRET;
  process.env.EMAIL_OTP_SECRET = "b".repeat(40);
  try {
    const encrypted = encryptKey("synthetic-api-key");
    for (const response of [
      Response.json({ status: "incomplete", output: [] }),
      Response.json({
        status: "completed",
        output: [
          { type: "message", content: [{ type: "refusal", refusal: "No" }] },
        ],
      }),
      Response.json({
        status: "completed",
        output: [
          { type: "message", content: [{ type: "output_text", text: "{}" }] },
        ],
      }),
      new Response("unavailable", { status: 429 }),
      new Response("x".repeat(250001)),
    ]) {
      globalThis.fetch = async () => response;
      await assert.rejects(
        analyzeEssays("openai", encrypted, "account-model", essays),
      );
    }
  } finally {
    globalThis.fetch = old;
    if (seed === undefined) delete process.env.EMAIL_OTP_SECRET;
    else process.env.EMAIL_OTP_SECRET = seed;
  }
});
test("Existing Anthropic and Gemini adapters retain schema and usage contracts", async () => {
  const old = globalThis.fetch,
    seed = process.env.EMAIL_OTP_SECRET;
  process.env.EMAIL_OTP_SECRET = "c".repeat(40);
  try {
    for (const provider of ["anthropic", "gemini"]) {
      globalThis.fetch = async () =>
        Response.json(
          provider === "anthropic"
            ? {
                content: [{ type: "text", text: JSON.stringify(output) }],
                usage: { n: 1 },
              }
            : {
                candidates: [
                  { content: { parts: [{ text: JSON.stringify(output) }] } },
                ],
                usageMetadata: { n: 1 },
              },
        );
      assert.deepEqual(
        (
          await analyzeEssays(
            provider,
            encryptKey("synthetic-api-key"),
            "account-model",
            essays,
          )
        ).result,
        output,
      );
    }
  } finally {
    globalThis.fetch = old;
    if (seed === undefined) delete process.env.EMAIL_OTP_SECRET;
    else process.env.EMAIL_OTP_SECRET = seed;
  }
});
