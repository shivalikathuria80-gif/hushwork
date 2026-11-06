import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSavedStep } from "@/lib/steps";
import DraftList from "./DraftList";
import { clockReady } from "@/lib/schedule-status";
import { AGENT_KIND, NO_KIND_COLUMN } from "@/lib/agents/kinds";
import { loadWaiting } from "@/lib/run-waiting";

// "Your drafts". It reads the session and the database, so the page wraps it in <Suspense>: everything above it
// appears first, and this section streams in. It re-checks who you are (requireUser) right next to the data;
// the database's own rules are the third check.

const intro = "Drafts are saved plans. Nothing is sent or connected until you run a workflow and approve its steps.";
const agentIntro = "Each agent reads and thinks by itself when it runs. A step that sends, adds or creates something waits for your Approve, unless you let its schedule write by itself.";

// What shows while the list loads. The heading is the same, so nothing above or below it moves.
export function DraftsFallback({ title = "Your drafts", agents = false }) {
  return (
    <div aria-busy="true">
      <h2 id="drafts-heading" tabIndex={-1} className="text-xl font-semibold leading-[1.35] tracking-tight outline-offset-4">{title}</h2>
      <p className="mt-1 text-[15px] text-mute">{agents ? agentIntro : intro}</p>
      <p role="status" className="sr-only">{agents ? "Loading your agents" : "Loading your drafts"}</p>
      <div aria-hidden="true" className="mt-3 space-y-3">
        {[0, 1, 2].map((row) => <div key={row} className="h-[68px] rounded-2xl border border-line bg-raised" />)}
      </div>
    </div>
  );
}

// Rebuilds each row from scratch with plain strings, so nothing unexpected is handed to the browser.
const text = (value) => (typeof value === "string" ? value : "");
function toDraft(row) {
  const plan = Array.isArray(row.plan) ? row.plan : [];
  return {
    id: row.id,
    name: text(row.name),
    prompt: text(row.prompt),
    updatedAt: text(row.updated_at),
    plan: plan.map(readSavedStep), // a typed step keeps its kind and fields
  };
}

// A schedule row as plain values for the browser (see supabase/schedules.sql).
const toSchedule = (row) => ({
  frequency: text(row.frequency), hour: Number(row.hour) || 0, minute: Number(row.minute) || 0, weekday: Number(row.weekday) || 0, tzOffset: Number(row.tz_offset) || 0,
  allowWrites: row.allow_writes === true, enabled: row.enabled !== false, nextRunAt: text(row.next_run_at), lastRunAt: text(row.last_run_at), lastStatus: text(row.last_status),
});

// `openBase` (the Workflows page sets it) makes each draft open in the Builder instead of in the workspace's box.
// `agents` (the Agents page sets it) lists only agents (workflows made from one sentence, see lib/agents/create.js); otherwise agents are
// left out, so the Workflows page and the workspace show only what the person built. Before supabase/agents.sql is run there is no `kind`
// column: the workflow lists then show everything as before, and the Agents page says which setup step is missing.
export default async function Drafts({ openBase, agents = false }) {
  const user = await requireUser(); // outside try/catch on purpose: a signed-out visitor is redirected

  let drafts = [];
  let loadFailed = false;
  let needsSetup = false;
  const scheduling = { tableMissing: false, clockReady: false };
  try {
    const supabase = await createClient();
    const list = (filter) => filter(supabase
      .from("workflows")
      .select("id, name, prompt, plan, updated_at")
      .eq("user_id", user.id))
      .order("updated_at", { ascending: false })
      .limit(50);
    let { data, error } = await list((query) => (agents ? query.eq("kind", AGENT_KIND) : query.neq("kind", AGENT_KIND)));
    if (error && NO_KIND_COLUMN.has(error.code)) {
      if (agents) { needsSetup = true; data = []; error = null; }
      else ({ data, error } = await list((query) => query));
    }
    if (error) {
      console.error("Loading drafts failed:", error.code);
      loadFailed = true;
    } else {
      drafts = data.map(toDraft);
      if (openBase) {
        // Each workflow's schedule (the Workflows page only). A missing table is not an error: the panel says what is missing.
        scheduling.clockReady = clockReady();
        const { data: rows, error: scheduleError } = await supabase
          .from("schedules")
          .select("workflow_id, frequency, hour, minute, weekday, tz_offset, allow_writes, enabled, next_run_at, last_run_at, last_status")
          .eq("user_id", user.id).limit(100);
        if (scheduleError) scheduling.tableMissing = scheduleError.code === "42P01" || scheduleError.code === "PGRST205";
        else for (const row of rows) {
          const draft = drafts.find((entry) => entry.id === row.workflow_id);
          if (draft) draft.schedule = toSchedule(row);
        }
      }
      if (agents) {
        // "Waiting for you" on each agent card: how many steps of its latest run wait for Approve (lib/run-waiting.js; none shown if it fails).
        const waiting = await loadWaiting(supabase, user.id, drafts.map((draft) => draft.id));
        for (const draft of drafts) if (waiting.has(draft.id)) draft.waiting = waiting.get(draft.id);
      }
    }
  } catch {
    loadFailed = true; // for example the Supabase settings are missing or the network is down
  }

  return (
    <div>
      <h2 id="drafts-heading" tabIndex={-1} className="text-xl font-semibold leading-[1.35] tracking-tight outline-offset-4">
        {agents ? "Your agents" : openBase ? "Your workflows" : "Your drafts"}{!loadFailed && drafts.length > 0 && <span className="ml-1 font-normal text-mute">({drafts.length})</span>}
      </h2>
      <p className="mt-1 text-[15px] text-mute">{agents ? agentIntro : intro}</p>
      <DraftList drafts={drafts} loadFailed={loadFailed} openBase={openBase} scheduling={scheduling} agents={agents} needsSetup={needsSetup} />
    </div>
  );
}
