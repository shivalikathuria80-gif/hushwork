// The command palette (Ctrl+K or Cmd+K anywhere in the app, components/app/CommandPalette.js): what can be found, and how a typed
// search ranks it. Plain code (no database, no browser), so tests can run it.
//
// An item: { id, group, title, hint, icon, href? , action? , workflowId? }
//   group  "Needs you" | "Go to" | "Run" | "Do"
//   href   go to this page;  action  one of the palette's own actions ("new", "theme", "motion", "run")

export const PAGES = [
  { id: "page:home", title: "Home", hint: "Your workflows and the box to describe a chore", icon: "Sparkles", href: "/app", words: "workflows start" },
  { id: "page:agents", title: "Agents", hint: "Agents that run on a schedule", icon: "Bot", href: "/app/agents", words: "schedule automate" },
  { id: "page:templates", title: "Templates", hint: "Ready-made workflows and packs", icon: "ListTodo", href: "/app/templates", words: "examples packs library" },
  { id: "page:runs", title: "Runs", hint: "What ran, and what waits for your OK", icon: "History", href: "/app/runs", words: "history approve results" },
  { id: "page:week", title: "Your week", hint: "Time Hushwork gave back in the last 7 days", icon: "FileBarChart", href: "/app/week", words: "report recap stats saved" },
  { id: "page:connections", title: "Connections", hint: "Connect Gmail, Linear, Slack and more", icon: "Plug", href: "/app/connections", words: "apps connect gmail linear google slack" },
  { id: "page:settings", title: "Settings", hint: "Memory, chatbot plugin, your account", icon: "Settings", href: "/app/settings", words: "account memory tokens plugin delete" },
  { id: "page:docs", title: "Docs", hint: "How Hushwork works", icon: "FileText", href: "/docs", words: "help guide" },
];

export const ACTIONS = [
  { id: "do:new", title: "New workflow", hint: "Describe a chore in one sentence", icon: "Plus", action: "new", words: "create add make" },
  { id: "do:theme", title: "Switch light or dark mode", hint: "Changes the colours", icon: "Moon", action: "theme", words: "theme dark light colour color" },
  { id: "do:motion", title: "Pause or play animations", hint: "Stops the moving backgrounds", icon: "Pause", action: "motion", words: "motion animation stop calm" },
];

const clean = (value, max = 80) => (typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "");

// workflows: [{ id, name, agent }]; needsYou: [{ id, name, tone ("you" | "bad") }] (from lib/week-recap.js).
export function buildItems({ workflows = [], needsYou = [] } = {}) {
  const items = [];
  for (const run of Array.isArray(needsYou) ? needsYou.slice(0, 5) : []) {
    if (!run || typeof run.id !== "string" || !run.id) continue;
    const name = clean(run.name) || "Untitled workflow";
    items.push({ id: `need:${run.id}`, group: "Needs you", title: name, hint: run.tone === "bad" ? "Stopped at a step. Open it to see why" : "A step waits for your OK", icon: run.tone === "bad" ? "CircleAlert" : "Bell", href: `/app/runs?run=${encodeURIComponent(run.id)}`, words: "approve waiting" });
  }
  for (const page of PAGES) items.push({ ...page, group: "Go to" });
  for (const flow of Array.isArray(workflows) ? workflows.slice(0, 50) : []) {
    if (!flow || typeof flow.id !== "string" || !flow.id) continue;
    const name = clean(flow.name) || "Untitled workflow";
    items.push({ id: `run:${flow.id}`, group: "Run", title: `Run "${name}"`, hint: flow.agent ? "Agent. A practice run: anything that sends waits for your OK" : "A practice run: anything that sends waits for your OK", icon: "Play", action: "run", workflowId: flow.id, words: `${name} practice start` });
  }
  for (const action of ACTIONS) items.push({ ...action, group: "Do" });
  return items;
}

// How well `query` matches `text`: 0 = not at all. Whole words and word starts beat letters scattered in order.
export function score(text, query) {
  const hay = String(text ?? "").toLowerCase();
  const q = String(query ?? "").toLowerCase().trim();
  if (!q) return 1;
  if (hay === q) return 100;
  if (hay.startsWith(q)) return 80;
  const at = hay.indexOf(q);
  if (at >= 0) return /\W/.test(hay[at - 1] ?? " ") ? 60 : 40;
  // Every typed word somewhere in the text.
  const words = q.split(/\s+/).filter(Boolean);
  if (words.length > 1 && words.every((word) => hay.includes(word))) return 30;
  // Letters in order ("nwf" finds "new workflow"), worth less the more spread out they are.
  let from = 0;
  let gaps = 0;
  for (const ch of q.replace(/\s+/g, "")) {
    const found = hay.indexOf(ch, from);
    if (found < 0) return 0;
    gaps += found - from;
    from = found + 1;
  }
  return Math.max(1, 20 - gaps);
}

const GROUP_ORDER = ["Needs you", "Go to", "Run", "Do"];

// The list to show for a search, best match first (the palette groups them in that order). With no search: everything except the long Run list, which shows its first 5.
export function search(items, query, limit = 40) {
  const list = Array.isArray(items) ? items : [];
  const q = String(query ?? "").trim();
  if (!q) {
    let runs = 0;
    return list.filter((item) => item.group !== "Run" || runs++ < 5).slice(0, limit);
  }
  const scored = list
    .map((item, index) => ({ item, index, s: Math.max(score(item.title, q) * 1.2, score(`${item.title} ${item.words ?? ""} ${item.hint ?? ""}`, q)) }))
    .filter((entry) => entry.s > 0);
  // When something matches well, letters scattered through a long hint are noise.
  const strong = scored.some((entry) => entry.s >= 30);
  return scored
    .filter((entry) => !strong || entry.s >= 15)
    .sort((a, b) => b.s - a.s || GROUP_ORDER.indexOf(a.item.group) - GROUP_ORDER.indexOf(b.item.group) || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}
