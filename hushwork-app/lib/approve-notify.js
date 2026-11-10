// APPROVE FROM A NOTIFICATION: telling the person (lib/approve-links.js has the rules and the words). Plain code: the database client, the
// email/Slack sender and fetch are all handed in, so `node --test` runs it against pretend ones. Nothing here throws.
//
//   loadNotifySettings  the person's choices (a missing row = email only, no links, each time: Hushwork's behaviour before this feature)
//   waitingItems        the steps waiting for them, each with its exact `will_do` words (the same ones the Runs page and the plugin show)
//   mintLinks           one single-use "review and approve" link per step, saved as hashes only
//   deliver             one message per channel: email (their own Gmail connection, to their own address), Slack (a direct message to
//                       them only), push (each browser they switched on). Returns what happened on each.
//   runDigests          the clock's part: once a day, at the hour they chose, one digest of everything that waits
import { DEFAULT_SETTINGS, LINK_LIFE_MS, MAX_ITEMS, approveUrl, digestDue, makeApproveCode, noticeText, noticeTitle, pushPayload, readSettings, sha256, slackText } from "./approve-links.js";
import { sendPush } from "./web-push.js";
import { readRun, listWaiting } from "./plugin/tools.js";
import { findAction, checkTarget } from "./connectors/composio-actions.js";
import { localDayStartMs, localHour } from "./watch-rules.js";

export async function loadNotifySettings(admin, userId) {
  try {
    const { data, error } = await admin.from("notify_settings").select("email, slack, slack_to, push, links, digest, digest_hour, tz_offset, last_digest_at").eq("user_id", userId).limit(1);
    if (error) return { ...DEFAULT_SETTINGS };
    return readSettings(data?.[0]);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

// `who` = { user: { id, email }, supabase } (the all-access client is fine: every read here names the person). With `runId`, only that run's
// waiting steps; without, every agent's and workflow's latest waiting steps (for the digest). Returns [{ runId, step, title, workflow, willDo }].
export async function waitingItems(who, { runId = null } = {}) {
  try {
    if (runId) {
      const read = await readRun(who, runId);
      if (!read.run) return [];
      return read.run.steps
        .filter((step) => step.state === "waiting for approval" && typeof step.will_do === "string")
        .map((step) => ({ runId: read.run.id, step: step.step, title: step.title, workflow: read.run.name, willDo: step.will_do }));
    }
    const listed = await listWaiting({}, who);
    if (listed.error) return [];
    return listed.waiting
      .filter((step) => typeof step.will_do === "string")
      .map((step) => ({ runId: step.run_id, step: step.step, title: step.title, workflow: step.agent, willDo: step.will_do }));
  } catch {
    return [];
  }
}

// One link per item (at most MAX_ITEMS). A link that could not be saved is simply left out of the message: the step is still named.
export async function mintLinks(admin, userId, items, channel, { siteUrl, now = Date.now() } = {}) {
  const out = [];
  for (const item of items.slice(0, MAX_ITEMS)) {
    const { code, hash } = makeApproveCode();
    const { error } = await admin.from("approve_links").insert({
      user_id: userId, code_hash: hash, run_id: item.runId, step_index: item.step, words_hash: sha256(item.willDo), channel,
      expires_at: new Date(now + LINK_LIFE_MS).toISOString(), created_at: new Date(now).toISOString(),
    });
    if (error) console.error("saving an approve link failed:", error.code);
    out.push(error ? { ...item } : { ...item, url: approveUrl(siteUrl, code) });
  }
  return [...out, ...items.slice(MAX_ITEMS)];
}

// Sends the message on each channel the person chose. `send` is runActionTool (pretend in tests), `key` the Composio key (email and Slack need it),
// `pushKeys` = { publicKey, privateKey, subject } (push needs them). Returns { email, slack, push, any }.
export async function deliver({ admin, userId, settings, reason, name, items, send, key, siteUrl, pushKeys, fetchImpl, email = "", now = Date.now() }) {
  const site = String(siteUrl ?? "").replace(/\/$/, "");
  const shown = items.slice(0, MAX_ITEMS);
  const more = Math.max(0, items.length - shown.length);
  const words = { reason, name, items: shown, siteUrl: site, more };
  const result = { email: "off", slack: "off", push: "off" };

  if (settings.email) {
    if (!key) result.email = "off";
    else {
      const action = findAction("gmail_send");
      const target = checkTarget(action, email);
      if (target.error) result.email = "no_address";
      else {
        try {
          const sent = await send({ key, userId, action, values: { target: target.value, title: noticeTitle(reason, Math.max(1, items.length)), details: noticeText(words) } });
          result.email = sent.ok ? "sent" : "not_sent";
        } catch { result.email = "error"; }
      }
    }
  }
  if (settings.slack && settings.slackTo) {
    if (!key) result.slack = "off";
    else {
      try {
        const sent = await send({ key, userId, action: findAction("slack_message"), values: { target: settings.slackTo, title: slackText(words), details: "" } });
        result.slack = sent.ok ? "sent" : "not_sent";
      } catch { result.slack = "error"; }
    }
  }
  if (settings.push) {
    if (!pushKeys?.publicKey || !pushKeys?.privateKey) result.push = "off";
    else {
      try {
        const { data } = await admin.from("push_subscriptions").select("id, endpoint, p256dh, auth").eq("user_id", userId).limit(10);
        const payload = pushPayload(words);
        let delivered = 0;
        for (const subscription of data ?? []) {
          const sent = await sendPush({ subscription, payload, keys: pushKeys, fetchImpl, now });
          if (sent.ok) delivered += 1;
          if (sent.gone) await admin.from("push_subscriptions").delete().eq("user_id", userId).eq("id", subscription.id); // the browser said it unsubscribed
        }
        result.push = delivered ? "sent" : (data ?? []).length ? "not_sent" : "no_browser";
      } catch { result.push = "error"; }
    }
  }
  return { ...result, any: Object.values(result).includes("sent") };
}

// THE DIGEST (the clock, lib/schedule-tick.js): for each person who chose it, at their chosen hour, once per local day. Sent even when the cap of
// 3 nudges a day is used up (it IS the person's own request to be told once a day), never at night (the hour is 08:00 to 19:00, checked when saved
// and by the table). Nothing waiting = nothing sent, and the day is still marked so the person is not looked at again today.
export async function runDigests({ admin, now = Date.now(), deadline = Infinity, send, key, siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "", pushKeys, fetchImpl, limit = 200 }) {
  const summary = { looked: 0, sent: 0 };
  let rows = [];
  try {
    const { data, error } = await admin.from("notify_settings").select("user_id, email, slack, slack_to, push, links, digest, digest_hour, tz_offset, last_digest_at").eq("digest", true).limit(limit);
    if (error) return summary;
    rows = data ?? [];
  } catch {
    return summary;
  }
  for (const row of rows) {
    if (Date.now() > deadline) break;
    const settings = readSettings(row);
    if (!digestDue(settings, now, { localHour, localDayStartMs })) continue;
    summary.looked += 1;
    try {
      // Marked FIRST, and only if it was not marked meanwhile (two clocks at once): a digest is sent at most once a day even if a send then fails.
      const marked = await admin.from("notify_settings").update({ last_digest_at: new Date(now).toISOString() }).eq("user_id", row.user_id).eq("digest", true).select("user_id");
      if (marked.error || !marked.data?.length) continue;
      const { data: found } = await admin.auth.admin.getUserById(row.user_id);
      const who = { user: { id: row.user_id, email: found?.user?.email ?? "" }, supabase: admin };
      let items = await waitingItems(who);
      if (!items.length) continue;
      if (settings.links) items = await mintLinks(admin, row.user_id, items, "digest", { siteUrl, now });
      const told = await deliver({ admin, userId: row.user_id, settings, reason: "digest", name: "", items, send, key, siteUrl, pushKeys, fetchImpl, email: found?.user?.email ?? "", now });
      if (told.any) summary.sent += 1;
    } catch {
      console.error("a digest could not be sent");
    }
  }
  return summary;
}

export const pushKeysFromEnv = () => ({ publicKey: process.env.VAPID_PUBLIC_KEY ?? "", privateKey: process.env.VAPID_PRIVATE_KEY ?? "", subject: process.env.VAPID_SUBJECT ?? "" });
