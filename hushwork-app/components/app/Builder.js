"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { unstable_rethrow, useRouter } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Btn } from "../ui";
import { Icon } from "../icons";
import useWarnBeforeLeaving from "../useWarnBeforeLeaving";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import StepEditor, { fieldId, firstPart, problemPart, toWorking } from "./StepEditor";
import StepStudioCard from "./StepStudioCard";
import FlowCanvas from "./builder/FlowCanvas";
import Copilot from "./builder/Copilot";
import Executions from "./builder/Executions";
import { pulse } from "./AppScene";
import { saveDraft, updateDraft, renameDraft } from "@/lib/actions/drafts";
import { syncScheduleFromStart } from "@/lib/actions/schedules";
import { startPracticeRun } from "@/lib/actions/runs";
import { LIMITS, checkSteps, cleanName, defaultName, sameSteps } from "@/lib/validate";
import { stepsToPlan } from "@/lib/steps";
import { planOnlyWarning } from "@/lib/run-engine";
import { isScheduledStart } from "@/lib/watch-rules";
import { insertRow, moveRow, newRow, newRowForBlock, rowsForEmailList, rowsForSkill, blockName } from "@/lib/step-rows";

// The Builder: a studio for one workflow. A copilot chat on the left (say what you want, apply the plan), the workflow drawn as a
// canvas of cards on the right (press + between two cards to add a block there, press a card to fill it in on the side panel),
// and a bar on top: Editor / Executions, Undo, Saved, Test and Publish. It saves the same kind of draft as the home page does,
// with the same checks (lib/validate.js), and nothing in it runs by itself: Test starts one practice run, where anything that
// sends or creates still waits for your Approve click on the Runs page.
//
// `initial` comes from the server (lib/builder-start.js):
//   { start: "new" }  { start: "template" | "skill", name, prompt, steps }  { start: "draft", draft: { id, name, prompt, version }, steps }
// `connections` (optional) says which apps are connected (lib/skills/connection-status.js): the side panel uses it to warn about a
// step whose app is missing. `runs` is this workflow's last runs (lib/builder-runs.js); `ai` is { enabled } (lib/ai-status.js); `ask` (from ?ask=, sent by
// Home) is a sentence Hushwork AI answers as soon as the page opens.
// Publishing a NEW workflow makes a draft; publishing an opened draft changes it in place (the version check is the same one the
// home page uses: if it was changed somewhere else, nothing is overwritten and "Load latest" brings the saved copy in).

const FAILED = "Could not save. Check your connection and try again.";
const HISTORY = 40; // how many Undo steps are kept

export default function Builder({ initial, connections, runs = [], ai = { enabled: false }, ask = "" }) {
  const router = useRouter();
  const reduce = usePrefersReducedMotion();
  const startSteps = initial.steps ?? [];
  const [name, setName] = useState(initial.draft?.name ?? initial.name ?? "");
  const [about, setAbout] = useState(initial.draft?.prompt ?? initial.prompt ?? "");
  const [working, setWorking] = useState(() => toWorking(stepsToPlan(startSteps)));
  const [history, setHistory] = useState([]); // earlier copies of `working`, newest last: what Undo brings back
  const [draft, setDraft] = useState(initial.draft ? { id: initial.draft.id, version: initial.draft.version } : null);
  // What is saved right now (null until the first save): used to tell whether anything would be lost by leaving.
  const [saved, setSaved] = useState(initial.draft ? { name: initial.draft.name, steps: startSteps } : null);
  const [showErrors, setShowErrors] = useState(false);
  const [message, setMessage] = useState(null); // { kind: "ok" | "error" | "conflict" | "gone", text, latest? }
  const [status, setStatus] = useState(""); // what the one hidden live region says out loud
  const [tab, setTab] = useState("editor"); // "editor" | "executions"
  const [selected, setSelected] = useState(null); // the key of the card open in the side panel
  const [flowing, setFlowing] = useState(false); // a test is starting: light runs down the lines
  const focusLater = useRef(null); // { key, part }: the control that should take the cursor once the next render is on screen
  const [saving, startSaving] = useTransition();

  const announce = useCallback((sentence) => {
    // The same sentence twice in a row would not be spoken again, so a non-breaking space makes it new.
    setStatus((previous) => (previous === sentence ? sentence + "\u00a0" : sentence));
  }, []);

  const atMax = working.length >= LIMITS.planSteps;
  // Would anything be lost by leaving? The editor's rows are compared AFTER checking them (a typed step's title and detail are
  // worked out by the check), and a half-filled row counts as a change.
  const checkedAll = checkSteps(working);
  const cleaned = checkedAll.value ?? null;
  const unsaved = saved
    ? name.trim() !== saved.name.trim() || !(cleaned && sameSteps(cleaned, saved.steps))
    : working.length > 0 || name.trim() !== "" || about.trim() !== "";
  useWarnBeforeLeaving(unsaved);
  // Cards with something to fix get a red edge, once a Publish has been tried.
  const problemKeys = new Set(showErrors ? (checkedAll.problems ?? []).map((one) => working[one.index]?.key).filter(Boolean) : []);
  const selectedIndex = working.findIndex((row) => row.key === selected);
  const selectedRow = selectedIndex >= 0 ? working[selectedIndex] : null;

  // The cursor goes to a control asked for in `focusLater` once it is on screen (a card just added, or the first problem).
  useEffect(() => {
    if (!focusLater.current) return;
    const el = document.getElementById(fieldId(focusLater.current.key, focusLater.current.part));
    if (el) { el.focus(); focusLater.current = null; }
  });

  // Every change to the steps goes through here, so Undo can bring the list back.
  const commit = useCallback((next) => {
    setWorking((current) => {
      const value = typeof next === "function" ? next(current) : next;
      if (value !== current) setHistory((past) => [...past.slice(-(HISTORY - 1)), current]);
      return value;
    });
    setMessage(null);
  }, []);

  const undo = useCallback(() => {
    if (!history.length || saving) return;
    const previous = history.at(-1);
    setHistory((past) => past.slice(0, -1));
    setWorking(previous);
    if (selected && !previous.some((row) => row.key === selected)) setSelected(null);
    announce("Undone.");
  }, [history, saving, selected, announce]);

  // Ctrl+Z / Cmd+Z undoes, unless the cursor is in a text box (there it undoes the typing, as always).
  useEffect(() => {
    const onKey = (event) => {
      if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== "z") return;
      if (event.target.closest?.("input, textarea, select, [contenteditable=true]")) return;
      event.preventDefault();
      undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  const full = (adding) => {
    if (working.length + adding <= LIMITS.planSteps) return false;
    announce(`A workflow can have up to ${LIMITS.planSteps} steps. Delete one to add another.`);
    return true;
  };

  function insertBlock(index, blockId) {
    if (full(1) || saving) return;
    const row = newRowForBlock(blockId);
    commit((rows) => insertRow(rows, row, index));
    setSelected(row.key);
    focusLater.current = { key: row.key, part: firstPart(row) };
    announce(`${blockName(row)} step added as step ${Math.min(index, working.length) + 1}.`);
  }
  const addBlock = (blockId) => insertBlock(working.length, blockId);

  // A skill from the panel: its step, and an "Ask me first" row ahead of it when it writes and nothing before it asks.
  function addSkill(skill) {
    const rows = rowsForSkill(skill, working);
    if (full(rows.length) || saving) return;
    commit((current) => [...current, ...rows]);
    setSelected(rows.at(-1).key);
    announce(`${skill.name} added${rows.length > 1 ? ", with an Ask me first step before it" : ""}.`);
  }
  // "Email several people": one email step for each typed address (see rowsForEmailList). Returns a problem sentence, or "".
  function addEmails(text) {
    const made = rowsForEmailList(text, working);
    if (made.error) return made.error;
    if (working.length + made.rows.length > LIMITS.planSteps) return `A workflow can have up to ${LIMITS.planSteps} steps. Delete some first.`;
    commit((current) => [...current, ...made.rows]);
    announce(`${made.rows.filter((row) => row.kind === "action").length} email steps added.`);
    return "";
  }
  // The copilot's plan replaces the steps (Undo brings the old ones back). Its rows get fresh keys so nothing clashes with the old ones.
  function applyPlan(rows, prompt) {
    const fresh = rows.map((row) => ({ ...row, key: newRow().key }));
    commit(fresh);
    setSelected(null);
    if (!name.trim()) setName(defaultName(prompt));
    if (!about.trim()) setAbout(prompt);
    setTab("editor");
    pulse("good");
    announce(`Plan applied: ${fresh.length} ${fresh.length === 1 ? "step" : "steps"} on the canvas.`);
  }
  function moveBy(key, by) {
    const from = working.findIndex((row) => row.key === key);
    const to = from + by;
    if (from < 0 || to < 0 || to >= working.length) return;
    commit((rows) => moveRow(rows, key, by > 0 ? to + 1 : to));
    announce(`Step ${from + 1} moved to position ${to + 1}.`);
  }
  function moveTo(key, index) {
    commit((rows) => moveRow(rows, key, index));
    announce("Step moved.");
  }
  function removeRow(key) {
    const index = working.findIndex((row) => row.key === key);
    if (index < 0) return;
    commit((rows) => rows.filter((row) => row.key !== key));
    if (selected === key) setSelected(null);
    announce(`Step ${index + 1} deleted. Undo is at the top.`);
  }
  // The side panel edits ONE row through the normal step editor. An empty list back means its delete button was pressed.
  function editSelected(next) {
    if (!selectedRow) return;
    if (next.length === 0) { removeRow(selectedRow.key); return; }
    const [row] = next;
    commit((rows) => rows.map((one) => (one.key === selectedRow.key ? row : one)));
  }
  const changeFields = (key, fields) => commit((rows) => rows.map((row) => (row.key === key ? { ...row, fields: { ...row.fields, ...fields } } : row)));

  // Checks everything the way the server will. Returns { name, steps } or null after showing what to fix.
  function check() {
    const checkedName = cleanName(name);
    const checked = checkSteps(working);
    if (checkedName.error) {
      setMessage({ kind: "error", text: checkedName.error });
      document.getElementById("builder-name")?.focus();
      return null;
    }
    if (checked.error) {
      const first = checked.problems[0];
      const row = working[first.index];
      setShowErrors(true);
      setTab("editor");
      if (row) { setSelected(row.key); focusLater.current = { key: row.key, part: problemPart(first.field) }; }
      const count = checked.problems.length;
      setMessage({ kind: "error", text: first.kind === "none" ? first.error : `Fix ${count} ${count === 1 ? "problem" : "problems"} before you publish.` });
      pulse("bad");
      return null;
    }
    return { name: checkedName.value, steps: checked.value };
  }

  // When the Start step says "On a schedule" (or "Keep watching"), saving also makes that schedule real (lib/schedule-sync.js). Returns a sentence to add to the
  // "Saved" message (empty when the Start step has nothing to do with a schedule).
  async function scheduleSentence(id, steps) {
    const start = steps[0];
    if (!id || !isScheduledStart(start)) return "";
    try {
      const result = await syncScheduleFromStart({ id, tzOffset: -new Date().getTimezoneOffset() });
      return result?.text ? ` ${result.text}` : "";
    } catch (problem) {
      unstable_rethrow(problem);
      return " The workflow was saved, but its schedule could not be checked. Set it on the home page.";
    }
  }

  function afterSave(nextDraft, nextName, steps, words) {
    setDraft(nextDraft);
    setSaved({ name: nextName, steps });
    setName(nextName);
    const warning = planOnlyWarning(steps); // steps that would run but do nothing: say so now, not after a run where "nothing came up"
    const text = warning ? `${words} ${warning}` : words;
    setMessage({ kind: "ok", text });
    announce(text);
    setShowErrors(false);
    pulse("good");
  }

  // Saves `ready` ({ name, steps } from check()). Returns the draft id, or null when it could not be saved (the message says why).
  async function persist(ready, asNew = false) {
    try {
      if (!draft || asNew) {
        const result = await saveDraft({ name: ready.name, prompt: about.trim() || ready.name, plan: JSON.stringify(ready.steps) });
        if (!result?.ok) { setMessage({ kind: "error", text: result?.error ?? FAILED }); return null; }
        const extra = await scheduleSentence(result.id, ready.steps);
        afterSave(result.id ? { id: result.id, version: result.version } : null, ready.name, ready.steps, extra ? `Published.${extra}` : "Published as a draft. Nothing will be sent until you run it.");
        // The address now names the draft, so a reload (or a shared link to yourself) opens it again.
        if (result.id) window.history.replaceState(null, "", `/app/builder?draft=${result.id}`);
        return result.id ?? null;
      }
      let version = draft.version;
      if (!sameSteps(ready.steps, saved.steps)) {
        const result = await updateDraft({ id: draft.id, version, plan: JSON.stringify(ready.steps) });
        if (!result?.ok) {
          const kind = result?.why === "changed" ? "conflict" : result?.why === "gone" ? "gone" : "error";
          setMessage({ kind, text: result?.error ?? FAILED, latest: result?.latest });
          return null;
        }
        version = result.version;
      }
      if (ready.name !== saved.name.trim()) {
        const renamed = await renameDraft({ id: draft.id, name: ready.name });
        if (!renamed?.ok) { setMessage({ kind: renamed?.error === "That draft no longer exists." ? "gone" : "error", text: renamed?.error ?? FAILED }); return null; }
        version = renamed.version ?? version;
      }
      const extra = await scheduleSentence(draft.id, ready.steps);
      afterSave({ id: draft.id, version }, ready.name, ready.steps, extra ? `Published.${extra}` : "Published. Nothing will be sent until you run it.");
      return draft.id;
    } catch (problem) {
      unstable_rethrow(problem); // signed out: the server redirects to /login
      setMessage({ kind: "error", text: FAILED });
      return null;
    }
  }

  function publish(asNew = false) {
    const ready = check();
    if (!ready) return;
    setMessage(null);
    announce("Publishing.");
    startSaving(async () => { await persist(ready, asNew); });
  }

  // Test: publish first when something changed, then one practice run, then the Runs page (where each real step waits for Approve).
  function test() {
    const needsSave = unsaved || !draft;
    const ready = needsSave ? check() : null;
    if (needsSave && !ready) return;
    setMessage(null);
    setFlowing(true);
    pulse("think");
    announce("Starting a test run.");
    startSaving(async () => {
      const id = needsSave ? await persist(ready) : draft.id;
      if (!id) { setFlowing(false); return; }
      try {
        const result = await startPracticeRun({ id, auto: false });
        if (result?.error) { setMessage({ kind: "error", text: result.error }); setFlowing(false); pulse("bad"); return; }
        router.push(`/app/runs?run=${result.runId}`);
      } catch (problem) {
        unstable_rethrow(problem);
        setMessage({ kind: "error", text: "Could not start the run. Try again." });
        setFlowing(false);
      }
    });
  }

  // The draft was changed somewhere else: bring the saved copy in (this throws the typing on screen away, so it is a choice).
  function loadLatest() {
    const latest = message?.latest;
    if (!latest) return;
    const steps = latest.plan;
    commit(toWorking(stepsToPlan(steps)).map((row) => ({ ...row, key: newRow().key })));
    setName(latest.name);
    setDraft({ id: draft.id, version: latest.version });
    setSaved({ name: latest.name, steps });
    setMessage({ kind: "ok", text: "Loaded the latest saved copy." });
    announce("Loaded the latest saved copy.");
    setShowErrors(false);
    setSelected(null);
  }

  const saveLabel = saving ? "Saving" : unsaved ? "Unsaved" : "Saved";

  return (
    <div className="flex min-h-dvh flex-1 flex-col lg:min-h-0">
      <p role="status" className="sr-only">{status}</p>

      {/* The bar on top: where you are, the two tabs, and what you can do. */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-line bg-bg/85 px-4 py-3 backdrop-blur-md sm:px-6">
        <div className="flex w-full min-w-0 items-center gap-2 text-[15px] sm:w-auto sm:flex-1">
          <Link href="/app#drafts" className="hidden shrink-0 items-center gap-1.5 text-mute hover:text-ink sm:inline-flex"><Icon name="Folder" size={18} />Workflows</Link>
          <span aria-hidden="true" className="hidden text-hint sm:inline">/</span>
          <label htmlFor="builder-name" className="sr-only">Name your workflow</label>
          <input
            id="builder-name" value={name} onChange={(event) => { setName(event.target.value); setMessage(null); }} readOnly={saving}
            placeholder="Name your workflow"
            className={`min-w-0 max-w-[22rem] flex-1 truncate rounded-lg border bg-transparent px-2 py-1 font-semibold tracking-[-0.01em] placeholder:font-normal placeholder:text-hint hover:border-line focus-visible:border-accent focus-visible:bg-surface ${message?.kind === "error" && !cleanName(name).value ? "border-error" : "border-transparent"}`}
          />
        </div>

        <LayoutGroup id="builder-tabs">
          <div role="tablist" aria-label="Builder view" className="order-last flex w-full rounded-xl border border-line bg-surface p-1 text-sm shadow-sm sm:order-none sm:w-auto">
            {[["editor", "Editor"], ["executions", "Executions"]].map(([id, label]) => (
              <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} onClick={() => setTab(id)} className="relative flex-1 rounded-lg px-4 py-1.5 font-medium text-mute transition-colors aria-selected:text-ink sm:flex-none">
                {tab === id && <motion.span layoutId="builder-tab" className="absolute inset-0 rounded-lg bg-raised" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="relative">{label}{id === "executions" && runs.length > 0 && <span className="ml-1.5 rounded-full bg-accent-subtle px-1.5 text-xs text-accent-text">{runs.length}</span>}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        <div className="flex items-center gap-2">
          <Btn variant="secondary" size="sm" icon="Undo" onClick={undo} disabled={!history.length || saving} title="Undo (Ctrl+Z)">Undo</Btn>
          <span className={`hidden h-9 items-center gap-1.5 rounded-xl border px-3 text-sm sm:inline-flex ${unsaved ? "border-line text-ink" : "border-line text-mute"}`} aria-live="polite">
            <Icon name={saving ? "Loader2" : unsaved ? "Pencil" : "Saved"} size={15} className={saving ? "hw-spin" : unsaved ? "text-warning" : "text-success"} />{saveLabel}
          </span>
          <Btn variant="secondary" size="sm" icon="Play" onClick={test} disabled={saving || working.length === 0}>Test</Btn>
          <Btn size="sm" onClick={() => publish()} loading={saving} disabled={saving}>{draft && !unsaved ? "Published" : draft ? "Publish changes" : "Publish"}</Btn>
        </div>
      </header>

      <AnimatePresence>
        {(message || (unsaved && history.length > 0 && !message)) && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="mx-4 mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface/95 px-3 py-2 text-[15px] shadow-sm backdrop-blur sm:mx-6"
          >
            {message ? (
              <>
                <Icon name={message.kind === "ok" ? "CircleCheck" : "CircleAlert"} className={`shrink-0 ${message.kind === "ok" ? "text-success" : "text-error"}`} />
                <span className="min-w-0 flex-1">{message.text}</span>
                {message.kind === "conflict" && <Btn size="sm" variant="secondary" onClick={loadLatest} disabled={saving}>Load latest</Btn>}
                {message.kind === "gone" && <Btn size="sm" variant="secondary" onClick={() => publish(true)} disabled={saving}>Save as new draft</Btn>}
              </>
            ) : (
              <><Icon name="Info" className="shrink-0 text-info" /><span className="min-w-0 flex-1 text-sm text-mute">You have unpublished changes. They are lost if you leave this page.</span></>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid min-h-0 flex-1 gap-4 p-4 sm:p-6 lg:grid-cols-[22rem_minmax(0,1fr)]">
        <Copilot initialAsk={ask} ai={ai} rowsCount={working.length} currentRows={working} busy={saving} connections={connections} onApply={applyPlan} onAddBlock={addBlock} onAddSkill={addSkill} onAddEmails={addEmails} />

        <section className="relative min-h-[36rem] overflow-hidden rounded-3xl border border-line bg-[color-mix(in_oklab,var(--bg)_72%,transparent)] lg:min-h-0" aria-label={tab === "editor" ? "Workflow canvas" : "Executions"}>
          {tab === "editor" ? (
            <div id="panel-editor" role="tabpanel" aria-labelledby="tab-editor" className="h-full">
              <FlowCanvas
                rows={working} problemKeys={problemKeys} selected={selected} busy={saving} flowing={flowing}
                onSelect={(key) => setSelected((now) => (now === key ? null : key))} onInsert={insertBlock} onMoveTo={moveTo} onMove={moveBy} onRemove={removeRow}
              />
              <AnimatePresence>
                {selectedRow && (
                  <motion.div
                    key="inspector"
                    initial={reduce ? false : { x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={reduce ? { opacity: 0 } : { x: 40, opacity: 0 }}
                    transition={{ type: "spring", stiffness: 420, damping: 38 }}
                    className="absolute inset-y-2 right-2 z-30 flex w-[min(25rem,calc(100%-1rem))] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl"
                  >
                    <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                      <p className="min-w-0 flex-1 truncate text-sm font-semibold">Step {selectedIndex + 1} · {blockName(selectedRow)}</p>
                      <button type="button" onClick={() => setSelected(null)} aria-label="Close the step panel" className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-raised hover:text-ink"><Icon name="X" size={18} /></button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-3">
                      <StepEditor
                        key={selectedRow.key} steps={[selectedRow]} onChange={editSelected} announce={announce} showErrors={showErrors} busy={saving}
                        focusOnOpen={false} simple single firstNumber={selectedIndex + 1}
                        heading="Fill in this step" subheading="Changes show on the canvas straight away. Publish when you are done."
                        renderExtra={(row) => (
                          <StepStudioCard
                            step={row} connections={connections} busy={saving}
                            onRemove={() => removeRow(row.key)} onChoose={(fields) => changeFields(row.key, fields)} onCheckAgain={() => router.refresh()}
                          />
                        )}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <div id="panel-executions" role="tabpanel" aria-labelledby="tab-executions" className="h-full">
              <Executions runs={runs} saved={Boolean(draft)} onTest={test} testing={saving} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
