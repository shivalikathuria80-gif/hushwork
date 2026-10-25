// THE RUN SUMMARY LINE: one plain sentence at the top of a run that says what was done, what was found and what failed, built ONLY from the
// results Hushwork really saved (the records under each step). Nothing in it is a plan or a guess: a step counts as done only when its saved
// record says so. Pure code (no React, no database), so the Runs page and the tests share it.
//
//   "3 of 4 steps done: looked in Gmail and Stripe, sent 1 email. 1 could not run: step 3 (Google is not connected yet)."
//
// Counts are STEPS, not items: Hushwork does not keep how many emails or files an app listed, so it never claims "read 12 files".
import { isApprovable } from "../run-engine.js";
import { capabilityOf } from "./capabilities.js";
import { connectionInfo } from "../skills/bundles.js";

// What a done writing step did: [verb, singular, plural].
const DID = {
  gmail_send: ["sent", "email", "emails"], slack_message: ["sent", "Slack message", "Slack messages"], github_issue: ["created", "GitHub issue", "GitHub issues"],
  calendar_event: ["added", "calendar event", "calendar events"], notion_page: ["created", "Notion page", "Notion pages"], todoist_task: ["added", "Todoist task", "Todoist tasks"],
};
const DID_OTHER = { issue: ["created", "Linear task", "Linear tasks"], row: ["added", "Google Sheet row", "Google Sheet rows"] };

const list = (words) => (words.length <= 1 ? words.join("") : `${words.slice(0, -1).join(", ")} and ${words.at(-1)}`);
const short = (text, max = 90) => { const one = String(text ?? "").replace(/\s+/g, " ").trim(); return one.length > max ? `${one.slice(0, max - 1)}…` : one; };

// steps: the saved steps of the practice run. doneAt / stoppedAt / unknownAt: Map(step number -> its newest saved record), as the Runs page builds them.
// Returns { line, state } where state is "empty", "waiting", "done", "stopped" or "unsure". line is "" when the run has nothing that can run.
export function summarizeRun({ steps, doneAt, stoppedAt, unknownAt }) {
  const runnable = (Array.isArray(steps) ? steps : []).map((step, index) => ({ step, index })).filter(({ step }) => isApprovable(step));
  const total = runnable.length;
  if (!total) return { line: "", state: "empty" };

  const done = runnable.filter(({ index }) => doneAt.has(index));
  const unsure = runnable.filter(({ index }) => !doneAt.has(index) && unknownAt.has(index));
  const failed = runnable.filter(({ index }) => !doneAt.has(index) && !unknownAt.has(index) && stoppedAt.has(index));
  const waiting = total - done.length - unsure.length - failed.length;

  if (!done.length && !unsure.length && !failed.length) {
    return { line: `Nothing has run yet: ${total} ${total === 1 ? "step is" : "steps are"} waiting for your approval.`, state: "waiting" };
  }

  const looked = [];
  let wrote = 0;
  const did = new Map(); // phrase key -> { verb, noun, count }
  for (const { step } of done) {
    const info = capabilityOf(step);
    if (info.access === "write") {
      const phrase = step.kind === "action" ? DID[step.fields?.action] : DID_OTHER[step.kind];
      const [verb, one, many] = phrase ?? ["did", "thing", "things"];
      const entry = did.get(one) ?? { verb, one, many, count: 0 };
      entry.count += 1;
      did.set(one, entry);
    } else if (info.access === "think") {
      wrote += 1;
    } else {
      const names = info.plugins.map((id) => connectionInfo(id)?.name ?? id);
      for (const name of names.length ? names : [step.fields?.uses === "web" || step.kind === "request" ? "a web page" : "a source"]) if (!looked.includes(name)) looked.push(name);
    }
  }
  const parts = [];
  if (looked.length) parts.push(`looked in ${list(looked)}`);
  if (wrote) parts.push(`the AI wrote ${wrote} ${wrote === 1 ? "text" : "texts"}`);
  for (const { verb, one, many, count } of did.values()) parts.push(`${verb} ${count} ${count === 1 ? one : many}`);

  const sentences = [`${done.length === total ? `All ${total} ${total === 1 ? "step" : "steps"}` : `${done.length} of ${total} ${total === 1 ? "step" : "steps"}`} done${parts.length ? `: ${list(parts)}` : ""}.`];
  if (failed.length) {
    const first = failed[0];
    sentences.push(`${failed.length === 1 ? "1 step" : `${failed.length} steps`} could not run: step ${first.index + 1}${stoppedAt.get(first.index)?.outcome ? ` (${short(stoppedAt.get(first.index).outcome)})` : ""}.`);
  }
  if (unsure.length) sentences.push(`Step ${unsure[0].index + 1} may or may not have happened: check the app before trying it again.`);
  if (waiting > 0) sentences.push(`${waiting} still ${waiting === 1 ? "waits" : "wait"} for your approval.`);
  return { line: sentences.join(" "), state: unsure.length ? "unsure" : failed.length ? "stopped" : waiting > 0 ? "waiting" : "done" };
}
