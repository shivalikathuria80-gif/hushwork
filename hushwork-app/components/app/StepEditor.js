"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Btn, EASE } from "../ui";
import { Icon } from "../icons";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { ICON_LABELS, ICON_NAMES } from "@/lib/ai/icon-names";
import { LIMITS, checkSteps, tidyText } from "@/lib/validate";
import { NOTE, STEP_KINDS, STEP_KIND_ORDER, isTypedKind } from "@/lib/steps";
import { DRAG_KIND, DRAG_ROW, blockById, blockIdFor, blockName, insertRow, moveRow, newRow, newRowForBlock, parseDragKind, rowForKind, toWorking } from "@/lib/step-rows";

// The step editor: change the kind, title, detail and icon of each step, add, delete and move steps. A step is either free
// text (a title and a detail) or one of the typed kinds in lib/steps.js (named fields to fill in: for example "Send a
// message" has how, to whom and about). It edits a working copy held by its parent (`steps`), and tells the parent about
// every change through `onChange`. It never saves anything and nothing it edits ever runs. The parent decides when the
// copy is checked and used (Done or Save changes).
//
// A "working copy" is a list of rows: { key, icon, title, detail } for free text, plus { kind, fields } for a typed step.
// `key` is a private number that follows a row around, so when rows move, React keeps each text box with its own step.
//
// Props:
//   steps       the working copy
//   onChange    called with the whole new list after every edit
//   announce    says a sentence out loud to screen readers (the page has ONE hidden live region; this editor adds none)
//   showErrors  true after a failed "Done": then empty titles show their error even if the person never touched them
//   busy        true while saving: fields are read-only and buttons do nothing
//   heading, subheading   the words above the list (they differ for a preview and for a saved draft)
//   simple      true is the Builder's calm look: each step shows its name and only the blanks to fill in (no kind picker, no icon
//               picker, no "shown in the plan as" line, no Add step button: blocks are added from the Builder's list)
//   dnd         true turns on drag and drop (the Builder does): drag a step by its handle to move it, or drop a step kind
//               dragged from the palette into the list. The arrow and Add buttons always work too: dragging needs a mouse.

// The rows are built by lib/step-rows.js (pure code, tested). They are re-exported so the Composer and the Builder import them from here.
export { newRow, toWorking };

// The id of one control of one step, so the parent (and our own focus code) can find it.
export const fieldId = (key, part) => `step-${key}-${part}`;
// Which control of a step a problem belongs to, from the problem's `field` name (see checkSteps): "title", "detail",
// "kind", a typed field ("fields.to" -> the box with id part "f-to"), or anything else -> the icon button.
export const problemPart = (field) => {
  if (field === "title" || field === "detail" || field === "kind") return field;
  if (field === "fields") return "kind"; // the whole set of fields is unreadable: the kind picker is the way to start over
  return field.startsWith("fields.") ? `f-${field.slice(7)}` : "icon";
};
const panelId = (key) => `step-${key}-icons`;
export const ADD_ID = "step-editor-add";
// The first control of a step, where the cursor lands: the kind picker for a typed step, the title for free text.
export const firstPart = (row) => (isTypedKind(row.kind) ? "kind" : "title");

const iconButton = "grid h-11 w-11 shrink-0 place-items-center rounded-xl text-mute transition-colors duration-120 ease-standard hover:bg-raised hover:text-ink active:bg-line aria-disabled:opacity-50";
const inputBase = "h-11 w-full rounded-xl border bg-surface px-3 text-[15px] placeholder:text-hint focus-visible:border-accent read-only:opacity-90";
const COUNTER_FROM = 160; // the character counter appears from here

export default function StepEditor({ steps, onChange, announce, showErrors, busy, heading, subheading, focusOnOpen = true, dnd = false, simple = false }) {
  const reduce = usePrefersReducedMotion();
  const [openIcon, setOpenIcon] = useState(null); // key of the step whose icon panel is open (only one at a time)
  const [touched, setTouched] = useState(() => new Set()); // keys of titles the person has already left
  const [undo, setUndo] = useState(null); // after a delete: { row, index }
  const focusLater = useRef(null); // the id to focus once the next render is on screen
  const [firstId] = useState(() => (steps[0] ? fieldId(steps[0].key, firstPart(steps[0])) : ADD_ID));
  const count = steps.length;
  const atMax = count >= LIMITS.planSteps;
  const problems = checkSteps(steps).problems ?? [];

  // Focus: on opening, the first title; after a move, add or delete, the control named in `focusLater`.
  // (React may re-create a moved row's HTML, which drops focus, so it is put back by id.)
  useEffect(() => { if (focusOnOpen) document.getElementById(firstId)?.focus(); }, [firstId, focusOnOpen]);
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
    const row = newRow();
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
    focusLater.current = landing ? fieldId(landing.key, firstPart(landing)) : ADD_ID;
    if (openIcon === steps[index].key) setOpenIcon(null); // an Undo must not bring a closed picker back open
    onChange(next);
    setUndo({ row: steps[index], index });
    announce(`Step ${index + 1} deleted. ${next.length} ${next.length === 1 ? "step" : "steps"} left. Undo is below the list.`);
  }

  function restore() {
    if (!undo || busy) return;
    const next = [...steps];
    next.splice(Math.min(undo.index, next.length), 0, undo.row);
    focusLater.current = fieldId(undo.row.key, firstPart(undo.row));
    onChange(next);
    announce(`Step ${undo.index + 1} restored.`);
    setUndo(null);
  }

  // The person picked another kind for a step: the row is rebuilt for that kind (lib/step-rows.js) and the icon panel closes.
  function changeKind(row, number, kind) {
    if (busy) return;
    if (openIcon === row.key) setOpenIcon(null);
    change(steps.map((other) => (other.key === row.key ? rowForKind(other, kind) : other)));
    const spec = STEP_KINDS[kind];
    announce(kind === NOTE ? `Step ${number} is now free text.` : `Step ${number} is now "${spec.label}". ${spec.fields.length} ${spec.fields.length === 1 ? "field" : "fields"} to fill in.`);
  }

  const closePicker = (key) => { focusLater.current = fieldId(key, "icon"); setOpenIcon(null); };
  const leaveTitle = (key) => setTouched((seen) => new Set(seen).add(key));

  // ---- Drag and drop (only when the parent turns `dnd` on) ----
  // Two things can be dragged here: a step by its handle (it moves), or a step kind from the Builder's palette (it is added).
  // `dropAt` is where a drop would land (0 = first ... count = last) and draws a line there. A drop only counts if it carries
  // one of OUR two drag types, so a file or a piece of text dragged in from elsewhere does nothing.
  const [dropAt, setDropAt] = useState(null);
  const [draggingKey, setDraggingKey] = useState(null);
  const draggingRow = useRef(false); // true while one of the rows (not a palette card) is being dragged
  // Where a drop would land, kept in a plain variable as well: a drop that follows a drag-over very quickly must not read an
  // old value from state (state is only updated after the next render). The state above is for drawing the line.
  const dropAtRef = useRef(null);
  const showDropAt = (at) => { dropAtRef.current = at; setDropAt(at); };
  const ours = (event) => dnd && !busy && [...event.dataTransfer.types].some((type) => type === DRAG_ROW || type === DRAG_KIND);

  function startRowDrag(event, row) {
    if (busy) { event.preventDefault(); return; }
    draggingRow.current = true;
    setDraggingKey(row.key);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(DRAG_ROW, String(row.key));
    const li = event.currentTarget.closest("li");
    if (li) event.dataTransfer.setDragImage(li, 20, 20); // the whole step follows the pointer, not just the small handle
  }
  function endDrag() { draggingRow.current = false; setDraggingKey(null); showDropAt(null); }

  // Over a step: the drop lands before it (pointer in its top half) or after it (bottom half). preventDefault() is how a
  // page tells the browser "yes, a drop is allowed here".
  function overRow(event, index) {
    if (!ours(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = draggingRow.current ? "move" : "copy";
    const box = event.currentTarget.getBoundingClientRect();
    showDropAt(index + (event.clientY > box.top + box.height / 2 ? 1 : 0));
  }
  function overEnd(event) {
    if (!ours(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = draggingRow.current ? "move" : "copy";
    showDropAt(count);
  }
  // The line goes away when the drag leaves the whole list (not when it only crosses from one child to another).
  function leaveList(event) { if (!event.currentTarget.contains(event.relatedTarget)) showDropAt(null); }

  function drop(event) {
    if (!ours(event)) return;
    event.preventDefault();
    const at = dropAtRef.current ?? count;
    const draggedKey = event.dataTransfer.getData(DRAG_ROW);
    const kind = parseDragKind(event.dataTransfer.getData(DRAG_KIND));
    endDrag();

    if (draggedKey) { // a step was moved
      const key = Number(draggedKey);
      const from = steps.findIndex((row) => row.key === key);
      const next = moveRow(steps, key, at);
      if (next === steps) return; // dropped on its own spot
      const to = from < at ? at - 1 : at;
      focusLater.current = fieldId(key, firstPart(steps[from]));
      change(next);
      announce(`Step ${from + 1} moved to position ${to + 1} of ${count}.`);
    } else if (kind) { // a step kind was dropped in
      if (atMax) { announce(`A plan can have up to ${LIMITS.planSteps} steps. Delete one to add another.`); return; }
      const row = newRowForBlock(kind);
      focusLater.current = fieldId(row.key, firstPart(row));
      change(insertRow(steps, row, at));
      announce(`${blockName(row)} step added as step ${at + 1} of ${LIMITS.planSteps}.`);
    }
  }

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
      {dnd && !simple && <p className="mt-1 px-2 text-sm text-mute">Drag a step by its handle to move it, or use the arrows. Dragging needs a mouse.</p>}

      {/* Drops are received here (they bubble up from the steps and the end zone). Nothing happens unless `dnd` is on. */}
      <div onDrop={dnd ? drop : undefined} onDragLeave={dnd ? leaveList : undefined}>
      {count === 0 && (
        <div
          onDragOver={dnd ? overEnd : undefined}
          className={`mt-3 rounded-xl bg-raised px-3 py-3 text-sm ${dnd && dropAt === 0 ? "outline-2 outline-offset-2 outline-accent" : ""}`}
        >
          <p className="font-medium">{simple ? "Nothing here yet." : "This plan has no steps."}</p>
          <p className="text-mute">{simple ? "Drag a block here, or press one on the left." : dnd ? "Drag a step kind here, or press one in the list." : "Add a step to build it."}</p>
        </div>
      )}

      <ol className="mt-3 px-2">
        <AnimatePresence initial={false}>
          {steps.map((row, index) => {
            const number = index + 1;
            const typed = isTypedKind(row.kind);
            const spec = typed ? STEP_KINDS[row.kind] : null;
            const open = openIcon === row.key && !typed; // only a free-text step has an icon to choose
            const shownAs = typed ? checkSteps([row]).value?.[0] : null; // how a typed step will read, once its blanks are filled in
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
                onDragOver={dnd ? (event) => overRow(event, index) : undefined}
                className={`relative border-t border-line py-4 first:border-t-0 first:pt-0 ${draggingKey === row.key ? "opacity-50" : ""}`}
              >
                {dnd && dropAt === index && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 -top-px z-10 h-0.5 rounded-full bg-accent" />}
                <div role="group" aria-labelledby={labelId}>
                  <div className="flex flex-wrap items-center gap-2">
                    {dnd && (
                      <span
                        draggable={!busy} onDragStart={(event) => startRowDrag(event, row)} onDragEnd={endDrag}
                        title="Drag to move this step" aria-hidden="true"
                        className="-mr-1 grid h-11 w-6 shrink-0 cursor-grab place-items-center rounded-md text-mute hover:bg-raised hover:text-ink active:cursor-grabbing"
                      >
                        <Icon name="GripVertical" size={18} />
                      </span>
                    )}
                    <span id={labelId} className="grid h-7 min-w-7 shrink-0 place-items-center rounded-md bg-raised px-1 text-sm font-medium">
                      <span><span className="sr-only">Step </span>{number}</span>
                    </span>
                    {typed ? (
                      <span className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-2 sm:px-3" aria-hidden="true">
                        <Icon name={simple ? (blockById(blockIdFor(row))?.icon ?? spec.icon) : spec.icon} size={20} className="text-accent-text" />
                        <span className={simple ? "text-sm font-medium" : "hidden text-sm sm:inline"}>{simple ? blockName(row) : spec.label}</span>
                      </span>
                    ) : simple ? (
                      <span className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3" aria-hidden="true">
                        <Icon name="FileText" size={20} className="text-accent-text" />
                        <span className="text-sm font-medium">Note</span>
                      </span>
                    ) : (
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
                    )}
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

                  {!simple && (
                  <div className="mt-3 md:max-w-xs">
                    <label htmlFor={fieldId(row.key, "kind")} className="text-sm font-medium">Kind of step<span className="sr-only"> for step {number}</span></label>
                    <select
                      id={fieldId(row.key, "kind")} value={typed ? row.kind : NOTE} disabled={busy}
                      onChange={(event) => changeKind(row, number, event.target.value)}
                      className={`mt-1 ${inputBase} border-field`}
                    >
                      <option value={NOTE}>Free text</option>
                      {STEP_KIND_ORDER.map((kind) => <option key={kind} value={kind}>{STEP_KINDS[kind].label}</option>)}
                    </select>
                    <p className="mt-1 text-sm text-mute">{typed ? `${spec.help} This only describes the step.` : "Your own words. Or pick a kind of step to fill in named blanks."}</p>
                  </div>
                  )}

                  {!typed && (
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
                  )}

                  {typed && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      {spec.fields.map((field) => {
                        const id = fieldId(row.key, `f-${field.key}`);
                        const noteId = `${id}-note`;
                        const value = row.fields?.[field.key] ?? "";
                        const problem = problems.find((p) => p.index === index && p.field === `fields.${field.key}`);
                        const seen = showErrors || touched.has(`${row.key}.${field.key}`); // the person has been here, or tried Done
                        const bad = Boolean(problem) && (problem.kind === "long" || seen);
                        const length = tidyText(value).length;
                        const describedBy = bad || (field.type === "text" && length >= field.max - 20) ? noteId : undefined;
                        return (
                          <div key={field.key}>
                            <label htmlFor={id} className="text-sm font-medium">{field.label}{field.optional ? " (optional)" : ""}<span className="sr-only"> of step {number}</span></label>
                            {field.type === "choice" ? (
                              <select
                                id={id} value={value} disabled={busy}
                                onChange={(event) => edit(row.key, { fields: { ...row.fields, [field.key]: event.target.value } })}
                                aria-invalid={bad || undefined} aria-describedby={describedBy}
                                className={`mt-1 ${inputBase} ${bad ? "border-error" : "border-field"}`}
                              >
                                {!Object.hasOwn(field.options, value) && <option value="">Choose...</option>}
                                {Object.entries(field.options).map(([choice, label]) => <option key={choice} value={choice}>{label}</option>)}
                              </select>
                            ) : (
                              <input
                                id={id} value={value} readOnly={busy}
                                onChange={(event) => edit(row.key, { fields: { ...row.fields, [field.key]: event.target.value } })}
                                onBlur={() => leaveTitle(`${row.key}.${field.key}`)}
                                aria-invalid={bad || undefined} aria-describedby={describedBy}
                                placeholder={field.hint}
                                className={`mt-1 ${inputBase} ${bad ? "border-error" : "border-field"}`}
                              />
                            )}
                            <FieldNote id={noteId} length={length} max={field.max} problem={problem} show={seen} isText={field.type === "text"} />
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {shownAs && !simple && (
                    <p className="mt-3 text-sm text-mute">
                      Shown in the plan as: <span className="font-medium text-ink">{shownAs.title}</span>{shownAs.detail ? `. ${shownAs.detail}` : ""}
                    </p>
                  )}
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ol>

      {/* The strip below the last step: dropping here puts the step at the end. */}
      {dnd && count > 0 && (
        <div onDragOver={overEnd} className="relative mx-2 flex h-8 items-center justify-center">
          {dropAt === count && <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-accent" />}
        </div>
      )}
      </div>

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
        {!simple && <Btn id={ADD_ID} size="sm" variant="secondary" icon="Plus" aria-disabled={atMax || busy || undefined} onClick={add} className="aria-disabled:opacity-50">Add step</Btn>}
        <p className="text-sm text-mute">Do not put passwords or card numbers in a step.</p>
      </div>
    </div>
  );
}

// The line under a field of a typed step: the limit message, the "fill this in" or "choose" message (once the person has
// been there or tried Done), or the character counter near the limit. An empty required field keeps its line free
// beforehand, for the same reason as the title (see Note below).
function FieldNote({ id, length, max, problem, show, isText }) {
  const message = (words) => <p id={id} className="mt-1 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{words}</p>;
  if (problem?.kind === "long") return message(`Use ${max} characters or fewer. Shorten it by ${problem.over}.`);
  if (problem?.kind === "empty") return show ? message("Fill this in.") : <p aria-hidden="true" className="mt-1 h-5" />;
  if (problem?.kind === "choice" && show) return message("Choose an option.");
  if (!isText || length < max - 20) return null;
  return <p id={id} className="mt-1 text-sm text-mute">{length} of {max}{length >= max ? ". Limit reached." : ""}</p>;
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
