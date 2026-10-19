"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { motion } from "motion/react";
import { Btn, EASE, StepRow, Switch } from "../ui";
import { Icon } from "../icons";
import { planFor } from "../AgentBox";
import StepEditor, { ADD_ID, fieldId, problemPart, toWorking } from "./StepEditor";
import useWarnBeforeLeaving from "../useWarnBeforeLeaving";
import { saveDraft, updateDraft } from "@/lib/actions/drafts";
import { previewPlan } from "@/lib/actions/plan";
import { LIMITS, checkSteps, sameSteps } from "@/lib/validate";
import { planToSteps, stepsToPlan } from "@/lib/steps";
import { onlyNameMoved } from "@/lib/update-plan";

const SAVE_FAILED = "Could not save your draft. Check your connection and try again.";
const STEPS_FAILED = "Could not save your changes. Check your connection and try again.";
const STEPS_OFFLINE = "You are offline. Your changes are still here. Reconnect and try again.";

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

// The plan on screen is a list of [icon, title, detail, kind, fields] (kind and fields only for typed steps). The editor
// and the saving code use step objects. lib/steps.js converts between the two.
const asSteps = planToSteps;
const asPlan = stepsToPlan;

// The workspace's request box. `ai` says whether AI planning is available: { enabled, limit } from the server, which only
// ever sends "a key exists" and never the key. With AI off, or the switch off, the plan is made by simple keyword matching
// in the browser and the text goes nowhere. With AI on, the text goes to the server action `previewPlan`, which asks the
// AI to write the plan; if that fails, the keyword plan is shown with a plain sentence saying why. Either way a plan is
// only something to read: nothing runs.
//
// Steps can be edited by hand ("Edit steps") on a fresh preview and on a saved draft. A fresh preview is changed on this
// page only (Done), then saved with "Save as draft". A saved draft is changed in place ("Save changes"). Anything that
// would throw away unsaved step edits first goes through guard(), which asks "Discard changes / Keep editing".
//
// `seed` is how the cards, recipe tiles and saved drafts put text into the box: { id, text, plan?, draft? } where draft is
// { id, name, version } for a saved draft. `ref` gives Workspace the guard.
export default function Composer({ seed, ai = { enabled: false, limit: 0 }, ref }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState("idle"); // idle -> writing (waiting for the AI) -> ready
  const [plan, setPlan] = useState([]); // steps as [icon, title, detail]
  const [view, setView] = useState({ source: "keyword" }); // what the plan on screen is: { source: "ai" | "keyword" | "saved", generated, notice?, canRetry?, retryAfter?, sent? }
  const [retryReady, setRetryReady] = useState(true);
  const [slow, setSlow] = useState(false);
  const [status, setStatus] = useState(""); // the sentence the hidden live region says out loud
  const [inputError, setInputError] = useState(null); // empty | too_long | other
  const [remaining, setRemaining] = useState(null); // AI plans left today, once the server has said
  const [dayNotice, setDayNotice] = useState(null); // set when today's AI plans are used up
  const [handledSeed, setHandledSeed] = useState(0);
  const [saveState, setSaveState] = useState({ status: "idle" }); // idle | saved (updated: true after Save changes) | error
  const [draft, setDraft] = useState(null); // { id, name, version } when the plan on screen is a saved draft
  const [editing, setEditing] = useState(false); // is the step editor open?
  const [working, setWorking] = useState([]); // the editor's working copy: [{ key, icon, title, detail }]
  const [showErrors, setShowErrors] = useState(false); // after a failed Done: untouched empty titles show their error
  const [editError, setEditError] = useState(null); // { message, why, latest? } after a failed Done or Save changes
  const [asking, setAsking] = useState(null); // { run }: an action waiting for "Discard changes"
  const [saving, startSaving] = useTransition();
  const aiChoice = useSyncExternalStore(subscribeToAiChoice, readAiChoice, () => true);
  const taRef = useRef(null);
  const planHeadingRef = useRef(null);
  const cardRef = useRef(null);
  const keepRef = useRef(null); // the "Keep editing" button
  const editRef = useRef(null); // the "Edit steps" button
  const returnFocus = useRef(null); // what had the cursor before the "Discard changes" bar appeared
  const refocusEdit = useRef(false); // put the cursor back on "Edit steps" once the editor has closed
  const requestId = useRef(0); // goes up with every request and every reset, so an old answer can be ignored
  const latest = useRef(null); // the newest guard and reset, for the listener below

  const writing = phase === "writing";
  const aiOn = ai.enabled && aiChoice && !dayNotice; // will "Preview plan" call the AI?

  // What is on screen, in the editor's shape, and whether the person has changed it.
  const steps = asSteps(plan);
  const edited = phase === "ready" && Boolean(view.generated) && !sameSteps(steps, view.generated); // the label follows the content
  const editorChanged = editing && !sameSteps(working, steps);
  const editsUnsaved = edited && !draft && saveState.status !== "saved"; // an edited preview that is not a draft yet
  const unsaved = editorChanged || editsUnsaved; // work that would be lost
  const holding = editing || editsUnsaved; // the request box is locked so typing cannot throw the plan away
  useWarnBeforeLeaving(unsaved);

  const announce = useCallback((sentence) => {
    // The same sentence twice in a row would not be spoken again, so a non-breaking space is added to make it new.
    setStatus((previous) => (previous === sentence ? sentence + "\u00a0" : sentence));
  }, []);

  // If something would throw away unsaved step edits, ask first; otherwise just do it.
  function guard(run) {
    if (!unsaved) { run(); return; }
    returnFocus.current = document.activeElement;
    setAsking({ run });
  }
  useImperativeHandle(ref, () => ({ guard }));

  // A new seed arrived: put its text (and saved plan, if it has one) in place. Done while rendering, which is the
  // React-approved way to reset state when a prop changes.
  if (seed && seed.id !== handledSeed) {
    setHandledSeed(seed.id);
    setText(seed.text);
    setInputError(null);
    setSaveState(seed.plan ? { status: "saved" } : { status: "idle" }); // an opened draft is already saved
    setEditing(false); setWorking([]); setShowErrors(false); setEditError(null); setAsking(null);
    if (seed.plan) {
      setPlan(asPlan(seed.plan));
      setView({ source: "saved", generated: seed.plan });
      setDraft(seed.draft ?? null);
      setPhase("ready");
      setStatus("");
    } else {
      setPlan([]);
      setDraft(null);
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
    setDraft(null); setEditing(false); setWorking([]); setShowErrors(false); setEditError(null); setAsking(null);
    if (clearText) setText("");
  }, []);

  // The sidebar's "New workflow" button announces itself with this event: clear the box and focus it (after asking, if
  // there are unsaved step edits). `latest` always holds the newest guard, so the listener never goes stale.
  useEffect(() => { latest.current = { guard, reset }; });
  useEffect(() => {
    const onNew = () => latest.current.guard(() => { latest.current.reset(true); taRef.current?.focus(); });
    window.addEventListener("hw:new-workflow", onNew);
    return () => window.removeEventListener("hw:new-workflow", onNew);
  }, []);

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

  // The "Discard changes / Keep editing" bar: the cursor goes to the safe button and the card scrolls into view.
  useEffect(() => {
    if (!asking) return;
    keepRef.current?.focus();
    cardRef.current?.scrollIntoView({ block: "center" });
  }, [asking]);

  // After the editor closes, the cursor returns to "Edit steps" (once a save in flight is over: the button is disabled until then).
  useEffect(() => {
    if (editing || saving || !refocusEdit.current) return;
    refocusEdit.current = false;
    editRef.current?.focus();
  }, [editing, saving]);

  const showPlan = (planSteps, nextView, announcement) => {
    setPlan(planSteps);
    setView({ ...nextView, generated: asSteps(planSteps) });
    setDraft(null); setEditing(false); setWorking([]); setEditError(null);
    setRetryReady(!nextView.retryAfter);
    setSlow(false);
    setStatus(announcement || `Plan ready, ${planSteps.length} ${planSteps.length === 1 ? "step" : "steps"}. Nothing will be sent.`);
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
  const retry = () => guard(() => { taRef.current?.focus(); preview(); });

  // Sends only text to the server: the request and the steps shown on screen. Nothing is executed anywhere.
  // The box text is always the text the plan was made from, because editing the box throws the plan away (see edit()).
  // `mine` is the number of the screen this save started on. If the person opens something else while it is in flight
  // (the number goes up), the answer is dropped: the draft WAS saved, but the new screen must not be changed by it.
  function save() {
    const mine = requestId.current;
    startSaving(async () => {
      let result;
      try {
        result = await saveDraft({ prompt: text.trim(), plan: JSON.stringify(steps) });
      } catch (problem) {
        unstable_rethrow(problem); // signed out: the server redirects to /login
        if (mine !== requestId.current) return;
        setSaveState({ status: "error", message: SAVE_FAILED });
        return;
      }
      if (mine !== requestId.current) return;
      setSaveState(result.ok ? { status: "saved" } : { status: "error", message: result.error });
      // From now on this plan IS a draft: the next change updates it, it never saves a copy.
      if (result.ok && result.id) setDraft({ id: result.id, name: result.name, version: result.version });
    });
  }
  // Typing in the box after a preview clears that preview: the plan on screen would no longer match the words,
  // and Save must never save words that differ from the box. Press the arrow again to preview the new text.
  const edit = (event) => {
    setText(event.target.value);
    setInputError(null);
    if (phase !== "idle") reset(false);
  };

  // ---- Editing the steps ----

  function startEditing() {
    setWorking(toWorking(plan));
    setShowErrors(false); setEditError(null);
    setEditing(true);
    announce(`Editing steps. ${plan.length} ${plan.length === 1 ? "step" : "steps"}.`);
  }
  function closeEditor() {
    refocusEdit.current = true;
    setEditing(false); setWorking([]); setShowErrors(false); setEditError(null);
  }
  // Cancel: nothing to lose -> close at once; changes -> ask first.
  const cancelEditing = () => (editorChanged ? guard(closeEditor) : closeEditor());

  // Checks the working copy with the same rules the server uses. Returns the clean steps, or null after showing what to fix.
  function checkWorking() {
    const checked = checkSteps(working);
    if (!checked.error) return checked.value;
    const first = checked.problems[0];
    const row = working[first.index];
    document.getElementById(row ? fieldId(row.key, problemPart(first.field)) : ADD_ID)?.focus();
    setShowErrors(true);
    const count = checked.problems.length;
    setEditError({ message: first.kind === "none" ? first.error : `Fix ${count} ${count === 1 ? "problem" : "problems"} before you continue.`, why: "invalid" });
    return null;
  }

  // Done (a preview that is not a draft yet): the edited steps replace the plan on this page. Nothing is sent anywhere.
  function done() {
    const clean = checkWorking();
    if (!clean) return;
    if (sameSteps(clean, steps)) { closeEditor(); announce("No changes made."); return; }
    setPlan(asPlan(clean));
    closeEditor();
    announce("Steps updated. Not saved yet.");
  }

  // Save changes (a saved draft): the new steps replace the old ones in the same draft. Confirmed save: the editor stays
  // open, with the typing, until the server says yes. A late answer for a screen the person has left is dropped (see save()).
  function saveSteps() {
    const clean = checkWorking();
    if (!clean) return;
    if (navigator.onLine === false) { setEditError({ message: STEPS_OFFLINE, why: "offline" }); return; }
    setEditError(null);
    announce("Saving your changes.");
    const mine = requestId.current;
    const startedFrom = steps; // the saved steps this edit began from
    const send = (version) => updateDraft({ id: draft.id, version, plan: JSON.stringify(clean) });
    startSaving(async () => {
      let result;
      let adopted = null; // the newer saved copy, when the first answer was a false conflict
      try {
        result = await send(draft.version);
        if (mine !== requestId.current) return;
        // Only the name moved (a rename in the list also changes the draft's time): take the new version, save once more.
        if (onlyNameMoved(result, startedFrom)) {
          adopted = result.latest;
          result = await send(adopted.version);
          if (mine !== requestId.current) return;
        }
      } catch (problem) {
        unstable_rethrow(problem); // signed out: the server redirects to /login
        if (mine !== requestId.current) return;
        setEditError({ message: STEPS_FAILED, why: "failed" });
        return;
      }
      const current = adopted ? { ...draft, name: adopted.name, version: adopted.version } : draft;
      if (result?.ok) {
        setPlan(asPlan(clean));
        setDraft({ ...current, version: result.version });
        setSaveState({ status: "saved", updated: true });
        closeEditor();
        announce("Draft updated. It will not be sent.");
      } else {
        if (adopted) setDraft(current);
        const message = result?.why === "invalid" ? `${result.error} Check each step and try again.` : (result?.error ?? STEPS_FAILED);
        setEditError({ message, why: result?.why ?? "failed", latest: result?.latest });
      }
    });
  }

  // The draft was deleted elsewhere: keep the typed steps by saving them as a new draft.
  function saveAsNew() {
    const clean = checkWorking();
    if (!clean) return;
    setEditError(null);
    announce("Saving your changes.");
    const mine = requestId.current;
    startSaving(async () => {
      let result;
      try {
        result = await saveDraft({ prompt: text.trim(), plan: JSON.stringify(clean) });
      } catch (problem) {
        unstable_rethrow(problem);
        if (mine !== requestId.current) return;
        setEditError({ message: SAVE_FAILED, why: "failed" });
        return;
      }
      if (mine !== requestId.current) return;
      if (!result?.ok) { setEditError({ message: result?.error ?? SAVE_FAILED, why: "failed" }); return; }
      setPlan(asPlan(clean));
      setDraft(result.id ? { id: result.id, name: result.name, version: result.version } : null);
      setSaveState({ status: "saved" });
      closeEditor();
      announce("Saved to your drafts. It will not be sent.");
    });
  }

  // The draft was changed elsewhere: throw away the typing and show the steps that are saved now.
  function loadLatest() {
    const saved = editError?.latest;
    if (!saved) return;
    setPlan(asPlan(saved.plan));
    setDraft({ ...draft, name: saved.name, version: saved.version });
    setSaveState({ status: "saved" });
    closeEditor();
    announce("Loaded the latest saved steps.");
  }

  // The "Discard changes / Keep editing" bar.
  function keepEditing() {
    setAsking(null);
    returnFocus.current?.focus?.();
  }
  function discard() {
    const { run } = asking;
    setAsking(null);
    setEditing(false); setWorking([]); setShowErrors(false); setEditError(null);
    announce("Changes discarded.");
    run();
  }

  // The line under the box that says, truthfully, where the text goes.
  let note;
  if (ai.pending) note = null;
  else if (!ai.enabled) note = { icon: "Info", text: "AI planning is off. Plans are matched on keywords, and your text is not sent to an AI service." };
  else if (dayNotice) note = { icon: "Info", text: `You have used your ${ai.limit} AI plans for today. They reset at midnight UTC. The keyword preview still works.` };
  else if (aiChoice) note = { icon: "Sparkles", text: "AI planning is on. Your text is sent to Groq to write the plan." };
  else note = { icon: "Info", text: "Keyword preview. Your text is not sent to an AI service." };

  const nearLimit = text.length >= LIMITS.promptMax * 0.9;

  // What the card says. The heading follows the content: an edited preview stops saying it was written by the AI.
  let heading;
  let subheading = null;
  if (view.source === "saved") {
    heading = "Saved plan. Nothing will be sent.";
  } else if (edited) {
    heading = "Plan edited by you. Nothing will be sent.";
    subheading = view.source === "ai" ? "It started as a plan written by AI, and you changed it. Read each step before you save." : "It started as a keyword preview, and you changed it.";
  } else if (view.source === "ai") {
    heading = "Plan written by AI. Nothing will be sent.";
    subheading = "AI can get things wrong. Read each step before you save.";
  } else {
    heading = "Keyword preview. Nothing will be sent.";
    subheading = view.sent ? "Matched on keywords in your text." : "Matched on keywords in your text. No AI was used.";
  }
  const editingSubheading = draft ? `Draft: ${draft.name || "this draft"}. Changes are saved only when you choose Save changes.` : "Changes stay on this page until you choose Save as draft.";
  const cardLook = view.source === "ai" && !edited && !editing ? "bg-surface bg-linear-to-b from-accent-subtle to-surface to-50%" : "bg-surface"; // the one use of the soft purple wash
  const canEdit = saveState.status !== "saved" || Boolean(draft); // a saved plan with no known draft cannot be edited here (a second save would make a copy)
  const conflict = editError?.why === "changed";
  const draftGone = editError?.why === "gone";

  return (
    <div>
      <p role="status" className="sr-only">{status}</p>

      <div className="field-focus rounded-3xl border border-field bg-surface p-4 shadow-sm">
        <label htmlFor="task" className="sr-only">Describe the work you want off your plate</label>
        <textarea
          id="task" ref={taRef} rows={3} value={text} readOnly={writing || holding} maxLength={LIMITS.promptMax}
          onChange={edit}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); guard(preview); } }}
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
            type="button" onClick={() => guard(preview)} aria-disabled={writing || undefined} aria-label="Preview plan"
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
        {holding && (
          <p className="flex items-start gap-2">
            <Icon name="Info" className="mt-0.5 shrink-0" />
            {editing ? "You are editing the steps. Finish or cancel before you change the request." : "Your step edits are not saved yet. To change the request, choose Edit request."}
          </p>
        )}
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
          ref={cardRef}
          className={`mt-4 rounded-2xl border border-line p-4 shadow-sm ${cardLook}`}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }}
        >
          {asking && (
            <div
              role="group" aria-label="Unsaved changes" className="mb-3 rounded-xl bg-raised p-3 text-sm"
              onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); keepEditing(); } }}
            >
              <p id="discard-text" className="flex items-start gap-2"><Icon name="Info" className="mt-0.5 shrink-0 text-info" />You have unsaved changes to the steps. If you continue, they are lost.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn size="sm" variant="dark" onClick={discard}>Discard changes</Btn>
                <Btn size="sm" variant="secondary" ref={keepRef} aria-describedby="discard-text" onClick={keepEditing}>Keep editing</Btn>
              </div>
            </div>
          )}

          {editing ? (
            <motion.div key="editor" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>
              <StepEditor
                steps={working} onChange={setWorking} announce={announce} showErrors={showErrors} busy={saving}
                heading="Edit the steps. Nothing will be sent." subheading={editingSubheading}
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line px-2 pt-4">
                {!draft && <Btn size="sm" icon="Check" onClick={done} className="w-full sm:w-auto">Done</Btn>}
                {draft && draftGone && <Btn size="sm" icon="Save" loading={saving} onClick={saveAsNew} className="w-full sm:w-auto">{saving ? "Saving..." : "Save as new draft"}</Btn>}
                {draft && conflict && <Btn size="sm" icon="RotateCcw" onClick={loadLatest} className="w-full sm:w-auto">Load latest</Btn>}
                {draft && !draftGone && !conflict && (
                  <Btn size="sm" icon="Save" loading={saving} disabled={!editorChanged} onClick={saveSteps} className="w-full sm:w-auto">
                    {saving ? "Saving..." : editError && editError.why !== "invalid" ? "Try again" : "Save changes"}
                  </Btn>
                )}
                <Btn size="sm" variant="ghost" disabled={saving} onClick={cancelEditing}>Cancel</Btn>
                <p className="flex w-full items-center gap-2 text-sm text-mute">
                  {editorChanged ? <><Icon name="Info" className="shrink-0 text-info" />You have unsaved changes.</> : "No changes yet."}
                </p>
                {editorChanged && <p className="w-full text-sm text-mute">Unsaved changes are lost if you leave this page.</p>}
                {editError && (
                  <div role="alert" className="w-full text-sm">
                    <p className="flex items-start gap-2"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{editError.message}</p>
                    {draftGone && <p className="mt-1 pl-6 text-mute">It may have been deleted in another tab or window. You can save these steps as a new draft.</p>}
                  </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}>
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
              {view.source === "ai" && <p className="mt-3 px-2 text-sm text-mute">{edited ? "Some steps may still be written by an AI model run by Groq." : "Written by an AI model run by Groq."} Read each step before you rely on it.</p>}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line px-2 pt-4">
                {saveState.status !== "saved" && (
                  <Btn size="sm" icon="Save" loading={saving} onClick={save} className="w-full sm:w-auto">{saving ? "Saving..." : saveState.status === "error" ? "Try again" : "Save as draft"}</Btn>
                )}
                {canEdit && <Btn size="sm" variant="secondary" icon="ListChecks" ref={editRef} disabled={saving} title="Change the steps of this plan by hand" onClick={startEditing}>Edit steps</Btn>}
                <Btn size="sm" variant="secondary" icon="Pencil" title="Change the words in the box and make a new plan" onClick={() => guard(() => { reset(false); taRef.current?.focus(); })}>Edit request</Btn>
                <Btn size="sm" variant="ghost" icon="RotateCcw" onClick={() => guard(() => { reset(true); taRef.current?.focus(); })}>Start over</Btn>
                <p role="status" className="w-full text-sm text-mute">
                  {saveState.status === "saved" ? (
                    <span className="flex flex-wrap items-center gap-x-2"><Icon name="CircleCheck" className="shrink-0 text-success" />{saveState.updated ? "Draft updated." : "Saved to your drafts."} It will not be sent. <a href="#drafts-heading">See your drafts</a></span>
                  ) : "Not saved yet."}
                </p>
                {saveState.status === "error" && <p role="alert" className="flex w-full items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{saveState.message}</p>}
              </div>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
