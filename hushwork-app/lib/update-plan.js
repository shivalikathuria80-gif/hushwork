// The heart of "save changed steps in place": checks the input, makes sure the draft was not changed somewhere else, then
// writes the new steps. It has no Next.js or Supabase imports: the database client is handed in, so a test can give it a
// pretend one (see update-plan.test.js). The Server Action `updateDraft` in lib/actions/drafts.js calls it after
// requireUser().
import { checkId, checkVersion, cleanPlan, sameSteps } from "./validate.js";
import { readSavedStep } from "./steps.js";

// Plain sentences. Raw database text is never returned; only the error code is logged.
export const CHANGED = "This draft was changed somewhere else, so your edits were not saved. They are still on screen.";
export const GONE = "That draft no longer exists.";
export const FAILED = "Could not save your changes. Check your connection and try again.";

const text = (value) => (typeof value === "string" ? value : "");

// The stored steps as plain strings (a typed step also keeps its kind and fields), so nothing unexpected is handed to the browser.
export function plainSteps(plan) {
  return (Array.isArray(plan) ? plan : []).map(readSavedStep);
}

// A "changed" answer is a FALSE conflict when the steps saved now are still the ones this edit began from: only something
// else about the draft moved (for example it was renamed in the list, which also changes its time). The screen can then
// adopt the newer version and save once more, instead of telling the person their edits clash with nothing.
// `startedFrom` is the plan on screen when Edit steps was pressed, as a list of { icon, title, detail }.
export function onlyNameMoved(result, startedFrom) {
  return result?.why === "changed" && Array.isArray(result.latest?.plan) && sameSteps(result.latest.plan, startedFrom);
}

// input: { userId, id, version, plan }
//   userId  who is asking (from requireUser(), never from the browser)
//   id      the draft
//   version the draft's `updated_at` exactly as the server gave it when the draft was opened
//   plan    the new steps as JSON text (same transport as saving a new draft)
// Returns { ok: true, version } with the new version, or { error: "plain sentence", why } where why is
//   "invalid" (the input is wrong)  "changed" (also returns `latest`)  "gone"  "failed".
export async function updatePlan(supabase, { userId, id, version, plan }) {
  // 1. Everything the browser sent is checked first. Nothing below runs, and the database is not touched, if it is wrong.
  const checkedId = checkId(id);
  if (checkedId.error) return { error: checkedId.error, why: "invalid" };
  const checkedVersion = checkVersion(version);
  if (checkedVersion.error) return { error: checkedVersion.error, why: "invalid" };
  const steps = cleanPlan(plan);
  if (steps.error) return { error: steps.error, why: "invalid" };

  // 2. Read the draft as it is now. The database hides other people's rows, and we also ask for this person's rows only.
  const read = await supabase.from("workflows").select("name, plan, updated_at").eq("id", id).eq("user_id", userId);
  if (read.error) {
    console.error("updateDraft failed:", read.error.code);
    return { error: FAILED, why: "failed" };
  }
  const current = read.data?.[0];
  if (!current) return { error: GONE, why: "gone" }; // deleted, or never theirs: the same sentence for both

  // 3. The version check: has anyone saved this draft since the person opened it? The two times are compared as plain
  // text, exactly as the database wrote them (never turned into a Date, which would cut them to milliseconds). If they
  // differ, nothing is written, and the latest saved steps are returned so the person can choose to load them.
  if (current.updated_at !== checkedVersion.value) {
    return { error: CHANGED, why: "changed", latest: { name: text(current.name), plan: plainSteps(current.plan), version: text(current.updated_at) } };
  }

  // 4. The one write: only the `plan` column (the database refuses any other column from this person anyway).
  // Known gap, accepted for now: another tab could still save in the few milliseconds between the read above and this
  // write, and would be overwritten. Closing it needs a database function that checks and writes in one step.
  const write = await supabase.from("workflows").update({ plan: steps.value }).eq("id", id).eq("user_id", userId).select("id, updated_at");
  if (write.error) {
    console.error("updateDraft failed:", write.error.code);
    return { error: FAILED, why: "failed" };
  }
  const saved = write.data?.[0];
  if (!saved) return { error: GONE, why: "gone" }; // deleted between the read and the write
  return { ok: true, version: text(saved.updated_at) };
}
