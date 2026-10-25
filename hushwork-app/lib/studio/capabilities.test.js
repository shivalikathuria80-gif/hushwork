// Workflow Studio rules: what a step says about itself (why, how, evidence), which apps it needs, and what to offer when one is missing.
import test from "node:test";
import assert from "node:assert/strict";
import { alternativeFor, capabilityOf, pluginsOf, requirementOf, skillOf } from "./capabilities.js";
import { SKILLS, BUNDLES, accessOf, buildWorkflow, skillStart, findSkill } from "../skills/bundles.js";
import { rowsForSkill, toWorking } from "../step-rows.js";
import { builderStart } from "../builder-start.js";
import { TEMPLATES } from "../templates.js";
import { checkSteps } from "../validate.js";
import { stepsToPlan } from "../steps.js";

const ai = (uses, address = "", task = "Do a job.") => ({ kind: "ai", fields: { task, uses, address } });

test("pluginsOf: the apps a step needs come from what it reads or writes, and nothing else", () => {
  assert.deepEqual(pluginsOf(ai("gmail")), ["google"]);
  assert.deepEqual(pluginsOf(ai("drive")), ["google"]);
  assert.deepEqual(pluginsOf(ai("calendar")), ["google"]);
  assert.deepEqual(pluginsOf(ai("linear")), ["linear"]);
  assert.deepEqual(pluginsOf(ai("app", "stripe")), ["stripe"]);
  assert.deepEqual(pluginsOf(ai("app", "stripeinvoices")), ["stripe"], "a second lookup shares its app's sign-in");
  assert.deepEqual(pluginsOf({ kind: "app", fields: { app: "stripeinvoices" } }), ["stripe"]);
  assert.deepEqual(pluginsOf(ai("app", "not-an-app")), [], "an unknown app name needs nothing we can name");
  for (const free of ["nothing", "web", "mcp"]) assert.deepEqual(pluginsOf(ai(free, "https://example.com/")), [], free);
  assert.deepEqual(pluginsOf({ kind: "app", fields: { app: "todoist", what: "" } }), ["todoist"]);
  assert.deepEqual(pluginsOf({ kind: "action", fields: { action: "gmail_send" } }), ["gmailsend"]);
  assert.deepEqual(pluginsOf({ kind: "action", fields: { action: "slack_message" } }), ["slack"]);
  assert.deepEqual(pluginsOf({ kind: "issue", fields: {} }), ["linear"]);
  assert.deepEqual(pluginsOf({ kind: "row", fields: {} }), ["google"]);
  assert.deepEqual(pluginsOf({ kind: "find", fields: { where: "linear" } }), ["linear"]);
  for (const none of [{ kind: "trigger", fields: {} }, { kind: "approve", fields: {} }, { kind: "request", fields: {} }, {}, null, undefined]) assert.deepEqual(pluginsOf(none), []);
});

test("skillOf: a step that is exactly a registry skill is recognised, an edited one is just a step of its kind", () => {
  for (const one of SKILLS) assert.equal(skillOf(one.step)?.id, one.id, one.id);
  const edited = { ...findSkill("stripe-unpaid").step, fields: { ...findSkill("stripe-unpaid").step.fields, task: "My own words." } };
  assert.equal(skillOf(edited), null);
  assert.equal(skillOf({}), null);
  assert.equal(skillOf(null), null);
});

test("capabilityOf: every skill and every template step explains why, how and what if it fails, in words", () => {
  const steps = [...SKILLS.map((one) => one.step), ...TEMPLATES.flatMap((t) => t.steps)];
  for (const s of steps) {
    const info = capabilityOf(s);
    for (const key of ["why", "how", "output", "onFailure"]) assert.ok(typeof info[key] === "string" && info[key].length > 10, `${s.kind}: ${key}`);
    assert.ok(["read", "write", "think", "control", "plan"].includes(info.access), `${s.kind}: access`);
    assert.ok(info.how.includes("·"), "says the skill or step, and the plugin");
  }
});

test("capabilityOf: a writing step says it waits for Approve and that it will not be sent twice by itself; reading steps do not claim to write", () => {
  for (const one of SKILLS) {
    const info = capabilityOf(one.step);
    if (accessOf(one) === "write") {
      assert.equal(info.access, "write", one.id);
      assert.match(info.how, /Waits for your Approve click/);
      assert.match(info.onFailure, /will NOT send it again by itself/);
      assert.match(info.onFailure, /It was not done, try again/);
    } else {
      assert.ok(!/Waits for your Approve/.test(info.how), one.id);
      assert.ok(!/NOT send/.test(info.onFailure), one.id);
    }
  }
  assert.match(capabilityOf(findSkill("stripe-unpaid").step).how, /Plugin: Stripe/);
  assert.match(capabilityOf(findSkill("post-ideas").step).how, /No plugin needed/);
  assert.match(capabilityOf(findSkill("stripe-unpaid").step).onFailure, /Continue from where it stopped/);
});

test("capabilityOf: a plan-only step and a plain note say plainly that they do nothing", () => {
  assert.equal(capabilityOf({ kind: "send", fields: { how: "email", to: "x", about: "" } }).access, "plan");
  assert.match(capabilityOf({ kind: "send", fields: {} }).why, /does nothing/);
  const note = capabilityOf({ icon: "Zap", title: "x", detail: "y" });
  assert.equal(note.access, "plan");
  assert.match(note.why, /does nothing/);
});

test("requirementOf: ready, missing, unavailable and unknown, and 'not asked' gives no false alarm", () => {
  const step = ai("app", "stripe");
  assert.deepEqual(requirementOf(step, { stripe: true }), { status: "ready", missing: [] });
  const missing = requirementOf(step, { stripe: false });
  assert.equal(missing.status, "missing_connection");
  assert.deepEqual(missing.missing.map((m) => [m.id, m.name, m.state]), [["stripe", "Stripe", "missing"]]);
  assert.equal(requirementOf(step, { stripe: null }).status, "unknown", "could not be checked: a soft note, never a block");
  assert.equal(requirementOf(step, {}).status, "unknown");
  assert.equal(requirementOf(step, undefined).status, "unknown", "connections were not asked at all");
  assert.equal(requirementOf(step, undefined).missing.length, 0, "and then nothing is shown");
  assert.equal(requirementOf(ai("app", "xero"), { xero: "unavailable" }).status, "unavailable");
  assert.match(requirementOf(ai("app", "xero"), { xero: "unavailable" }).missing[0].reason, /Not available yet/);
  assert.equal(requirementOf(ai("app", "xero"), { xero: false }).status, "unavailable", "an app that can never be connected is never 'just connect it'");
  assert.deepEqual(requirementOf(ai("nothing"), { stripe: false }), { status: "ready", missing: [] }, "a step that needs no app is always ready");
  assert.deepEqual(requirementOf({ kind: "trigger", fields: {} }, undefined), { status: "ready", missing: [] });
  // two missing apps are both named
  assert.deepEqual(requirementOf({ kind: "action", fields: { action: "gmail_send" } }, { gmailsend: false }).missing.map((m) => m.name), ["Gmail (send)"]);
});

test("alternativeFor: only an Ask the AI step that looks at an app has a stand-in, and the stand-in really needs no app", () => {
  for (const uses of ["linear", "calendar", "gmail", "drive", "app"]) {
    const step = ai(uses, uses === "app" ? "stripe" : "");
    const alt = alternativeFor(step);
    assert.ok(alt && alt.label, uses);
    const after = { ...step, fields: { ...step.fields, ...alt.fields } };
    assert.deepEqual(pluginsOf(after), [], `${uses}: nothing is needed after switching`);
    assert.deepEqual(requirementOf(after, { google: false, linear: false, stripe: false }), { status: "ready", missing: [] });
    assert.ok(checkSteps([after]).value, `${uses}: the changed step is still valid`);
  }
  for (const none of [ai("nothing"), ai("web", "https://example.com/"), { kind: "action", fields: { action: "gmail_send" } }, { kind: "issue", fields: {} }, { kind: "row", fields: {} }, null]) assert.equal(alternativeFor(none), null);
});

test("skillStart: every skill (except the stop sign) opens as a valid workflow: Start, then an approval when it writes, then the skill", () => {
  assert.equal(skillStart("ask-approval"), null);
  for (const bad of ["nope", "", "__proto__", 5, null, undefined]) assert.equal(skillStart(bad), null, String(bad));
  for (const one of SKILLS.filter((x) => x.step.kind !== "approve")) {
    const made = skillStart(one.id);
    assert.ok(made, one.id);
    assert.equal(made.steps[0].kind, "trigger");
    assert.equal(made.steps[0].fields.how, "manual");
    assert.equal(made.steps.at(-1).kind, one.step.kind);
    if (accessOf(one) === "write") {
      assert.equal(made.steps.at(-2).kind, "approve", `${one.id}: approval right before the write`);
      assert.ok(!/\{answers?\}/.test(JSON.stringify(made.steps.at(-1).fields)), `${one.id}: no {answer} when nothing came before it`);
    }
    assert.ok(made.name && made.prompt);
  }
});

test("rowsForSkill: a writing skill brings an Ask me first row unless one is already there; a reading skill never does", () => {
  const empty = toWorking([]);
  const reading = rowsForSkill(findSkill("stripe-unpaid"), empty);
  assert.deepEqual(reading.map((r) => r.kind), ["ai"]);
  const writing = rowsForSkill(findSkill("email-me"), empty);
  assert.deepEqual(writing.map((r) => r.kind), ["approve", "action"]);
  assert.equal(writing[1].fields.title, "A note from Hushwork", "on its own an email uses plain words, not {answers}");
  const after = toWorking(stepsToPlan(checkSteps([{ kind: "trigger", fields: { how: "manual", when: "" } }, { kind: "ai", fields: { task: "x", uses: "nothing", address: "" } }]).value));
  assert.deepEqual(rowsForSkill(findSkill("email-me"), after).map((r) => r.kind), ["approve", "action"]);
  assert.equal(rowsForSkill(findSkill("email-me"), after)[1].fields.details, "{answers}", "after an AI step the skill keeps its {answers}");
  const onlyStart = toWorking(stepsToPlan(checkSteps([{ kind: "trigger", fields: { how: "manual", when: "" } }]).value));
  assert.equal(rowsForSkill(findSkill("email-me"), onlyStart)[1].fields.details, "Write your message here.", "a Start step alone is not an AI answer");
  const withApproval = toWorking(stepsToPlan(checkSteps([{ kind: "approve", fields: { what: "x" } }]).value));
  assert.deepEqual(rowsForSkill(findSkill("email-me"), withApproval).map((r) => r.kind), ["action"], "no second approval row");
  assert.equal(new Set([...reading, ...writing].map((r) => r.key)).size, reading.length + writing.length, "every new row has its own key");
});

test("builderStart: ?skill= opens a new workflow made from that skill; a bad skill id is a plain new workflow", async () => {
  const pretend = { from: () => { throw new Error("the database must not be asked for a skill"); } };
  const result = await builderStart(pretend, "u1", { skill: "stripe-summary" });
  assert.equal(result.start, "skill");
  assert.equal(result.name, "Summarise payments");
  assert.equal(result.steps[0].kind, "trigger");
  assert.equal(result.steps[1].fields.address, "stripe");
  for (const bad of ["nope", ["stripe-summary"], "ask-approval", "__proto__"]) assert.deepEqual(await builderStart(pretend, "u1", { skill: bad }), { start: "new" }, String(bad));
  assert.equal((await builderStart(pretend, "u1", { skill: "stripe-summary", template: "invoices" })).start, "skill", "the skill wins over a template (one thing at a time)");
});

test("every bundle workflow shows the Studio cards without trouble: each step has a why, and the writing ones are marked", () => {
  for (const bundle of BUNDLES) {
    for (const workflow of bundle.workflows) {
      const { steps } = buildWorkflow(bundle, workflow);
      const infos = steps.map(capabilityOf);
      assert.ok(infos.every((i) => i.why && i.how && i.output && i.onFailure));
      assert.ok(infos.some((i) => i.access === "write"), `${workflow.id}: at least one step is marked as writing`);
      const firstWrite = infos.findIndex((i) => i.access === "write");
      assert.ok(infos.slice(0, firstWrite).some((i) => i.access === "control" && /stop sign/i.test(i.why)), `${workflow.id}: the approval stop sign comes before it`);
    }
  }
});
