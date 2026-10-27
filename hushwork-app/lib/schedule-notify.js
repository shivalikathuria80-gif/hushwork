import "server-only";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { runActionTool } from "@/lib/connectors/composio";
import { checkTarget, findAction } from "@/lib/connectors/composio-actions";
import { DAILY_CAP, canSpeak, inQuietHours, localDayStartMs } from "@/lib/watch-rules";

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

// ---- WATCH MODE: the one thing Hushwork does by itself ------------------------------------------------------------------------------------------
// After a watch run found something new and left a step waiting for the person's Approve, Hushwork may send ONE short plain email to the person
// THEMSELF (never anyone else) saying to open the Runs page. Rules (lib/watch-rules.js): never between 20:00 and 08:00 their time, at most 3 a day
// per person. The words never include anything from the run (no step text, no findings) and never a link that approves anything.
// To count the day, each email leaves a small "Told you" record (spoke: true); the number sent today is the number of those records since the
// person's local midnight. Nothing sent means nothing recorded. It never throws; it returns "sent" or the reason it did not send.
export const watchText = (name, siteUrl) => `Hushwork noticed something in "${String(name).slice(0, 80)}". Open the Runs page to read it and approve only what you want: ${siteUrl}/app/runs`;

export async function notifyWatch({ admin, userId, workflowId, runId, tzOffset, now = Date.now(), send = runActionTool, key = getComposioKey(), siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "" }) {
  try {
    if (!key) return "off";
    if (inQuietHours(now, tzOffset)) return "quiet_hours";
    const { data: told, error: countError } = await admin
      .from("runs").select("id")
      .eq("user_id", userId).eq("mode", "live")
      .contains("results", JSON.stringify([{ spoke: true }])) // JSON TEXT on purpose (see loadStepStates in lib/run-state.js)
      .gte("created_at", new Date(localDayStartMs(now, tzOffset)).toISOString()).limit(DAILY_CAP);
    if (countError || !Array.isArray(told)) return "error"; // cannot count how many times it spoke today, so it stays silent
    if (!canSpeak({ spokenToday: told.length, nowMs: now, tzOffset })) return "capped";
    const { data: found } = await admin.auth.admin.getUserById(userId);
    const action = findAction("gmail_send");
    const target = checkTarget(action, found?.user?.email);
    if (target.error) return "no_address";
    const { data: workflows } = await admin.from("workflows").select("name").eq("user_id", userId).eq("id", workflowId).limit(1);
    const name = workflows?.[0]?.name ?? "a workflow";
    const result = await send({ key, userId, action, values: { target: target.value, title: "Hushwork noticed something", details: watchText(name, siteUrl.replace(/\/$/, "")) } });
    if (!result.ok) return "not_sent";
    const { error: recordError } = await admin.from("runs").insert({
      user_id: userId, workflow_id: workflowId, workflow_name: name, mode: "live", status: "done",
      results: [{ icon: "Mail", title: "Told you", detail: "", status: "done", spoke: true, outcome: "Hushwork emailed you once to say it noticed something. Nothing was approved or sent for you.", from: runId, fromStep: 0 }],
    });
    if (recordError) console.error("saving the watch record failed:", recordError.code);
    return "sent";
  } catch {
    console.error("a watch notice could not be sent");
    return "error";
  }
}
