// The step editor's rows, as pure code (no React), so they can be tested. A row is { key, icon, title, detail } for a plain
// note, or { key, icon, title, detail, kind, fields } for a typed step (see lib/steps.js). `key` is the editor's private
// number: it follows a row around when rows move, so React keeps each text box with its own step.
import { ICON_NAMES } from "./ai/icon-names.js";
import { NOTE, STEP_KINDS, blankFields, isTypedKind } from "./steps.js";
import { checkSteps } from "./validate.js";
import { accessOf } from "./skills/bundles.js";
import { checkTarget, findAction } from "./connectors/composio-actions.js";

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

// The rows to add when a SKILL is picked in the Builder: its step, and, when it writes and nothing before it in the list is an approval, an "Ask me first"
// row ahead of it (the real gate is the Approve click on the Runs page; the row tells the person where the writing starts).
// `skill` is a registry skill (lib/skills/bundles.js); `existing` the rows already in the list. A skill whose words come from an AI step ({answers}) uses plain
// words instead when no Ask the AI step is in the list yet (otherwise the run would stop with "there is no answer to put in"). Returns the new rows, in order.
export function rowsForSkill(skill, existing) {
  const rows = [];
  if (accessOf(skill) === "write" && !existing.some((row) => row.kind === "approve")) {
    rows.push({ ...newRow("approve"), fields: { what: "What is written below, before it happens" } });
  }
  rows.push({ ...newRow(skill.step.kind), fields: { ...skill.step.fields, ...(skill.alone && !existing.some((row) => row.kind === "ai") ? skill.alone : {}) } });
  return rows;
}

// "Email each person on a list": ONE email step per address, so every person gets their own separate email, each with its own Approve click (and its own
// "done" record, so a stop half way never sends anyone a second copy). The addresses are the ones the person TYPES here: Hushwork never picks recipients
// from what an email or an app says (that would let a stranger's email choose who gets mail). Every person gets the same words; after an Ask the AI step
// they carry its answer ({answer}). `text` is the addresses (commas, spaces, semicolons or new lines between them); `existing` the rows already in the list.
// Returns { rows } or { error }.
export const MAX_EMAIL_LIST = 8;
export function rowsForEmailList(text, existing) {
  const email = findAction("gmail_send");
  const typed = String(text ?? "").split(/[\s,;]+/).map((one) => one.trim()).filter(Boolean);
  if (!typed.length) return { error: "Write at least one email address." };
  const seen = new Set();
  const addresses = [];
  for (const address of typed) {
    if (checkTarget({ ...email, selfAllowed: false }, address).error) return { error: `"${address.slice(0, 40)}" does not look like an email address.` };
    if (!seen.has(address.toLowerCase())) { seen.add(address.toLowerCase()); addresses.push(address); }
  }
  if (addresses.length > MAX_EMAIL_LIST) return { error: `Up to ${MAX_EMAIL_LIST} addresses at a time, so each email can be read and approved.` };
  const words = existing.some((row) => row.kind === "ai") ? "{answer}" : "Write your message here.";
  const rows = [];
  if (!existing.some((row) => row.kind === "approve")) rows.push({ ...newRow("approve"), fields: { what: "Each email below, before it is sent" } });
  for (const address of addresses) rows.push({ ...newRow("action"), fields: { action: "gmail_send", target: address, title: "A message from Hushwork", details: words } });
  return { rows };
}

// ---- drag and drop (the browser's own dragging; the screens call these when something is dropped) ----

// What a drag carries. The palette drags a KIND (the value is a kind name, or "note" for free text); the list drags a ROW
// (the value is the row's key). The names are ours, so a drag that comes from anywhere else is ignored.
export const DRAG_KIND = "application/x-hushwork-kind";
export const DRAG_ROW = "application/x-hushwork-row";

// The BLOCKS are what the Builder offers on its left side: a short list of friendly names. Most blocks are one kind of step.
// A few are a kind with a ready-made answer already filled in (PRESET_BLOCKS), for example the Linear block is a "look
// something up" step that already says Linear. What a drag carries is a block id: "note", a kind name, or a preset name.
export const BLOCKS = [
  { id: "trigger", label: "Start", help: "How it begins", icon: "Zap" },
  { id: "linear", label: "Linear", help: "Look at your tasks", icon: "ListTodo" },
  { id: "request", label: "Web address", help: "Ask a website", icon: "Plug" },
  { id: "ai", label: "Ask the AI", help: "Let the AI think or look", icon: "Sparkles" },
  { id: "mcp", label: "MCP server", help: "Let the AI use a tool server", icon: "Plug" },
  { id: "find", label: "Find something", help: "Search for information", icon: "Search" },
  { id: "write", label: "Write something", help: "Plan only: describes a draft", icon: "PenLine" },
  { id: "approve", label: "Ask me first", help: "Wait for your yes", icon: "ShieldCheck" },
  { id: "send", label: "Send a message (plan only)", help: "Describes it. Does NOT send", icon: "Send" },
  { id: "row", label: "Add a row", help: "Put a line in a sheet", icon: "Table" },
  { id: "issue", label: "Create Linear task", help: "Add a task in Linear", icon: "ListTodo" },
  { id: "app", label: "Another app", help: "Look in Todoist, Notion...", icon: "Plug" },
  { id: "action", label: "Do in another app", help: "REALLY sends: email, Slack, GitHub...", icon: "Send" },
  { id: NOTE, label: "Note", help: "Your own words", icon: "FileText" },
];
// What the Builder's palette OFFERS. The three blocks that only describe (Find something, Write something, Send a message) are not offered any more: they
// do nothing when run, and Ask the AI looks, finds, writes and sums up for real, "Do in another app" really sends. Plans saved earlier may still hold them;
// they keep working as plan-only steps and keep their names (BLOCKS above still lists them).
export const DESCRIBING_BLOCKS = ["find", "write", "send"];
export const PALETTE_BLOCKS = BLOCKS.filter((block) => !DESCRIBING_BLOCKS.includes(block.id));
export const PRESET_BLOCKS = {
  linear: { kind: "find", fields: { where: "linear", what: "My open tasks" } },
  mcp: { kind: "ai", fields: { task: "", uses: "mcp", address: "" } },
};
export const blockById = (id) => BLOCKS.find((block) => block.id === id) ?? null;

// A dragged block is only used if it names a real block. Anything else is ignored.
export const parseDragKind = (value) => (value === NOTE || isTypedKind(value) || (typeof value === "string" && Object.hasOwn(PRESET_BLOCKS, value)) ? value : null);

// A new row for a block id (see above): a note, a typed step, or a typed step with its ready-made answer filled in.
export function newRowForBlock(id) {
  if (typeof id !== "string" || !Object.hasOwn(PRESET_BLOCKS, id)) return newRow(id);
  const preset = PRESET_BLOCKS[id];
  const row = newRow(preset.kind);
  return { ...row, fields: { ...row.fields, ...preset.fields } };
}

// The short name a row shows in the Builder: "Linear" for the Linear lookup, "MCP server" for an MCP step, the block's name for other typed steps, "Note".
export function blockName(row) {
  return blockById(blockIdFor(row))?.label ?? (isTypedKind(row?.kind) ? STEP_KINDS[row.kind].label : "Note");
}

// Which block a row is: its kind, except the Linear lookup and the MCP step, which have blocks of their own.
export function blockIdFor(row) {
  if (!isTypedKind(row?.kind)) return NOTE;
  if (row.kind === "find" && row.fields?.where === "linear") return "linear";
  if (row.kind === "ai" && row.fields?.uses === "mcp") return "mcp";
  return row.kind;
}

// Moves the row with `key` so it ends up BEFORE position `index` of the current list (0 = first, rows.length = last).
// Returns the new list, or the very same list when nothing would change (unknown key, a bad position, or dropped on its own
// spot). Never changes the list it is given.
export function moveRow(rows, key, index) {
  const from = rows.findIndex((row) => row.key === key);
  if (from < 0 || !Number.isInteger(index) || index < 0 || index > rows.length) return rows;
  const target = from < index ? index - 1 : index; // taking the row out first shifts every later position up by one
  if (target === from) return rows;
  const next = [...rows];
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved);
  return next;
}

// Puts `row` into the list so it ends up at position `index` (0..rows.length). A position outside that adds it at the end.
// Returns a new list.
export function insertRow(rows, row, index) {
  const at = Number.isInteger(index) && index >= 0 && index <= rows.length ? index : rows.length;
  const next = [...rows];
  next.splice(at, 0, row);
  return next;
}