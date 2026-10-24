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

const MULTI = ["testall", "hellomail", "emailweek", "emailinbox", "emailfiles", "emailtask", "mailtask", "briefing"];

test("templates: the three that work for real say what they need, and their steps can really be approved on the Runs page", async () => {
  const { isAiStep } = await import("./run-engine.js");
  const { checkRequestUrl } = await import("./connectors/http.js");
  const real = TEMPLATES.filter((t) => t.needs);
  assert.deepEqual(real.map((t) => t.id), ["firsttask", "inboxnow", "recentfiles", "weekahead", "siteup", "testall", "hellomail", "emailweek", "emailinbox", "emailfiles", "emailtask", "mailtask", "briefing"]);
  for (const t of real.filter((x) => !MULTI.includes(x.id))) {
    assert.ok(["Linear", "Google", "Nothing"].includes(t.needs), t.id);
    const checked = checkSteps(t.steps).value;
    const ai = checked.find((s) => s.kind === "ai");
    assert.ok(ai && isAiStep(ai), `${t.id}: has an Ask the AI step that can be approved`);
    assert.equal(ai.fields.uses, { Linear: "linear", Google: { inboxnow: "gmail", recentfiles: "drive" }[t.id] ?? "calendar", Nothing: "web" }[t.needs], `${t.id}: the tool matches what it needs`);
    if (ai.fields.uses === "web") assert.ok(checkRequestUrl(ai.fields.address).value, `${t.id}: the starting web address is valid`);
  }
  // the check-up uses several apps at once: every step must be one that can really be approved, and its writes must read the AI's line
  const { isAppLookup, isActionStep, isLinearCreate, isRequestStep } = await import("./run-engine.js");
  const all = checkSteps(real.find((x) => x.id === "testall").steps).value;
  for (const s of all.filter((x) => x.kind !== "trigger")) assert.ok(isAiStep(s) || isAppLookup(s) || isActionStep(s) || isLinearCreate(s) || isRequestStep(s), `testall: ${s.kind} can be approved`);
  assert.equal(all.filter(isActionStep).length + all.filter(isLinearCreate).length, 1, "exactly one test task is written");
  assert.ok(all.findLast(isAiStep) === all[6] && all[7].fields.title === "{answer}", "the write uses the last AI line");
  // each one-way chain (look, then write) must be approvable, and its write must use the AI's line
  for (const id of ["emailweek", "emailinbox", "emailfiles", "emailtask", "mailtask"]) {
    const chain = checkSteps(real.find((x) => x.id === id).steps).value;
    assert.ok(isAiStep(chain[1]) && (isActionStep(chain[2]) || isLinearCreate(chain[2])), `${id}: look with the AI, then write`);
    assert.ok(chain[2].fields.title === "{answer}" || chain[2].fields.details === "{answer}", `${id}: the write uses the AI's line`);
    if (isActionStep(chain[2])) assert.equal(chain[2].fields.action, "gmail_send", id);
  }
  const briefing = checkSteps(real.find((x) => x.id === "briefing").steps).value;
  assert.deepEqual(briefing.filter(isAiStep).map((s) => s.fields.uses), ["calendar", "gmail", "linear"], "the briefing reads three sources");
  assert.ok(isActionStep(briefing[4]) && briefing[4].fields.details === "{answers}", "and sends them in one email");
  const hello = checkSteps(real.find((x) => x.id === "hellomail").steps).value;
  assert.ok(isActionStep(hello[1]) && hello[1].fields.action === "gmail_send", "the hello email is a real send step, approved on the Runs page");
  for (const t of TEMPLATES.filter((x) => !x.needs)) assert.equal(t.needs, undefined);
});

test("templates: no real person's email address is written into any template, and every email template goes to {myEmail}", () => {
  const text = JSON.stringify(TEMPLATES);
  assert.equal(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/.test(text), false, "no address appears anywhere in the templates");
  const emails = TEMPLATES.flatMap((t) => t.steps).filter((s) => s.kind === "action" && s.fields.action === "gmail_send");
  assert.ok(emails.length >= 6);
  for (const s of emails) assert.equal(s.fields.target, "{myEmail}");
});

