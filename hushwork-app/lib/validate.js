// Input checks used by the Server Actions. They run on the server, because anything the browser sends can be
// faked. Each check returns { value } when the input is fine, or { error: "plain sentence" } when it is not.
// The database has its own limits too (supabase/workflows.sql); these are the friendly first line.
// No Next.js or Supabase imports, so `node --test` and the browser can both load this file.
import { ICON_NAMES } from "./ai/icon-names.js";

export const LIMITS = {
  emailMax: 254,
  passwordMin: 10,
  passwordMax: 64,
  passwordMaxBytes: 72,
  signInPasswordMax: 256, // sign-in only stops absurd input; it does not judge old passwords
  nameMax: 80,
  defaultNameLength: 60,
  promptMax: 2000,
  planSteps: 12,
  stepText: 200,
  iconMax: 40,
};

export const EMAIL_RULE = "Enter a valid email address, like you@company.com.";
export const PASSWORD_BYTES_RULE = "That password is too long. Use a shorter one, and avoid very long emoji or non-Latin strings.";
export const PASSWORD_RULE = `Use at least ${LIMITS.passwordMin} characters. A short sentence you will remember works well.`;

export function checkEmail(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  const looksRight = value.length <= LIMITS.emailMax && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
  return looksRight ? { value } : { error: EMAIL_RULE };
}

// creating = true when making an account (full rule). Signing in only needs something typed.
// Passwords are never trimmed: spaces are allowed.
export function checkPassword(raw, creating) {
  const value = typeof raw === "string" ? raw : "";
  if (!value) return { error: "Enter your password." };
  if (!creating) {
    return value.length > LIMITS.signInPasswordMax ? { error: "That password is too long." } : { value };
  }
  if (value.length < LIMITS.passwordMin) return { error: PASSWORD_RULE };
  if (value.length > LIMITS.passwordMax) return { error: `Use ${LIMITS.passwordMax} characters or fewer.` };
  // The sign-in service only reads the first 72 BYTES of a password. Emoji and non-Latin letters take 3 to 4 bytes
  // each, so a password that is short in characters can still be too long in bytes.
  if (new TextEncoder().encode(value).length > LIMITS.passwordMaxBytes) return { error: PASSWORD_BYTES_RULE };
  return { value };
}

// A draft id is a UUID like 3f2b8c1e-...; anything else is refused before the database is asked.
export function checkId(raw) {
  const value = typeof raw === "string" ? raw : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? { value } : { error: "That draft no longer exists." };
}

// Required name (used by rename). Whitespace-only counts as empty.
export function cleanName(raw) {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return { error: "Give the draft a name." };
  if (value.length > LIMITS.nameMax) return { error: `Use ${LIMITS.nameMax} characters or fewer.` };
  return { value };
}

// The name a new draft gets when the person does not type one: the first 60 characters, cut at a word.
export function defaultName(prompt) {
  const text = prompt.replace(/\s+/g, " ").trim();
  if (text.length <= LIMITS.defaultNameLength) return text;
  const cut = text.slice(0, LIMITS.defaultNameLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 20 ? cut.slice(0, lastSpace) : cut).trimEnd() + "...";
}

// The task text typed in the box. Used by saving a draft and by the AI "Preview plan". Over-long text is refused with a
// sentence, never cut silently. `code` lets the screen pick its own wording; `error` is the plain sentence.
export function checkPrompt(raw) {
  // Zero-width characters (U+200B to U+200D, U+FEFF) are invisible: text made only of them counts as empty.
  const value = typeof raw === "string" ? raw.replace(/[\u200b-\u200d\ufeff]/g, "").trim() : "";
  if (!value) return { error: "Write a request first.", code: "empty" };
  if (value.length > LIMITS.promptMax) return { error: `Use ${LIMITS.promptMax} characters or fewer.`, code: "too_long" };
  return { value };
}

// Characters with no width or no visible shape, which can hide text or change how it reads: every Unicode "format"
// character (\p{Cf}: zero-width characters, direction marks, the direction-flipping overrides and isolates, the invisible
// word joiner, the soft hyphen, and similar) plus the two blank "filler" letters U+3164 and U+2800. Written with escapes so
// the characters can be seen and safely edited. Used by tidyText below.
const INVISIBLE = /[\p{Cf}\u3164\u2800]/gu;

// Cleans one piece of step text (a title or a detail) so it is safe to store and show. It removes the invisible
// characters above, so a title made only of them counts as empty. Control characters and any run of spaces, tabs or line
// breaks become one space. A lone half of an emoji (a "lone surrogate", which the database refuses) is replaced, and the
// ends are trimmed. It never cuts text short: too long is an error sentence, not a silent trim. Used by the server AND
// the step editor.
export function tidyText(raw) {
  if (typeof raw !== "string") return "";
  const whole = typeof raw.toWellFormed === "function" ? raw.toWellFormed() : raw;
  return whole
    .replace(INVISIBLE, "")
    .replace(/[\u0000-\u001f\u007f-\u009f\s]+/g, " ")
    .trim();
}

// Plain well-formed icon names that are not in our list (an old draft) show as Sparkles, as AI plans already do.
const knownIcon = (icon) => (ICON_NAMES.includes(icon) ? icon : "Sparkles");
const UNREADABLE = "That plan could not be read.";

// The one set of rules for the steps of a plan. The step editor runs it in the browser and the server runs it again
// on whatever arrives, so both always agree. `list` is an array of { icon, title, detail } (other keys are ignored).
// Returns { value: [{ icon, title, detail }] } with every step rebuilt from scratch, or { error, index, field, problems }
// where `error` is the first problem as a plain sentence and `problems` lists them all (the editor shows each one
// under its own field). `kind` is "empty", "long" (with `over`: how many characters too many) or "unreadable".
export function checkSteps(list) {
  const alone = (problem) => ({ error: problem.error, field: problem.field, problems: [problem] });
  if (!Array.isArray(list)) return alone({ field: "steps", kind: "unreadable", error: UNREADABLE });
  if (list.length === 0) return alone({ field: "steps", kind: "none", error: "A plan needs at least 1 step. Add a step to continue." });
  if (list.length > LIMITS.planSteps) return alone({ field: "steps", kind: "many", error: `A plan can have up to ${LIMITS.planSteps} steps.` });

  const steps = [];
  const problems = [];
  for (let index = 0; index < list.length; index++) {
    const step = list[index];
    const number = index + 1;
    const isObject = step !== null && typeof step === "object" && !Array.isArray(step);
    if (!isObject) { problems.push({ index, field: "step", kind: "unreadable", error: UNREADABLE }); continue; }
    const { icon, title, detail } = step;

    const iconOk = typeof icon === "string" && icon.length <= LIMITS.iconMax && /^[A-Za-z0-9]*$/.test(icon);
    if (!iconOk) problems.push({ index, field: "icon", kind: "unreadable", error: UNREADABLE });
    if (typeof title !== "string") { problems.push({ index, field: "title", kind: "unreadable", error: UNREADABLE }); continue; }
    if (typeof detail !== "string") { problems.push({ index, field: "detail", kind: "unreadable", error: UNREADABLE }); continue; }

    const cleanTitle = tidyText(title);
    const cleanDetail = tidyText(detail);
    if (!cleanTitle) problems.push({ index, field: "title", kind: "empty", error: `Step ${number} needs a title.` });
    else if (cleanTitle.length > LIMITS.stepText) {
      problems.push({ index, field: "title", kind: "long", over: cleanTitle.length - LIMITS.stepText, error: `Step ${number}: use ${LIMITS.stepText} characters or fewer in the title.` });
    }
    if (cleanDetail.length > LIMITS.stepText) {
      problems.push({ index, field: "detail", kind: "long", over: cleanDetail.length - LIMITS.stepText, error: `Step ${number}: use ${LIMITS.stepText} characters or fewer in the detail.` });
    }
    if (iconOk) steps.push({ icon: knownIcon(icon), title: cleanTitle, detail: cleanDetail });
  }
  if (problems.length > 0) return { error: problems[0].error, index: problems[0].index, field: problems[0].field, problems };
  return { value: steps };
}

// True when two lists of { icon, title, detail } would be saved as the same steps (so moving a step away and back, or
// adding a space, is "no change").
export function sameSteps(a, b) {
  return a.length === b.length && a.every((step, i) => (
    knownIcon(step.icon) === knownIcon(b[i].icon) && tidyText(step.title) === tidyText(b[i].title) && tidyText(step.detail) === tidyText(b[i].detail)
  ));
}

// A plan arrives as a JSON string (a hidden form field, or the AI's answer turned back into text). Never trust its
// shape: parse it safely, then run the same rules the step editor runs (checkSteps), which rebuild every step from
// scratch so nothing extra gets through. This is the strict gate both saved drafts and AI plans must pass.
export function cleanPlan(raw) {
  let parsed;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : "");
  } catch {
    return { error: UNREADABLE };
  }
  const checked = checkSteps(parsed);
  return checked.error ? { error: checked.error } : checked;
}

// The "version" of a saved draft is its `updated_at` time, exactly as the server wrote it (for example
// 2026-10-17T10:15:30.123456+00:00). It is only ever compared with the stored time, never put in a database query, but
// anything that does not look like a timestamp is still refused first.
export function checkVersion(raw) {
  const value = typeof raw === "string" ? raw : "";
  const looksRight = value.length <= 40 && /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}(?::?\d{2})?)$/.test(value);
  return looksRight ? { value } : { error: "This draft needs to be opened again before it can be changed. Reload the page and try again." };
}

// Checks a whole new draft: { prompt, name (optional), plan (JSON string) }.
export function cleanDraft(input) {
  const checked = checkPrompt(input?.prompt);
  if (checked.error) return { error: checked.error };
  const prompt = checked.value;

  const rawName = typeof input?.name === "string" ? input.name.trim() : "";
  const name = rawName ? cleanName(rawName) : { value: defaultName(prompt) };
  if (name.error) return { error: name.error };

  const plan = cleanPlan(input?.plan);
  if (plan.error) return { error: plan.error };

  return { value: { name: name.value, prompt, plan: plan.value } };
}
