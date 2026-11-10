import Link from "next/link";
import { Btn } from "../ui";
import { Icon } from "../icons";
import RunTime from "./RunTime";
import ApproveSend from "./ApproveSend";
import DeleteRun from "./DeleteRun";
import ResumeRun from "./ResumeRun";
import { CountUp, Reveal, RevealItem, RunsKeys, StepDot, StepLine, StepProgress } from "./RunMotion";
import { summarizeRun } from "@/lib/studio/run-summary";
import { PAUSED_MESSAGE, isPaused } from "@/lib/app-controls";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { readSavedResults, isRequestStep, requestSummary, isLinearLookup, linearSummary, isCalendarLookup, calendarSummary, isGmailLookup, gmailSummary, isDriveLookup, driveSummary, isLinearCreate, linearCreateSummary, isAppLookup, appSummary, isActionStep, actionSummary, isApprovable, isSheetsRow, sheetsSummary, isAiStep, aiSummary, runOutcome, stepState, incomingOf, SETUP_MESSAGE } from "@/lib/run-engine";
import { connectorStatus } from "@/lib/connector-status";
import { aiStatus } from "@/lib/ai-status";
import { ANSWERS_TAG, findAnswer, findAnswers } from "@/lib/run-answer";
import { ANSWER_TAG } from "@/lib/connectors/google-sheets";
import { quietLine, quietRunIds } from "@/lib/watch-rules";

// The runs page: a list of real saved runs on the left, the detail of the selected run on the right (stacked on phones).
// A PRACTICE run walks the steps and writes down what each would do; nothing leaves the app. A "Real" run is the record of
// one web address really asked after an Approve click. It reads the session and the database, so the page wraps it in <Suspense>.

const text = (value) => (typeof value === "string" ? value : "");
const heading = "text-xl font-semibold leading-[1.35] tracking-tight";

// One status word for a run or a step, always with a coloured dot AND words, so it never relies on colour alone.
// tone: "good" (done), "you" (waiting for you), "bad" (stopped or unsure), "quiet" (nothing to do).
const DOT = { good: "bg-success", you: "bg-accent", bad: "bg-error", quiet: "bg-line-strong" };
function Pill({ tone, children }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-line-strong bg-surface px-2.5 py-0.5 text-xs font-medium text-ink">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[tone] ?? DOT.quiet}`} />{children}
    </span>
  );
}

// The run's headline in short, plain words (runOutcome in lib/run-engine.js has the long sentence).
const RUN_WORDS = {
  completed: ["good", "Done"], partial: ["good", "Partly done"], waiting: ["you", "Needs your OK"],
  stopped: ["bad", "Stopped"], unsure: ["bad", "Check this"], practice: ["quiet", "Preview only"],
};
function RunPill({ outcome }) {
  const [tone, words] = RUN_WORDS[outcome.key] ?? ["quiet", outcome.label];
  return <Pill tone={tone}>{words}</Pill>;
}
const needsYou = (outcome) => outcome.key === "waiting" || outcome.key === "stopped" || outcome.key === "unsure";

// A step's state in words.
const STEP_WORDS = {
  done: ["good", "Done"], waiting: ["you", "Needs your OK"], stopped: ["bad", "Stopped"], unsure: ["bad", "Not sure it ran"],
  "plan-only": ["quiet", "Plan only"], nothing: null, // a trigger or a note: nothing to say
};

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
      <Btn href="/app#drafts" size="sm" variant="secondary" className="mt-4">Go to your workflows</Btn>
    </div>
  );
}

export default async function RunsViewer({ searchParams }) {
  const user = await requireUser(); // outside try/catch on purpose: a signed-out visitor is redirected
  const { run: wanted, auto, agent } = await searchParams;

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
        On the home page, press Run on one of your workflows. Steps that act on your apps wait for your approval, and each run and its results are kept here.
      </Notice>
    );
  }

  // A run is one go at a workflow; each step that acted on an app saves its result as its own small record that points back to the run. The
  // list shows the runs (their results appear inside them), and a result whose run is not loaded still shows on its own.
  // Each real record is sorted by what it says: done, stopped (a stop note is not a finished step) or only started (never seen to finish).
  const byRun = { done: new Map(), failed: new Map(), pending: new Map() };
  for (const run of runs) {
    const first = run.live ? run.results[0] : null;
    if (!first?.from || !Number.isInteger(first.fromStep)) continue;
    const into = byRun[first.status] ?? byRun.done;
    into.set(first.from, (into.get(first.from) ?? new Set()).add(first.fromStep));
  }
  // The honest headline of a run (see runOutcome in lib/run-engine.js). A saved real record is "Completed", unless it says a step stopped or never finished.
  const outcomeOf = (run) => {
    if (!run.live) return runOutcome(run.results, byRun.done.get(run.id), byRun.failed.get(run.id), byRun.pending.get(run.id));
    const status = run.results[0]?.status;
    if (status === "failed") return { key: "stopped", label: "Stopped at a step", notRun: [], text: run.results[0].outcome };
    if (status === "pending") return { key: "unsure", label: "Not sure it finished", notRun: [], text: "" };
    return { key: "completed", label: "Completed", notRun: [], text: "" };
  };
  const runIds = new Set(runs.filter((run) => !run.live).map((run) => run.id));
  // WATCH MODE: a check that found "nothing new" is not listed (it would bury the runs that matter). All of them are folded into one quiet line.
  const quiet = quietRunIds(runs);
  const shown = runs.filter((run) => !(run.live && run.results[0]?.from && runIds.has(run.results[0].from)) && !quiet.has(run.id) && !(run.live && run.results[0]?.quiet));
  if (shown.length === 0 && !runs.some((run) => run.id === wanted)) {
    return <Notice icon="History" title="Nothing needs you.">{quiet.size > 0 ? `${quietLine(quiet.size)}. A watch workflow only shows up here when it finds something new.` : "Nothing is waiting."}</Notice>;
  }
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
        .eq("user_id", user.id).eq("mode", "live").contains("results", JSON.stringify([{ from: selected.id }])) /* JSON text on purpose (see loadStepStates in lib/run-state.js) */.gte("created_at", selected.createdAt || "1970-01-01T00:00:00Z") /* records come after their run */.order("created_at", { ascending: true }).limit(60);
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
  const selectedOutcome = selected.live ? outcomeOf(selected) : runOutcome(selected.results, doneAt, stoppedAt, unknownAt);
  const approvals = selected.live ? [] : selected.results.map((step, index) => ({ step, index })).filter(({ step, index }) => !doneAt.has(index) && isApprovable(step));
  // A row step that uses {answer} shows the real words, so you read exactly what will be written before you press Approve.
  const needsAnswer = approvals.some(({ step }) => (isSheetsRow(step) && String(step.fields?.values).includes(ANSWER_TAG)) || ((isLinearCreate(step) || isActionStep(step)) && `${step.fields?.title}${step.fields?.details}`.includes(ANSWER_TAG)));
  const answer = needsAnswer ? await findAnswer(await createClient(), user.id, { workflow_id: selected.workflowId, created_at: selected.createdAt }) : "";
  // An email that writes {answers} carries every Ask the AI step of this run, in order.
  const needsAnswers = approvals.some(({ step }) => isActionStep(step) && String(step.fields?.details).includes(ANSWERS_TAG));
  const answers = needsAnswers ? await findAnswers(await createClient(), user.id, { id: selected.id, workflow_id: selected.workflowId, created_at: selected.createdAt }) : [];
  const paused = await isPaused(await createClient());
  const incoming = incomingOf(selected.results); // what arrived at the start link, for steps that write {incoming.name}

  // What each approval card needs, keyed by step number, so the card sits right under the step it belongs to.
  const approvalFor = new Map(approvals.map(({ step, index }) => [index, {
    kind: isAiStep(step) ? "ai" : isLinearLookup(step) ? "linear" : isCalendarLookup(step) ? "calendar" : isGmailLookup(step) ? "gmail" : isDriveLookup(step) ? "drive" : isLinearCreate(step) ? "issue" : isAppLookup(step) ? "app" : isActionStep(step) ? "action" : isSheetsRow(step) ? "sheets" : "request",
    connected: isAiStep(step) ? aiOn : isLinearLookup(step) || isLinearCreate(step) ? linearConnected : isCalendarLookup(step) || isGmailLookup(step) || isDriveLookup(step) || isSheetsRow(step) ? google.usable : true,
    message: isAiStep(step) ? aiSummary(step) : isLinearLookup(step) ? linearSummary(step) : isCalendarLookup(step) ? calendarSummary(step) : isGmailLookup(step) ? gmailSummary(step) : isDriveLookup(step) ? driveSummary(step) : isLinearCreate(step) ? linearCreateSummary(step, answer) : isAppLookup(step) ? appSummary(step) : isActionStep(step) ? actionSummary(step, answer, answers, user.email, incoming) : isSheetsRow(step) ? sheetsSummary(step, answer, incoming) : requestSummary(step),
  }]));
  const firstApproval = approvals[0]?.index;
  const liveLine = selectedOutcome.key === "stopped" ? "A step stopped before it could finish. The reason is below." : selectedOutcome.key === "unsure" ? "This was started, but Hushwork never saw it finish. Look in the app first." : liveAi ? "The AI ran this step." : liveSheets ? "A row was added to your Google Sheet." : liveCalendar ? "Google Calendar was read." : liveGmail ? "Gmail was read." : liveDrive ? "Google Drive was read." : liveIssue ? "A task was created in Linear." : liveApp ? "Another app was read, through Composio." : liveAction ? "Something was done in another app, through Composio." : liveLinear ? "Linear was read." : "A web address was read.";
  // The list, split in two: runs that need you (an approval, a stop, or a step Hushwork lost track of) and everything else.
  const withOutcome = shown.map((run) => ({ run, outcome: outcomeOf(run) }));
  // For the progress bar: steps that do something (not a trigger or a note), and how many of them are done.
  const counted = selected.live ? [] : selected.results.map((step, index) => stepState(step, index, doneAt, stoppedAt, unknownAt)).filter((state) => state !== "nothing");
  const doneCount = counted.filter((state) => state === "done").length;
  const mood = selectedOutcome.key === "completed" ? "good" : selectedOutcome.key === "stopped" ? "bad" : "";
  const needCount = withOutcome.filter(({ outcome }) => needsYou(outcome)).length;
  const doneRuns = withOutcome.filter(({ outcome }) => outcome.key === "completed" || outcome.key === "partial").length;
  const groups = [
    ["Needs you", withOutcome.filter(({ outcome }) => needsYou(outcome))],
    ["Earlier", withOutcome.filter(({ outcome }) => !needsYou(outcome))],
  ].filter(([, items]) => items.length > 0);

  return (
    <>
    <RunsKeys ids={withOutcome.map(({ run }) => run.id)} current={selected.id} mood={mood} />
    <Reveal as="dl" className="mt-6 grid grid-cols-3 gap-3">
      {[["Needs you", needCount, "you"], ["Done", doneRuns, "good"], ["Shown", withOutcome.length, "quiet"]].map(([label, value, tone]) => (
        <RevealItem key={label} className="rounded-2xl border border-line bg-surface/85 px-4 py-3 shadow-sm backdrop-blur-sm">
          <dt className="flex items-center gap-1.5 text-xs font-medium text-mute"><span aria-hidden="true" className={`h-2 w-2 rounded-full ${DOT[tone]} ${tone === "you" && value > 0 ? "hw-pulse-dot" : ""}`} />{label}</dt>
          <dd className="mt-1 text-2xl font-semibold tracking-tight"><CountUp value={value} /></dd>
        </RevealItem>
      ))}
    </Reveal>
    <div className="mt-6 md:flex md:gap-8">
      <nav aria-label="Your runs" data-runs-list className="md:w-72 md:shrink-0">
        {quiet.size > 0 && <p className="mb-3 text-sm text-mute">{quietLine(quiet.size)}</p>}
        {groups.map(([title, items]) => (
          <div key={title} className="mb-5">
            <h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-mute">{title} <span className="font-normal">({items.length})</span></h2>
            <Reveal as="ul" className="mt-2 space-y-1">
              {items.map(({ run, outcome }) => (
                <RevealItem as="li" key={run.id}>
                  <Link
                    href={`/app/runs?run=${run.id}`} scroll={false} data-run-id={run.id} aria-current={run.id === selected.id ? "true" : undefined}
                    className={`block rounded-xl border px-3 py-2.5 transition-[background-color,border-color,transform] duration-120 ease-standard ${run.id === selected.id ? "border-accent bg-accent-subtle shadow-sm" : "border-transparent hover:translate-x-0.5 hover:bg-raised"} text-ink no-underline`}
                  >
                    <span className="flex items-start justify-between gap-2"><b className="min-w-0 break-words text-[15px] font-medium">{run.name}</b><RunPill outcome={outcome} /></span>
                    <span className="mt-0.5 block text-sm text-mute"><RunTime iso={run.createdAt} /></span>
                  </Link>
                </RevealItem>
              ))}
            </Reveal>
          </div>
        ))}
        <p className="mt-2 hidden px-1 text-xs text-mute md:block">Tip: press <kbd className="rounded border border-line bg-raised px-1 font-mono">J</kbd> and <kbd className="rounded border border-line bg-raised px-1 font-mono">K</kbd> to move between runs.</p>
      </nav>

      <section aria-labelledby="run-heading" className="mt-6 min-w-0 flex-1 md:mt-0">
        {paused && <p role="status" className="mb-3 flex items-start gap-2 rounded-xl border border-error bg-surface px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{PAUSED_MESSAGE}</p>}

        <RevealItem key={`head-${selected.id}`} initial="hidden" animate="shown" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="run-heading" className={heading}>{selected.name}</h2>
              <p className="mt-0.5 text-sm text-mute">{selected.live ? <>Ran <RunTime iso={selected.createdAt} /></> : <>Started <RunTime iso={selected.createdAt} /> · {selected.results.length} {selected.results.length === 1 ? "step" : "steps"}</>}</p>
            </div>
            <RunPill outcome={selectedOutcome} />
          </div>
          <p className="mt-3 text-[15px]">{selected.live ? liveLine : summary.line || selectedOutcome.text}</p>
          {!selected.live && summary.line && selectedOutcome.notRun.length > 0 && <p className="mt-1 text-sm text-mute">{selectedOutcome.notRun.length} {selectedOutcome.notRun.length === 1 ? "step only describes" : "steps only describe"} what would happen, so {selectedOutcome.notRun.length === 1 ? "it does" : "they do"} nothing by itself.</p>}
          {!selected.live && counted.length > 0 && <StepProgress done={doneCount} total={counted.length} tone={selectedOutcome.key === "waiting" ? "you" : selectedOutcome.key === "stopped" || selectedOutcome.key === "unsure" ? "bad" : "good"} />}
          {approvals.length > 0 && (
            <a href={`#step-${firstApproval + 1}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover md:min-h-9">
              <Icon name="ShieldCheck" />{approvals.length === 1 ? "1 step is waiting for your OK" : `${approvals.length} steps are waiting for your OK`}<Icon name="ArrowDown" />
            </a>
          )}
          {selected.live && selected.results[0]?.from && runs.some((run) => run.id === selected.results[0].from) && (
            <p className="mt-3 text-sm"><Link href={`/app/runs?run=${selected.results[0].from}`} className="font-medium text-accent-text hover:underline">Back to the whole run</Link> to approve the next step.</p>
          )}
        </RevealItem>

        {!selected.live && (agent === "new" || agent === "scheduled") && (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-accent-subtle px-3 py-2 text-sm">
            <Icon name="Bot" className="mt-0.5 shrink-0 text-accent-text" />
            <span>
              Your agent is saved and just ran once. {agent === "scheduled" ? "It will also run on the schedule you described. " : ""}
              Any step that sends, adds or creates something waits below for your OK. <Link href="/app/agents" className="font-medium text-accent-text hover:underline">See your agents</Link>
            </span>
          </p>
        )}
        {!selected.live && (auto === "done" || auto === "stopped") && (
          <p role="status" className="mt-3 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm">
            <Icon name={auto === "done" ? "CircleCheck" : "CircleAlert"} className={`mt-0.5 shrink-0 ${auto === "done" ? "text-success" : "text-error"}`} />
            {auto === "done"
              ? (doneAt.size === 0
                ? "Auto mode ran, but it had nothing it could carry out for real, so nothing was sent, written or changed. The steps below say why."
                : `Auto mode did ${doneAt.size} ${doneAt.size === 1 ? "step" : "steps"} for you, without asking. The results are under each step below.`)
              : `Auto mode did ${doneAt.size} ${doneAt.size === 1 ? "step" : "steps"} and then stopped at a step that needs attention. Its reason is under that step.`}
          </p>
        )}

        {selected.live ? (
          <Reveal as="ol" key={`live-${selected.id}`} delay={0.1} className="mt-6 space-y-4">
            {selected.results.map((step, index) => (
              <RevealItem as="li" key={index}>
                <p className="flex items-center gap-2 text-sm font-medium"><Icon name={step.icon} fallback="Check" size={16} className="text-accent-text" />{step.title}</p>
                <div className="mt-2 max-w-[75ch] rounded-2xl border border-line bg-surface p-4 shadow-sm md:p-5"><ResultText text={step.outcome} /></div>
              </RevealItem>
            ))}
          </Reveal>
        ) : (
          <Reveal as="ol" key={`steps-${selected.id}`} delay={0.1} className="mt-6">
            {selected.results.map((step, index) => {
              const state = stepState(step, index, doneAt, stoppedAt, unknownAt);
              const [tone, words] = STEP_WORDS[state] ?? [];
              const approval = approvalFor.get(index);
              const last = index === selected.results.length - 1;
              return (
                <RevealItem as="li" key={index} id={`step-${index + 1}`} className="relative scroll-mt-20 pb-5 pl-12">
                  {!last && <StepLine className={`absolute bottom-0 left-[17px] top-10 w-px ${state === "done" ? "bg-success/60" : "bg-line"}`} />}
                  <StepDot state={state} number={index + 1} className={`absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full border text-sm font-semibold ${state === "done" ? "border-success bg-surface text-success" : state === "waiting" ? "border-accent bg-accent-subtle text-accent-text" : state === "stopped" || state === "unsure" ? "border-error bg-surface text-error" : "border-line bg-surface text-mute"}`}>
                    {state === "done" ? <Icon name="Check" size={16} /> : index + 1}
                  </StepDot>
                  <div className="flex flex-wrap items-start justify-between gap-2 pt-1">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 font-medium"><span className="sr-only">Step {index + 1}: </span><Icon name={step.icon} fallback="Workflow" size={16} className="shrink-0 text-accent-text" />{step.title}</p>
                      {step.detail && <p className="mt-0.5 text-sm text-mute">{step.detail}</p>}
                    </div>
                    {words && <Pill tone={tone}>{words}</Pill>}
                  </div>
                  {index === 0 && step.incoming && (
                    <div className="mt-3 max-w-[75ch] rounded-2xl border border-line bg-surface p-4 shadow-sm">
                      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-mute">Arrived at its start link</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm">{step.incoming}</p>
                      <p className="mt-2 text-xs text-mute">Someone else wrote this. Hushwork treats it as information only, never as instructions.</p>
                    </div>
                  )}
                  {unknownAt.has(index) && !doneAt.has(index) && (
                    <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-error bg-surface px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" /><span><b className="font-medium">Not sure if this happened.</b> It was started, but Hushwork never saw whether it finished (the connection may have dropped). Look in the app first. It is not sent again by itself.</span></p>
                  )}
                  {stoppedAt.has(index) && !doneAt.has(index) && !unknownAt.has(index) && (
                    <p role="alert" className="mt-3 flex items-start gap-2 rounded-xl border border-error bg-surface px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" /><span><b className="font-medium">It stopped here.</b> {stoppedAt.get(index).outcome} Fix that, then approve this step again below.</span></p>
                  )}
                  {doneAt.has(index) && (
                    <div className="mt-3 max-w-[75ch] rounded-2xl border border-line bg-surface p-4 shadow-sm md:p-5"><ResultText text={doneAt.get(index).outcome} /></div>
                  )}
                  {approval && (
                    <div className="mt-3">
                      <ApproveSend runId={selected.id} index={index} unknown={unknownAt.has(index)} kind={approval.kind} connected={approval.connected} message={approval.message} />
                    </div>
                  )}
                </RevealItem>
              );
            })}
          </Reveal>
        )}
        {!selected.live && [...stoppedAt.keys()].some((step) => !doneAt.has(step) && !unknownAt.has(step)) && (
          <div className="mt-2"><ResumeRun key={selected.id} runId={selected.id} /></div>
        )}
        {/* key: every run gets a fresh button, so an open "are you sure?" never carries over to the next run */}
        <div className="mt-8 border-t border-line pt-4"><DeleteRun key={selected.id} id={selected.id} name={selected.name} /></div>
      </section>
    </div>
    </>
  );
}
