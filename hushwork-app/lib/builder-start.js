// What the Builder opens with, decided from the address (`/app/builder`, `?template=invoices`, `?draft=<id>`).
// No Next.js or Supabase imports: the database client is handed in, so a test can give it a pretend one
// (see builder-start.test.js). The page calls it after requireUser().
//
// Everything in the address bar is untrusted: it is checked before anything is looked up, and a draft is only ever read
// for the person asking (the database hides other people's rows, and we also ask for this person's rows only).
//
// Returns one of:
//   { start: "new" }                                            an empty workflow
//   { start: "template", name, prompt, steps }                  a starter template (checked steps)
//   { start: "draft", draft: { id, name, prompt, version }, steps }   one of the person's saved drafts
//   { start: "missing" }                                        a draft that does not exist (or is not theirs: same answer)
//   { start: "failed" }                                         the database could not be read
import { checkId } from "./validate.js";
import { readSavedStep } from "./steps.js";
import { templateById } from "./templates.js";

const text = (value) => (typeof value === "string" ? value : "");
// Address parameters can be a list (?draft=a&draft=b); only a single plain value counts.
const single = (value) => (typeof value === "string" ? value : undefined);

export async function builderStart(supabase, userId, params) {
  if (params?.draft !== undefined) {
    // Whenever a draft was asked for, anything that is not one plain id (a list, a number, odd text) means "missing",
    // never a silent empty workflow. checkId only accepts a string shaped like an id.
    const id = checkId(params.draft);
    if (id.error) return { start: "missing" }; // not even shaped like an id: the database is not asked
    const read = await supabase.from("workflows").select("id, name, prompt, plan, updated_at").eq("id", id.value).eq("user_id", userId);
    if (read.error) {
      console.error("builder load failed:", read.error.code);
      return { start: "failed" };
    }
    const row = read.data?.[0];
    if (!row) return { start: "missing" };
    return {
      start: "draft",
      draft: { id: String(row.id), name: text(row.name), prompt: text(row.prompt), version: text(row.updated_at) },
      steps: Array.isArray(row.plan) ? row.plan.map(readSavedStep) : [],
    };
  }

  const template = templateById(single(params?.template));
  if (template) return { start: "template", name: template.title, prompt: template.request, steps: template.steps };
  return { start: "new" };
}
