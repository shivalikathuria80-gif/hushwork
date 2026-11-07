import test from "node:test";
import assert from "node:assert/strict";
import { publicAgent, publicAgentGroups, publicAgentIds, metaDescription, needsLine, templateSignupHref, agentPath } from "./public-agents.js";
import { cleanShared, sharedPath, sharedSignupHref, SHARE_MAX } from "./shared-agent.js";
import { safeNext } from "./next-path.js";
import { TEMPLATES } from "./templates.js";

test("every template has a public page with plain steps, and the groups hold each one once", () => {
  const ids = publicAgentIds();
  assert.equal(new Set(ids).size, TEMPLATES.length);
  for (const id of ids) {
    const agent = publicAgent(id);
    assert.ok(agent, id);
    assert.match(id, /^[a-z0-9]{1,40}$/, "ids must fit lib/next-path.js");
    assert.ok(!/\{[a-zA-Z]+\}/.test(agent.body), `${id}: placeholder in the body`);
    for (const step of agent.steps) assert.ok(!/\{answers?\}|\{myEmail\}/.test(`${step.title} ${step.detail}`), `${id}: placeholder shown to a visitor`);
    assert.ok(agent.steps.some((step) => step.approve) || !TEMPLATES.find((t) => t.id === id).steps.some((s) => s.kind === "action" || s.kind === "issue"), `${id}: a writing step must say it waits`);
  }
  assert.deepEqual(publicAgentGroups().flatMap((group) => group.agents.map((agent) => agent.id)).sort(), [...ids].sort());
  assert.equal(publicAgent("nope"), null);
  assert.equal(publicAgent({}), null);
});

test("Week at risk reads Linear and the calendar, then emails you after Approve", () => {
  const agent = publicAgent("weekrisk");
  assert.equal(agent.schedule, "Every week on Friday at 15:00");
  assert.deepEqual(agent.steps.map((step) => step.kind), ["trigger", "ai", "ai", "ai", "action"]);
  assert.equal(agent.steps.at(-1).title, "Emails you");
  assert.equal(agent.steps.at(-1).approve, true);
});

test("meta descriptions stay short and needs lines read well", () => {
  for (const template of TEMPLATES) assert.ok(metaDescription(template.body).length <= 160, template.id);
  assert.equal(metaDescription("Short."), "Short.");
  assert.equal(needsLine("Nothing"), "Needs no app");
  assert.equal(needsLine("Linear"), "Works with Linear");
});

test("shared sentences are cleaned: plain text, no control or direction characters, cut short", () => {
  assert.equal(cleanShared("  Every Monday\n\temail me  "), "Every Monday email me");
  assert.equal(cleanShared("a‮b​c"), "a b c");
  assert.equal(cleanShared(5), "");
  assert.equal(cleanShared(null), "");
  assert.equal(cleanShared("x".repeat(500)).length, SHARE_MAX);
  assert.equal(sharedPath("Hi & bye"), "/agents/try?a=Hi%20%26%20bye");
});

test("sign-in comes back only to the Allow page, a template, or a shared sentence in the Agents box", () => {
  const next = (href) => decodeURIComponent(href.match(/next=([^#]+)/)[1]);
  assert.equal(safeNext(next(templateSignupHref("weekrisk"))), "/app/builder?template=weekrisk");
  const shared = next(sharedSignupHref("Every Friday at 3pm, email me (my week) & more!"));
  assert.equal(safeNext(shared), shared);
  assert.equal(new URLSearchParams(shared.split("?")[1]).get("try"), "Every Friday at 3pm, email me (my week) & more!");
  assert.equal(safeNext(next(sharedSignupHref("Héllo wörld ✓"))).length > 0, true);
  for (const bad of [
    "/app", "/app/builder?template=../x", "/app/builder?template=a&draft=1", "/app/builder?template=", "/app/agents?try=a b", "/app/agents?try=a&x=1",
    "/app/agents?try=%zz", "/app/agents?try=/\\evil", "//evil.example/app/agents?try=a", "/app/agents?try=" + "a".repeat(1990),
  ]) assert.equal(safeNext(bad), "", bad);
  assert.equal(agentPath("followup"), "/agents/followup");
});
