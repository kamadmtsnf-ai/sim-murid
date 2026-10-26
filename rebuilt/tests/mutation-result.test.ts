import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mutationGuidance,
  savedAcknowledgement,
  rejectionPhase,
} from "../src/lib/forms/mutation-result.ts";
test("success requires coherent acknowledgement and an advanced safe revision", () => {
  assert.equal(
    savedAcknowledgement({ code: "saved" }, { revision: 2 }, 1),
    true,
  );
  assert.equal(
    savedAcknowledgement(
      { code: "saved", result: { code: "saved" } },
      { revision: 3 },
      1,
    ),
    true,
  );
  for (const body of [
    {},
    { code: "invalid" },
    { code: "saved", result: null },
    { code: "saved", result: { code: "stale" } },
  ])
    assert.equal(savedAcknowledgement(body, { revision: 2 }, 1), false);
  for (const revision of [
    1,
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
    "2",
  ])
    assert.equal(
      savedAcknowledgement({ code: "saved" }, { revision }, 1),
      false,
    );
});
test("only explicit correctable business rejections allow another command", () => {
  for (const code of [
    "invalid",
    "duplicate",
    "overlap",
    "invalid_membership",
    "class_in_use",
    "insufficient",
    "incomplete",
    "rate_limited",
    "archived",
  ])
    assert.equal(rejectionPhase(409, code), "error");
  for (const code of [
    "stale",
    "request_conflict",
    "not_found",
    "unknown",
    undefined,
  ])
    assert.equal(rejectionPhase(409, code), "blocked");
  for (const status of [401, 403])
    assert.equal(rejectionPhase(status, "invalid"), "blocked");
  for (const status of [200, 500, 503])
    assert.equal(rejectionPhase(status, "invalid"), "uncertain");
});

test('timeout and invalid HTTP evidence never unlock a blind retry',()=>{for(const status of [408,NaN,Infinity,-1,200,500,503])assert.equal(rejectionPhase(status,'invalid'),'uncertain');});

test('next steps distinguish corrective business reasons from permission and version problems',()=>{
 for(const [code,word] of [['duplicate','sudah tercatat'],['insufficient','saldo'],['overlap','bertabrakan'],['rate_limited','Tunggu'],['archived','arsip'],['invalid_membership','keanggotaan'],['class_in_use','Kelas'],['incomplete','Lengkapi']] as const)assert.ok(mutationGuidance('error',code)?.includes(word));
 for(const [code,word] of [['stale','versi terbaru'],['request_conflict','hasil sebelumnya'],['not_found','referensi']] as const)assert.ok(mutationGuidance('blocked',code)?.includes(word));
 assert.match(mutationGuidance('blocked',undefined,401)??'',/Masuk kembali/);assert.match(mutationGuidance('blocked',undefined,403)??'',/tugas tambahan/);
});
test('uncertain/pending instructions never recommend resending or copying private drafts',()=>{
 const pending=mutationGuidance('pending')??'',unknown=mutationGuidance('uncertain','duplicate',503)??'';
 assert.match(pending,/Jangan kirim/);assert.match(unknown,/jangan kirim ulang/);assert.match(unknown,/menghilangkan isian/);assert.equal(/Catat|salin|otomatis ulang/i.test(unknown),false);assert.equal(mutationGuidance('idle'),undefined);
});
