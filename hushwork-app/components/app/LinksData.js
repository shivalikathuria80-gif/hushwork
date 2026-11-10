import { headers } from "next/headers";
import { Icon } from "../icons";
import LinksBoard from "./LinksBoard";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HOOK_LIMITS, HOOK_SETUP, INCOMING_TAG, NO_COLUMN, REPEAT_WINDOWS, hookUrl, looksLikeCode, looksLikeSecret, looksLikeStyle, readPreview } from "@/lib/hooks";
import { fieldKey, fieldTag, hasFieldTag, readFieldList, tagsIn } from "@/lib/hook-fields";
import { WATCH_LIMITS, isWatchSource } from "@/lib/app-events";
import { NO_DATA_SETUP, readCap, readKeep } from "@/lib/hook-data";

// "Start links": the server half. It reads the person's workflows, their links and what arrived in the last 14 days, and hands plain values
// to LinksBoard. The page wraps this in <Suspense>.

const text = (value) => (typeof value === "string" ? value : "");
const NO_TABLE = new Set(["42P01", "PGRST205"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const clock = () => Date.now(); // read once per request
const STATUSES = new Set(["started", "limited", "off", "failed", "refused", "duplicate", "capped"]);
// A step that fills {incoming.name} in (an email's To, subject or text, a Sheet box). An Ask the AI job reads what arrived through {incoming} instead.
const usesFields = (step) => ["action", "row"].includes(step?.kind) && step.fields && typeof step.fields === "object" && Object.values(step.fields).some((value) => hasFieldTag(text(value)));

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
  let keepsFields = true;
  let watches = [];
  let watchSetup = false; // supabase/app-events.sql not run yet: the "From your apps" part says so, start links keep working
  let dataReady = true; // false until supabase/hooks-data.sql is run (then the data controls say so instead of failing)
  try {
    const supabase = await createClient();
    // Arrivals with every field (supabase/hook-fields.sql); a database without that column yet gives the short preview only.
    const arrivalsWith = (columns) => supabase.from("hook_events").select(columns).eq("user_id", user.id)
      .gte("created_at", new Date(now - 14 * DAY_MS).toISOString()).order("created_at", { ascending: false }).limit(300);
    const linkRows = (columns) => supabase.from("hooks").select(columns).eq("user_id", user.id).order("created_at", { ascending: true }).limit(HOOK_LIMITS.maxLinks);
    const BASE = "id, workflow_id, code, enabled, received_count, last_received_at, created_at, tz_offset";
    const DATA = "keep_days, daily_cap"; // supabase/hooks-data.sql
    let [flows, hooks, firstEvents, watchRows, watchEvents] = await Promise.all([
      supabase.from("workflows").select("id, name, plan").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100),
      linkRows(`${BASE}, signing_style, signing_secret, ${DATA}`),
      arrivalsWith("id, hook_id, status, run_id, preview, fields, test, created_at"),
      supabase.from("app_watches").select("id, workflow_id, source, filter, enabled, last_checked_at, last_status, last_error, started_count, last_started_at, created_at").eq("user_id", user.id).order("created_at", { ascending: true }).limit(WATCH_LIMITS.maxWatches),
      supabase.from("app_watch_events").select("id, watch_id, status, run_id, preview, created_at").eq("user_id", user.id)
        .gte("created_at", new Date(now - 14 * DAY_MS).toISOString()).order("created_at", { ascending: false }).limit(300),
    ]);
    const events = firstEvents.error && NO_COLUMN.has(firstEvents.error.code) ? await arrivalsWith("id, hook_id, status, run_id, preview, test, created_at") : firstEvents;
    if (events !== firstEvents && !events.error) keepsFields = false;
    // 42703: the sender-check columns are not there yet (supabase/hooks-signing.sql not run): show the links without it.
    // Each optional part is tried away in turn: the sender check (hooks-signing.sql), the data controls (hooks-data.sql).
    let signingReady = true;
    if (hooks.error && NO_DATA_SETUP.has(hooks.error.code)) {
      hooks = await linkRows(`${BASE}, signing_style, signing_secret`);
      dataReady = false;
    }
    if (hooks.error && NO_DATA_SETUP.has(hooks.error.code)) {
      hooks = await linkRows(`${BASE}, ${DATA}`);
      signingReady = false;
      dataReady = !hooks.error;
    }
    if (hooks.error && NO_DATA_SETUP.has(hooks.error.code)) {
      hooks = await linkRows(BASE);
      dataReady = false;
    }
    if (flows.error) {
      console.error("Loading start links failed:", flows.error.code);
      failure = NO_TABLE.has(flows.error.code) ? "Hushwork's database is not set up yet. Run the files in the supabase folder first." : "Check your connection and try again.";
    } else if (hooks.error && !NO_TABLE.has(hooks.error.code)) {
      console.error("Loading start links failed:", hooks.error.code);
      failure = "Check your connection and try again.";
    } else {
      setup = Boolean(hooks.error); // start links are not set up yet: the page still shows what your apps started
      const origin = await siteOrigin();
      const flowOf = new Map(flows.data.map((row) => {
        const plan = Array.isArray(row.plan) ? row.plan : [];
        return [text(row.id), {
          name: text(row.name) || "Untitled workflow",
          hasStart: plan[0]?.kind === "trigger",
          readsIncoming: plan.some((step) => (step?.kind === "ai" && text(step.fields?.task).includes(INCOMING_TAG)) || usesFields(step)),
          // the {incoming.name} tags its steps use, so the page can say which of them the latest arrival did not have
          tags: [...new Set(plan.flatMap((step) => (usesFields(step) ? Object.values(step.fields).flatMap((value) => tagsIn(text(value))) : [])))].slice(0, 20),
          writes: plan.filter((step) => ["action", "row", "issue"].includes(step?.kind)).length,
        }];
      }));
      links = (hooks.data ?? []).filter((row) => flowOf.has(text(row.workflow_id)) && looksLikeCode(row.code)).map((row) => ({
        id: text(row.id), workflowId: text(row.workflow_id), ...flowOf.get(text(row.workflow_id)),
        url: hookUrl(origin, row.code), enabled: row.enabled === true,
        count: Number(row.received_count) || 0, lastAt: text(row.last_received_at),
        // The sender check. The secret is the owner's own (like the code in the address) and is needed to sign "Send a test".
        signing: signingReady && looksLikeStyle(row.signing_style) && looksLikeSecret(row.signing_secret) ? { style: row.signing_style, secret: row.signing_secret } : { style: "none", secret: "" },
        signingReady,
        keepDays: readKeep(row.keep_days), dailyCap: readCap(row.daily_cap), tzOffset: Number.isInteger(row.tz_offset) ? row.tz_offset : 0,
      }));
      // How many arrivals each link holds in all (the page itself reads only the last 14 days).
      if (dataReady) {
        const held = await Promise.all(links.map((link) => supabase.from("hook_events").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("hook_id", link.id)));
        links = links.map((link, index) => ({ ...link, held: held[index].error ? null : Number(held[index].count) || 0 }));
      }
      const linked = new Set(links.map((link) => link.workflowId));
      const nameOf = new Map(links.map((link) => [link.id, link.name]));
      candidates = [...flowOf.entries()].filter(([id]) => !linked.has(id)).map(([id, flow]) => ({ id, name: flow.name, hasStart: flow.hasStart, readsIncoming: flow.readsIncoming }));
      if (!events.error && !setup) {
        arrivals = events.data.filter((row) => nameOf.has(text(row.hook_id))).map((row) => ({
          id: text(row.id), linkId: text(row.hook_id), name: nameOf.get(text(row.hook_id)), status: STATUSES.has(row.status) ? row.status : "failed",
          runId: text(row.run_id), test: row.test === true, at: text(row.created_at),
          ...(Array.isArray(row.fields) ? { fields: readFieldList(row.fields), full: true } : { fields: readPreview(row.preview), full: false }),
        }));
        // Each link's newest arrival that kept its fields: the names its steps can use as {incoming.name}.
        for (const link of links) {
          const newest = arrivals.find((arrival) => arrival.linkId === link.id && arrival.full && arrival.fields.length > 0);
          link.fields = newest ? newest.fields.map((field) => ({ name: field.name, tag: fieldTag(field.name), sample: field.value.slice(0, 80) })) : [];
          const have = new Set(link.fields.map((field) => fieldKey(field.name)));
          link.missing = newest ? link.tags.filter((key) => !have.has(key)) : [];
        }
      }
      // FROM YOUR APPS: watched workflows ("When an email arrives", "When a calendar event is added") and what they started (lib/app-events.js).
      if (watchRows.error) watchSetup = NO_TABLE.has(watchRows.error.code);
      else {
        watches = watchRows.data.filter((row) => flowOf.has(text(row.workflow_id)) && isWatchSource(row.source)).map((row) => ({
          id: text(row.id), workflowId: text(row.workflow_id), name: flowOf.get(text(row.workflow_id)).name, readsIncoming: flowOf.get(text(row.workflow_id)).readsIncoming,
          source: row.source, filter: text(row.filter), enabled: row.enabled === true, checkedAt: text(row.last_checked_at),
          status: ["ok", "new", "limited", "not_connected", "failed"].includes(row.last_status) ? row.last_status : "", error: text(row.last_error).slice(0, 300),
          count: Number(row.started_count) || 0, lastAt: text(row.last_started_at),
        }));
        const watchOf = new Map(watches.map((watch) => [watch.id, watch]));
        if (!watchEvents.error) {
          arrivals.push(...watchEvents.data.filter((row) => watchOf.has(text(row.watch_id))).map((row) => ({
            id: text(row.id), watchId: text(row.watch_id), source: watchOf.get(text(row.watch_id)).source, name: watchOf.get(text(row.watch_id)).name,
            status: STATUSES.has(row.status) ? row.status : "failed", runId: text(row.run_id), test: false, at: text(row.created_at), fields: readPreview(row.preview), full: false,
          })));
          arrivals.sort((a, b) => b.at.localeCompare(a.at)); // links and apps in one list, newest first
        }
      }
    }
  } catch {
    failure = "Check your connection and try again.";
  }
  if (failure) return <Problem>{failure}</Problem>;
  if (setup && watchSetup) return <Problem title="One setup step is left">{HOOK_SETUP} Nothing else in Hushwork is affected until then.</Problem>;
  return <LinksBoard linksSetup={setup ? HOOK_SETUP : ""} watches={watches} watchSetup={watchSetup} links={links} arrivals={arrivals} candidates={candidates} keepsFields={keepsFields} limits={{ perMinute: HOOK_LIMITS.perMinute, perDay: HOOK_LIMITS.perDay, maxLinks: HOOK_LIMITS.maxLinks, watchPerDay: WATCH_LIMITS.perDay, repeatMinutes: REPEAT_WINDOWS.body / 60_000, repeatDays: REPEAT_WINDOWS.id / 86_400_000 }} dataReady={dataReady} />;
}
