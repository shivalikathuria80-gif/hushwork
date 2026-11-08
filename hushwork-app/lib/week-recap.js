// "Your week": what Hushwork did for the person in the last 7 days, built only from the runs table (no table of its own).
// Plain code (no database, no clock of its own), so tests can run it. The page (components/app/WeekRecap.js) reads the rows and hands them in.
//
// Words used here, the same as the Runs page (components/app/RunsViewer.js):
//   - a PRACTICE run is one go at a workflow; reading steps run by themselves, a step that sends or creates waits for Approve.
//   - a LIVE record is one step really done after Approve (or Auto mode). It points back to its practice run (`from`, `fromStep`).
//   - a QUIET record is a watch check that found nothing new: it is counted, never shown as a run.
import { runOutcome, isAiStep, isWriteStep } from "./run-engine.js";
export { minutesText } from "./week-time.js";

export const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// The rough minutes a person would have spent doing one thing by hand. Shown on the page, so the guess is never hidden.
export const MINUTES = { read: 2, ai: 5, write: 3, quiet: 1 };

// tone: "good" (done), "you" (waiting for your OK), "bad" (stopped or not sure it finished), "preview" (practice only), "quiet" (nothing new).
const TONE = { completed: "good", partial: "good", waiting: "you", stopped: "bad", unsure: "bad", practice: "preview" };

const when = (value) => {
  const t = Date.parse(typeof value === "string" ? value : "");
  return Number.isFinite(t) ? t : NaN;
};

// rows: [{ id, workflowId, name, live, createdAt, results }] with results read by readSavedResults (lib/run-engine.js), newest first or any order.
// Returns everything the page shows. Rows outside the 7 days before `now` are left out.
export function buildWeekRecap(rows, now = Date.now()) {
  const since = now - WEEK_MS;
  const list = (Array.isArray(rows) ? rows : []).filter((row) => {
    const t = when(row?.createdAt);
    return row && typeof row.id === "string" && t >= since && t <= now + 60_000;
  });
  const practice = list.filter((row) => !row.live);
  const live = list.filter((row) => row.live);
  const practiceIds = new Set(practice.map((row) => row.id));

  // Sort the live records the way the Runs page does: done, stopped, or started but never seen to finish.
  const at = { done: new Map(), failed: new Map(), pending: new Map() };
  const quietRuns = new Set();
  const effort = { read: 0, ai: 0, write: 0, quiet: 0 };
  const loose = []; // live records whose practice run is not in the 7 days: each is shown as its own dot
  for (const row of live) {
    const first = Array.isArray(row.results) ? row.results[0] : null;
    if (!first) continue;
    if (first.quiet === true) {
      effort.quiet += 1;
      if (first.from) quietRuns.add(first.from);
      continue;
    }
    if (first.status === "done" && !first.note) {
      if (isAiStep(first)) effort.ai += 1;
      else if (isWriteStep(first)) effort.write += 1;
      else effort.read += 1;
    }
    if (first.from && Number.isInteger(first.fromStep) && practiceIds.has(first.from)) {
      const into = at[first.status] ?? at.done;
      into.set(first.from, (into.get(first.from) ?? new Set()).add(first.fromStep));
    } else {
      loose.push(row);
    }
  }

  const dots = []; // one per run, for the chart: { t (ISO), tone, name }
  const needsYou = [];
  for (const run of practice) {
    let tone;
    let waiting = 0;
    if (quietRuns.has(run.id)) tone = "quiet";
    else {
      const outcome = runOutcome(run.results, at.done.get(run.id), at.failed.get(run.id), at.pending.get(run.id));
      tone = TONE[outcome.key] ?? "preview";
      if (outcome.key === "waiting") waiting = Number(outcome.text.match(/^(\d+)/)?.[1] ?? 0);
    }
    dots.push({ t: run.createdAt, tone, name: run.name || "Untitled workflow", workflowId: run.workflowId || "" });
    if (tone === "you" || tone === "bad") needsYou.push({ id: run.id, name: run.name || "Untitled workflow", tone, waiting, createdAt: run.createdAt });
  }
  for (const row of loose) {
    const status = row.results[0]?.status;
    dots.push({ t: row.createdAt, tone: status === "done" ? "good" : "bad", name: row.name || "Untitled workflow", workflowId: row.workflowId || "" });
  }
  dots.sort((a, b) => when(a.t) - when(b.t));
  needsYou.sort((a, b) => when(b.createdAt) - when(a.createdAt));

  // By workflow: grouped by id when there is one (two workflows can share a name), busiest first.
  const groups = new Map();
  for (const dot of dots) {
    const key = dot.workflowId || `name:${dot.name}`;
    const group = groups.get(key) ?? { key, name: dot.name, total: 0, good: 0, you: 0, bad: 0, quiet: 0, preview: 0 };
    group.total += 1;
    group[dot.tone] += 1;
    groups.set(key, group);
  }
  const byWorkflow = [...groups.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)).slice(0, 6);

  const stepsDone = effort.read + effort.ai + effort.write;
  const minutes = effort.read * MINUTES.read + effort.ai * MINUTES.ai + effort.write * MINUTES.write + effort.quiet * MINUTES.quiet;
  const runs = dots.filter((dot) => dot.tone !== "quiet").length;

  return {
    since: new Date(since).toISOString(),
    runs, stepsDone, minutes,
    reads: effort.read, ai: effort.ai, writes: effort.write, quiet: effort.quiet,
    waitingRuns: needsYou.filter((run) => run.tone === "you").length,
    needsYou: needsYou.slice(0, 5),
    byWorkflow,
    dots: dots.map(({ t, tone }) => ({ t, tone })),
    runDots: dots, // the same, with each run's workflow name and id (the Calendar page lists today's runs by name)
  };
}

// The one plain sentence under the big number.
export function weekLine(recap) {
  if (!recap || (recap.runs === 0 && recap.quiet === 0)) return "Nothing ran in the last 7 days. Run a workflow, or give an agent a schedule, and this page fills up.";
  const parts = [];
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  if (recap.stepsDone) parts.push(`did ${plural(recap.stepsDone, "step", "steps")} for real`);
  if (recap.writes) parts.push(`sent or created ${plural(recap.writes, "thing", "things")} after your OK`);
  if (recap.quiet) parts.push(`checked ${plural(recap.quiet, "time", "times")} and stayed quiet because nothing was new`);
  if (!parts.length) return `${plural(recap.runs, "run", "runs")} this week, all practice so far. Approve a step on the Runs page to make one real.`;
  const last = parts.pop();
  return `Hushwork ${parts.length ? `${parts.join(", ")} and ${last}` : last}.`;
}
