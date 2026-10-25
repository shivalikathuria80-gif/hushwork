// Turning a Skill Bundle on or off. Plain code: the database client is handed in (the person's OWN client, so the privacy rules apply), so tests can give it a
// pretend one.
//
// Turning a bundle ON does exactly this and nothing else:
//   1. saves a row "this person enabled this bundle" (enabled_bundles, supabase/skills.sql). The row is saved FIRST: a second press, or a second tab, finds the row
//      and does nothing, so the workflows can never be saved twice by a double click;
//   2. saves the bundle's ready-made workflows as drafts in the person's own list (skipping any whose name they already have).
// It never connects an app, never makes a schedule and never runs a workflow. If saving the drafts fails, the row is removed again so the person can simply try again.
// Turning a bundle OFF removes the row only: the saved workflows stay (they are the person's now).
import { findBundle, buildWorkflow } from "./bundles.js";

export const SKILLS_FAILED = {
  setup: "Skills need one setup step: paste supabase/skills.sql into the Supabase SQL Editor and press Run.",
  unknown: "That bundle does not exist.",
  enable: "Could not turn it on. Check your connection and try again.",
  disable: "Could not turn it off. Try again.",
  full: "You can have up to 20 bundles on.",
};
const missingTable = (error) => error?.code === "42P01" || error?.code === "PGRST205";

// Returns { ok: true, saved: [names], skipped: [names] } (or { ok: true, already: true }) or { error }.
export async function enableBundle(supabase, userId, bundleId) {
  const bundle = findBundle(bundleId);
  if (!bundle) return { error: SKILLS_FAILED.unknown };
  const drafts = bundle.workflows.map((workflow) => buildWorkflow(bundle, workflow));
  if (drafts.some((draft) => !draft)) return { error: SKILLS_FAILED.enable }; // a bug in the bundle, never reached by a person (a test keeps every bundle valid)

  const added = await supabase.from("enabled_bundles").insert({ bundle_id: bundle.id }).select("id");
  if (added.error) {
    if (added.error.code === "23505") return { ok: true, already: true };
    console.error("enabling a bundle failed:", added.error.code);
    return { error: missingTable(added.error) ? SKILLS_FAILED.setup : added.error.code === "42501" ? SKILLS_FAILED.full : SKILLS_FAILED.enable };
  }

  const undo = () => supabase.from("enabled_bundles").delete().eq("user_id", userId).eq("bundle_id", bundle.id);
  const existing = await supabase.from("workflows").select("name").eq("user_id", userId).limit(200);
  if (existing.error || !Array.isArray(existing.data)) {
    await undo();
    return { error: SKILLS_FAILED.enable };
  }
  const have = new Set(existing.data.map((row) => row.name));
  const saved = [];
  const skipped = [];
  for (const draft of drafts) {
    if (have.has(draft.name)) { skipped.push(draft.name); continue; }
    const made = await supabase.from("workflows").insert({ name: draft.name, prompt: draft.prompt, plan: draft.steps });
    if (made.error) {
      console.error("saving a bundle workflow failed:", made.error.code);
      await undo(); // the drafts saved so far stay (they are harmless and named, so they are skipped next time)
      return { error: SKILLS_FAILED.enable };
    }
    saved.push(draft.name);
  }
  return { ok: true, saved, skipped };
}

export async function disableBundle(supabase, userId, bundleId) {
  const bundle = findBundle(bundleId);
  if (!bundle) return { error: SKILLS_FAILED.unknown };
  const removed = await supabase.from("enabled_bundles").delete().eq("user_id", userId).eq("bundle_id", bundle.id);
  if (removed.error) {
    console.error("disabling a bundle failed:", removed.error.code);
    return { error: missingTable(removed.error) ? SKILLS_FAILED.setup : SKILLS_FAILED.disable };
  }
  return { ok: true };
}

// The ids of the bundles this person has on, or null when that could not be read (a missing table is "none", with `missing: true`).
export async function enabledBundleIds(supabase, userId) {
  try {
    const { data, error } = await supabase.from("enabled_bundles").select("bundle_id").eq("user_id", userId).limit(20);
    if (error) return { ids: new Set(), missing: missingTable(error), failed: !missingTable(error) };
    return { ids: new Set(data.map((row) => row.bundle_id)), missing: false, failed: false };
  } catch {
    return { ids: new Set(), missing: false, failed: true };
  }
}
