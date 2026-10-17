"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { motion } from "motion/react";
import { Btn, EASE, StepRow, Switch } from "../ui";
import { Icon } from "../icons";
import { planFor } from "../AgentBox";
import { saveDraft } from "@/lib/actions/drafts";
import { previewPlan } from "@/lib/actions/plan";
import { LIMITS } from "@/lib/validate";

const SAVE_FAILED = "Could not save your draft. Check your connection and try again.";

// Sentences the screen says by itself (the server's own sentences arrive inside its answer, as `notice`).
const WRITING = "The AI is writing your plan.";
const SLOW = "This is taking longer than usual.";
const UNREACHABLE = "We could not reach the AI, so this is a keyword preview.";
const OFFLINE = "You are offline, so this is a keyword preview. Saving needs a connection.";
const INPUT_ERROR = {
  empty: "Describe the work first, then preview the plan.",
  too_long: `That is longer than ${LIMITS.promptMax} characters. Shorten it and try again.`,
  other: "Could not preview that request. Try again.",
};

// The reasons the server gives when it refused BEFORE sending anything to the AI. Every other reason means the text was sent.
const NOT_SENT = ["off", "sensitive", "limit_minute", "limit_day", "limit_all_minute", "limit_all_day"];

// The "Write with AI" switch remembers its position in this browser (localStorage key hw-ai). useSyncExternalStore lets
// the server render the default (on) and the browser read the saved choice, without any setState-in-an-effect.
// `chosen` also keeps the choice for this page if the browser refuses to store it.
let chosen = null;
const listeners = new Set();
function subscribeToAiChoice(listener) {
  listeners.add(listener);
  const onStorage = () => { chosen = null; listener(); }; // another tab changed it: read it again
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(listener); window.removeEventListener("storage", onStorage); };
}
function readAiChoice() {
  if (chosen !== null) return chosen;
  try { return localStorage.getItem("hw-ai") !== "off"; } catch { return true; }
}
function saveAiChoice(on) {
  chosen = on;
  try { localStorage.setItem("hw-ai", on ? "on" : "off"); } catch { /* private window: the choice lasts until the page closes */ }
  listeners.forEach((listener) => listener());
}

// The workspace's request box. `ai` says whether AI planning is available: { enabled, limit } from the server, which only
// ever sends "a key exists" and never the key. With AI off, or the switch off, the plan is made by simple keyword matching
// in the browser and the text goes nowhere. With AI on, the text goes to the server action `previewPlan`, which asks the
// AI to write the plan; if that fails, the keyword plan is shown with a plain sentence saying why. Either way a plan is
// only something to read: nothing runs.
// `seed` is how the cards, recipe tiles and saved drafts put text into the box: { id, text, plan? }.
export default function Composer({ seed, ai = { enabled: false, limit: 0 } }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState("idle"); // idle -> writing (waiting for the AI) -> ready
  const [plan, setPlan] = useState([]); // steps as [icon, title, detail]
  const [view, setView] = useState({ source: "keyword" }); // what the plan on screen is: { source: "ai" | "keyword" | "saved", notice?, canRetry?, retryAfter?, sent? }
  const [retryReady, setRetryReady] = useState(true);
  const [slow, setSlow] = useState(false);
  const [status, setStatus] = useState(""); // the sentence the hidden live region says out loud
  const [inputError, setInputError] = useState(null); // empty | too_long | other
  const [remaining, setRemaining] = useState(null); // AI plans left today, once the server has said
  const [dayNotice, setDayNotice] = useState(null); // set when today's AI plans are used up
  const [handledSeed, setHandledSeed] = useState(0);
  const [saveState, setSaveState] = useState({ status: "idle" }); // idle | saved | error
  const [saving, startSaving] = useTransition();
  const aiChoice = useSyncExternalStore(subscribeToAiChoice, readAiChoice, () => true);
  const taRef = useRef(null);
  const planHeadingRef = useRef(null);
  const requestId = useRef(0); // goes up with every request and every reset, so an old answer can be ignored

  const writing = phase === "writing";
  const aiOn = ai.enabled && aiChoice && !dayNotice; // will "Preview plan" call the AI?

  // A new seed arrived: put its text (and saved plan, if it has one) in place. Done while rendering, which is the
  // React-approved way to reset state when a prop changes.
  if (seed && seed.id !== handledSeed) {
    setHandledSeed(seed.id);
    setText(seed.text);
    setInputError(null);
    setSaveState(seed.plan ? { status: "saved" } : { status: "idle" }); // an opened draft is already saved
    if (seed.plan) {
      setPlan(seed.plan.map((step) => [step.icon, step.title, step.detail]));
      setView({ source: "saved" });
      setPhase("ready");
      setStatus("");
    } else {
      setPlan([]);
      setPhase("idle");
    }
  }

  // After a seed: draft with a plan -> focus the plan heading; text only -> focus the box with the cursor at the end.
  const seedId = seed?.id;
  const seedHasPlan = Boolean(seed?.plan);
  useEffect(() => {
    if (!seedId) return;
    requestId.current += 1; // any AI call still waiting belongs to the old text: ignore its answer
    if (seedHasPlan) {
      planHeadingRef.current?.focus();
    } else if (taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(taRef.current.value.length, taRef.current.value.length);
      taRef.current.scrollIntoView({ block: "center" });
    }
  }, [seedId, seedHasPlan]);

  // Clears the plan and any waiting AI call (its answer will be ignored). The text stays unless `clearText`.
  const reset = useCallback((clearText) => {
    requestId.current += 1;
    setPhase("idle"); setPlan([]); setStatus(""); setSlow(false); setInputError(null);
    setSaveState({ status: "idle" });
    if (clearText) setText("");
  }, []);

  // The sidebar's "New workflow" button announces itself with this event: clear the box and focus it.
  useEffect(() => {
    const onNew = () => { reset(true); taRef.current?.focus(); };
    window.addEventListener("hw:new-workflow", onNew);
    return () => window.removeEventListener("hw:new-workflow", onNew);
  }, [reset]);

  // While the AI is writing: after 6 seconds say it is slow and offer the keyword preview.
  useEffect(() => {
    if (phase !== "writing") return;
    const timer = setTimeout(() => { setSlow(true); setStatus(SLOW); }, 6000);
    return () => clearTimeout(timer);
  }, [phase]);

  // After "the AI is busy, wait N seconds", the "Try AI again" button appears once the wait is over.
  useEffect(() => {
    if (phase !== "ready" || !view.retryAfter || retryReady) return;
    const timer = setTimeout(() => setRetryReady(true), view.retryAfter * 1000);
    return () => clearTimeout(timer);
  }, [phase, view, retryReady]);

  const showPlan = (steps, nextView, announce) => {
    setPlan(steps);
    setView(nextView);
    setRetryReady(!nextView.retryAfter);
    setSlow(false);
    setStatus(announce || `Plan ready, ${steps.length} ${steps.length === 1 ? "step" : "steps"}. Nothing will run.`);
    setPhase("ready");
  };
  // `sent` is true when the text DID go to the AI service first (it failed, was slow, or was abandoned). Then the card must not
  // say "No AI was used". It stays false when the text never left: AI off, switch off, offline, or refused before sending.
  const showKeyword = (task, notice, { canRetry = false, retryAfter, sent = false } = {}) =>
    showPlan(planFor(task, []), { source: "keyword", notice, canRetry, retryAfter, sent }, notice);

  async function preview() {
    const task = text.trim();
    if (!task) { setInputError("empty"); taRef.current?.focus(); return; }
    if (writing) return;
    const mine = ++requestId.current;
    setInputError(null);
    setSaveState({ status: "idle" });

    // Not using the AI: switch off, no key, or today's plans used up. The text stays in this browser.
    if (!aiOn) { showKeyword(task, ai.enabled && dayNotice ? dayNotice : null); return; }
    if (navigator.onLine === false) { showKeyword(task, OFFLINE); return; }

    setPhase("writing"); setSlow(false); setStatus(WRITING);
    let result;
    try {
      result = await previewPlan({ prompt: task });
    } catch (problem) {
      unstable_rethrow(problem); // signed out: the server redirects to /login
      if (mine !== requestId.current) return;
      showKeyword(task, navigator.onLine === false ? OFFLINE : UNREACHABLE, { canRetry: true, sent: true }); // we cannot tell if it left, so claim nothing
      return;
    }
    if (mine !== requestId.current) return; // the person pressed Start over, Edit or "Show keyword preview instead"

    if (result?.error) {
      setPhase("idle"); setStatus("");
      setInputError(result.error === "empty" || result.error === "too_long" ? result.error : "other");
      taRef.current?.focus();
      return;
    }
    if (typeof result?.remaining === "number") setRemaining(result.remaining);
    if (result?.source === "ai" && Array.isArray(result.steps) && result.steps.length > 0) {
      showPlan(result.steps.map((step) => [step.icon, step.title, step.detail]), { source: "ai" });
      return;
    }
    if (result?.why === "limit_day") setDayNotice(result.notice);
    // why === "off" means the server has no key after all: show the plain keyword preview, no notice.
    showKeyword(task, result?.why === "off" ? null : (result?.notice ?? UNREACHABLE), {
      canRetry: Boolean(result?.canRetry), retryAfter: result?.retryAfter, sent: !NOT_SENT.includes(result?.why),
    });
  }

  // "Show keyword preview instead" (the AI is slow): forget the waiting call and use the keyword plan right now.
  const showKeywordInstead = () => { requestId.current += 1; showKeyword(text.trim(), null, { sent: true }); taRef.current?.focus(); };
  const retry = () => { taRef.current?.focus(); preview(); };

  // Sends only text to the server: the request and the steps shown on screen. Nothing is executed anywhere.
  // The box text is always the text the plan was made from, because editing the box throws the plan away (see edit()).
  function save() {
    startSaving(async () => {
      const steps = plan.map(([icon, title, detail]) => ({ icon, title, detail }));
      try {
        const result = await saveDraft({ prompt: text.trim(), plan: JSON.stringify(steps) });
        setSaveState(result.ok ? { status: "saved" } : { status: "error", message: result.error });
      } catch (problem) {
        unstable_rethrow(problem); // signed out: the server redirects to /login
        setSaveState({ status: "error", message: SAVE_FAILED });
      }
    });
  }
  // Typing in the box after a preview clears that preview: the plan on screen would no longer match the words,
  // and Save must never save words that differ from the box. Press the arrow again to preview the new text.
  const edit = (event) => {
    setText(event.target.value);
    setInputError(null);
    if (phase !== "idle") reset(false);
  };

  // The line under the box that says, truthfully, where the text goes.
  let note;
  if (ai.pending) note = null;
  else if (!ai.enabled) note = { icon: "Info", text: "AI planning is off. Plans are matched on keywords, and your text is not sent to an AI service." };
  else if (dayNotice) note = { icon: "Info", text: `You have used your ${ai.limit} AI plans for today. They reset at midnight UTC. The keyword preview still works.` };
  else if (aiChoice) note = { icon: "Sparkles", text: "AI planning is on. Your text is sent to Groq to write the plan." };
  else note = { icon: "Info", text: "Keyword preview. Your text is not sent to an AI service." };

  const nearLimit = text.length >= LIMITS.promptMax * 0.9;
  const heading = view.source === "ai" ? "Plan written by AI. Nothing will run." : view.source === "saved" ? "Saved plan. Nothing will run." : "Keyword preview. Nothing will run.";
  const subheading = view.source === "ai" ? "AI can get things wrong. Read each step before you save." : view.source === "keyword" ? (view.sent ? "Matched on keywords in your text." : "Matched on keywords in your text. No AI was used.") : null;
  const cardLook = view.source === "ai" ? "bg-surface bg-linear-to-b from-accent-subtle to-surface to-50%" : "bg-surface"; // the one use of the soft purple wash

  return (
    <div>
      <p role="status" className="sr-only">{status}</p>

      <div className="field-focus rounded-3xl border border-field bg-surface p-4 shadow-sm">
        <label htmlFor="task" className="sr-only">Describe the work you want off your plate</label>
        <textarea
          id="task" ref={taRef} rows={3} value={text} readOnly={writing} maxLength={LIMITS.promptMax}
          onChange={edit}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); preview(); } }}
          aria-describedby="ai-note" aria-invalid={inputError ? true : undefined}
          placeholder="e.g. Every Monday, remind clients with unpaid invoices"
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-hidden placeholder:text-hint"
        />
        <div className="mt-1 flex items-center justify-between gap-3">
          {ai.enabled ? (
            <div className="flex min-h-11 items-center gap-2 md:min-h-9">
              <Switch id="ai-switch" checked={aiOn} disabled={Boolean(dayNotice)} onChange={saveAiChoice} />
              <label htmlFor="ai-switch" className="text-sm">Write with AI</label>
            </div>
          ) : <span />}
          <button
            type="button" onClick={preview} aria-disabled={writing || undefined} aria-label="Preview plan"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-accent text-on-accent transition-colors duration-120 ease-standard hover:bg-accent-hover active:bg-accent-active aria-disabled:opacity-50 md:h-9 md:w-9"
          >
            <Icon name={writing ? "Loader2" : "ArrowUp"} className={writing ? "hw-spin" : ""} />
          </button>
        </div>
      </div>

      {inputError && (
        <p role="alert" className="mt-2 flex items-start gap-2 px-1 text-sm">
          <Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{INPUT_ERROR[inputError]}
        </p>
      )}

      <div id="ai-note" className="mt-2 space-y-1 px-1 text-sm text-mute">
        <p>A plan is only something to read. Nothing runs. Do not put passwords or card numbers in a task.</p>
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          {note ? <p className="flex min-w-0 items-start gap-2"><Icon name={note.icon} className="mt-0.5 shrink-0" />{note.text}</p> : <p className="min-h-5" aria-hidden="true" />}
          <span className="ml-auto text-right">
            {typeof remaining === "number" && ai.enabled && !dayNotice && <span className="block">{remaining} of {ai.limit} AI plans left today</span>}
            {nearLimit && <span className="block">{text.length >= LIMITS.promptMax ? "Limit reached. Shorten your text to add more." : `${text.length} of ${LIMITS.promptMax} characters`}</span>}
          </span>
        </div>
      </div>

      {phase === "writing" && (
        <motion.div
          className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm" aria-busy="true"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }}
        >
          <div className="flex items-center gap-2 px-2 text-sm text-mute"><Icon name="Loader2" className="hw-spin" />{WRITING}</div>
          <div aria-hidden="true" className="mt-3 space-y-2 px-2">
            {[0, 1, 2].map((row) => <div key={row} className="h-[52px] rounded-xl bg-raised" />)}
          </div>
          {slow && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-2 pt-3 text-sm">
              <p>{SLOW}</p>
              <Btn size="sm" variant="ghost" onClick={showKeywordInstead}>Show keyword preview instead</Btn>
            </div>
          )}
        </motion.div>
      )}

      {phase === "ready" && (
        <motion.div
          className={`mt-4 rounded-2xl border border-line p-4 shadow-sm ${cardLook}`}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }}
        >
          {view.notice && (
            <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl bg-raised px-3 py-2 text-sm">
              <div className="flex min-w-0 flex-1 basis-60 items-start gap-2">
                <Icon name="Info" className="mt-0.5 shrink-0 text-info" />
                <p className="min-w-0">{view.notice}</p>
              </div>
              {view.canRetry && retryReady && <Btn size="sm" variant="ghost" icon="RotateCcw" onClick={retry}>Try AI again</Btn>}
            </div>
          )}
          <h2 ref={planHeadingRef} tabIndex={-1} className="flex items-center gap-2 px-2 text-sm font-medium outline-offset-4">
            <Icon name="Workflow" className="text-accent-text" />{heading}
          </h2>
          {subheading && <p className="mt-1 px-2 text-sm text-mute">{subheading}</p>}
          <ol className="mt-2 space-y-1">
            {plan.map(([icon, title, detail], index) => (
              <StepRow key={title + index} delay={index * 0.04} icon={icon} title={`${index + 1}. ${title}`} sub={detail} />
            ))}
          </ol>
          {view.source === "ai" && <p className="mt-3 px-2 text-sm text-mute">Written by an AI model run by Groq. Read each step before you rely on it.</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line px-2 pt-4">
            {saveState.status !== "saved" && (
              <Btn size="sm" icon="Save" loading={saving} onClick={save} className="w-full sm:w-auto">{saving ? "Saving..." : saveState.status === "error" ? "Try again" : "Save as draft"}</Btn>
            )}
            <Btn size="sm" variant="secondary" icon="Pencil" onClick={() => { reset(false); taRef.current?.focus(); }}>Edit request</Btn>
            <Btn size="sm" variant="ghost" icon="RotateCcw" onClick={() => { reset(true); taRef.current?.focus(); }}>Start over</Btn>
            <p role="status" className="w-full text-sm text-mute">
              {saveState.status === "saved" ? (
                <span className="flex flex-wrap items-center gap-x-2"><Icon name="CircleCheck" className="shrink-0 text-success" />Saved to your drafts. It will not run. <a href="#drafts-heading">See your drafts</a></span>
              ) : "Not saved yet."}
            </p>
            {saveState.status === "error" && <p role="alert" className="flex w-full items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{saveState.message}</p>}
          </div>
        </motion.div>
      )}
    </div>
  );
}
