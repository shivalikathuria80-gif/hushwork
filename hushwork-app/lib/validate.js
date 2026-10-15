// Input checks used by the Server Actions. They run on the server, because anything the browser sends can be
// faked. Each check returns { value } when the input is fine, or { error: "plain sentence" } when it is not.
// The database has its own limits too (supabase/workflows.sql); these are the friendly first line.

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

// The plan arrives as a JSON string from a hidden form field. Never trust its shape: parse it safely and rebuild
// every step from scratch so nothing extra gets through.
function cleanPlan(raw) {
  let parsed;
  try {
    parsed = JSON.parse(typeof raw === "string" ? raw : "");
  } catch {
    return { error: "That plan could not be read." };
  }
  if (!Array.isArray(parsed) || parsed.length === 0 || parsed.length > LIMITS.planSteps) {
    return { error: "That plan could not be read." };
  }
  const steps = [];
  for (const step of parsed) {
    const isObject = step !== null && typeof step === "object" && !Array.isArray(step);
    if (!isObject) return { error: "That plan could not be read." };
    const { icon, title, detail } = step;
    const textOk = (s, max) => typeof s === "string" && s.length <= max;
    if (!textOk(icon, LIMITS.iconMax) || !/^[A-Za-z0-9]*$/.test(icon)) return { error: "That plan could not be read." };
    if (!textOk(title, LIMITS.stepText) || !textOk(detail, LIMITS.stepText)) return { error: "That plan could not be read." };
    steps.push({ icon, title, detail });
  }
  return { value: steps };
}

// Checks a whole new draft: { prompt, name (optional), plan (JSON string) }.
export function cleanDraft(input) {
  const prompt = typeof input?.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt) return { error: "Write a request first." };
  if (prompt.length > LIMITS.promptMax) return { error: `Use ${LIMITS.promptMax} characters or fewer.` };

  const rawName = typeof input?.name === "string" ? input.name.trim() : "";
  const name = rawName ? cleanName(rawName) : { value: defaultName(prompt) };
  if (name.error) return { error: name.error };

  const plan = cleanPlan(input?.plan);
  if (plan.error) return { error: plan.error };

  return { value: { name: name.value, prompt, plan: plan.value } };
}
