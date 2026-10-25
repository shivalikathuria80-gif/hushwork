// Rules for skills and bundles. If someone adds a skill or a bundle that breaks a rule here, `npm test` says which one.
import test from "node:test";
import assert from "node:assert/strict";
import { SKILLS, BUNDLES, accessOf, buildWorkflow, connectionInfo, describeBundle, findBundle, findSkill, SKILL_IDS, BUNDLE_IDS } from "./bundles.js";
import { ICON_NAMES } from "../ai/icon-names.js";
import { LIMITS, checkPrompt } from "../validate.js";
import { parseWhen } from "../schedule-text.js";
import { checkSchedule } from "../schedule.js";
import { findAction, isExampleTarget } from "../connectors/composio-actions.js";
import { findComposioApp, parseAppAddress } from "../connectors/composio-apps.js";

const WRITING = ["action", "issue", "row"];

test("ids: skill and bundle ids are unique plain words, and a made-up id finds nothing", () => {
  assert.equal(new Set(SKILL_IDS).size, SKILLS.length);
  assert.equal(new Set(BUNDLE_IDS).size, BUNDLES.length);
  for (const id of [...SKILL_IDS, ...BUNDLE_IDS]) assert.match(id, /^[a-z][a-z0-9-]{1,39}$/, id);
  assert.deepEqual(BUNDLE_IDS, ["finance-ops", "marketing-growth", "dev-admin"]);
  for (const bad of ["nope", "", "constructor", "__proto__", 5, null, undefined, ["dev-admin"]]) {
    assert.equal(findBundle(bad), null, String(bad));
    assert.equal(findSkill(bad), null, String(bad));
  }
});

test("skills: every skill has words, a real icon, a valid step, and says what it reads or writes", () => {
  for (const one of SKILLS) {
    assert.ok(one.name && one.name.length <= 40 && one.about, one.id);
    assert.ok(ICON_NAMES.includes(one.icon), `${one.id}: icon`);
    assert.ok(one.reads || one.writes, `${one.id}: says what it reads or writes`);
    const checked = buildWorkflow({ skills: [one.id] }, { title: "x", request: "x", start: { how: "manual", when: "" }, flow: [one.id] });
    assert.ok(checked, `${one.id}: its step passes the normal checks`);
  }
});

test("skills: a writing skill says so, says it waits for Approve, and uses a real action; a reading skill never writes", () => {
  for (const one of SKILLS) {
    const writes = WRITING.includes(one.step.kind);
    assert.equal(accessOf(one) === "write", writes, one.id);
    assert.equal(Boolean(one.writes), writes, `${one.id}: 'writes' text only on a writing skill`);
    if (writes) {
      assert.match(one.writes, /Approve/, `${one.id}: promises the Approve click`);
      if (one.step.kind === "action") assert.ok(findAction(one.step.fields.action), `${one.id}: a real action`);
    } else {
      assert.ok(["ai", "approve"].includes(one.step.kind), `${one.id}: a reading skill is an Ask the AI step (read only) or a stop sign`);
    }
  }
});

test("skills: an email always goes to the person themself, never to a typed address", () => {
  for (const one of SKILLS.filter((x) => x.step.fields.action === "gmail_send")) assert.equal(one.step.fields.target, "{myEmail}", one.id);
});

test("skills: reading skills that look at an app name a real app that can be connected; web skills name a valid address", async () => {
  const { checkRequestUrl } = await import("../connectors/http.js");
  for (const one of SKILLS.filter((x) => x.step.kind === "ai")) {
    const { uses, address } = one.step.fields;
    if (uses === "app") {
      const app = parseAppAddress(address)?.app; // "slackmessages:general" names a channel too
      assert.ok(app && !app.unavailable, `${one.id}: ${address} can be connected`);
      assert.ok(one.needs.includes(app.lookupOf ?? address), `${one.id}: lists ${app.lookupOf ?? address} as a need`);
    }
    if (uses === "web") assert.ok(checkRequestUrl(address).value, `${one.id}: valid web address`);
    if (uses === "gmail" || uses === "drive" || uses === "calendar") assert.ok(one.needs.includes("google"), `${one.id}: needs Google`);
    if (uses === "linear") assert.ok(one.needs.includes("linear"), `${one.id}: needs Linear`);
    if (uses === "nothing") assert.deepEqual(one.needs, [], `${one.id}: reads nothing, needs nothing`);
  }
});

test("skills: what a skill needs to write matches its action or task", () => {
  for (const one of SKILLS.filter((x) => WRITING.includes(x.step.kind))) {
    if (one.step.kind === "issue") assert.ok(one.needs.includes("linear"), one.id);
    if (one.step.kind === "action") assert.ok(one.needs.includes(findAction(one.step.fields.action).app), one.id);
  }
});

test("bundles: the connections listed are exactly the ones the skills need, every one exists, and every skill is used by a workflow", () => {
  for (const bundle of BUNDLES) {
    const needed = new Set(bundle.skills.flatMap((id) => findSkill(id).needs));
    assert.deepEqual([...needed].sort(), [...bundle.connections].sort(), `${bundle.id}: connections`);
    for (const id of bundle.connections) assert.ok(connectionInfo(id), `${bundle.id}: ${id} exists`);
    assert.equal(new Set(bundle.skills).size, bundle.skills.length, `${bundle.id}: no repeated skill`);
    for (const id of bundle.skills) assert.ok(findSkill(id), `${bundle.id}: skill ${id} exists`);
    const used = new Set(bundle.workflows.flatMap((workflow) => workflow.flow.map((entry) => (Array.isArray(entry) ? entry[0] : entry))));
    assert.deepEqual([...used].sort(), [...bundle.skills].sort(), `${bundle.id}: skills and workflows agree`);
    assert.ok(ICON_NAMES.includes(bundle.icon));
  }
});

test("bundles: every workflow builds into valid steps (a Start step first), with a valid name and request, and unique ids", () => {
  const ids = new Set();
  for (const bundle of BUNDLES) {
    for (const workflow of bundle.workflows) {
      assert.ok(!ids.has(workflow.id), `${workflow.id} repeated`);
      ids.add(workflow.id);
      const built = buildWorkflow(bundle, workflow);
      assert.ok(built, `${bundle.id}/${workflow.id}: builds`);
      assert.ok(built.name.length > 0 && built.name.length <= LIMITS.nameMax);
      assert.ok(checkPrompt(built.prompt).value, `${workflow.id}: request`);
      assert.equal(built.steps[0].kind, "trigger");
      assert.ok(built.steps.length <= LIMITS.planSteps);
    }
  }
  assert.equal(new Set(BUNDLES.flatMap((b) => b.workflows.map((w) => w.title))).size, ids.size, "workflow names are unique, so a saved copy is recognised by name");
});

test("bundles: a workflow that writes always has an 'Ask you to approve' step before its first writing step, and never sends to a typed address", () => {
  for (const bundle of BUNDLES) {
    for (const workflow of bundle.workflows) {
      const { steps } = buildWorkflow(bundle, workflow);
      const firstWrite = steps.findIndex((s) => WRITING.includes(s.kind));
      assert.ok(firstWrite > 0, `${workflow.id}: it writes something`);
      assert.ok(steps.slice(0, firstWrite).some((s) => s.kind === "approve"), `${workflow.id}: approval before the first write`);
      for (const s of steps.filter((x) => x.kind === "action" && x.fields.action === "gmail_send")) assert.equal(s.fields.target, "{myEmail}", `${workflow.id}: only to the person`);
      for (const s of steps.filter((x) => x.kind === "action" && x.fields.action === "notion_page")) assert.ok(isExampleTarget(findAction("notion_page"), s.fields.target), `${workflow.id}: a Notion page id is the made-up one until the person writes their own (it is refused until then)`);
      assert.ok(steps.every((x) => x.kind !== "action" || ["gmail_send", "notion_page"].includes(x.fields.action)), `${workflow.id}: a bundle only writes an email to the person or one Notion page`);
    }
  }
});

test("bundles: a workflow's changes only touch fields the skill really has, and an email carries what the AI steps said", () => {
  for (const bundle of BUNDLES) {
    for (const workflow of bundle.workflows) {
      for (const entry of workflow.flow.filter(Array.isArray)) {
        const one = findSkill(entry[0]);
        for (const key of Object.keys(entry[1])) assert.ok(Object.hasOwn(one.step.fields, key), `${workflow.id}: ${entry[0]} has no field ${key}`);
      }
      const built = buildWorkflow(bundle, workflow);
      const aiBeforeEmail = built.steps.filter((s) => s.kind === "ai").length;
      const email = built.steps.find((s) => s.kind === "action" && s.fields.action === "gmail_send");
      if (email) assert.ok(aiBeforeEmail >= 1 && email.fields.details === "{answers}", `${workflow.id}: the email carries every AI answer`);
      const page = built.steps.find((s) => s.kind === "action" && s.fields.action === "notion_page");
      if (page) assert.ok(aiBeforeEmail >= 1 && page.fields.details === "{answer}", `${workflow.id}: the Notion page carries the AI's text`);
    }
  }
  // a skill can only be used by a bundle that lists it
  assert.equal(buildWorkflow({ skills: [] }, { title: "x", request: "x", start: { how: "manual", when: "" }, flow: ["email-me"] }), null);
  assert.equal(buildWorkflow(BUNDLES[0], { title: "x", request: "x", start: { how: "manual", when: "" }, flow: ["nope"] }), null);
});

test("bundles: a suggested schedule is valid and agrees with the Start step's words", () => {
  for (const bundle of BUNDLES) {
    for (const workflow of bundle.workflows) {
      if (!workflow.schedule) { assert.equal(workflow.start.how, "manual", `${workflow.id}: no schedule means it starts when asked`); continue; }
      assert.ok(checkSchedule({ ...workflow.schedule, tzOffset: 0 }).value, `${workflow.id}: schedule valid`);
      assert.equal(workflow.start.how, "schedule");
      const read = parseWhen(workflow.start.when);
      assert.ok(read, `${workflow.id}: the Start step's words can be read as a schedule`);
      for (const key of ["frequency", "hour", "minute"]) assert.equal(read[key], workflow.schedule[key], `${workflow.id}: ${key}`);
      if (workflow.schedule.frequency === "weekly") assert.equal(read.weekday, workflow.schedule.weekday, `${workflow.id}: weekday`);
    }
  }
});

test("the three examples from the plan exist as workflows with the steps they promise", () => {
  const find = (id) => { for (const b of BUNDLES) for (const w of b.workflows) if (w.id === id) return [b, w]; return []; };
  const [fb, chaser] = find("invoice-chaser");
  assert.deepEqual(chaser.schedule, { frequency: "weekly", weekday: 5, hour: 10, minute: 0 }, "every Friday at 10:00");
  const steps = buildWorkflow(fb, chaser).steps;
  assert.deepEqual(steps.map((s) => s.kind), ["trigger", "ai", "ai", "ai", "approve", "action"], "unpaid payments, client emails, a reminder draft, approval, then the email");
  assert.equal(steps[1].fields.address, "stripeinvoices", "unpaid INVOICES, not payments");
  assert.equal(steps[2].fields.uses, "gmail");
  const [tb, triage] = find("client-triage");
  assert.equal(triage.start.how, "manual", "on demand");
  assert.deepEqual(buildWorkflow(tb, triage).steps.map((s) => s.kind), ["trigger", "ai", "ai", "ai", "approve", "issue", "action"], "emails, blockers, the top request, approval, a Linear task, the brief");
  const [mb, repurposer] = find("campaign-repurposer");
  assert.equal(repurposer.start.how, "manual");
  const made = buildWorkflow(mb, repurposer).steps;
  assert.equal(made.filter((s) => s.fields.uses === "web").length, 2, "reads the post, then writes the content");
  assert.equal(made.at(-1).fields.action, "gmail_send", "the review queue is your inbox");
});

test("describeBundle: tells the person what each skill reads and writes, the apps needed, and whether anything writes", () => {
  for (const bundle of BUNDLES) {
    const info = describeBundle(bundle);
    assert.equal(info.skills.length, bundle.skills.length);
    assert.equal(info.writes, true, `${bundle.id}: every bundle can write, so the page says Approve is needed`);
    assert.ok(info.connections.every((c) => c && c.name));
    assert.ok(info.skills.every((s) => ["read", "write", "think", "control"].includes(s.access)));
    for (const workflow of info.workflows) assert.ok(workflow.steps >= 3);
  }
  assert.deepEqual(describeBundle(findBundle("marketing-growth")).connections.map((c) => c.name), ["Gmail (send)", "Notion"]);
});

test("connectionInfo: own sign-ins and Composio apps are named; unavailable apps say so; unknown ids are null", () => {
  assert.deepEqual(connectionInfo("google"), { id: "google", name: "Google", own: true });
  assert.equal(connectionInfo("stripe").name, "Stripe");
  assert.equal(connectionInfo("xero").unavailable.length > 0, true);
  for (const bundle of BUNDLES) for (const id of bundle.connections) assert.equal(connectionInfo(id).unavailable ?? "", "", `${bundle.id}: ${id} can be connected`);
  assert.equal(connectionInfo("nope"), null);
});
