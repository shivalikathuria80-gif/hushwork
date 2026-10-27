import { Fragment } from "react";
import Link from "next/link";
import { Btn, StepRow } from "../ui";
import { Icon } from "../icons";
import RunTime from "./RunTime";
import ApproveSend from "./ApproveSend";
import DeleteRun from "./DeleteRun";
import ResumeRun from "./ResumeRun";
import StepStudioCard from "./StepStudioCard";
import { summarizeRun } from "@/lib/studio/run-summary";
import { PAUSED_MESSAGE, isPaused } from "@/lib/app-controls";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSavedResults, isRequestStep, requestSummary, isLinearLookup, linearSummary, isCalendarLookup, calendarSummary, isGmailLookup, gmailSummary, isDriveLookup, driveSummary, isLinearCreate, linearCreateSummary, isAppLookup, appSummary, isActionStep, actionSummary, isApprovable, isPlanOnly, isSheetsRow, sheetsSummary, isAiStep, aiSummary, SETUP_MESSAGE } from "@/lib/run-engine";
import { connectorStatus } from "@/lib/connector-status";
import { aiStatus } from "@/lib/ai-status";
import { ANSWERS_TAG, findAnswer, findAnswers } from "@/lib/run-answer";
import { ANSWER_TAG } from "@/lib/connectors/google-sheets";

// The runs page: a list of real saved runs on the left, the detail of the selected run on the right (stacked on phones).
// A PRACTICE run walks the steps and writes down what each would do; nothing leaves the app. A "Real" run is the record of
// one web address really asked after an Approve click. It reads the session and the database, so the page wraps it in <Suspense>.

const chip = "rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink";
const chipWaiting = "rounded-md border border-accent bg-accent-subtle px-2 text-xs font-medium text-accent-text";
const text = (value) => (typeof value === "string" ? value : "");
const heading = "text-xl font-semibold leading-[1.35] tracking-tight";

// The words a real run saved, laid out so they are easy to read: blank lines keep their gaps, lines that start with "- " become bullet
// points, "Next step:" stands out, and the app's own list is set apart in a quieter style. Plain text only (React never treats it as HTML).
function Inline({ text }) {
  // **words** (which the AI sometimes writes) become bold; any stray ** or leading # is dropped so no raw symbols show.
  return text.replace(/^#{1,6}\s+/, "").split(/(\*\*[^*]+\*\*)/).map((part, index) => (part.startsWith("**") && part.endsWith("**") && part.length > 4 ? <strong key={index} className="font-semibold">{part.slice(2, -2)}</strong> : part.replace(/\*\*/g, "")));
}

function ResultText({ text }) {
  return (
    <div className="space-y-1.5 text-[15px] leading-relaxed">
      {text.split("\n").map((line, index) => {
        if (!line.trim()) return <div key={index} aria-hidden="true" className="h-2" />;
        if (/^\*\*[^*]+\*\*:?$/.test(line.trim()) || /^#{1,6}\s+/.test(line)) return <p key={index} className="mt-2 break-words font-semibold"><Inline text={line.trim().replace(/:$/, "")} /></p>;
        const numbered = line.match(/^(\d{1,2})[.)]\s+(.*)$/);
        if (numbered) {
          return (
            <p key={index} className="flex gap-2.5 pl-1">
              <span aria-hidden="true" className="w-4 shrink-0 text-right font-medium text-accent-text">{numbered[1]}.</span>
              <span className="min-w-0 break-words"><Inline text={numbered[2]} /></span>
            </p>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <p key={index} className="flex gap-2.5 pl-1">
              <span aria-hidden="true" className="mt-[0.62em] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
              <span className="min-w-0 break-words"><Inline text={line.slice(2)} /></span>
            </p>
          );
        }
        if (/^Next step:/.test(line)) return <p key={index} className="mt-1 break-words rounded-xl bg-accent-subtle px-3 py-2 font-medium text-accent-text">{line}</p>;
        if (/^The AI looked at .+\.$/.test(line)) return <p key={index} className="mt-1 text-sm text-mute">{line}</p>;
        if (/^The list from .+:$/.test(line)) return <p key={index} className="mt-1 border-t border-line pt-3 text-sm font-medium text-mute">{line}</p>;
        return <p key={index} className="break-words"><Inline text={line} /></p>;
      })}
    </div>
  );
}

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
  const { run: wanted, auto } = await searchParams;

  let runs = [];
  let failure = "";
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("runs")
      .select("id, workflow_id, workflow_name, mode, status, results, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) {
      console.error("Loading runs failed:", error.code);
      failure = error.code === "42P01" || error.code === "PGRST205" ? SETUP_MESSAGE : "Could not load your runs. Check your connection and try again.";
    } else {
      runs = data.map((row) => ({
        id: text(row.id), workflowId: text(row.workflow_id), name: text(row.workflow_name), live: row.mode === "live", status: row.status === "failed" ? "failed" : "done",
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
        Open Workflows and press Run on one of your workflows. Steps that act on your apps wait for your approval, and each run and its results are kept here.
      </Notice>
    );
  }

  // A run is one go at a workflow; each step that acted on an app saves its result as its own small record that points back to the run. The
  // list shows the runs (their results appear inside them), and a result whose run is not loaded still shows on its own.
  const doneByRun = new Map();
  for (const run of runs) {
    const first = run.live ? run.results[0] : null;
    if (first?.from && Number.isInteger(first.fromStep) && first.status === "done") doneByRun.set(first.from, (doneByRun.get(first.from) ?? new Set()).add(first.fromStep)); // a stopped note or a step that was only started is not a finished step
  }
  const waitingIn = (run) => (run.live ? 0 : run.results.filter((step, index) => isApprovable(step) && !doneByRun.get(run.id)?.has(index)).length);
  const runIds = new Set(runs.filter((run) => !run.live).map((run) => run.id));
  const shown = runs.filter((run) => !(run.live && run.results[0]?.from && runIds.has(run.results[0].from)));
  const selected = runs.find((run) => run.id === wanted) ?? shown[0] ?? runs[0]; // opens on the newest run in the list
  const { linear, google } = await connectorStatus(await createClient(), user.id);
  const linearConnected = linear.usable;
  const { enabled: aiOn } = await aiStatus();
  const liveLinear = selected.live && isLinearLookup(selected.results[0]);
  const liveAi = selected.live && isAiStep(selected.results[0]);
  const liveCalendar = selected.live && isCalendarLookup(selected.results[0]);
  const liveSheets = selected.live && isSheetsRow(selected.results[0]);
  const liveGmail = selected.live && isGmailLookup(selected.results[0]);
  const liveDrive = selected.live && isDriveLookup(selected.results[0]);
  const liveIssue = selected.live && isLinearCreate(selected.results[0]);
  const liveApp = selected.live && isAppLookup(selected.results[0]);
  const liveAction = selected.live && isActionStep(selected.results[0]);
  // Real runs that came from this practice run (an Approve click, or Auto mode): each is shown right under the step it did, and that step
  // no longer offers Approve. (A step that failed saved nothing, so it still offers Approve and the person can try again.)
  const doneAt = new Map();
  const stoppedAt = new Map(); // step number -> the saved note saying why it stopped (a later success wins)
  const unknownAt = new Map(); // step number -> started but never seen to finish: it may have happened, so it is never sent again by itself
  if (!selected.live) {
    try {
      const { data } = await (await createClient()).from("runs").select("results, created_at")
        .eq("user_id", user.id).eq("mode", "live").contains("results", JSON.stringify([{ from: selected.id }])) /* JSON text on purpose (see loadStepStates in lib/run-state.js) */.order("created_at", { ascending: true }).limit(60);
      for (const row of data ?? []) {
        const first = readSavedResults(row.results)[0];
        if (first && first.from === selected.id && Number.isInteger(first.fromStep)) {
          if (first.status === "failed") { stoppedAt.set(first.fromStep, first); if (!first.note) unknownAt.delete(first.fromStep); } // a clear refusal settles an unknown step; a note only explains
          else if (first.status === "pending") { unknownAt.set(first.fromStep, first); stoppedAt.delete(first.fromStep); }
          else { doneAt.set(first.fromStep, first); stoppedAt.delete(first.fromStep); unknownAt.delete(first.fromStep); }
        }
      }
    } catch {
      // the page still works without it: the steps just offer Approve
    }
  }
  const summary = selected.live ? { line: "" } : summarizeRun({ steps: selected.results, doneAt, stoppedAt, unknownAt }); // one plain line of what was really done, built only from saved results
  const approvals = selected.live ? [] : selected.results.map((step, index) => ({ step, index })).filter(({ step, index }) => !doneAt.has(index) && isApprovable(step));
  // A row step that uses {answer} shows the real words, so you read exactly what will be written before you press Approve.
  const needsAnswer = approvals.some(({ step }) => (isSheetsRow(step) && String(step.fields?.values).includes(ANSWER_TAG)) || ((isLinearCreate(step) || isActionStep(step)) && `${step.fields?.title}${step.fields?.details}`.includes(ANSWER_TAG)));
  const answer = needsAnswer ? await findAnswer(await createClient(), user.id, { workflow_id: selected.workflowId, created_at: selected.createdAt }) : "";
  // An email that writes {answers} carries every Ask the AI step of this run, in order.
  const needsAnswers = approvals.some(({ step }) => isActionStep(step) && String(step.fields?.details).includes(ANSWERS_TAG));
  const answers = needsAnswers ? await findAnswers(await createClient(), user.id, { id: selected.id, workflow_id: selected.workflowId, created_at: selected.createdAt }) : [];
  const paused = await isPaused(await createClient());
  return (
    <div className="mt-8 md:flex">
      <div className="md:w-72 md:shrink-0 md:border-r md:border-line md:pr-6">
        <h2 className={heading}>Your runs</h2>
        <ul className="mt-3 space-y-1">
          {shown.map((run) => (
            <li key={run.id}>
              <Link
                href={`/app/runs?run=${run.id}`} aria-current={run.id === selected.id ? "true" : undefined}
                className={`block rounded-xl px-4 py-3 hover:bg-raised ${run.id === selected.id ? "bg-accent-subtle" : ""}`}
              >
                <span className="flex flex-wrap items-center gap-2"><b className="font-medium">{run.name}</b><span className={waitingIn(run) > 0 ? chipWaiting : chip}>{waitingIn(run) > 0 ? "Needs approval" : "Completed"}</span></span>
                <span className="mt-1 block text-sm text-mute"><RunTime iso={run.createdAt} /> · {run.results.length} {run.results.length === 1 ? "step" : "steps"}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <section aria-labelledby="run-heading" className="mt-10 min-w-0 flex-1 md:mt-0 md:pl-8">
        {paused && <p role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-error bg-surface px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{PAUSED_MESSAGE}</p>}
        <div className="flex items-start gap-3 rounded-xl border border-line-strong bg-raised p-3">
          <span className={!selected.live && approvals.length > 0 ? chipWaiting : chip}>{!selected.live && approvals.length > 0 ? "Needs approval" : "Completed"}</span>
          <p className="text-sm">
            {selected.live
              ? (liveAi ? "The AI ran this step." : liveSheets ? "A row was added to your Google Sheet." : liveCalendar ? "Google Calendar was read." : liveGmail ? "Gmail was read." : liveDrive ? "Google Drive was read." : liveIssue ? "A task was created in Linear." : liveApp ? "Another app was read, through Composio." : liveAction ? "Something was done in another app, through Composio." : liveLinear ? "Linear was read." : "A web address was read.")
              : approvals.length > 0
                ? `${approvals.length} ${approvals.length === 1 ? "step is" : "steps are"} waiting for your approval. Nothing is sent, written or changed in your apps until you approve it.`
                : "All steps are done."}
          </p>
        </div>
        {summary.line && (
          <p id="run-summary" className="mt-3 flex items-start gap-2 text-[15px] font-medium">
            <Icon name={summary.state === "done" ? "CircleCheck" : summary.state === "waiting" ? "Info" : "CircleAlert"} className={`mt-0.5 shrink-0 ${summary.state === "done" ? "text-success" : summary.state === "waiting" ? "text-info" : "text-error"}`} />
            <span>{summary.line}</span>
          </p>
        )}
        {!selected.live && (auto === "done" || auto === "stopped") && (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm">
            <Icon name={auto === "done" ? "CircleCheck" : "CircleAlert"} className={`mt-0.5 shrink-0 ${auto === "done" ? "text-success" : "text-error"}`} />
            {auto === "done"
              ? `Auto mode did ${doneAt.size} ${doneAt.size === 1 ? "step" : "steps"} for you, without asking. The results are under each step below.`
              : `Auto mode did ${doneAt.size} ${doneAt.size === 1 ? "step" : "steps"} and then stopped at a step that needs attention. Press Approve on that step to see why.`}
          </p>
        )}
        <h2 id="run-heading" className={`${heading} mt-5`}>{selected.name}</h2>
        <p className="mt-1 text-[15px] text-mute">{selected.live ? <>Ran <RunTime iso={selected.createdAt} /></> : <>Started <RunTime iso={selected.createdAt} /> · {selected.results.length} {selected.results.length === 1 ? "step" : "steps"}</>}</p>
        {/* key={selected.id}: every run gets a fresh button, so an open "are you sure?" never carries over to the next run */}
        {/* key: every run gets a fresh button, so an open "are you sure?" never carries over to the next run */}
        {selected.live && selected.results[0]?.from && runs.some((run) => run.id === selected.results[0].from) && (
          <p className="mt-2 text-sm"><Link href={`/app/runs?run=${selected.results[0].from}`} className="font-medium text-accent-text hover:underline">Back to the run</Link> to approve the next step.</p>
        )}
        <div className="mt-2"><DeleteRun key={selected.id} id={selected.id} name={selected.name} /></div>
        <h3 className="mt-6 text-sm font-medium">{selected.live ? "Result" : "Steps"}</h3>
        {selected.live ? (
          <ol className="mt-2 space-y-4">
            {selected.results.map((step, index) => (
              <li key={index}>
                <p className="flex items-center gap-2 text-sm font-medium"><Icon name={step.icon} fallback="Check" size={16} className="text-accent-text" />{step.title}</p>
                <div className="mt-2 max-w-[75ch] rounded-2xl border border-line bg-surface p-4 shadow-sm md:p-5"><ResultText text={step.outcome} /></div>
              </li>
            ))}
          </ol>
        ) : (
          <ol className="mt-1 space-y-1">
            {selected.results.map((step, index) => (
              <Fragment key={index}>
                <StepRow
                  icon={step.icon} title={step.title} sub={step.detail}
                  right={doneAt.has(index) ? <span className="text-success"><Icon name="Check" size={14} /></span> : isApprovable(step) ? <span className="text-xs text-mute">Waiting</span> : isPlanOnly(step) ? <span className="text-xs text-mute" title="This step only describes what would happen. It does nothing when run.">Plan only</span> : null}
                />
                {step.kind && step.kind !== "trigger" && (
                  <li className="list-none pb-1">
                    <StepStudioCard
                      step={step}
                      evidence={doneAt.has(index) ? { state: "verified", text: "It ran, and its result was saved (shown below)." } : unknownAt.has(index) ? { state: "unknown", text: "" } : stoppedAt.has(index) ? { state: "failed", text: stoppedAt.get(index).outcome } : { state: "planned", text: "" }}
                    />
                  </li>
                )}
                {unknownAt.has(index) && !doneAt.has(index) && (
                  <li className="list-none pb-3 pt-1">
                    <p role="alert" className="flex items-start gap-2 rounded-xl bg-raised px-3 py-2 pl-2.5 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" /><span><b className="font-medium">Not sure if this happened.</b> It was started, but Hushwork never saw whether it finished (the connection may have dropped). Look in the app first. It is not sent again by itself.</span></p>
                  </li>
                )}
                {stoppedAt.has(index) && !doneAt.has(index) && !unknownAt.has(index) && (
                  <li className="list-none pb-3 pt-1">
                    <p role="alert" className="flex items-start gap-2 rounded-xl bg-raised px-3 py-2 pl-2.5 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" /><span><b className="font-medium">It stopped here.</b> {stoppedAt.get(index).outcome} You can fix that and press Approve on this step to try again.</span></p>
                  </li>
                )}
                {doneAt.has(index) && (
                  <li className="list-none pb-3 pt-1">
                    <p className="flex items-center gap-2 pl-1 text-sm font-medium text-success"><Icon name="CircleCheck" size={16} />Done. Result:</p>
                    <div className="mt-2 max-w-[75ch] rounded-2xl border border-line bg-surface p-4 shadow-sm md:p-5"><ResultText text={doneAt.get(index).outcome} /></div>
                  </li>
                )}
              </Fragment>
            ))}
          </ol>
        )}
        {!selected.live && [...stoppedAt.keys()].some((step) => !doneAt.has(step) && !unknownAt.has(step)) && (
          <div className="mt-4"><ResumeRun key={selected.id} runId={selected.id} /></div>
        )}
        {approvals.map(({ step, index }) => (
          <div key={index} className="mt-6">
            <ApproveSend
              runId={selected.id} index={index} unknown={unknownAt.has(index)}
              kind={isAiStep(step) ? "ai" : isLinearLookup(step) ? "linear" : isCalendarLookup(step) ? "calendar" : isGmailLookup(step) ? "gmail" : isDriveLookup(step) ? "drive" : isLinearCreate(step) ? "issue" : isAppLookup(step) ? "app" : isActionStep(step) ? "action" : isSheetsRow(step) ? "sheets" : "request"}
              connected={isAiStep(step) ? aiOn : isLinearLookup(step) || isLinearCreate(step) ? linearConnected : isCalendarLookup(step) || isGmailLookup(step) || isDriveLookup(step) || isSheetsRow(step) ? google.usable : true}
              message={isAiStep(step) ? aiSummary(step) : isLinearLookup(step) ? linearSummary(step) : isCalendarLookup(step) ? calendarSummary(step) : isGmailLookup(step) ? gmailSummary(step) : isDriveLookup(step) ? driveSummary(step) : isLinearCreate(step) ? linearCreateSummary(step, answer) : isAppLookup(step) ? appSummary(step) : isActionStep(step) ? actionSummary(step, answer, answers, user.email) : isSheetsRow(step) ? sheetsSummary(step, answer) : requestSummary(step)}
            />
          </div>
        ))}
      </section>
    </div>
  );
}
