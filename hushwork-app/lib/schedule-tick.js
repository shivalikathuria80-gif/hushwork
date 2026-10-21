import "server-only";
import { timingSafeEqual } from "node:crypto";
import { getCronSecret } from "@/lib/schedule-env";
import { createAdminClient } from "@/lib/supabase/admin";
import { runDueSchedules } from "@/lib/schedule-runner";
import { startPracticeRun } from "@/lib/run-core";

// What the clock calls (app/api/cron/tick). It does NOTHING unless the call carries the clock's password in the Authorization header
// ("Bearer <CRON_SECRET>"; Vercel Cron sends exactly that when CRON_SECRET is set). Answers are small and never hold anyone's data:
//   503  scheduled runs are not switched on (no password or no database key in the settings)
//   401  wrong or missing password
//   200  { ok, due, ran, stopped, failed, skipped }
const same = (a, b) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const reply = (status, body) => Response.json(body, { status, headers: { "cache-control": "no-store" } });

export async function handleTick(request) {
  const secret = getCronSecret();
  const admin = secret ? createAdminClient() : null;
  if (!secret || !admin) return reply(503, { ok: false, error: "Scheduled runs are not switched on." });

  const sent = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!sent || !same(sent, secret)) return reply(401, { ok: false, error: "Wrong or missing password." });

  const summary = await runDueSchedules({ admin, run: startPracticeRun });
  return reply(summary.ok ? 200 : 500, summary);
}
