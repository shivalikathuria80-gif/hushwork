import "server-only";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { runActionTool } from "@/lib/connectors/composio";
import { checkTarget, findAction } from "@/lib/connectors/composio-actions";

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
