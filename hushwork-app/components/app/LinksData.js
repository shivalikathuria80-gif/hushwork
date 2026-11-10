import { headers } from "next/headers";
import { Icon } from "../icons";
import LinksBoard from "./LinksBoard";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HOOK_LIMITS, HOOK_SETUP, INCOMING_TAG, hookUrl, looksLikeCode, readPreview } from "@/lib/hooks";

// "Start links": the server half. It reads the person's workflows, their links and what arrived in the last 14 days, and hands plain values
// to LinksBoard. The page wraps this in <Suspense>.

const text = (value) => (typeof value === "string" ? value : "");
const NO_TABLE = new Set(["42P01", "PGRST205"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const clock = () => Date.now(); // read once per request
const STATUSES = new Set(["started", "limited", "off", "failed"]);

export function LinksFallback() {
  return (
    <div aria-busy="true" className="mt-8 space-y-4">
      <p role="status" className="sr-only">Loading your start links</p>
      <div aria-hidden="true" className="h-56 rounded-[28px] border border-line bg-raised" />
      <div aria-hidden="true" className="h-[320px] rounded-[28px] border border-line bg-raised" />
    </div>
  );
}

function Problem({ title = "Your start links could not be shown", children }) {
  return (
    <div className="mt-8 rounded-[28px] border border-line bg-surface p-5">
      <Icon name="CircleAlert" className="text-error" />
      <p className="mt-2 font-semibold">{title}</p>
      <p className="mt-1 text-sm text-mute">{children}</p>
    </div>
  );
}

// The site's own address, for the full link. The setting wins; otherwise the address this very request came to.
async function siteOrigin() {
  const set = text(process.env.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, "");
  if (/^https?:\/\//.test(set)) return set;
  const list = await headers();
  const host = text(list.get("x-forwarded-host")) || text(list.get("host"));
  if (!/^[A-Za-z0-9.-]+(?::\d+)?$/.test(host)) return "";
  const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  return `${local ? "http" : "https"}://${host}`;
}

export default async function LinksData() {
  const user = await requireUser(); // outside try/catch on purpose: a signed-out visitor is redirected
  const now = clock();
  let failure = "";
  let setup = false;
  let links = [];
  let arrivals = [];
  let candidates = [];
  try {
    const supabase = await createClient();
    const [flows, hooks, events] = await Promise.all([
      supabase.from("workflows").select("id, name, plan").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100),
      supabase.from("hooks").select("id, workflow_id, code, enabled, received_count, last_received_at, created_at").eq("user_id", user.id).order("created_at", { ascending: true }).limit(HOOK_LIMITS.maxLinks),
      supabase.from("hook_events").select("id, hook_id, status, run_id, preview, test, created_at").eq("user_id", user.id)
        .gte("created_at", new Date(now - 14 * DAY_MS).toISOString()).order("created_at", { ascending: false }).limit(300),
    ]);
    if (flows.error) {
      console.error("Loading start links failed:", flows.error.code);
      failure = NO_TABLE.has(flows.error.code) ? "Hushwork's database is not set up yet. Run the files in the supabase folder first." : "Check your connection and try again.";
    } else if (hooks.error) {
      if (NO_TABLE.has(hooks.error.code)) setup = true;
      else {
        console.error("Loading start links failed:", hooks.error.code);
        failure = "Check your connection and try again.";
      }
    } else {
      const origin = await siteOrigin();
      const flowOf = new Map(flows.data.map((row) => {
        const plan = Array.isArray(row.plan) ? row.plan : [];
        return [text(row.id), {
          name: text(row.name) || "Untitled workflow",
          hasStart: plan[0]?.kind === "trigger",
          readsIncoming: plan.some((step) => step?.kind === "ai" && text(step.fields?.task).includes(INCOMING_TAG)),
          writes: plan.filter((step) => ["action", "row", "issue"].includes(step?.kind)).length,
        }];
      }));
      links = hooks.data.filter((row) => flowOf.has(text(row.workflow_id)) && looksLikeCode(row.code)).map((row) => ({
        id: text(row.id), workflowId: text(row.workflow_id), ...flowOf.get(text(row.workflow_id)),
        url: hookUrl(origin, row.code), enabled: row.enabled === true,
        count: Number(row.received_count) || 0, lastAt: text(row.last_received_at),
      }));
      const linked = new Set(links.map((link) => link.workflowId));
      const nameOf = new Map(links.map((link) => [link.id, link.name]));
      candidates = [...flowOf.entries()].filter(([id]) => !linked.has(id)).map(([id, flow]) => ({ id, name: flow.name, hasStart: flow.hasStart, readsIncoming: flow.readsIncoming }));
      if (!events.error) {
        arrivals = events.data.filter((row) => nameOf.has(text(row.hook_id))).map((row) => ({
          id: text(row.id), linkId: text(row.hook_id), name: nameOf.get(text(row.hook_id)), status: STATUSES.has(row.status) ? row.status : "failed",
          runId: text(row.run_id), test: row.test === true, at: text(row.created_at), fields: readPreview(row.preview),
        }));
      }
    }
  } catch {
    failure = "Check your connection and try again.";
  }
  if (failure) return <Problem>{failure}</Problem>;
  if (setup) return <Problem title="One setup step is left">{HOOK_SETUP} Nothing else in Hushwork is affected until then.</Problem>;
  return <LinksBoard links={links} arrivals={arrivals} candidates={candidates} limits={{ perMinute: HOOK_LIMITS.perMinute, perDay: HOOK_LIMITS.perDay, maxLinks: HOOK_LIMITS.maxLinks }} />;
}
