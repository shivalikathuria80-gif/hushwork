import Link from "next/link";
import { Btn, StepRow } from "../ui";
import { Icon } from "../icons";
import RunTime from "./RunTime";
import ApproveSend from "./ApproveSend";
import DeleteRun from "./DeleteRun";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSavedResults, isRequestStep, requestSummary, isLinearLookup, linearSummary, isCalendarLookup, calendarSummary, isGmailLookup, gmailSummary, isDriveLookup, driveSummary, isSheetsRow, sheetsSummary, isAiStep, aiSummary, SETUP_MESSAGE } from "@/lib/run-engine";
import { connectorStatus } from "@/lib/connector-status";
import { aiStatus } from "@/lib/ai-status";

// The runs page: a list of real saved runs on the left, the detail of the selected run on the right (stacked on phones).
// A PRACTICE run walks the steps and writes down what each would do; nothing leaves the app. A "Real" run is the record of
// one web address really asked after an Approve click. It reads the session and the database, so the page wraps it in <Suspense>.

const chip = "rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink";
const text = (value) => (typeof value === "string" ? value : "");
const heading = "text-xl font-semibold leading-[1.35] tracking-tight";

export function RunsFallback() {
  return (
    <div aria-busy="true" className="mt-8">
      <p role="status" className="sr-only">Loading your runs</p>
      <div aria-hidden="true" className="space-y-3">{[0, 1, 2].map((row) => <div key={row} className="h-[68px] rounded-2xl border border-line bg-raised" />)}</div>
    </div>
  );
}

function Notice({ icon, title, children }) {
  return (
    <div className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={icon} size={18} /></span>
      <p className="mt-3 font-semibold">{title}</p>
      <div className="mt-1 text-sm leading-relaxed text-mute">{children}</div>
      <Btn href="/app/workflows" size="sm" variant="secondary" className="mt-4">Go to Workflows</Btn>
    </div>
  );
}

export default async function RunsViewer({ searchParams }) {
  const user = await requireUser(); // outside try/catch on purpose: a signed-out visitor is redirected
  const { run: wanted } = await searchParams;

  let runs = [];
  let failure = "";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("runs")
      .select("id, workflow_name, mode, status, results, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      console.error("Loading runs failed:", error.code);
      failure = error.code === "42P01" || error.code === "PGRST205" ? SETUP_MESSAGE : "Could not load your runs. Check your connection and try again.";
    } else {
      runs = data.map((row) => ({
        id: text(row.id), name: text(row.workflow_name), live: row.mode === "live", status: row.status === "failed" ? "failed" : "done",
        createdAt: text(row.created_at), results: readSavedResults(row.results),
      }));
    }
  } catch {
    failure = "Could not load your runs. Check your connection and try again.";
  }

  if (failure) return <Notice icon="CircleAlert" title="Your runs could not be shown">{failure}</Notice>;
  if (runs.length === 0) {
    return (
      <Notice icon="History" title="Nothing has run yet.">
        Open Workflows and choose Practice run on one of your workflows. A practice run walks every step and writes down what it would do. It sends nothing and changes nothing outside Hushwork.
      </Notice>
    );
  }

  const selected = runs.find((run) => run.id === wanted) ?? runs[0];
  const { linear, google } = await connectorStatus(await createClient(), user.id);
  const linearConnected = linear.usable;
  const { enabled: aiOn } = await aiStatus();
  const liveLinear = selected.live && isLinearLookup(selected.results[0]);
  const liveAi = selected.live && isAiStep(selected.results[0]);
  const liveCalendar = selected.live && isCalendarLookup(selected.results[0]);
  const liveSheets = selected.live && isSheetsRow(selected.results[0]);
  const liveGmail = selected.live && isGmailLookup(selected.results[0]);
  const liveDrive = selected.live && isDriveLookup(selected.results[0]);
  const approvals = selected.live ? [] : selected.results.map((step, index) => ({ step, index })).filter(({ step }) => isRequestStep(step) || isLinearLookup(step) || isCalendarLookup(step) || isGmailLookup(step) || isDriveLookup(step) || isSheetsRow(step) || isAiStep(step));
  return (
    <div className="mt-8 md:flex">
      <div className="md:w-72 md:shrink-0 md:border-r md:border-line md:pr-6">
        <h2 className={heading}>Your runs</h2>
        <ul className="mt-3 space-y-1">
          {runs.map((run) => (
            <li key={run.id}>
              <Link
                href={`/app/runs?run=${run.id}`} aria-current={run.id === selected.id ? "true" : undefined}
                className={`block rounded-xl px-4 py-3 hover:bg-raised ${run.id === selected.id ? "bg-accent-subtle" : ""}`}
              >
                <span className="flex flex-wrap items-center gap-2"><b className="font-medium">{run.name}</b><span className={chip}>{run.live ? "Real" : "Practice"}</span></span>
                <span className="mt-1 block text-sm text-mute"><RunTime iso={run.createdAt} /> · {run.results.length} {run.results.length === 1 ? "step" : "steps"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <section aria-labelledby="run-heading" className="mt-10 min-w-0 flex-1 md:mt-0 md:pl-8">
        <div className="flex items-start gap-3 rounded-xl border border-line-strong bg-raised p-3">
          <span className={chip}>{selected.live ? "Real" : "Practice"}</span>
          <p className="text-sm">{selected.live ? (liveAi ? "The AI was really asked, after you approved it." : liveSheets ? "A row was really added to your Google Sheet, after you approved it." : liveCalendar ? "Google Calendar was really asked for your next events, after you approved it." : liveGmail ? "Gmail was really asked for your latest messages, after you approved it." : liveDrive ? "Google Drive was really asked for your latest files, after you approved it." : liveLinear ? "Linear was really asked for your open tasks, after you approved it." : "This web address was really asked, after you approved it.") : "This was a practice run. Every step was walked through, but nothing was sent, written or changed outside Hushwork."}</p>
        </div>
        <h2 id="run-heading" className={`${heading} mt-5`}>{selected.name}</h2>
        <p className="mt-1 text-[15px] text-mute">{selected.live ? (liveAi ? "The AI answered once." : liveSheets ? "One row was added." : liveCalendar ? "Google Calendar was asked once." : liveGmail ? "Gmail was asked once." : liveDrive ? "Google Drive was asked once." : liveLinear ? "Linear was asked once." : "One web address was asked.") : selected.status === "done" ? "All steps were walked through." : "This run could not finish."}</p>
        {/* key={selected.id}: every run gets a fresh button, so an open "are you sure?" never carries over to the next run */}
        {/* key: every run gets a fresh button, so an open "are you sure?" never carries over to the next run */}
        <div className="mt-2"><DeleteRun key={selected.id} id={selected.id} name={selected.name} /></div>
        <h3 className="mt-6 text-sm font-medium">{selected.live ? "What was done" : "What each step would do"}</h3>
        <ol className="mt-1 space-y-1">
          {selected.results.map((step, index) => (
            <StepRow
              key={index} icon={step.icon} title={step.title} sub={step.outcome}
              right={<span className="text-success"><Icon name="Check" size={14} /></span>}
            />
          ))}
        </ol>
        {approvals.map(({ step, index }) => (
          <div key={index} className="mt-6">
            <ApproveSend
              runId={selected.id} index={index}
              kind={isAiStep(step) ? "ai" : isLinearLookup(step) ? "linear" : isCalendarLookup(step) ? "calendar" : isGmailLookup(step) ? "gmail" : isDriveLookup(step) ? "drive" : isSheetsRow(step) ? "sheets" : "request"}
              connected={isAiStep(step) ? aiOn : isLinearLookup(step) ? linearConnected : isCalendarLookup(step) || isGmailLookup(step) || isDriveLookup(step) || isSheetsRow(step) ? google.usable : true}
              message={isAiStep(step) ? aiSummary(step) : isLinearLookup(step) ? linearSummary(step) : isCalendarLookup(step) ? calendarSummary(step) : isGmailLookup(step) ? gmailSummary(step) : isDriveLookup(step) ? driveSummary(step) : isSheetsRow(step) ? sheetsSummary(step) : requestSummary(step)}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
