"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { AGENT_SETUP, checkAgent } from "@/lib/agent/check";
import { cleanNotes, cleanOffset, nextCheckAt } from "@/lib/agent/brain";

// The Hushwork Agent's buttons on the workspace. Each works out WHO is asking from the session; the browser only sends its time-zone offset or
// the title of a note. Every database call uses the person's own client, so the database rules keep each person to their own row.
// Each returns { ok: true, ... } or { error } (a plain sentence).
const NO_TABLE = new Set(["42P01", "PGRST205"]);
const failed = (error) => ({ error: NO_TABLE.has(error?.code) ? AGENT_SETUP : "Could not change the agent. Try again." });

// "Turn on the agent": saves the switch and the person's time zone, then takes the first look straight away so they see what it does.
// user_id is never sent: the database fills it in from the session (and the person is not allowed to write it).
export async function turnAgentOn(input) {
  const user = await requireUser();
  const supabase = await createClient();
  const tzOffset = cleanOffset(input?.tzOffset);
  const now = Date.now();
  const { error } = await supabase.from("agent_state").upsert({ enabled: true, tz_offset: tzOffset, next_check_at: new Date(nextCheckAt(now, tzOffset)).toISOString(), updated_at: new Date(now).toISOString() });
  if (error) return failed(error);
  const look = await checkAgent({ supabase, userId: user.id, tzOffset, now });
  revalidatePath("/app");
  return look.ok ? { ok: true } : { ok: true, note: `The agent is on. Its first look did not work: ${look.error}` };
}

export async function turnAgentOff() {
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("agent_state").update({ enabled: false, next_check_at: null, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (error) return failed(error);
  revalidatePath("/app");
  return { ok: true };
}

// "Look now": one look outside the three set times (it uses one of the person's AI steps). No email: the person is already looking.
export async function lookNow(input) {
  const user = await requireUser();
  const supabase = await createClient();
  const look = await checkAgent({ supabase, userId: user.id, tzOffset: cleanOffset(input?.tzOffset) });
  revalidatePath("/app");
  return look.ok ? { ok: true } : { error: look.error };
}

// "Dismiss": hides one note (found by its title). It stays in the saved list, marked, so the next look knows it was already shown.
export async function dismissNote(input) {
  const user = await requireUser();
  const supabase = await createClient();
  const title = typeof input?.title === "string" ? input.title : "";
  const { data, error } = await supabase.from("agent_state").select("notes").eq("user_id", user.id).limit(1);
  if (error) return failed(error);
  const notes = cleanNotes(data?.[0]?.notes).map((note) => (note.title === title ? { ...note, dismissed: true } : note));
  const saved = await supabase.from("agent_state").update({ notes, updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (saved.error) return failed(saved.error);
  revalidatePath("/app");
  return { ok: true };
}
