// The public agent pages (/agents and /agents/<id>) and the "Share this agent" link (/agents/try?a=<sentence>).
// Pure data and small functions, no React or Next.js, so tests and both sides of the app can load it.
//
// A public page shows a ready-made template (lib/templates.js) to someone who is not signed in: what it does, what it needs and its steps
// in plain words. Nothing on these pages reads a sign-in or the database. "Use this agent" goes through the sign-in page and comes back to
// the Builder with that template open (lib/next-path.js allows exactly that address).
//
// A shared agent is only a SENTENCE in the link. It is shown as text and, after sign-in, put in the Agents box; nothing is made or run until
// the person reads it and presses Create agent. Because anyone can write such a link, the page says it was shared by someone, is never
// indexed, and the sentence is cleaned and cut short.
import { TEMPLATES, templateById } from "./templates.js";
import { PACKS, packOf, suggestedSchedule } from "./template-packs.js";

export { SHARE_MAX, cleanShared, sharedSignupHref, sharedPath } from "./shared-agent.js";

// The address of the public page for a template id.
export const agentPath = (id) => `/agents/${id}`;

// Sign up (or sign in) first, then land in the Builder with this template open (lib/next-path.js allows exactly this).
export const templateSignupHref = (id) => `/login?next=${encodeURIComponent(`/app/builder?template=${id}`)}#create`;

const PACK_LABEL = Object.fromEntries(PACKS.map((pack) => [pack.id, pack.label]));

// What the AI may look at, in the words of a visitor.
const LOOKS_AT = {
  linear: "your open Linear tasks", calendar: "your Google Calendar", gmail: "the senders and subjects of your latest emails",
  gmailtext: "your latest emails", drive: "the names of your newest Google Drive files", web: "one web page", mcp: "an MCP server", nothing: "",
};

// One step of a template in plain words for a visitor: { kind, title, detail, approve }. `approve` is true for a step that sends or creates
// something (it waits for the person's Approve). The {answer} / {myEmail} placeholders are said in words instead.
const words = (text) => String(text ?? "").replaceAll("{answers}", "what the AI found").replaceAll("{answer}", "what the AI found").replaceAll(" ({myEmail})", "").replaceAll(" (the step says {myEmail})", "").replaceAll("{myEmail}", "you");

function plainStep(step) {
  if (step.kind === "trigger") return { kind: "trigger", title: step.fields.how === "schedule" ? "Starts by itself" : "Starts when you press Run", detail: step.fields.how === "schedule" ? step.fields.when : "", approve: false };
  if (step.kind === "ai") {
    const where = step.fields.uses === "app" && step.fields.address.startsWith("gmailsearch:") ? "your sent emails (who replied, never the text)" : step.fields.uses === "app" ? "an app you connected" : LOOKS_AT[step.fields.uses] ?? "";
    return { kind: "ai", title: where ? `The AI reads ${where}` : "The AI thinks it through", detail: words(step.fields.task), approve: false };
  }
  if (step.kind === "action" && step.fields.action === "gmail_send") return { kind: "action", title: step.fields.target === "{myEmail}" ? "Emails you" : "Sends an email", detail: words(step.fields.title), approve: true };
  if (step.kind === "issue") return { kind: "issue", title: "Creates a Linear task", detail: words(step.fields.title), approve: true };
  return { kind: step.kind, title: words(step.title), detail: words(step.kind === "action" ? step.fields.title : ""), approve: step.kind === "action" || step.kind === "row" };
}

// Everything a public page shows for one template, or null for an unknown id.
export function publicAgent(id) {
  const template = templateById(id);
  if (!template) return null;
  const pack = packOf(template);
  return {
    id: template.id,
    icon: template.icon,
    title: template.title,
    body: words(template.body),
    request: template.request ?? "",
    needs: template.needs ?? "",
    pack,
    packLabel: PACK_LABEL[pack],
    schedule: suggestedSchedule(template),
    steps: template.steps.map(plainStep),
  };
}

// Every template, grouped by pack in the order of PACKS, for the /agents list.
export function publicAgentGroups() {
  return PACKS.map((pack) => ({ ...pack, agents: TEMPLATES.filter((template) => packOf(template) === pack.id).map((template) => publicAgent(template.id)).filter(Boolean) }))
    .filter((group) => group.agents.length > 0);
}

// Every template id, for the sitemap and for building the pages ahead of time.
export const publicAgentIds = () => TEMPLATES.map((template) => template.id);

// A short description for search results: the template's body, cut at a sentence end near 155 characters.
export function metaDescription(body) {
  const text = String(body ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= 158) return text;
  const cut = text.slice(0, 158);
  const end = cut.lastIndexOf(". ");
  return end > 80 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}…`;
}

// "Works with Linear, Gmail (send)", or "Needs no app" for a template that needs nothing.
export const needsLine = (needs) => (!needs || needs === "Nothing" ? "Needs no app" : `Works with ${needs}`);
