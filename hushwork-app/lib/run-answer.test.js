import test from "node:test";
import assert from "node:assert/strict";
import { findAnswer } from "./run-answer.js";

// A pretend database: remembers the filters it was given and answers with `rows`.
function pretend(rows, error = null) {
  const calls = [];
  const builder = { select: () => builder, eq: (name, value) => { calls.push([name, value]); return builder; }, gte: (name, value) => { calls.push([`>=${name}`, value]); return builder; }, order: () => builder, limit: async () => ({ data: rows, error }) };
  return { supabase: { from: (table) => { calls.push(["from", table]); return builder; } }, calls };
}
const run = { workflow_id: "w1", created_at: "2026-10-20T00:00:00Z" };

test("the answer is the newest real AI step of the same workflow saved after the practice run", async () => {
  const { supabase, calls } = pretend([
    { results: [{ kind: "row", outcome: "Added a row" }] },
    { results: [{ kind: "ai", outcome: "The AI answered: newest", answer: "Newest answer" }] },
    { results: [{ kind: "ai", answer: "Older answer" }] },
  ]);
  assert.equal(await findAnswer(supabase, "u1", run), "Newest answer");
  assert.deepEqual(calls, [["from", "runs"], ["user_id", "u1"], ["workflow_id", "w1"], ["mode", "live"], [">=created_at", run.created_at]]);
});

test("no answer when there is none, the data is odd, the database fails, or the run has no workflow", async () => {
  assert.equal(await findAnswer(pretend([]).supabase, "u1", run), "");
  assert.equal(await findAnswer(pretend([{ results: [{ kind: "ai", answer: "  " }] }, { results: "nope" }, { results: [null] }, {}]).supabase, "u1", run), "");
  assert.equal(await findAnswer(pretend(null, { code: "42P01" }).supabase, "u1", run), "");
  assert.equal(await findAnswer(pretend([{ results: [{ kind: "ai", answer: "x" }] }]).supabase, "u1", { created_at: run.created_at }), "");
  assert.equal(await findAnswer(pretend([{ results: [{ kind: "ai", answer: "x" }] }]).supabase, "u1", { workflow_id: "w1" }), "");
  assert.equal(await findAnswer(pretend([]).supabase, "u1", null), "");
});

test("{answer} in a piece of text: put in as one plain line, cut to the limit, and a missing answer is an error", async () => {
  const { fillAnswerText } = await import("./run-answer.js");
  assert.deepEqual(fillAnswerText("no tag here", "ignored", 50), { text: "no tag here" });
  assert.deepEqual(fillAnswerText("Do: {answer}", "Call Ana\nback  today $&", 200), { text: "Do: Call Ana back today $&" });
  assert.equal(fillAnswerText("Do: {answer}", "x".repeat(900), 30).text.length, 30);
  assert.equal(fillAnswerText("{answer} {answer}", "Hi", 50).text, "Hi Hi");
  for (const none of ["", "  ", undefined, null, 7]) assert.ok(fillAnswerText("Do: {answer}", none, 50).error, String(none));
});

test("a step that writes is approved once per practice run and step: the check looks for a real run from that run and step", async () => {
  const { wasApproved } = await import("./run-answer.js");
  const seen = [];
  const make = (rows, error = null) => { const b = { select: () => b, eq: (n, v) => { seen.push([n, v]); return b; }, contains: (n, v) => { seen.push([n, v]); return b; }, limit: async () => ({ data: rows, error }) }; return { from: () => b }; };
  const run = { id: "r1", stepIndex: 2 };
  assert.equal(await wasApproved(make([{ id: "x" }]), "u1", run, "issue"), true);
  assert.deepEqual(seen.at(-1), ["results", JSON.stringify([{ kind: "issue", from: "r1", fromStep: 2 }])], "handed over as JSON text: an array would be written as a Postgres list and match nothing");
  assert.deepEqual(seen.slice(0, 2), [["user_id", "u1"], ["mode", "live"]]);
  assert.equal(await wasApproved(make([]), "u1", run, "row"), false);
  assert.equal(await wasApproved(make(null, { code: "x" }), "u1", run, "row"), false);
});

test("an email's text keeps its line breaks (never more than one blank line), is cut at 3000, and a missing answer is a clear message; other actions stay one short line", async () => {
  const { fillActionDetails } = await import("./run-answer.js");
  const answer = "Monday:\r\n- Standup\n\n\n\n- Dentist\t at 5\u0007pm\n";
  assert.deepEqual(fillActionDetails("gmail_send", "Hi,\n{answer}\nBye", answer), { text: "Hi,\nMonday:\n- Standup\n\n- Dentist at 5 pm\nBye" });
  assert.equal(fillActionDetails("gmail_send", "{answer}", "x".repeat(5000)).text.length, 2800);
  assert.equal(fillActionDetails("gmail_send", "a ".repeat(2000) + "{answer}", "tail").text.length, 3000);
  assert.deepEqual(fillActionDetails("gmail_send", "No tag here", ""), { text: "No tag here" });
  assert.ok(fillActionDetails("gmail_send", "{answer}", "  \n ").error);
  assert.ok(fillActionDetails("gmail_send", "{answer}", undefined).error);
  assert.deepEqual(fillActionDetails("slack_message", "{answer}", "line one\nline two"), { text: "line one line two" });
  assert.equal(fillActionDetails("github_issue", "{answer}", "y".repeat(900)).text.length, 300);
});

