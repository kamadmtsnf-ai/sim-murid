import { test } from "node:test";
import assert from "node:assert/strict";
import {
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
