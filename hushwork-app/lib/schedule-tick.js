import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getCronSecret } from "@/lib/schedule-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDueSchedules } from "@/lib/schedule-runner";
import { startPracticeRun } from "@/lib/run-core";
import { notifyAgent, notifyScheduleProblem, notifyWatch } from "@/lib/schedule-notify";
import { isPaused } from "@/lib/app-controls";
import { runDueAgents } from "@/lib/agent/runner";
import { checkAgent } from "@/lib/agent/check";

// What the clock calls (app/api/cron/tick). It does NOTHING unless the call carries the clock's password in the Authorization header
// ("Bearer <CRON_SECRET>"; Vercel Cron sends exactly that when CRON_SECRET is set). Answers are small and never hold anyone's data:
//   503  scheduled runs are not switched on (no password or no database key in the settings)
//   401  wrong or missing password
//   200  { ok, due, ran, stopped, failed, skipped }
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const reply = (status, body) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

// How long one clock call may keep STARTING work. Runs are done one after another, and a schedule with several AI steps can take half a minute, so
// 20 due schedules could run for minutes: the host would cut the call off halfway through a run, and the clock's next calls would pile up on top of
// it. After this budget, whatever is left stays due and the next call (a minute later) takes it.
export const TICK_BUDGET_MS = 45_000;

export async function handleTick(request) {
  const deadline = Date.now() + TICK_BUDGET_MS;
  const secret = getCronSecret();
  const admin = secret ? createAdminClient() : null;
  if (!secret || !admin) return reply(503, { ok: false, error: "Scheduled runs are not switched on." });

  const sent = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!sent || !same(sent, secret)) return reply(401, { ok: false, error: "Wrong or missing password." });

  if (await isPaused(admin)) return reply(200, { ok: true, paused: true, due: 0, ran: 0, stopped: 0, failed: 0, skipped: 0 }); // the pause switch: no schedule is claimed or run, they wait
  const summary = await runDueSchedules({ admin, run: startPracticeRun, notify: (problem) => notifyScheduleProblem({ admin, ...problem }), nudge: (watch) => notifyWatch({ admin, ...watch }), deadline });
  // The Hushwork Agent's looks (lib/agent/). A problem there never fails the schedules above.
  const agents = await runDueAgents({ admin, check: checkAgent, nudge: (found) => notifyAgent({ admin, ...found }), deadline }).catch(() => ({ ok: false }));
  return reply(summary.ok ? 200 : 500, { ...summary, agents: { looked: agents.looked ?? 0, told: agents.told ?? 0 } });
}
