// The words Hushwork uses to tell the person a step waits (lib/approve-links.js has the rules). Plain code with no imports: the server sends
// these words, and the Settings page shows a live preview built by the very same functions. They take names and step titles only, never what
// a step would send.
export const MAX_ITEMS = 10; // steps named in one message (a digest that has more says "and N more")

// ---- the words of the message --------------------------------------------------------------------------------------------------------------------
// `items` = [{ workflow, title, step, url? }] (url only when links are on). Only names and titles: never what the step would send.
const one = (text, max) => String(text ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
const HEAD = {
  watch: "Hushwork noticed something",
  waiting: "a step is waiting for you",
  arrived: "something arrived",
  digest: "your daily digest",
};
export function noticeTitle(reason, count) {
  if (reason === "digest") return count === 1 ? "Hushwork: 1 step waits for you" : `Hushwork: ${count} steps wait for you`;
  if (reason === "watch") return HEAD.watch;
  if (reason === "test") return "Hushwork: a test notification";
  return `Hushwork: ${HEAD[reason] ?? HEAD.waiting}`;
}

const lead = (reason, name, count) => {
  const steps = count === 1 ? "a step is" : `${count} steps are`;
  if (reason === "digest") return `${count === 1 ? "One step is" : `${count} steps are`} waiting for your OK.`;
  if (reason === "test") return "This is a test from your Hushwork settings. Nothing is waiting, and this message cannot approve anything.";
  if (reason === "watch") return `Hushwork noticed something in "${name}", and ${steps} waiting for you.`;
  if (reason === "arrived") return `Something arrived at the start link of "${name}", and ${steps} waiting for you.`;
  return `Your scheduled workflow "${name}" ran and ${steps} waiting for you.`;
};

// Plain text (email body). Each step on its own lines; with links, each has its own "Review and approve" address.
export function noticeText({ reason = "waiting", name = "", items = [], siteUrl = "", more = 0 }) {
  const site = String(siteUrl).replace(/\/$/, "");
  const shown = items.slice(0, MAX_ITEMS);
  const lines = [lead(reason, one(name, 80), Math.max(1, items.length + more)), ""];
  for (const item of shown) {
    lines.push(`- ${reason === "digest" ? `${one(item.workflow, 80)}: ` : ""}${one(item.title, 100) || `Step ${item.step}`}`);
    if (item.url) lines.push(`  Read the exact words and approve: ${item.url}`);
  }
  const extra = more + Math.max(0, items.length - shown.length);
  if (extra > 0) lines.push(`- and ${extra} more on the Runs page`);
  lines.push("", `All of them on the Runs page: ${site}/app/runs`);
  lines.push(shown.some((item) => item.url)
    ? "Each link opens a page that shows the exact words first. Nothing is approved until you press Approve there. Each link works once, for 48 hours."
    : "Nothing was approved or sent for you.");
  lines.push(`To change how Hushwork tells you: ${site}/app/settings#notify-settings`);
  return lines.join("\n");
}

// Slack (a direct message, Slack's own markdown: <url|label>).
export function slackText({ reason = "waiting", name = "", items = [], siteUrl = "", more = 0 }) {
  const site = String(siteUrl).replace(/\/$/, "");
  const shown = items.slice(0, MAX_ITEMS);
  const lines = [`*${lead(reason, one(name, 80), Math.max(1, items.length + more))}*`];
  for (const item of shown) {
    const words = `${reason === "digest" ? `${one(item.workflow, 80)}: ` : ""}${one(item.title, 100) || `Step ${item.step}`}`.replace(/[<>&]/g, " ");
    lines.push(item.url ? `• ${words}  <${item.url}|Review and approve>` : `• ${words}`);
  }
  const extra = more + Math.max(0, items.length - shown.length);
  if (extra > 0) lines.push(`• and ${extra} more`);
  lines.push(`<${site}/app/runs|Open Runs>${shown.some((item) => item.url) ? "  ·  Each link shows the exact words first and works once." : ""}`);
  return lines.join("\n");
}

// Push: short, and its tap opens ONE page: the first step's review page when links are on, else the Runs page.
export function pushPayload({ reason = "waiting", name = "", items = [], siteUrl = "", more = 0 }) {
  const site = String(siteUrl).replace(/\/$/, "");
  const count = Math.max(1, items.length + more);
  const first = items[0];
  const body = reason === "test" ? "A test from your settings. Nothing is waiting." : reason === "digest"
    ? `${count === 1 ? "1 step waits" : `${count} steps wait`} for your OK.`
    : `${one(name, 60)}: ${one(first?.title, 80) || "a step"}${count > 1 ? ` and ${count - 1} more` : ""}`;
  return { title: noticeTitle(reason, count), body, url: count === 1 && first?.url ? first.url : `${site}/app/runs`, tag: reason === "digest" ? "hw-digest" : `hw-${reason}` };
}

