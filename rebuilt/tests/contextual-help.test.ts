import assert from "node:assert/strict";
import test from "node:test";
import { helpFor, supportTemplate } from "../src/config/contextual-help.ts";
import { accountNavigation } from "../src/config/account-navigation.ts";
test("every registered menu has actionable contextual guidance", () => {
  for (const group of accountNavigation)
    for (const item of group.items) {
      const help = helpFor(item.href);
      assert.ok(help.title && help.steps.length >= 4, item.href);
      assert.ok(help.steps.some((step) => step.includes("belum pasti")));
    }
});
test("academic guidance preserves period and archive semantics; finance uses calendar", () => {
  assert.match(helpFor("/account/schedules").steps.join(" "), /2026\/2027/);
  assert.match(
    helpFor("/account/learning/reports").steps.join(" "),
    /tidak mengubah arsip/,
  );
  assert.match(
    helpFor("/account/operations/savings").steps.join(" "),
    /tahun kalender/,
  );
});
test("support template has no automatic context collection or delivery claim", () => {
  const text = supportTemplate("Absensi", null);
  assert.match(text, /tidak tersedia/);
  assert.match(text, /Jangan sertakan password, OTP, cookie/);
  assert.ok(!text.includes("http"));
});
