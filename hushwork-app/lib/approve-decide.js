// APPROVE FROM A NOTIFICATION: the page behind a "review and approve" link (app/a/[code]) and its two buttons (lib/actions/approve-link.js).
// Plain code: everything is handed in (`deps`), so the tests run it against a pretend database.
//
//   viewLink    what the page shows: the step's exact words AS THEY ARE NOW. Opening the page changes nothing (mail scanners open links).
//   decideLink  a button press. The link is CLAIMED first in one database step (only an unused, unexpired link can be claimed, so two presses,
//               or two tabs, can never do the step twice), then the step is done with the very action the Runs page uses, with `seen` = the
//               words the page showed: if they changed since, nothing is sent (lib/run-core.js). If the step could not be done, the claim is
//               given back so the person can read the new words and try again; a link that did its job stays used.
//
// `deps` = { admin, readRun(who, runId), approveStep(input, who), rejectStep(input, who), clientFor(userId), now }.
import { LINK_WORDS, linkProblem, looksLikeApproveCode, sha256 } from "./approve-links.js";

const OPEN_STATES = new Set(["waiting for approval", "stopped"]);

async function findLink(admin, code) {
  if (!admin || !looksLikeApproveCode(code)) return { problem: "unknown" };
  const { data, error } = await admin.from("approve_links").select("id, user_id, run_id, step_index, words_hash, expires_at, used_at, used_as").eq("code_hash", sha256(code)).limit(1);
  if (error) {
    console.error("finding an approve link failed:", error.code);
    return { problem: "unknown" };
  }
  const row = data?.[0];
  return row?.id ? { row } : { problem: "unknown" };
}

async function whoFor(deps, userId) {
  const { data } = await deps.admin.auth.admin.getUserById(userId);
  return { user: { id: userId, email: data?.user?.email ?? "" }, supabase: deps.clientFor(userId) };
}

async function readStep(deps, row) {
  const who = await whoFor(deps, row.user_id);
  const read = await deps.readRun(who, String(row.run_id));
  const step = read.run?.steps?.[row.step_index];
  return { who, run: read.run ?? null, step: step ?? null };
}

// Returns { problem, words } (words = LINK_WORDS[problem]) or { view: { workflow, title, step, total, words, writes, changed, expiresAt, runId, usedAs? } }.
export async function viewLink(deps, code) {
  const now = deps.now ?? Date.now();
  const found = await findLink(deps.admin, code);
  if (found.problem) return { problem: found.problem, words: LINK_WORDS[found.problem] };
  const { row } = found;
  const problem = linkProblem(row, now);
  if (problem) return { problem, words: LINK_WORDS[problem], ...(row.used_as ? { usedAs: row.used_as } : {}) };
  const { run, step } = await readStep(deps, row);
  if (!run || !step) return { problem: "unknown", words: LINK_WORDS.unknown };
  if (!OPEN_STATES.has(step.state) || typeof step.will_do !== "string") return { problem: "done", words: LINK_WORDS.done, runId: run.id };
  return {
    view: {
      workflow: run.name, title: step.title, step: step.step, total: run.steps.length, words: step.will_do, writes: step.writes === true,
      changed: sha256(step.will_do) !== row.words_hash, // the words are not the ones there were when we told you: the page says so
      expiresAt: row.expires_at, runId: run.id, stopped: step.state === "stopped",
    },
  };
}

// `input` = { code, decision: "approve" | "turn_down", seen }. Returns { ok: true, decision, result? } or { error, problem?, changed?, wordsNow? }.
export async function decideLink(deps, input) {
  const now = deps.now ?? Date.now();
  const decision = input?.decision === "approve" ? "approve" : input?.decision === "turn_down" ? "turn_down" : null;
  if (!decision) return { error: "Choose Approve or Turn down." };
  if (decision === "approve" && (typeof input?.seen !== "string" || !input.seen)) return { error: "Reload the page and read the words first." };
  const found = await findLink(deps.admin, input?.code);
  if (found.problem) return { error: LINK_WORDS[found.problem], problem: found.problem };
  const { row } = found;
  const problem = linkProblem(row, now);
  if (problem) return { error: LINK_WORDS[problem], problem };

  // THE CLAIM: one UPDATE that only matches an unused, unexpired link. Whoever gets the row back may go on; nobody else.
  const claimed = await deps.admin.from("approve_links")
    .update({ used_at: new Date(now).toISOString(), used_as: decision === "approve" ? "approved" : "turned_down" })
    .eq("id", row.id).is("used_at", null).gt("expires_at", new Date(now).toISOString()).select("id");
  if (claimed.error || !claimed.data?.length) return { error: LINK_WORDS.used, problem: "used" };
  const release = async () => {
    const back = await deps.admin.from("approve_links").update({ used_at: null, used_as: null }).eq("id", row.id);
    if (back.error) console.error("giving an approve link back failed:", back.error.code);
  };

  try {
    const who = await whoFor(deps, row.user_id);
    const input2 = { runId: String(row.run_id), index: row.step_index };
    const done = decision === "approve"
      ? await deps.approveStep({ ...input2, seen: input.seen }, who)
      : await deps.rejectStep({ ...input2, reason: "Turned down from a notification." }, who);
    if (done?.error) {
      await release();
      if (done.changed) {
        const again = await deps.readRun(who, String(row.run_id));
        const wordsNow = again.run?.steps?.[row.step_index]?.will_do;
        return { error: "What this step will send changed after you opened this page, so nothing was sent. Read the new words below and decide again.", changed: true, ...(typeof wordsNow === "string" ? { wordsNow } : {}) };
      }
      return { error: String(done.error).slice(0, 400) };
    }
    const after = await deps.readRun(who, String(row.run_id));
    const step = after.run?.steps?.[row.step_index];
    return { ok: true, decision, ...(step?.result ? { result: String(step.result).slice(0, 600) } : {}) };
  } catch {
    await release();
    console.error("deciding from an approve link crashed");
    return { error: "Something went wrong. Nothing was approved. Try again in a moment, or open the Runs page." };
  }
}
