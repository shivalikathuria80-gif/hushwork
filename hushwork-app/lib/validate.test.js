// Run with: node --test lib/validate.test.js
// (Node may print a harmless "module type not specified" warning. Do not add "type": "module" to package.json.)
import test from "node:test";
import assert from "node:assert/strict";
import { LIMITS, PASSWORD_BYTES_RULE, checkEmail, checkPassword, checkId, checkPrompt, cleanName, cleanPlan, cleanDraft, defaultName } from "./validate.js";

const goodPlan = JSON.stringify([{ icon: "Clock", title: "Run every morning", detail: "8:00 am, weekdays" }]);

test("email: good and bad", () => {
  assert.equal(checkEmail("  you@company.com ").value, "you@company.com");
  for (const bad of ["", "nope", "a@b", "a b@c.com", "@c.com", 42, null, `${"a".repeat(250)}@c.com`]) {
    assert.ok(checkEmail(bad).error, `should reject ${String(bad).slice(0, 20)}`);
  }
});

test("password when creating: 9 no, 10 yes, 64 yes, 65 no", () => {
  assert.ok(checkPassword("a".repeat(9), true).error);
  assert.ok(checkPassword("a".repeat(10), true).value);
  assert.ok(checkPassword("a".repeat(64), true).value);
  assert.ok(checkPassword("a".repeat(65), true).error);
  assert.ok(checkPassword("", true).error);
  assert.equal(checkPassword("          ", true).value, "          "); // spaces are allowed, never trimmed
});

test("password when creating: also at most 72 BYTES", () => {
  assert.ok(checkPassword("あ".repeat(24), true).value, "24 Japanese letters = 72 bytes is fine");
  assert.ok(checkPassword("あ".repeat(25), true).error, "25 Japanese letters = 75 bytes is too long");
  assert.ok(checkPassword("😀".repeat(18), true).value, "18 emoji = 72 bytes is fine");
  assert.equal(checkPassword("😀".repeat(19), true).error, PASSWORD_BYTES_RULE, "19 emoji = 76 bytes is too long");
  assert.ok(checkPassword("a".repeat(64), true).value, "64 ordinary letters = 64 bytes is fine");
});

test("password when signing in: only needs something typed", () => {
  assert.ok(checkPassword("x", false).value);
  assert.ok(checkPassword("", false).error);
  assert.ok(checkPassword("a".repeat(LIMITS.signInPasswordMax + 1), false).error);
});

test("draft id: a UUID passes, anything else is refused", () => {
  assert.ok(checkId("3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f").value);
  for (const bad of ["", "1", "not-a-uuid", "3f2b8c1e5d4a4b7e9c100a1b2c3d4e5f", "3f2b8c1e-5d4a-4b7e-9c10-0a1b2c3d4e5f; drop table", null, 7, {}]) {
    assert.ok(checkId(bad).error, `should reject ${String(bad)}`);
  }
});

test("rename: empty, normal, 80 and 81 characters", () => {
  assert.ok(cleanName("   ").error);
  assert.equal(cleanName("  Invoices ").value, "Invoices");
  assert.ok(cleanName("a".repeat(80)).value);
  assert.ok(cleanName("a".repeat(81)).error);
});

test("default name: short stays, long is cut at a word with ...", () => {
  assert.equal(defaultName("Chase invoices"), "Chase invoices");
  const cut = defaultName("Every weekday at 9am, find invoices more than 7 days overdue and draft a polite reminder for each client.");
  assert.ok(cut.endsWith("..."));
  assert.ok(cut.length <= LIMITS.defaultNameLength + 3);
});

test("draft: a good one is accepted and rebuilt", () => {
  const out = cleanDraft({ prompt: "  Chase invoices ", name: "", plan: goodPlan });
  assert.deepEqual(out.value, { name: "Chase invoices", prompt: "Chase invoices", plan: [{ icon: "Clock", title: "Run every morning", detail: "8:00 am, weekdays" }] });
});

test("draft: extra fields on steps are dropped", () => {
  const plan = JSON.stringify([{ icon: "Clock", title: "a", detail: "b", user_id: "x", evil: true }]);
  assert.deepEqual(Object.keys(cleanDraft({ prompt: "p", plan }).value.plan[0]), ["icon", "title", "detail"]);
});

test("draft: bad input is refused", () => {
  assert.ok(cleanDraft({ prompt: "   ", plan: goodPlan }).error, "empty prompt");
  assert.ok(cleanDraft({ prompt: "a".repeat(LIMITS.promptMax + 1), plan: goodPlan }).error, "2001-character prompt");
  assert.ok(cleanDraft({ prompt: "p", plan: "not json" }).error, "plan not json");
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify({ icon: "Clock" }) }).error, "plan not an array");
  assert.ok(cleanDraft({ prompt: "p", plan: "[]" }).error, "empty plan");
  const step = { icon: "Clock", title: "a", detail: "b" };
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify(Array(13).fill(step)) }).error, "13 steps");
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify([{ ...step, title: 5 }]) }).error, "non-string field");
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify([{ ...step, detail: "x".repeat(201) }]) }).error, "long detail");
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify([{ ...step, icon: "<script>" }]) }).error, "odd icon name");
  assert.ok(cleanDraft({ prompt: "p", plan: JSON.stringify(["text"]) }).error, "step not an object");
  assert.ok(cleanDraft({ prompt: "p", name: "n".repeat(81), plan: goodPlan }).error, "name too long");
  assert.ok(cleanDraft(null).error, "null input");
});

test("prompt: trimmed, 1 to 2000 characters, with a code the screen can use", () => {
  assert.equal(checkPrompt("  Chase invoices ").value, "Chase invoices");
  assert.equal(checkPrompt("a".repeat(LIMITS.promptMax)).value.length, LIMITS.promptMax);
  for (const empty of ["", "   ", null, 5, {}]) assert.equal(checkPrompt(empty).code, "empty");
  const long = checkPrompt("a".repeat(LIMITS.promptMax + 1));
  assert.equal(long.code, "too_long");
  assert.equal(long.error, `Use ${LIMITS.promptMax} characters or fewer.`);
  assert.equal(cleanDraft({ prompt: "   ", plan: goodPlan }).error, "Write a request first.", "saving a draft says the same as before");
});

test("plan: cleanPlan is the strict gate (exported for the AI)", () => {
  assert.deepEqual(cleanPlan(goodPlan).value, [{ icon: "Clock", title: "Run every morning", detail: "8:00 am, weekdays" }]);
  assert.ok(cleanPlan("[]").error);
  assert.ok(cleanPlan(JSON.stringify(Array(13).fill({ icon: "Clock", title: "a", detail: "b" }))).error);
  assert.ok(cleanPlan(JSON.stringify([{ icon: "Clock", title: "a".repeat(201), detail: "b" }])).error);
});

test("prompt: text made only of zero-width characters counts as empty (it cannot spend an AI plan)", () => {
  for (const hidden of ["\u{200b}", "\u{200b}\u{200c}\u{200d}", "\u{feff}", "  \u{200b} \u{feff} "]) assert.equal(checkPrompt(hidden).code, "empty", JSON.stringify(hidden));
  assert.equal(checkPrompt("\u{feff}  Chase\u{200b} invoices ").value, "Chase invoices");
  assert.equal(cleanDraft({ prompt: "\u{200b}\u{200b}", plan: goodPlan }).error, "Write a request first.");
});
