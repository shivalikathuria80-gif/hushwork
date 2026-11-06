import "server-only";
import { getGroqKey } from "@/lib/ai/key";
import { loadMemory } from "@/lib/ai/memory";
import { takeDbSlot } from "@/lib/db-limits";
import { PAUSED_MESSAGE, isPaused } from "@/lib/app-controls";
import { googleAuthorization, linearAuthorization } from "@/lib/run-core";
import { fetchUpcomingEvents } from "@/lib/connectors/google-calendar";
import { fetchInbox } from "@/lib/connectors/google-gmail";
import { fetchLinearIssues, issueLine } from "@/lib/connectors/linear";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { listConnected, runReadTool } from "@/lib/connectors/composio";
import { findComposioApp } from "@/lib/connectors/composio-apps";
import { niceTime } from "@/lib/connectors/time-format";
import { cleanNotes, hasNewNote, thinkAgent } from "./brain.js";

// ONE LOOK by the Hushwork Agent (see brain.js): read every connected app, ask the AI once, save the notes. Used by the clock (with the all-access
// client) and by the "Look now" button (with the person's own client). Read-only everywhere. Returns { ok, status, notes, fresh } or { ok: false, error }.
export const AGENT_SETUP = "The agent needs one setup step: run supabase/agent.sql in Supabase.";
const NO_TABLE = new Set(["42P01", "PGRST205"]);

// The connected apps the agent reads through Composio (each one's read-only list), in this order, at most 3 per look.
const AGENT_APPS = ["stripeinvoices", "github", "todoist", "hubspot", "jira", "googletasks", "trello", "sentry"];

// What the person's apps show right now: [{ name, text }]. A failing app is left out; it never stops the look.
async function gatherData(supabase, userId) {
  const parts = [];
  const google = await googleAuthorization(supabase, userId).catch(() => null);
  if (google) {
    const events = await fetchUpcomingEvents({ authorization: google }).catch(() => null);
    if (events?.ok) parts.push({ name: "Calendar, next 7 days", text: events.events.length ? events.events.map((event) => `${event.start}  ${event.title}`).join("\n") : "No events." });
    const inbox = await fetchInbox({ authorization: google }).catch(() => null); // senders and subjects only, never the text of an email
    if (inbox?.ok) parts.push({ name: "Gmail inbox, newest (sender and subject only)", text: inbox.mails.length ? inbox.mails.map((mail) => `${mail.time}  ${mail.from}: ${mail.subject}`).join("\n") : "The inbox is empty." });
  }
  const linear = await linearAuthorization(supabase, userId).catch(() => null);
  if (linear) {
    const issues = await fetchLinearIssues({ authorization: linear }).catch(() => null);
    if (issues?.ok) parts.push({ name: "Linear, open tasks (status, due date, priority)", text: issues.issues.length ? issues.issues.map(issueLine).join("\n") : "No open tasks." });
  }
  const key = getComposioKey();
  if (key) {
    const listed = await listConnected({ key, userId }).catch(() => null);
    const toolkits = new Set(listed && !listed.error ? listed.accounts.map((account) => account.toolkit) : []);
    const apps = AGENT_APPS.map(findComposioApp).filter((app) => app && toolkits.has(app.toolkit)).slice(0, 3);
    for (const app of apps) {
      const answer = await runReadTool({ key, userId, app }).catch(() => null);
      if (answer?.ok) parts.push({ name: app.name, text: answer.text });
    }
  }
  return parts;
}

const save = (supabase, userId, values) => supabase.from("agent_state").update({ ...values, updated_at: new Date().toISOString() }).eq("user_id", userId);

export async function checkAgent({ supabase, userId, tzOffset = 0, now = Date.now() }) {
  if (await isPaused(supabase)) return { ok: false, error: PAUSED_MESSAGE };
  const groqKey = getGroqKey();
  if (!groqKey) return { ok: false, error: "AI is switched off (there is no Groq key), so the agent cannot look." };
  const { data, error } = await supabase.from("agent_state").select("notes").eq("user_id", userId).limit(1);
  if (error) return { ok: false, error: NO_TABLE.has(error.code) ? AGENT_SETUP : "Could not read the agent. Try again." };
  if (!data?.[0]) return { ok: false, error: "Turn the agent on first." };
  const shown = cleanNotes(data[0].notes);
  const checkedAt = new Date(now).toISOString();

  const parts = await gatherData(supabase, userId);
  if (!parts.length) {
    await save(supabase, userId, { checked_at: checkedAt, status: "nothing_connected", notes: [] });
    return { ok: true, status: "nothing_connected", notes: [], fresh: false };
  }
  const slot = await takeDbSlot(supabase, "ai_step", 3, 15); // a look is one of the person's 15 AI steps a day (the clock's client skips this count)
  if (!slot.ok) return { ok: false, error: slot.why === "limit_minute" ? "You did that a moment ago. Try again in a minute." : "You have used today's 15 AI steps. The agent looks again tomorrow." };

  const answer = await thinkAgent({ parts, shown, nowText: niceTime(now, { offset: tzOffset, suffix: "" }), groqKey, memory: await loadMemory(supabase, userId) });
  if (!answer.ok) {
    await save(supabase, userId, { checked_at: checkedAt, status: "failed" }); // the old notes stay on screen
    return { ok: false, error: answer.error };
  }
  const status = answer.notes.length ? "ok" : "quiet";
  const saved = await save(supabase, userId, { checked_at: checkedAt, status, notes: answer.notes });
  if (saved.error) return { ok: false, error: "The agent looked, but could not save what it found. Try again." };
  return { ok: true, status, notes: answer.notes, fresh: hasNewNote(shown, answer.notes) };
}
