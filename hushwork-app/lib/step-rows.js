// The step editor's rows, as pure code (no React), so they can be tested. A row is { key, icon, title, detail } for a plain
// note, or { key, icon, title, detail, kind, fields } for a typed step (see lib/steps.js). `key` is the editor's private
// number: it follows a row around when rows move, so React keeps each text box with its own step.
import { ICON_NAMES } from "./ai/icon-names.js";
import { NOTE, STEP_KINDS, blankFields, isTypedKind } from "./steps.js";
import { checkSteps } from "./validate.js";

let counter = 0;
const newKey = () => ++counter;

// Turns a plan ([icon, title, detail, kind, fields] lists) into a working copy. An old icon name we no longer offer shows
// as Sparkles. A typed step keeps its kind and (a copy of) its fields.
// The keys are 1, 2, 3... in order. That is deliberate: the Builder draws its steps on the SERVER, and the browser builds the
// same rows again when the page wakes up; if the keys differed (a counter that keeps counting on the server), every id on
// the page would differ and React would report a hydration mismatch. Rows made later (newRow) carry on after these.
export function toWorking(plan) {
  counter = Math.max(counter, plan.length);
  return plan.map(([icon, title, detail, kind, fields], index) => ({
    key: index + 1, icon: ICON_NAMES.includes(icon) ? icon : "Sparkles", title, detail,
    ...(isTypedKind(kind) ? { kind, fields: { ...fields } } : {}),
  }));
}

// A new, empty row: free text, or a typed step of `kind` with blank fields. The Builder's palette uses it.
export function newRow(kind = NOTE) {
  const row = { key: newKey(), icon: "Workflow", title: "", detail: "" };
  return kind === NOTE ? row : rowForKind(row, kind);
}

// What happens to a row when the person picks another kind of step. Returns the row as it should be after switching to
// `kind` (NOTE or a typed kind). Nothing the person typed is lost by switching to a note: a typed step turns into a note
// that says what the typed step said.
export function rowForKind(row, kind) {
  if (kind === NOTE) {
    if (!isTypedKind(row.kind)) return row; // already a note
    const checked = checkSteps([row]);
    const next = { ...row };
    if (checked.value) { next.title = checked.value[0].title; next.detail = checked.value[0].detail; }
    delete next.kind;
    delete next.fields;
    return next;
  }
  if (!isTypedKind(kind) || row.kind === kind) return row;
  // A new kind starts with blank fields (the old ones belong to another kind) and its own icon.
  return { ...row, kind, fields: blankFields(kind), icon: STEP_KINDS[kind].icon };
}
