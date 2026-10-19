"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { unstable_rethrow } from "next/navigation";
import { Btn } from "../ui";
import { Icon } from "../icons";
import useWarnBeforeLeaving from "../useWarnBeforeLeaving";
import StepEditor, { ADD_ID, fieldId, firstPart, newRow, problemPart, toWorking } from "./StepEditor";
import { saveDraft, updateDraft, renameDraft } from "@/lib/actions/drafts";
import { LIMITS, checkSteps, cleanName, sameSteps } from "@/lib/validate";
import { NOTE, STEP_KINDS, STEP_KIND_ORDER, stepsToPlan } from "@/lib/steps";
import { DRAG_KIND } from "@/lib/step-rows";

// The Builder: build a workflow by hand from a palette of step kinds. It reuses the step editor (the same rows, the same
// checks) and adds a name, a palette and Save. It saves the same kind of draft as the workspace does, and it still runs
// nothing: a workflow here is only a plan.
//
// `initial` comes from the server (lib/builder-start.js):
//   { start: "new" }  { start: "template", name, prompt, steps }  { start: "draft", draft: { id, name, prompt, version }, steps }
// Saving a NEW workflow makes a draft; saving an opened draft changes it in place (the version check is the same one the
// workspace uses: if it was changed somewhere else, nothing is overwritten and "Load latest" brings the saved copy in).

const PALETTE = [
  { kind: NOTE, label: "Free text", help: "Your own words.", icon: "FileText" },
  ...STEP_KIND_ORDER.map((kind) => ({ kind, label: STEP_KINDS[kind].label, help: STEP_KINDS[kind].help, icon: STEP_KINDS[kind].icon })),
];

const FAILED = "Could not save. Check your connection and try again.";
const inputClass = "mt-1 h-11 w-full rounded-xl border bg-surface px-3 text-[15px] placeholder:text-hint focus-visible:border-accent read-only:opacity-90";

export default function Builder({ initial }) {
  const startSteps = initial.steps ?? [];
  const [name, setName] = useState(initial.draft?.name ?? initial.name ?? "");
  const [about, setAbout] = useState(initial.draft?.prompt ?? initial.prompt ?? "");
  const [working, setWorking] = useState(() => toWorking(stepsToPlan(startSteps)));
  const [draft, setDraft] = useState(initial.draft ? { id: initial.draft.id, version: initial.draft.version } : null);
  // What is saved right now (null until the first save): used to tell whether anything would be lost by leaving.
  const [saved, setSaved] = useState(initial.draft ? { name: initial.draft.name, steps: startSteps } : null);
  const [showErrors, setShowErrors] = useState(false);
  const [message, setMessage] = useState(null); // { kind: "ok" | "error" | "conflict" | "gone", text, latest? }
  const [status, setStatus] = useState(""); // what the one hidden live region says out loud
  const focusLater = useRef(null); // { key, part }: the control that should take the cursor once the next render is on screen
  const [saving, startSaving] = useTransition();

  const announce = useCallback((sentence) => {
    // The same sentence twice in a row would not be spoken again, so a non-breaking space makes it new.
    setStatus((previous) => (previous === sentence ? sentence + " " : sentence));
  }, []);

  const atMax = working.length >= LIMITS.planSteps;
  // Would anything be lost by leaving? The editor's rows are compared AFTER checking them (a typed step's title and detail are
  // worked out by the check), and a half-filled row counts as a change.
  const cleaned = checkSteps(working).value ?? null;
  const unsaved = saved
    ? name.trim() !== saved.name.trim() || !(cleaned && sameSteps(cleaned, saved.steps))
    : working.length > 0 || name.trim() !== "" || about.trim() !== "";
  useWarnBeforeLeaving(unsaved);

  // The cursor goes to the first control of a step that was just added from the palette. (Runs after every render and
  // does nothing unless `focusLater` was set: a ref, so no state is set inside the effect.)
  useEffect(() => {
    if (!focusLater.current) return;
    document.getElementById(fieldId(focusLater.current.key, focusLater.current.part))?.focus();
    focusLater.current = null;
  });

  function addKind(kind, label) {
    if (atMax) { announce(`A workflow can have up to ${LIMITS.planSteps} steps. Delete one to add another.`); return; }
    const row = newRow(kind);
    setWorking((rows) => [...rows, row]);
    focusLater.current = { key: row.key, part: firstPart(row) };
    setMessage(null);
    announce(`${label} step added as step ${working.length + 1} of ${LIMITS.planSteps}.`);
  }

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
      document.getElementById(row ? fieldId(row.key, problemPart(first.field)) : ADD_ID)?.focus();
      setShowErrors(true);
      const count = checked.problems.length;
      setMessage({ kind: "error", text: first.kind === "none" ? first.error : `Fix ${count} ${count === 1 ? "problem" : "problems"} before you save.` });
      return null;
    }
    return { name: checkedName.value, steps: checked.value };
  }

  function afterSave(nextDraft, nextName, steps, words) {
    setDraft(nextDraft);
    setSaved({ name: nextName, steps });
    setName(nextName);
    setMessage({ kind: "ok", text: words });
    announce(words);
    setShowErrors(false);
  }

  function save() {
    const ready = check();
    if (!ready) return;
    setMessage(null);
    announce("Saving.");
    startSaving(async () => {
      try {
        if (!draft) {
          const result = await saveDraft({ name: ready.name, prompt: about.trim() || ready.name, plan: JSON.stringify(ready.steps) });
          if (!result?.ok) { setMessage({ kind: "error", text: result?.error ?? FAILED }); return; }
          afterSave(result.id ? { id: result.id, version: result.version } : null, ready.name, ready.steps, "Saved as a draft. Nothing will be sent.");
          // The address now names the draft, so a reload (or a shared link to yourself) opens it again.
          if (result.id) window.history.replaceState(null, "", `/app/builder?draft=${result.id}`);
          return;
        }

        let version = draft.version;
        const planChanged = !sameSteps(ready.steps, saved.steps);
        if (planChanged) {
          const result = await updateDraft({ id: draft.id, version, plan: JSON.stringify(ready.steps) });
          if (!result?.ok) {
            const kind = result?.why === "changed" ? "conflict" : result?.why === "gone" ? "gone" : "error";
            setMessage({ kind, text: result?.error ?? FAILED, latest: result?.latest });
            return;
          }
          version = result.version;
        }
        if (ready.name !== saved.name.trim()) {
          const renamed = await renameDraft({ id: draft.id, name: ready.name });
          if (!renamed?.ok) { setMessage({ kind: renamed?.error === "That draft no longer exists." ? "gone" : "error", text: renamed?.error ?? FAILED }); return; }
          version = renamed.version ?? version;
        }
        afterSave({ id: draft.id, version }, ready.name, ready.steps, "Saved. Nothing will be sent.");
      } catch (problem) {
        unstable_rethrow(problem); // signed out: the server redirects to /login
        setMessage({ kind: "error", text: FAILED });
      }
    });
  }

  // The draft was deleted elsewhere: keep the work by saving it as a new draft.
  function saveAsNew() {
    const ready = check();
    if (!ready) return;
    setMessage(null);
    startSaving(async () => {
      try {
        const result = await saveDraft({ name: ready.name, prompt: about.trim() || ready.name, plan: JSON.stringify(ready.steps) });
        if (!result?.ok) { setMessage({ kind: "error", text: result?.error ?? FAILED }); return; }
        afterSave(result.id ? { id: result.id, version: result.version } : null, ready.name, ready.steps, "Saved as a new draft. Nothing will be sent.");
        if (result.id) window.history.replaceState(null, "", `/app/builder?draft=${result.id}`);
      } catch (problem) {
        unstable_rethrow(problem);
        setMessage({ kind: "error", text: FAILED });
      }
    });
  }

  // The draft was changed somewhere else: bring the saved copy in (this throws the typing on screen away, so it is a choice).
  function loadLatest() {
    const latest = message?.latest;
    if (!latest) return;
    const steps = latest.plan;
    setWorking(toWorking(stepsToPlan(steps)));
    setName(latest.name);
    setDraft({ id: draft.id, version: latest.version });
    setSaved({ name: latest.name, steps });
    setMessage({ kind: "ok", text: "Loaded the latest saved copy." });
    announce("Loaded the latest saved copy.");
    setShowErrors(false);
  }

  return (
    <div>
      <p role="status" className="sr-only">{status}</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="builder-name" className="text-sm font-medium">Workflow name</label>
          <input
            id="builder-name" value={name} onChange={(event) => setName(event.target.value)} readOnly={saving}
            placeholder="For example: Chase unpaid invoices"
            className={`${inputClass} ${message?.kind === "error" && !cleanName(name).value ? "border-error" : "border-field"}`}
          />
        </div>
        <div>
          <label htmlFor="builder-about" className="text-sm font-medium">What is it for?{draft ? "" : " (optional)"}</label>
          {draft ? (
            <p className="mt-1 flex min-h-11 items-center rounded-xl bg-raised px-3 text-[15px] text-mute">{about || "No description saved."}</p>
          ) : (
            <input id="builder-about" value={about} onChange={(event) => setAbout(event.target.value)} readOnly={saving} maxLength={LIMITS.promptMax} placeholder="One line about the job" className={`${inputClass} border-field`} />
          )}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
        <aside aria-labelledby="palette-heading" className="lg:sticky lg:top-6 lg:self-start">
          <h2 id="palette-heading" className="text-sm font-medium">Step kinds</h2>
          <p className="mt-1 text-sm text-mute">Drag a kind into the steps, or press it to add it at the end. This only describes the step.</p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {PALETTE.map((item) => (
              <li
                key={item.kind}
                // Dragging a card carries its kind (see StepEditor's drop code). Pressing the card still adds it at the end,
                // which is the way for keyboards and touch screens.
                draggable={!atMax && !saving}
                onDragStart={(event) => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData(DRAG_KIND, item.kind); }}
                className="cursor-grab active:cursor-grabbing"
              >
                <button
                  type="button" onClick={() => addKind(item.kind, item.label)} aria-disabled={atMax || saving || undefined}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl border border-line bg-surface p-2 text-left transition-[background-color,border-color] duration-120 ease-standard hover:border-line-strong hover:bg-raised active:bg-line aria-disabled:opacity-50"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-text"><Icon name={item.icon} size={18} /></span>
                  <span className="min-w-0 flex-1">
                    {/* The spoken name is "Add Free text Your own words.": the visible words, with "Add" in front. */}
                    <span className="block text-sm font-medium"><span className="sr-only">Add </span>{item.label}</span>
                    <span className="block text-sm text-mute">{item.help}</span>
                  </span>
                  <Icon name="Plus" size={16} className="shrink-0 text-mute" />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section aria-labelledby="builder-steps-heading" className="min-w-0">
          <div className="rounded-2xl border border-line bg-surface p-3 shadow-sm">
            <StepEditor
              steps={working} onChange={setWorking} announce={announce} showErrors={showErrors} busy={saving} focusOnOpen={false} dnd
              heading={<span id="builder-steps-heading">Steps</span>}
              subheading={draft ? "Changes are saved only when you choose Save changes." : "This workflow is not saved yet. Choose Save as draft when you are ready."}
            />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Btn icon="Save" loading={saving} onClick={save} className="w-full sm:w-auto">
              {saving ? "Saving..." : draft ? "Save changes" : "Save as draft"}
            </Btn>
            {message?.kind === "conflict" && <Btn variant="secondary" onClick={loadLatest} disabled={saving}>Load latest</Btn>}
            {message?.kind === "gone" && <Btn variant="secondary" onClick={saveAsNew} disabled={saving}>Save as new draft</Btn>}
            <p className="text-sm text-mute">{working.length} of {LIMITS.planSteps} steps</p>
          </div>
          {message && (
            <p className="mt-3 flex items-start gap-2 text-[15px]">
              <Icon name={message.kind === "ok" ? "CircleCheck" : "CircleAlert"} className={`mt-0.5 shrink-0 ${message.kind === "ok" ? "text-accent-text" : "text-error"}`} />{message.text}
            </p>
          )}
          {unsaved && <p className="mt-3 flex items-start gap-2 text-sm text-mute"><Icon name="Info" className="mt-0.5 shrink-0 text-info" />You have unsaved changes. Unsaved changes are lost if you leave this page.</p>}
        </section>
      </div>
    </div>
  );
}
