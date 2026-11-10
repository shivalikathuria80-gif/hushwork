import "server-only";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { runActionTool } from "@/lib/connectors/composio";
import { checkTarget, findAction } from "@/lib/connectors/composio-actions";
import { DAILY_CAP, canSpeak, inQuietHours, localDayStartMs } from "@/lib/watch-rules";
import { deliver, loadNotifySettings, mintLinks, pushKeysFromEnv, waitingItems } from "@/lib/approve-notify";

// The email a person gets when a scheduled workflow stops working. It is sent ONLY when a schedule changes from working (or never run) to
// failed or stopped, so a broken schedule mails once, not every five minutes. It goes to the person's own address through their own
// Gmail (send) connection at Composio; with no connection or no Composio key nothing is sent and nothing breaks. The words never include
// anything from the run itself (no results, no step text): just the workflow's name and where to look.
const WHAT = { failed: "could not run", stopped: "stopped at a step that needs you" };

export const noticeText = (name, status, siteUrl) =>
  `Your scheduled workflow "${String(name).slice(0, 80)}" ${WHAT[status] ?? "needs you"}.\nOpen the Runs page to see why: ${siteUrl}/app/runs\nYou only get one email like this each time a schedule starts having trouble.`;

// `send` is runActionTool (a pretend one in tests). Returns "sent", or the reason it was skipped. Never throws.
export async function notifyScheduleProblem({ admin, userId, workflowId, status, send = runActionTool, key = getComposioKey(), siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "" }) {
  try {
    if (!key || !WHAT[status]) return "off";
    const { data: found } = await admin.auth.admin.getUserById(userId);
    const action = findAction("gmail_send");
    const target = checkTarget(action, found?.user?.email);
    if (target.error) return "no_address";
    const { data: workflows } = await admin.from("workflows").select("name").eq("user_id", userId).eq("id", workflowId).limit(1);
    const name = workflows?.[0]?.name ?? "a workflow";
    const result = await send({ key, userId, action, values: { target: target.value, title: "Hushwork: a scheduled workflow needs you", details: noticeText(name, status, siteUrl.replace(/\/$/, "")) } });
    return result.ok ? "sent" : "not_sent";
  } catch {
    console.error("a failure notice could not be sent");
    return "error";
  }
}

// ---- THE NUDGE: the one thing Hushwork does by itself -------------------------------------------------------------------------------------------
// After a scheduled run left a step waiting for the person's Approve, Hushwork may send ONE short plain email to the person THEMSELF (never anyone
// else) saying to open the Runs page. `reason` says why: "watch" (a watch workflow found something new), "arrived" (a start link started the run, lib/hook-receive.js) or "waiting" (any other scheduled run, an
// agent included, skipped its writing steps because the schedule does not allow writing). Rules (lib/watch-rules.js), the same for both: never
// between 20:00 and 08:00 their time, at most 3 a day per person in all. The words never include anything from the run (no step text, no findings)
// and never a link that approves anything (a person who switched on "review and approve" links in Settings gets links to a page that shows the words first, see below).
// To count the day, each email leaves a small "Told you" record (spoke: true); the number sent today is the number of those records since the
// person's local midnight. Nothing sent means nothing recorded. It never throws; it returns "sent" or the reason it did not send.
const NUDGE = {
  watch: {
    title: "Hushwork noticed something",
    text: (name, siteUrl) => `Hushwork noticed something in "${name}". Open the Runs page to read it and approve only what you want: ${siteUrl}/app/runs`,
    record: "Hushwork emailed you once to say it noticed something. Nothing was approved or sent for you.",
  },
  waiting: {
    title: "Hushwork: a step is waiting for you",
    text: (name, siteUrl) => `Your scheduled workflow "${name}" ran and has a step waiting for you. Open the Runs page to read it and approve only what you want: ${siteUrl}/app/runs`,
    record: "Hushwork emailed you once to say a step is waiting for you. Nothing was approved or sent for you.",
  },
  email: {
    title: "Hushwork: a new email started a workflow",
    text: (name, siteUrl) => `A new email started "${name}", and a step is waiting for you. Open the Runs page to read it and approve only what you want: ${siteUrl}/app/runs`,
    record: "Hushwork emailed you once to say a new email started this workflow and a step is waiting for you. Nothing was approved or sent for you.",
  },
  event: {
    title: "Hushwork: a new calendar event started a workflow",
    text: (name, siteUrl) => `A new calendar event started "${name}", and a step is waiting for you. Open the Runs page to read it and approve only what you want: ${siteUrl}/app/runs`,
    record: "Hushwork emailed you once to say a new calendar event started this workflow and a step is waiting for you. Nothing was approved or sent for you.",
  },
  arrived: {
    title: "Hushwork: something arrived",
    text: (name, siteUrl) => `Something arrived at the start link of "${name}", and a step is waiting for you. Open the Runs page to read it and approve only what you want: ${siteUrl}/app/runs`,
    record: "Hushwork emailed you once to say something arrived and a step is waiting for you. Nothing was approved or sent for you.",
  },
};
const nudgeOf = (reason) => NUDGE[reason] ?? NUDGE.watch;
export const watchText = (name, siteUrl, reason = "watch") => nudgeOf(reason).text(String(name).slice(0, 80), siteUrl);

// NOTIFICATION SETTINGS (supabase/notify.sql, lib/approve-notify.js). A person who saved none gets exactly the email above. A person who did:
//   * chose the daily digest: nothing is sent now ("digest"); the clock's digest names this step at their hour.
//   * else: the same limits, then one message on each channel they chose (email, a Slack direct message, push), naming the waiting steps by
//     their titles, and, only if they switched it on, one single-use "review and approve" link per step (lib/approve-links.js). The link opens a
//     page that shows the exact words first; it never approves by being opened.
export async function notifyWatch({ admin, userId, workflowId, runId, tzOffset, reason = "watch", now = Date.now(), send = runActionTool, key = getComposioKey(), siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "", pushKeys = pushKeysFromEnv(), fetchImpl }) {
  try {
    const settings = await loadNotifySettings(admin, userId);
    if (settings.saved && settings.digest) return "digest";
    if (!key && !(settings.saved && settings.push && pushKeys?.publicKey)) return "off";
    if (inQuietHours(now, tzOffset)) return "quiet_hours";
    const { data: told, error: countError } = await admin
      .from("runs").select("id")
      .eq("user_id", userId).eq("mode", "live")
      .contains("results", JSON.stringify([{ spoke: true }])) // JSON TEXT on purpose (see loadStepStates in lib/run-state.js)
      .gte("created_at", new Date(localDayStartMs(now, tzOffset)).toISOString()).limit(DAILY_CAP);
    if (countError || !Array.isArray(told)) return "error"; // cannot count how many times it spoke today, so it stays silent
    if (!canSpeak({ spokenToday: told.length, nowMs: now, tzOffset })) return "capped";
    const { data: found } = await admin.auth.admin.getUserById(userId);
    const { data: workflows } = await admin.from("workflows").select("name").eq("user_id", userId).eq("id", workflowId).limit(1);
    const name = workflows?.[0]?.name ?? "a workflow";
    if (settings.saved) {
      const who = { user: { id: userId, email: found?.user?.email ?? "" }, supabase: admin };
      let items = await waitingItems(who, { runId });
      if (!items.length) items = [{ runId, step: 0, title: "", workflow: name, willDo: "" }]; // still say something waits; no link without words
      else if (settings.links) items = await mintLinks(admin, userId, items, settings.email ? "email" : settings.slack ? "slack" : "push", { siteUrl, now });
      const told = await deliver({ admin, userId, settings, reason, name, items, send, key, siteUrl, pushKeys, fetchImpl, email: found?.user?.email ?? "", now });
      if (!told.any) return told.email === "no_address" ? "no_address" : "not_sent";
    } else {
      const action = findAction("gmail_send");
      const target = checkTarget(action, found?.user?.email);
      if (target.error) return "no_address";
      const result = await send({ key, userId, action, values: { target: target.value, title: nudgeOf(reason).title, details: watchText(name, siteUrl.replace(/\/$/, ""), reason) } });
      if (!result.ok) return "not_sent";
    }
    const { error: recordError } = await admin.from("runs").insert({
      user_id: userId, workflow_id: workflowId, workflow_name: name, mode: "live", status: "done",
      results: [{ icon: "Mail", title: "Told you", detail: "", status: "done", spoke: true, outcome: nudgeOf(reason).record, from: runId, fromStep: 0 }],
    });
    if (recordError) console.error("saving the watch record failed:", recordError.code);
    return "sent";
  } catch {
    console.error("a nudge could not be sent");
    return "error";
  }
}

// ---- THE HUSHWORK AGENT (lib/agent/) ---------------------------------------------------------------------------------------------------------------
// After a look that found a note the person has not seen, ONE short email to the person THEMSELF says to open the workspace. Looks happen only at
// 09:00, 13:00 and 17:00 their time (lib/agent/brain.js), so that is at most 3 emails a day and never at night. Like the watch email, the words
// never include what was found. It never throws; it returns "sent" or the reason it did not send.
export const agentText = (count, siteUrl) => `Your Hushwork agent noticed ${count === 1 ? "something that needs you" : `${count} things that need you`}. Open your workspace to read ${count === 1 ? "it" : "them"} and decide: ${siteUrl}/app\nThe agent only reads. Nothing was sent or changed for you. To stop these emails, turn the agent off on that page.`;

export async function notifyAgent({ admin, userId, notes, send = runActionTool, key = getComposioKey(), siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "" }) {
  try {
    if (!key) return "off";
    const { data: found } = await admin.auth.admin.getUserById(userId);
    const action = findAction("gmail_send");
    const target = checkTarget(action, found?.user?.email);
    if (target.error) return "no_address";
    const count = Array.isArray(notes) ? notes.length : 1;
    const result = await send({ key, userId, action, values: { target: target.value, title: "Your Hushwork agent noticed something", details: agentText(count, siteUrl.replace(/\/$/, "")) } });
    return result.ok ? "sent" : "not_sent";
  } catch {
    console.error("an agent email could not be sent");
    return "error";
  }
}
