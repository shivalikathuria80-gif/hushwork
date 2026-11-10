// START LINKS: one field of what arrived, by name. A step can write {incoming.email} in the "Where" of an email, or {incoming.subject} in its
// subject, text or a Sheet box, and the value that arrived under that name is put in when the step is shown for approval and again when it runs
// (the same words both times, so what you approve is what is sent). Plain data and plain functions with no imports: the browser uses them too.
//
// What arrived was written by a stranger, so a value is only ever TEXT: braces are swapped for look-alikes (a value can never form another tag such
// as {answer} or {myEmail}), control characters go, and a one-line box gets one line. An Ask the AI job is never filled in this way: it reads what
// arrived as information through {incoming} (lib/run-core.js), so nothing a stranger wrote becomes part of a request to the AI.

export const FIELD_TAG_SHAPE = /\{incoming\.([A-Za-z0-9_.-]{1,40})\}/g;
export const FIELD_LIMITS = { fields: 20, nameChars: 40, valueChars: 500 }; // the same as HOOK_LIMITS in lib/hooks.js

// The short name a tag uses for a field: "Your email" -> your_email, "customer.Email" -> customer.email.
export function fieldKey(name) {
  return String(name ?? "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9.]+/g, "_").replace(/\.{2,}/g, ".").replace(/^[_.]+|[_.]+$/g, "").slice(0, 40);
}
export const fieldTag = (name) => `{incoming.${fieldKey(name) || "value"}}`;
export const hasFieldTag = (text) => typeof text === "string" && new RegExp(FIELD_TAG_SHAPE.source).test(text);
export const isOnlyFieldTag = (text) => typeof text === "string" && new RegExp(`^${FIELD_TAG_SHAPE.source}$`).test(text.trim());
export const tagsIn = (text) => [...String(text ?? "").matchAll(FIELD_TAG_SHAPE)].map((match) => match[1].toLowerCase());

// Reads a saved list of fields back (a person can write anything into their own rows): [{ name, value }], strings only, cut to the limits.
// Anything that is not a list gives null, which means "nothing arrived" (a run started by a click or a schedule).
export function readFieldList(value) {
  if (!Array.isArray(value)) return null;
  return value.filter((one) => one && typeof one.name === "string" && typeof one.value === "string" && one.name).slice(0, FIELD_LIMITS.fields)
    .map((one) => ({ name: one.name.slice(0, FIELD_LIMITS.nameChars), value: one.value.slice(0, FIELD_LIMITS.valueChars) }));
}

const asText = (value, oneLine) => {
  const text = String(value).replace(/\{/g, "\u{FF5B}").replace(/\}/g, "\u{FF5D}").replace(/\r/g, "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ");
  return (oneLine ? text.replace(/\s+/g, " ") : text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n")).trim();
};

// Fills every {incoming.name} in `text`. `fields` is the run's list (or null when nothing arrived). Returns { text } or { error }. `oneLine`
// flattens the values (a subject, a Sheet box, an address); `max` cuts the result.
export function fillFields(text, fields, { oneLine = false, max = 3000 } = {}) {
  const source = typeof text === "string" ? text : "";
  if (!hasFieldTag(source)) return { text: source };
  const tags = tagsIn(source);
  if (!Array.isArray(fields)) return { error: `This step uses {incoming.${tags[0]}}, but this run was not started by its start link, so nothing arrived to fill it in. It can only be done in a run that something arrived for.` };
  const byKey = new Map();
  for (const field of fields) if (!byKey.has(fieldKey(field.name))) byKey.set(fieldKey(field.name), field.value);
  const missing = tags.find((key) => !String(byKey.get(key) ?? "").trim());
  if (missing) return { error: `Nothing named "${missing}" arrived at the start link, so {incoming.${missing}} cannot be filled in. The fields that arrived are on the Start links page.` };
  return { text: source.replace(FIELD_TAG_SHAPE, (_, key) => asText(byKey.get(key.toLowerCase()), oneLine)).slice(0, max) };
}
