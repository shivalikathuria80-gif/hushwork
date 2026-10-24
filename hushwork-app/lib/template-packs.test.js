import test from "node:test";
import assert from "node:assert/strict";
import { PACKS, PACK_IDS, packOf, suggestedSchedule } from "./template-packs.js";
import { TEMPLATES } from "./templates.js";
import { checkSteps } from "./validate.js";
import { findComposioApp } from "./connectors/composio-apps.js";
import { findAction } from "./connectors/composio-actions.js";
import { ICON_NAMES } from "./ai/icon-names.js";

test("packs: a template without a pack is Everyday, a made-up pack is Everyday too, and a suggested schedule reads like the Schedule panel", () => {
  assert.deepEqual(PACK_IDS, ["everyday", "finance", "marketing", "coding", "design"]);
  for (const pack of PACKS) assert.ok(pack.label && pack.blurb && ICON_NAMES.includes(pack.icon), pack.id);
  assert.equal(packOf({}), "everyday");
  assert.equal(packOf({ pack: "finance" }), "finance");
  for (const odd of ["", "nope", "__proto__", 5, null, undefined]) assert.equal(packOf({ pack: odd }), "everyday", String(odd));
  assert.equal(suggestedSchedule({ schedule: { frequency: "weekly", weekday: 1, hour: 9, minute: 0 } }), "Every week on Monday at 09:00");
  assert.equal(suggestedSchedule({ schedule: { frequency: "weekdays", hour: 8, minute: 30 } }), "Every weekday at 08:30");
  for (const bad of [undefined, {}, { schedule: { frequency: "monthly", hour: 9, minute: 0 } }, { schedule: { frequency: "daily", hour: 25, minute: 0 } }]) assert.equal(suggestedSchedule(bad), "", JSON.stringify(bad));
});

test("packs: every pack has at least three templates, and every template has a real icon and a valid plan", () => {
  for (const pack of PACK_IDS) assert.ok(TEMPLATES.filter((t) => packOf(t) === pack).length >= 3, `${pack} has at least 3 templates`);
  for (const t of TEMPLATES) {
    assert.ok(ICON_NAMES.includes(t.icon), `${t.id}: icon`);
    assert.ok(checkSteps(t.steps).value, `${t.id}: steps`);
    if (t.pack !== undefined) assert.ok(PACK_IDS.includes(t.pack), `${t.id}: pack`);
  }
});

test("packs: a suggested schedule is valid and matches the Start step; a template with a Start of 'on a schedule' says when", () => {
  for (const t of TEMPLATES.filter((x) => x.schedule)) {
    assert.ok(suggestedSchedule(t), `${t.id}: the suggested schedule is valid`);
    assert.equal(t.steps[0].kind, "trigger", t.id);
    assert.equal(t.steps[0].fields.how, "schedule", `${t.id}: its Start step says it runs on a schedule`);
    assert.ok(t.steps[0].fields.when, `${t.id}: and says when`);
    assert.ok(t.steps.some((s) => s.kind === "action" || s.kind === "issue" || s.kind === "ai"), `${t.id}: a schedule is only suggested for something that does work`);
  }
});

test("packs: every template that says what it needs can really be approved, step by step, with real apps and actions", async () => {
  const { isAiStep, isAppLookup, isActionStep, isLinearCreate, isRequestStep } = await import("./run-engine.js");
  for (const t of TEMPLATES.filter((x) => x.needs)) {
    const checked = checkSteps(t.steps).value;
    for (const s of checked.filter((x) => x.kind !== "trigger")) {
      assert.ok(isAiStep(s) || isAppLookup(s) || isActionStep(s) || isLinearCreate(s) || isRequestStep(s), `${t.id}: a ${s.kind} step can be approved`);
      if (s.kind === "ai" && s.fields.uses === "app") {
        const app = findComposioApp(s.fields.address);
        assert.ok(app && !app.unavailable, `${t.id}: the app ${s.fields.address} exists and can be connected`);
      }
      if (s.kind === "action") assert.ok(findAction(s.fields.action), `${t.id}: a listed action`);
    }
    const writes = checked.filter((s) => s.kind === "action" || s.kind === "issue");
    if (checked.some((s) => s.kind === "ai") && writes.length) {
      const text = writes.map((s) => `${s.fields.title}${s.fields.details}`).join(" ");
      if (/\{answers?\}/.test(text)) assert.ok(checked.findIndex((s) => s.kind === "ai") < checked.findIndex((s) => s.kind === "action" || s.kind === "issue"), `${t.id}: the AI speaks before its words are used`);
    }
  }
});

test("packs: a template with a placeholder the person must change says so in plain words", () => {
  for (const t of TEMPLATES) {
    const body = `${t.body} ${t.request}`.toLowerCase();
    for (const s of t.steps.filter((x) => x.kind === "action")) {
      if (s.fields.action === "notion_page") assert.ok(body.includes("page id"), `${t.id}: tells you to change the Notion page id`);
      if (s.fields.action === "calendar_event") assert.ok(body.includes("start time"), `${t.id}: tells you to change the start time`);
      if (s.fields.action === "github_issue") assert.ok(body.includes("owner/name"), `${t.id}: tells you to change owner/name`);
    }
    for (const s of t.steps.filter((x) => x.kind === "ai" && x.fields.uses === "web")) {
      if (s.fields.address === "https://example.com/" && t.id !== "siteup") assert.ok(body.includes("change the address"), `${t.id}: tells you to change the web address`);
    }
  }
});
