"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { motion } from "motion/react";
import { Btn, EASE, StepRow } from "../ui";
import { Icon } from "../icons";
import { planFor } from "../AgentBox";
import { saveDraft } from "@/lib/actions/drafts";
import { LIMITS } from "@/lib/validate";

const SAVE_FAILED = "Could not save your draft. Check your connection and try again.";

// The workspace's request box. Same look as the landing page's agent box, minus the pretend extras
// (Search / Deep research / Reason chips, Attach files). The plan is made by simple keyword matching in the browser:
// no AI is called and nothing runs. `seed` is how the cards, recipe tiles and saved drafts put text into the box:
// { id, text, plan? } where id goes up with every click so the same tile can be clicked twice.
export default function Composer({ seed }) {
  const [text, setText] = useState("");
  const [phase, setPhase] = useState("idle"); // idle -> thinking -> plan (steps appear one by one) -> ready
  const [plan, setPlan] = useState([]); // steps as [icon, title, detail]
  const [shown, setShown] = useState(0);
  const [handledSeed, setHandledSeed] = useState(0);
  const [saveState, setSaveState] = useState({ status: "idle" }); // idle | saved | error
  const [saving, startSaving] = useTransition();
  const taRef = useRef(null);
  const planHeadingRef = useRef(null);

  // A new seed arrived: put its text (and saved plan, if it has one) in place. Done while rendering, which is the
  // React-approved way to reset state when a prop changes.
  if (seed && seed.id !== handledSeed) {
    setHandledSeed(seed.id);
    setText(seed.text);
    setSaveState(seed.plan ? { status: "saved" } : { status: "idle" }); // an opened draft is already saved
    if (seed.plan) {
      setPlan(seed.plan.map((step) => [step.icon, step.title, step.detail]));
      setShown(seed.plan.length);
      setPhase("ready");
    } else {
      setPlan([]);
      setShown(0);
      setPhase("idle");
    }
  }

  // After a seed: draft with a plan -> focus the plan heading; text only -> focus the box with the cursor at the end.
  const seedId = seed?.id;
  const seedHasPlan = Boolean(seed?.plan);
  useEffect(() => {
    if (!seedId) return;
    if (seedHasPlan) {
      planHeadingRef.current?.focus();
    } else if (taRef.current) {
      taRef.current.focus();
      taRef.current.setSelectionRange(taRef.current.value.length, taRef.current.value.length);
      taRef.current.scrollIntoView({ block: "center" });
    }
  }, [seedId, seedHasPlan]);

  // The sidebar's "New workflow" button announces itself with this event: clear the box and focus it.
  useEffect(() => {
    const onNew = () => {
      setPhase("idle"); setPlan([]); setShown(0); setText("");
      taRef.current?.focus();
    };
    window.addEventListener("hw:new-workflow", onNew);
    return () => window.removeEventListener("hw:new-workflow", onNew);
  }, []);

  // "Reading your request" lasts a moment, then the steps are revealed one at a time, then the plan is ready.
  useEffect(() => {
    if (phase !== "thinking") return;
    const timer = setTimeout(() => setPhase("plan"), 700);
    return () => clearTimeout(timer);
  }, [phase]);
  useEffect(() => {
    if (phase !== "plan") return;
    if (shown >= plan.length) {
      const timer = setTimeout(() => setPhase("ready"), 400);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setShown((count) => count + 1), 650);
    return () => clearTimeout(timer);
  }, [phase, shown, plan]);

  const busy = phase === "thinking" || phase === "plan";
  const preview = () => {
    const task = text.trim();
    if (!task) { taRef.current?.focus(); return; }
    setPlan(planFor(task, []));
    setSaveState({ status: "idle" });
    setShown(0);
    setPhase("thinking");
  };

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
    if (phase !== "idle") { setPhase("idle"); setPlan([]); setShown(0); setSaveState({ status: "idle" }); }
  };
  const startOver = () => { setPhase("idle"); setPlan([]); setShown(0); setText(""); taRef.current?.focus(); };

  return (
    <div>
      <div className="rounded-2xl border border-field bg-surface p-4 transition-shadow focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25">
        <label htmlFor="task" className="sr-only">Describe the work you want off your plate</label>
        <textarea
          id="task" ref={taRef} rows={3} value={text} disabled={busy} maxLength={LIMITS.promptMax}
          onChange={edit}
          onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); preview(); } }}
          placeholder="e.g. Every Monday, remind clients with unpaid invoices"
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-hidden placeholder:text-hint disabled:opacity-60"
        />
        <div className="mt-1 flex justify-end">
          <motion.button
            type="button" onClick={preview} disabled={busy} aria-label="Preview plan"
            whileTap={{ scale: 0.92 }} transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="grid h-11 w-11 place-items-center rounded-xl bg-accent text-white transition-colors hover:bg-accent/90 disabled:opacity-50 md:h-9 md:w-9"
          >
            <Icon name={busy ? "Loader2" : "ArrowUp"} className={busy ? "hw-spin" : ""} />
          </motion.button>
        </div>
      </div>
      <p className="mt-2 px-1 text-sm text-mute">This is a preview. It drafts a plan and sends nothing. Do not put passwords or card numbers in a task.</p>

      {phase !== "idle" && (
        <motion.div
          className="mt-4 rounded-2xl border border-line bg-surface p-4" aria-live="polite"
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
        >
          {phase === "thinking" ? (
            <div className="flex items-center gap-2 px-2 text-sm text-mute">
              <Icon name="Loader2" className="hw-spin" />Reading your request<span className="hw-caret ml-0.5 inline-block h-4 w-0.5 translate-y-0.5 bg-current" aria-hidden="true"></span>
            </div>
          ) : (
            <h2 ref={planHeadingRef} tabIndex={-1} className="flex items-center gap-2 px-2 text-sm font-medium outline-offset-4">
              <Icon name="Workflow" className="text-accent-text" />Preview plan. Nothing will run.
            </h2>
          )}
          <ol className="mt-2 space-y-0.5">
            {plan.slice(0, shown).map(([icon, title, detail], index) => (
              <StepRow key={title + index} delay={0} icon={icon} title={`${index + 1}. ${title}`} sub={detail}
                right={<motion.span className="shrink-0 text-accent-text" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 22, delay: 0.15 }}><Icon name="Check" size={16} /></motion.span>} />
            ))}
          </ol>
          {phase === "ready" && (
            <motion.div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line px-2 pt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
              {saveState.status !== "saved" && (
                <Btn size="sm" icon="Save" loading={saving} onClick={save}>{saving ? "Saving..." : saveState.status === "error" ? "Try again" : "Save as draft"}</Btn>
              )}
              <Btn size="sm" variant="secondary" icon="Pencil" onClick={() => { setPhase("idle"); setPlan([]); setShown(0); taRef.current?.focus(); }}>Edit request</Btn>
              <Btn size="sm" variant="ghost" icon="RotateCcw" onClick={startOver}>Start over</Btn>
              <p role="status" className="w-full text-sm text-mute">
                {saveState.status === "saved" ? (
                  <span className="flex flex-wrap items-center gap-x-2"><Icon name="CircleCheck" className="shrink-0 text-accent-text" />Saved to your drafts. It will not run. <a href="#drafts-heading">See your drafts</a></span>
                ) : "Not saved yet."}
              </p>
              {saveState.status === "error" && <p role="alert" className="flex w-full items-start gap-1.5 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-accent-text" />{saveState.message}</p>}
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
