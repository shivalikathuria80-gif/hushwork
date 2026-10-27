// WORKFLOW STUDIO: what every step IS, in plain words. Pure code (no React, no database), so the Builder, the Runs page and the tests share it.
//
// For any typed step ({ kind, fields }) this works out:
//   skill        which ready-made skill it is (lib/skills/bundles.js), or null when it is just a step of that kind
//   plugins      the connections (apps) it needs: Stripe, Google, Linear, Gmail (send)...
//   why / how    why the step exists and how it runs, in a sentence each
//   output       what it produces ("One email to you") and onFailure: what happens if it fails
//   access       "read", "write", "think", "control" or "plan" (only describes)
// and, given which apps are connected, whether the step is READY or needs something (requirementOf), with the next actions to offer.
//
// All of it is DERIVED from the step each time, never saved with the workflow. That is on purpose: a saved "requirementStatus" would go stale the moment a
// person connects or disconnects an app, and a saved "why" would go stale the moment they edit the step. The saved plan, the database and the approval
// gates stay exactly as they were.
import { STEP_KINDS } from "../steps.js";
import { SKILLS, connectionInfo, accessOf } from "../skills/bundles.js";
import { findAction } from "../connectors/composio-actions.js";
import { findComposioApp, parseAppAddress } from "../connectors/composio-apps.js";

// Which connections a step needs, as ids from the app list or the Composio list. A step that reads or writes nothing in an app needs none.
export function pluginsOf(step) {
  const f = step?.fields ?? {};
  switch (step?.kind) {
    case "ai":
      if (["gmail", "gmailtext", "drive", "calendar"].includes(f.uses)) return ["google"];
      if (f.uses === "linear") return ["linear"];
      if (f.uses === "app") return parseAppAddress(f.address) ? [parseAppAddress(f.address).app.lookupOf ?? parseAppAddress(f.address).app.id] : []; // a second lookup shares its app's sign-in
      return []; // nothing, a web address (public pages only) or an MCP server (no sign-in)
    case "app": return findComposioApp(f.app) ? [findComposioApp(f.app).lookupOf ?? f.app] : [];
    case "action": return findAction(f.action) ? [findAction(f.action).app] : [];
    case "issue": return ["linear"];
    case "row": return ["google"];
    case "find": return f.where === "linear" ? ["linear"] : [];
    default: return [];
  }
}

// The skill a step came from: same kind and same words (an edited step is just a step of its kind).
export function skillOf(step) {
  if (!step?.kind || !step.fields) return null;
  const f = step.fields;
  return SKILLS.find((one) => {
    if (one.step.kind !== step.kind) return false;
    const s = one.step.fields;
    if (step.kind === "ai") return s.task === f.task && s.uses === f.uses && s.address === f.address;
    if (step.kind === "action") return s.action === f.action;
    return step.kind === "issue" || step.kind === "approve";
  }) ?? null;
}

const OUTPUT = {
  trigger: "Nothing: it only starts the workflow.",
  approve: "Your yes or no.",
  ai: "A short written answer, saved on the Runs page.",
  app: "The list the app answered, with an AI summary.",
  request: "The start of the web page's answer.",
  issue: "One new task in Linear.",
  row: "One new row in your Google Sheet.",
  action: "One real thing in another app (an email, a message, an issue, an event or a page).",
};

const FAIL_READ = "If it fails, the run stops here and the Runs page says why. “Continue from where it stopped” picks up from this step, and steps already done are not repeated.";
const FAIL_WRITE = "If it fails the run stops here and the Runs page says why. If the connection drops while it is sending, Hushwork cannot tell whether it happened, so it will NOT send it again by itself: you check, then press “It was not done, try again”.";

export function capabilityOf(step) {
  const kind = step?.kind;
  const f = step?.fields ?? {};
  if (!kind || !STEP_KINDS[kind]) {
    return { kind: null, skill: null, plugins: [], access: "plan", why: "A note in your plan. It does nothing when the workflow runs.", how: "Not a real step: it is only words.", output: "Nothing.", onFailure: "It cannot fail: it does nothing." };
  }
  const skill = skillOf(step);
  const plugins = pluginsOf(step);
  const names = plugins.map((id) => connectionInfo(id)?.name ?? id);
  const label = STEP_KINDS[kind].label;
  const access = skill ? accessOf(skill) : kind === "action" || kind === "issue" || kind === "row" ? "write" : kind === "approve" || kind === "trigger" ? "control" : kind === "find" || kind === "write" || kind === "send" ? "plan" : kind === "ai" && f.uses === "nothing" ? "think" : "read";

  let why;
  if (skill) why = skill.about;
  else if (kind === "ai") why = f.task ? `Asks the AI to: ${f.task}` : "Asks the AI to do a job (write the job in the step).";
  else if (kind === "trigger") why = f.how === "watch" ? "This is how the workflow begins: it checks on its schedule and stays quiet unless something is new. It never speaks at night, at most 3 times a day, and never acts alone." : "This is how the workflow begins.";
  else if (kind === "approve") why = "A stop sign before anything is written: you read it, then say yes.";
  else if (kind === "action") why = `Really does one thing in another app: ${findAction(f.action)?.name ?? "an action"}. It happens only after you approve it.`;
  else if (kind === "issue") why = "Adds one new task in Linear. It happens only after you approve it.";
  else if (kind === "row") why = "Adds one row to your Google Sheet. It happens only after you approve it.";
  else if (kind === "app") why = `Looks at one thing in ${names[0] ?? "another app"}. It only reads.`;
  else if (kind === "request") why = "Asks one web address for information. It only reads.";
  else why = "Only describes what would happen. It does nothing when the workflow runs: use “Do something in another app” to really do it.";

  const how = `${skill ? `Skill: ${skill.name}` : `Step: ${label}`} · ${names.length ? `Plugin: ${names.join(", ")}` : "No plugin needed"}${access === "write" ? " · Waits for your Approve click" : ""}`;
  const output = kind === "action" && findAction(f.action) ? `${findAction(f.action).name}: one real action, saved as a result on the Runs page.` : OUTPUT[kind] ?? "Nothing: it only describes.";
  return { kind, skill, plugins, access, why, how, output, onFailure: access === "write" ? FAIL_WRITE : access === "plan" ? "It cannot fail: it does nothing." : FAIL_READ };
}

// connections: { [connectionId]: true | false | null | "unavailable" } (true = connected, false = not, null = could not be checked), or undefined when it was not asked.
// Returns { status, missing: [{ id, name, state, reason }] } with status "ready" | "missing_connection" | "unavailable" | "unknown".
// "unavailable" = an app that cannot be connected at all yet (Vercel, Xero, Cloudflare): connecting is no use, so the step needs another way or has to go.
export function requirementOf(step, connections) {
  const plugins = pluginsOf(step);
  if (!plugins.length) return { status: "ready", missing: [] };
  if (!connections) return { status: "unknown", missing: [] };
  const missing = [];
  for (const id of plugins) {
    const info = connectionInfo(id);
    const state = connections[id];
    if (state === true) continue;
    missing.push({ id, name: info?.name ?? id, state: state === "unavailable" || info?.unavailable ? "unavailable" : state === false ? "missing" : "unknown", reason: info?.unavailable ?? "" });
  }
  if (!missing.length) return { status: "ready", missing };
  if (missing.some((one) => one.state === "unavailable")) return { status: "unavailable", missing };
  if (missing.some((one) => one.state === "missing")) return { status: "missing_connection", missing };
  return { status: "unknown", missing };
}

// A way out that is not "connect it": the fields to change so the step needs no app, or null when there is none.
// Only an Ask the AI step has one (let it just think). Anything that writes has no stand-in: the person connects the app or removes the step.
export function alternativeFor(step) {
  if (step?.kind === "ai" && ["linear", "calendar", "gmail", "gmailtext", "drive", "app"].includes(step.fields?.uses)) {
    return { label: "Let the AI just think (it will not look at your apps)", fields: { uses: "nothing", address: "" } };
  }
  return null;
}
