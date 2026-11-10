// START LINKS: the rules. A start link is a private web address for ONE workflow (supabase/hooks.sql). When a form tool, a shop or any other
// app sends something to it, the workflow starts by itself with writing switched OFF. Plain code with no Next.js and no database (the server and
// `node --test` load it; the browser never does: pages hand their components ready-made data).
//
// What arrives is NEVER trusted: it comes from a stranger. It is cut to a few short fields here, anything that looks like a card number or a
// secret key is left out, and the run hands it to the AI as information only (never as part of the person's request).
import { createHash, randomBytes } from "node:crypto";
import { looksSensitive } from "./ai/plan.js";

export const CODE_PREFIX = "hwl_";
const CODE_SHAPE = /^hwl_[A-Za-z0-9_-]{32}$/;
export const HOOK_LIMITS = {
  bodyBytes: 16_000, // a bigger arrival is refused before it is read
  fields: 20, // at most this many fields are kept
  nameChars: 40,
  valueChars: 500,
  totalChars: 4000, // all kept values together
  perMinute: 5, // arrivals that may START a run, per person
  perDay: 60,
  maxLinks: 10, // links one person can keep
  previewFields: 6, // what the Start links page shows of one arrival
  previewChars: 80,
};
export const HOOK_SETUP = "Start links need one setup step that is not done yet. Open supabase/hooks.sql and run it in Supabase.";
export const NO_TABLE = new Set(["42P01", "PGRST205"]);
export const NO_COLUMN = new Set(["42703", "PGRST204"]); // supabase/hook-fields.sql not run yet: hook_events has no `fields` column
export { INCOMING_TAG, TEST_ARRIVAL, TEST_FLAG, dailyCounts, hookUrl, snippets } from "./hook-tags.js";

export const hashCode = (code) => createHash("sha256").update(String(code)).digest("hex");
export const looksLikeCode = (value) => typeof value === "string" && CODE_SHAPE.test(value);

// A new link code: { code, hash }. 24 random bytes = 32 letters and digits, far too many to guess.
export function makeCode() {
  const code = `${CODE_PREFIX}${randomBytes(24).toString("base64url")}`;
  return { code, hash: hashCode(code) };
}

const clean = (text, max) => String(text).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]+/g, " ").replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
const cleanName = (name) => clean(name, 200).replace(/[^\p{L}\p{N} _.-]+/gu, " ").replace(/\s+/g, " ").trim().slice(0, HOOK_LIMITS.nameChars);

// Flattens whatever arrived into a short list of { name, value } texts. A nested object becomes "parent.child" names (two levels deep at most);
// a list becomes its items joined by commas. Form tools wrap their answers differently (Tally: data.fields[{label,value}], Typeform:
// form_response.answers), so a list of { label | name | key | title, value | answer | text } pairs is read as fields too.
function collect(value, prefix, depth, out) {
  if (out.length >= 60 || value == null) return;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    out.push([prefix || "value", String(value)]);
    return;
  }
  if (Array.isArray(value)) {
    const pairs = value.filter((one) => one && typeof one === "object" && !Array.isArray(one));
    const named = pairs.length === value.length && pairs.length > 0 && pairs.every((one) => ["label", "name", "key", "title"].some((k) => typeof one[k] === "string" && one[k]) || typeof one?.field?.ref === "string");
    if (named) {
      for (const one of pairs) {
        const label = one.label ?? one.name ?? one.key ?? one.title ?? one.field?.ref;
        const answer = one.value ?? one.answer ?? one.text ?? one.email ?? one.number ?? one.choice?.label ?? one.url ?? one.phone_number ?? one.date ?? one.boolean;
        if (answer == null) continue;
        collect(Array.isArray(answer) || typeof answer !== "object" ? answer : JSON.stringify(answer), String(label), depth + 1, out);
      }
      return;
    }
    const flat = value.filter((one) => ["string", "number", "boolean"].includes(typeof one)).map(String);
    if (flat.length) out.push([prefix || "value", flat.join(", ")]);
    else if (value.length && depth < 3) value.slice(0, 5).forEach((one, index) => collect(one, `${prefix || "item"} ${index + 1}`, depth + 1, out));
    return;
  }
  if (typeof value === "object") {
    if (depth >= 3) return;
    for (const [key, inner] of Object.entries(value).slice(0, 60)) {
      // Wrappers that only hold the answers do not add their own name ("data.fields.Email" reads worse than "Email").
      const wrapper = ["data", "fields", "form_response", "answers", "payload", "body"].includes(key);
      collect(inner, wrapper && inner && typeof inner === "object" ? "" : prefix ? `${prefix}.${key}` : key, depth + 1, out);
    }
  }
}

// What a link keeps of an arrival. Returns { fields: [{ name, value }], dropped: how many were left out } (possibly no fields at all: a bare
// "ping" still starts the workflow). Never throws.
export function readFields(payload) {
  const found = [];
  try {
    collect(payload, "", 0, found);
  } catch {
    return { fields: [], dropped: 0 };
  }
  const fields = [];
  const seen = new Set();
  let total = 0;
  let dropped = 0;
  for (const [rawName, rawValue] of found) {
    const name = cleanName(rawName) || "value";
    const value = clean(rawValue, HOOK_LIMITS.valueChars);
    if (!value) continue;
    const key = name.toLowerCase();
    if (seen.has(key) || fields.length >= HOOK_LIMITS.fields || total + value.length > HOOK_LIMITS.totalChars || looksSensitive(value) || looksSensitive(name)) {
      dropped += 1;
      continue;
    }
    seen.add(key);
    total += value.length;
    fields.push({ name, value });
  }
  return { fields, dropped };
}

// Turns the body of a request into a payload. Understands JSON, a posted form (name=value&...) and plain text. Returns { payload } or
// { error, status }. `type` is the Content-Type header.
export function parseBody(text, type = "") {
  const body = typeof text === "string" ? text : "";
  if (Buffer.byteLength(body, "utf8") > HOOK_LIMITS.bodyBytes) return { error: "That is too much data for one arrival.", status: 413 };
  const trimmed = body.trim();
  if (!trimmed) return { payload: {} };
  const kind = String(type).toLowerCase();
  if (kind.includes("json") || /^[[{]/.test(trimmed)) {
    try {
      return { payload: JSON.parse(trimmed) };
    } catch {
      if (kind.includes("json")) return { error: "That is not valid JSON.", status: 400 };
    }
  }
  if (kind.includes("x-www-form-urlencoded") || (/^[^\s=&]+=/.test(trimmed) && !trimmed.includes("\n"))) {
    const payload = Object.create(null); // no prototype: a field named __proto__ is just a field
    for (const [name, value] of new URLSearchParams(trimmed)) payload[name] = name in payload ? `${payload[name]}, ${value}` : value;
    return { payload: { ...payload } };
  }
  return { payload: { message: trimmed } };
}

// The words the AI is handed for {incoming}: one "name: value" line per field. Look-alike angle brackets, so nothing that arrived can form a tag.
const neutralise = (text) => String(text).replace(/</g, "\u{2039}").replace(/>/g, "\u{203a}");
export function incomingText(fields) {
  const lines = (Array.isArray(fields) ? fields : []).filter((one) => one && typeof one.name === "string" && typeof one.value === "string").map((one) => `${neutralise(one.name)}: ${neutralise(one.value)}`);
  return lines.join("\n").slice(0, HOOK_LIMITS.totalChars + 1200);
}

// The short version the Start links page shows: a few fields, each cut short. Stays under the database's 2,000 byte limit.
export function previewOf(fields) {
  const list = (Array.isArray(fields) ? fields : []).slice(0, HOOK_LIMITS.previewFields).map((one) => ({ name: String(one.name).slice(0, 24), value: String(one.value).replace(/\s+/g, " ").slice(0, HOOK_LIMITS.previewChars) }));
  while (list.length && Buffer.byteLength(JSON.stringify(list), "utf8") > 1900) list.pop();
  return list;
}

// Reads a saved preview back (a person could have written anything into their own rows).
export function readPreview(value) {
  if (!Array.isArray(value)) return [];
  return value.filter((one) => one && typeof one.name === "string" && typeof one.value === "string").slice(0, HOOK_LIMITS.previewFields).map((one) => ({ name: one.name.slice(0, 24), value: one.value.slice(0, HOOK_LIMITS.previewChars) }));
}

