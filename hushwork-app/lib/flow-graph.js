// How the Builder's canvas draws a workflow. A workflow is still a straight list of steps (lib/steps.js); this works out, for each
// step, the card the canvas shows: a title, the app it uses (a logo id for components/AppLogo.js) and a short line under it,
// plus the little extras around it:
//   - an "Ask the AI" step gets two side cards, what it LOOKS AT and the MODEL that thinks (Hushwork AI);
//   - an "Ask me first" step is drawn as a fork: YES carries on down the line, NO stops the run and nothing is sent.
// Pure code (no React), so it is tested (flow-graph.test.js) and the server and the browser draw the same thing.
import { STEP_KINDS, isTypedKind } from "./steps.js";
import { checkSteps } from "./validate.js";
import { blockName } from "./step-rows.js";
import { pluginsOf } from "./studio/capabilities.js";
import { connectionInfo } from "./skills/bundles.js";
import { findAction } from "./connectors/composio-actions.js";
import { parseAppAddress } from "./connectors/composio-apps.js";

// The logo to show for a connection id. A few write-only connections share their app's picture.
const LOGO_OF = { gmailsend: "gmail", gcalwrite: "calendar", gsheets: "sheets", gdrivewrite: "drive", gdocs: "drive", gslides: "drive", stripeinvoices: "stripe" };
export const logoId = (id) => (typeof id === "string" ? LOGO_OF[id] ?? id : null);

// What an "Ask the AI" step may look at, as a side card: { logo, name }.
const AI_LOOKS = {
  nothing: null,
  linear: { logo: "linear", name: "Linear tasks" },
  calendar: { logo: "calendar", name: "Google Calendar" },
  gmail: { logo: "gmail", name: "Gmail inbox" },
  gmailtext: { logo: "gmail", name: "Gmail, with text" },
  drive: { logo: "drive", name: "Google Drive files" },
  web: { logo: "web", name: "A web address" },
  mcp: { logo: "mcp", name: "MCP server" },
};

// The title and line a step shows on its card, from its own checked words when it is complete, or its block's name while it is half filled in.
function words(row) {
  const checked = checkSteps([row]).value?.[0];
  return { title: checked?.title || row.title || blockName(row), detail: checked?.detail || row.detail || "" };
}

// One card. `row` is a Builder row ({ key, kind?, fields?, title, detail }); `index` is its place in the list.
// Returns { key, index, tone, title, sub, logo, icon, bullets, sides, fork, start }.
//   tone   "start" | "ai" | "fork" | "write" | "read" | "note": picks the card's accent
//   logo   a logo id for AppLogo, or null (then `icon`, a name from components/icons.js, is drawn in a tile)
//   sides  [{ label, logo?, icon?, name }]: the small cards to the right of an AI step
//   fork   { yes, no } labels for an approval step, or null
export function nodeFor(row, index) {
  const kind = isTypedKind(row?.kind) ? row.kind : null;
  const f = row?.fields ?? {};
  const { title, detail } = words(row ?? {});
  const plugin = pluginsOf(row)[0];
  const appName = plugin ? connectionInfo(plugin)?.name ?? null : null;
  const base = { key: row?.key, index, title, sub: detail, logo: null, icon: STEP_KINDS[kind]?.icon ?? "FileText", bullets: [], sides: [], fork: null, start: false, tone: "read" };

  switch (kind) {
    case "trigger": {
      const how = STEP_KINDS.trigger.fields[0].options[f.how] ?? "When I ask";
      return { ...base, tone: "start", start: true, title: f.when ? f.when : how, sub: f.when ? how : "How this workflow starts", icon: "Zap" };
    }
    case "ai": {
      const look = f.uses === "app" ? (parseAppAddress(f.address) ? { logo: logoId(parseAppAddress(f.address).app.lookupOf ?? parseAppAddress(f.address).app.id), name: parseAppAddress(f.address).app.name } : { icon: "Plug", name: "Another app" }) : AI_LOOKS[f.uses] ?? null;
      const sides = [];
      if (look) sides.push({ label: "looks at", ...look });
      sides.push({ label: "model", icon: "Sparkles", name: "Hushwork AI" });
      return { ...base, tone: "ai", title: blockName(row) === "MCP server" ? "MCP server" : "Ask the AI", sub: "Hushwork AI", icon: "Sparkles", bullets: f.task ? [f.task] : ["Write what the AI should do"], sides };
    }
    case "approve":
      return { ...base, tone: "fork", title: "Ask me first", sub: f.what || "Waits for your yes", icon: "Branch", fork: { yes: "yes", no: "no" } };
    case "action": {
      const action = findAction(f.action);
      return { ...base, tone: "write", title: f.title ? f.title : action?.name ?? title, sub: action ? `${action.name.replace(/\s*\(.*\)$/, "")}${appName ? ` · ${appName}` : ""}` : detail, logo: logoId(action?.app ?? plugin) };
    }
    case "issue":
      return { ...base, tone: "write", title: f.title || "Create a Linear task", sub: "Linear", logo: "linear" };
    case "row":
      return { ...base, tone: "write", title: "Add a row", sub: "Google Sheets", logo: "sheets" };
    case "find":
      return { ...base, sub: f.where === "linear" ? "Linear" : detail, logo: f.where === "linear" ? "linear" : null };
    case "app":
      return { ...base, title: f.what || "Look in another app", sub: appName ?? "Another app", logo: logoId(plugin) };
    case "request":
      return { ...base, title: f.why || "Call a web address", sub: f.url || "Web address", logo: null, icon: "Plug" };
    case "write": case "send":
      return { ...base, tone: "note", sub: `${detail}${detail ? " · " : ""}plan only` };
    default:
      // An approval written as plain words (older and quick plans write "Ask you to approve" as a note with the shield icon) is still a fork.
      if (row?.icon === "ShieldCheck") return { ...base, tone: "fork", title: "Ask me first", sub: row.detail || "Waits for your yes", icon: "Branch", fork: { yes: "yes", no: "no" } };
      return { ...base, tone: "note", title: row?.title || "Note", sub: row?.detail || "Your own words", icon: "FileText" };
  }
}

export const nodesFor = (rows) => (Array.isArray(rows) ? rows.map(nodeFor) : []);

// A short list the copilot says back after it made a plan: one line per step.
export function planLines(rows) {
  return nodesFor(rows).map((node) => (node.start ? `Start: ${node.title}` : node.fork ? `Wait for your yes${node.sub && node.sub !== "Waits for your yes" ? `: ${node.sub}` : ""}` : node.tone === "ai" ? `AI: ${node.bullets[0]}` : `${node.title}${node.sub ? ` (${node.sub})` : ""}`));
}
