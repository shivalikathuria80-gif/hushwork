"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Btn, EASE } from "../ui";
import { Icon } from "../icons";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { ICON_LABELS, ICON_NAMES } from "@/lib/ai/icon-names";
import { LIMITS, checkSteps, tidyText } from "@/lib/validate";

// The step editor: change the title, detail and icon of each step, add, delete and move steps. It edits a working copy
// held by its parent (`steps`), and tells the parent about every change through `onChange`. It never saves anything
// and nothing it edits ever runs. The parent decides when the copy is checked and used (Done or Save changes).
//
// A "working copy" is a list of rows: { key, icon, title, detail }. `key` is a private number that follows a row
// around, so when rows move, React keeps each text box with its own step.
//
// Props:
//   steps       the working copy
//   onChange    called with the whole new list after every edit
//   announce    says a sentence out loud to screen readers (the page has ONE hidden live region; this editor adds none)
//   showErrors  true after a failed "Done": then empty titles show their error even if the person never touched them
//   busy        true while saving: fields are read-only and buttons do nothing
//   heading, subheading   the words above the list (they differ for a preview and for a saved draft)

let counter = 0;
const newKey = () => ++counter;

// Turns a plan ([icon, title, detail] lists) into a working copy. An old icon name we no longer offer shows as Sparkles.
export function toWorking(plan) {
  return plan.map(([icon, title, detail]) => ({ key: newKey(), icon: ICON_NAMES.includes(icon) ? icon : "Sparkles", title, detail }));
}

// The id of one control of one step, so the parent (and our own focus code) can find it.
export const fieldId = (key, part) => `step-${key}-${part}`;
const panelId = (key) => `step-${key}-icons`;
export const ADD_ID = "step-editor-add";

const iconButton = "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-mute transition-colors duration-120 ease-standard hover:bg-raised hover:text-ink active:bg-line aria-disabled:opacity-50";
const inputBase = "h-11 w-full rounded-xl border bg-surface px-3 text-[15px] placeholder:text-hint focus-visible:border-accent read-only:opacity-90";
const COUNTER_FROM = 160; // the character counter appears from here

export default function StepEditor({ steps, onChange, announce, showErrors, busy, heading, subheading }) {
  const reduce = usePrefersReducedMotion();
  const [openIcon, setOpenIcon] = useState(null); // key of the step whose icon panel is open (only one at a time)
  const [touched, setTouched] = useState(() => new Set()); // keys of titles the person has already left
  const [undo, setUndo] = useState(null); // after a delete: { row, index }
  const focusLater = useRef(null); // the id to focus once the next render is on screen
  const [firstId] = useState(() => (steps[0] ? fieldId(steps[0].key, "title") : ADD_ID));
  const count = steps.length;
  const atMax = count >= LIMITS.planSteps;
  const problems = checkSteps(steps).problems ?? [];

  // Focus: on opening, the first title; after a move, add or delete, the control named in `focusLater`.
  // (React may re-create a moved row's HTML, which drops focus, so it is put back by id.)
  useEffect(() => { document.getElementById(firstId)?.focus(); }, [firstId]);
  useEffect(() => {
    if (!focusLater.current) return;
    document.getElementById(focusLater.current)?.focus();
    focusLater.current = null;
  });
  // Opening the icon panel moves focus to the chosen icon.
  useEffect(() => {
    if (!openIcon) return;
    const panel = document.getElementById(panelId(openIcon));
    (panel?.querySelector("input:checked") ?? panel?.querySelector("input"))?.focus();
  }, [openIcon]);

  // Every edit goes through here: it passes the new list up and forgets the "Undo" for a delete.
  const change = (next) => { setUndo(null); onChange(next); };
  const edit = (key, values) => change(steps.map((row) => (row.key === key ? { ...row, ...values } : row)));

  function add() {
    if (busy) return;
    if (atMax) { announce(`A plan can have up to ${LIMITS.planSteps} steps. Delete one to add another.`); return; }
    const row = { key: newKey(), icon: "Workflow", title: "", detail: "" };
    focusLater.current = fieldId(row.key, "title");
    change([...steps, row]);
    announce(`Step ${count + 1} added. ${count + 1} of ${LIMITS.planSteps} steps.`);
  }

  function move(index, by) {
    if (busy) return;
    const target = index + by;
    if (target < 0) { announce(`Step ${index + 1} is already first.`); return; }
    if (target >= count) { announce(`Step ${index + 1} is already last.`); return; }
    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    focusLater.current = fieldId(steps[index].key, by < 0 ? "up" : "down"); // the same button keeps the cursor
    change(next);
    announce(`Step ${index + 1} moved to position ${target + 1} of ${count}.`);
  }

  function remove(index) {
    if (busy) return;
    const next = steps.filter((_, at) => at !== index);
    const landing = next[index] ?? next[index - 1]; // the step now in this place, else the one before
    focusLater.current = landing ? fieldId(landing.key, "title") : ADD_ID;
    if (openIcon === steps[index].key) setOpenIcon(null); // an Undo must not bring a closed picker back open
    onChange(next);
    setUndo({ row: steps[index], index });
    announce(`Step ${index + 1} deleted. ${next.length} ${next.length === 1 ? "step" : "steps"} left. Undo is below the list.`);
  }

  function restore() {
    if (!undo || busy) return;
    const next = [...steps];
    next.splice(Math.min(undo.index, next.length), 0, undo.row);
    focusLater.current = fieldId(undo.row.key, "title");
    onChange(next);
    announce(`Step ${undo.index + 1} restored.`);
    setUndo(null);
  }

  const closePicker = (key) => { focusLater.current = fieldId(key, "icon"); setOpenIcon(null); };
  const leaveTitle = (key) => setTouched((seen) => new Set(seen).add(key));

  const exit = reduce
    ? { opacity: 0, transition: { duration: 0.12 } }
    : { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, borderTopWidth: 0, overflow: "hidden", transition: { duration: 0.2, ease: EASE } };

  return (
    <div role="group" aria-labelledby="step-editor-heading" aria-busy={busy || undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-2">
        <h2 id="step-editor-heading" className="flex items-center gap-2 text-sm font-medium">
          <Icon name="ListChecks" className="text-accent-text" />{heading}
        </h2>
        <p className="text-sm text-mute">{count} of {LIMITS.planSteps} steps</p>
      </div>
      <p className="mt-1 px-2 text-sm text-mute">{subheading}</p>

      {count === 0 && (
        <div className="mt-3 rounded-xl bg-raised px-3 py-3 text-sm">
          <p className="font-medium">This plan has no steps.</p>
          <p className="text-mute">Add a step to build it.</p>
        </div>
      )}

      <ol className="mt-3 px-2">
        <AnimatePresence initial={false}>
          {steps.map((row, index) => {
            const number = index + 1;
            const open = openIcon === row.key;
            const titleProblem = problems.find((p) => p.index === index && p.field === "title");
            const detailProblem = problems.find((p) => p.index === index && p.field === "detail");
            const titleEmpty = titleProblem?.kind === "empty" && (showErrors || touched.has(row.key));
            const titleLong = titleProblem?.kind === "long";
            const titleBad = titleEmpty || titleLong;
            const titleLength = tidyText(row.title).length;
            const detailLength = tidyText(row.detail).length;
            const iconLabel = ICON_LABELS[row.icon] ?? "Flow";
            const labelId = fieldId(row.key, "label");
            return (
              <motion.li
                key={row.key}
                layout={reduce ? false : "position"}
                initial={{ opacity: 0, y: reduce ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} exit={exit}
                transition={{ duration: 0.2, ease: EASE }}
                className="border-t border-line py-4 first:border-t-0 first:pt-0"
              >
                <div role="group" aria-labelledby={labelId}>
                  <div className="flex items-center gap-2">
                    <span id={labelId} className="grid h-7 min-w-7 shrink-0 place-items-center rounded-md bg-raised px-1 text-sm font-medium">
                      <span><span className="sr-only">Step </span>{number}</span>
                    </span>
                    <button
                      type="button" id={fieldId(row.key, "icon")} aria-label={`Icon for step ${number}: ${iconLabel}`}
                      aria-expanded={open} aria-controls={panelId(row.key)}
                      onClick={() => (open ? closePicker(row.key) : setOpenIcon(row.key))}
                      className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-xl border border-field bg-surface px-2 text-ink transition-colors duration-120 ease-standard hover:bg-raised active:bg-line sm:gap-2 sm:px-3"
                    >
                      <Icon name={row.icon} size={20} fallback="Workflow" className="text-accent-text" />
                      <span className="hidden text-sm sm:inline">{iconLabel}</span>
                      <Icon name="ChevronDown" size={14} className={`text-mute transition-transform duration-120 ${open ? "rotate-180" : ""}`} />
                    </button>
                    <span className="min-w-0 flex-1" />
                    <button type="button" id={fieldId(row.key, "up")} aria-label={`Move step ${number} up`} title={`Move step ${number} up`} aria-disabled={index === 0 || busy || undefined} onClick={() => move(index, -1)} className={iconButton}><Icon name="ArrowUp" size={18} /></button>
                    <button type="button" id={fieldId(row.key, "down")} aria-label={`Move step ${number} down`} title={`Move step ${number} down`} aria-disabled={index === count - 1 || busy || undefined} onClick={() => move(index, 1)} className={iconButton}><Icon name="ArrowDown" size={18} /></button>
                    <button type="button" id={fieldId(row.key, "delete")} aria-label={`Delete step ${number}`} title={`Delete step ${number}`} aria-disabled={busy || undefined} onClick={() => remove(index)} className={iconButton}><Icon name="Trash" size={18} /></button>
                  </div>

                  {open && (
                    <motion.div
                      id={panelId(row.key)} role="radiogroup" aria-label={`Icon for step ${number}`}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12 }}
                      onKeyDown={(event) => { if (event.key === "Escape" || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); closePicker(row.key); } }}
                      className="mt-3 grid max-h-72 grid-cols-3 gap-2 overflow-y-auto rounded-xl bg-sunken p-2 sm:max-h-none sm:grid-cols-8"
                    >
                      {ICON_NAMES.map((name) => {
                        const chosen = row.icon === name;
                        return (
                          <label
                            key={name}
                            className="relative flex min-h-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-line bg-surface px-1 py-2 text-center text-[13px] leading-tight transition-colors duration-120 ease-standard hover:bg-raised has-[:checked]:border-accent has-[:checked]:bg-[linear-gradient(var(--accent-subtle),var(--accent-subtle))] has-[:checked]:font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-focus has-[:focus-visible]:shadow-[var(--ring)]"
                          >
                            <input
                              type="radio" name={`icon-${row.key}`} value={name} checked={chosen} disabled={busy}
                              onChange={() => edit(row.key, { icon: name })}
                              onClick={(event) => { if (event.detail > 0) closePicker(row.key); }} // a mouse or touch click closes; arrow keys do not
                              className="sr-only"
                            />
                            <Icon name={name} size={20} className="text-accent-text" />
                            <span>{ICON_LABELS[name]}</span>
                            {chosen && <Icon name="Check" size={14} className="absolute right-1 top-1 text-accent-text" />}
                          </label>
                        );
                      })}
                    </motion.div>
                  )}

                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div>
                      <label htmlFor={fieldId(row.key, "title")} className="text-sm font-medium">Title<span className="sr-only"> of step {number}</span></label>
                      <input
                        id={fieldId(row.key, "title")} value={row.title} readOnly={busy} required
                        onChange={(event) => edit(row.key, { title: event.target.value })}
                        onBlur={() => leaveTitle(row.key)}
                        aria-invalid={titleBad || undefined} aria-describedby={titleBad || titleLength >= COUNTER_FROM ? fieldId(row.key, "title-note") : undefined}
                        placeholder="e.g. Ask you to approve"
                        className={`mt-1 ${inputBase} ${titleBad ? "border-error" : "border-field"}`}
                      />
                      <Note id={fieldId(row.key, "title-note")} length={titleLength} problem={titleEmpty ? { kind: "empty" } : titleLong ? titleProblem : null} reserve={titleProblem?.kind === "empty"} />
                    </div>
                    <div>
                      <label htmlFor={fieldId(row.key, "detail")} className="text-sm font-medium">Detail (optional)<span className="sr-only"> of step {number}</span></label>
                      <div className={`field-focus mt-1 rounded-xl border bg-surface ${detailProblem ? "border-error" : "border-field"}`}>
                        <textarea
                          id={fieldId(row.key, "detail")} rows={2} value={row.detail} readOnly={busy}
                          onChange={(event) => edit(row.key, { detail: event.target.value.replace(/\s*[\r\n]+\s*/g, " ") })} // a step is one paragraph: pasted line breaks become spaces
                          onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }}
                          aria-invalid={detailProblem ? true : undefined} aria-describedby={detailProblem || detailLength >= COUNTER_FROM ? fieldId(row.key, "detail-note") : undefined}
                          placeholder="e.g. Nothing is sent until you say yes"
                          className="block w-full resize-none bg-transparent px-3 py-2 text-[15px] leading-relaxed outline-hidden placeholder:text-hint read-only:opacity-90"
                        />
                      </div>
                      <Note id={fieldId(row.key, "detail-note")} length={detailLength} problem={detailProblem} />
                    </div>
                  </div>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      <div className="mt-1 space-y-3 px-2">
        {undo && (
          <p className="flex flex-wrap items-center gap-x-2 rounded-xl bg-raised px-3 py-1 text-sm">
            <span>Step {undo.index + 1} deleted.</span>
            <Btn size="sm" variant="ghost" onClick={restore}>Undo</Btn>
          </p>
        )}
        {atMax && (
          <p className="flex items-start gap-2 text-sm"><Icon name="Info" className="mt-0.5 shrink-0 text-info" />A plan can have up to {LIMITS.planSteps} steps. Delete one to add another.</p>
        )}
        <Btn id={ADD_ID} size="sm" variant="secondary" icon="Plus" aria-disabled={atMax || busy || undefined} onClick={add} className="aria-disabled:opacity-50">Add step</Btn>
        <p className="text-sm text-mute">Steps are saved as text. Do not put passwords or card numbers in them.</p>
      </div>
    </div>
  );
}

// The line under a field: the character counter (from 160), the limit message, or the empty-title message.
// `reserve` keeps the space of the empty-title message while it is not shown yet. Without it the message would appear when
// the title loses focus, push the buttons below it down, and a click on one of them (for example Add step) would be lost.
function Note({ id, length, problem, reserve }) {
  if (problem?.kind === "empty") {
    return <p id={id} className="mt-1 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />Give this step a title.</p>;
  }
  if (problem?.kind === "long") {
    return <p id={id} className="mt-1 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />Use {LIMITS.stepText} characters or fewer. Shorten it by {problem.over}.</p>;
  }
  if (reserve) return <p aria-hidden="true" className="mt-1 h-5" />;
  if (length < COUNTER_FROM) return null;
  return <p id={id} className="mt-1 text-sm text-mute">{length} of {LIMITS.stepText}{length >= LIMITS.stepText ? ". Limit reached." : ""}</p>;
}
