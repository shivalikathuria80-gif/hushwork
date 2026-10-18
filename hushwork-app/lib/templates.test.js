// Tests for the starter templates. Run with `npm test`. Pure code only.
import test from "node:test";
import assert from "node:assert/strict";
import { TEMPLATES, templateById } from "./templates.js";
import { ICON_NAMES } from "./ai/icon-names.js";
import { LIMITS, checkPrompt, checkSteps } from "./validate.js";

test("templates: ids are unique, every icon exists, every request is a valid request text", () => {
  assert.equal(new Set(TEMPLATES.map((t) => t.id)).size, TEMPLATES.length);
  for (const t of TEMPLATES) {
    assert.ok(/^[a-z]+$/.test(t.id), t.id);
    assert.ok(ICON_NAMES.includes(t.icon), `${t.id}: icon ${t.icon}`);
    assert.ok(t.title.length > 0 && t.title.length <= LIMITS.nameMax, `${t.id}: title length`);
    assert.ok(t.body.length > 0);
    assert.ok(checkPrompt(t.request).value, `${t.id}: request`);
  }
});

test("templates: every step passes the same checks as any saved plan, and none is a free-text note", () => {
  for (const t of TEMPLATES) {
    const checked = checkSteps(t.steps);
    assert.ok(checked.value, `${t.id}: ${checked.error}`);
    assert.ok(checked.value.length >= 1 && checked.value.length <= LIMITS.planSteps);
    for (const s of checked.value) assert.ok(s.kind && s.fields, `${t.id}: a typed step was expected`);
  }
});

test("templates: a message to someone else is never sent without an approval step before it", () => {
  for (const t of TEMPLATES) {
    t.steps.forEach((s, index) => {
      if (s.kind !== "send" || s.fields.to === "me") return;
      assert.ok(t.steps.slice(0, index).some((earlier) => earlier.kind === "approve"), `${t.id}: step ${index + 1} sends without approval`);
    });
  }
});

test("templateById: a known id gives checked steps; anything else gives null", () => {
  const invoices = templateById("invoices");
  assert.equal(invoices.title, "Chase unpaid invoices");
  assert.equal(invoices.steps[0].title, "On a schedule");
  assert.equal(invoices.steps.at(-1).detail, "By email, to each overdue client: payment reminder");
  for (const bad of ["nope", "", "constructor", "__proto__", 5, null, undefined, ["invoices"], { id: "invoices" }]) assert.equal(templateById(bad), null, String(bad));
});
