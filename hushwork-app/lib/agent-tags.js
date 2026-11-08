// "Pick an agent off the rail" on the landing page (components/AgentRail.js): ready-made agents drawn as hang tags for the clothing rail
// (components/ui/product-rail-gallery.tsx). Each tag is a small SVG picture, front and back, on a see-through 200 x 310 canvas, which the
// rail also uses as the shape of its shadow. Plain code (no React), so tests can run it and the page can build the pictures ahead of time.
import { publicAgent, needsLine } from "./public-agents.js";

// The agents on the rail, in order. A missing id is skipped.
export const RAIL_IDS = ["firsttask", "weekrisk", "stripeweek", "postideas", "githubdigest", "inboxnow", "invoicemail", "designreview", "pagecheck", "feedbackmail"];

// One colour pair per pack: the tag's paper and its ink.
const PAPER = {
  everyday: ["#7c3aed", "#f5f0ff"], finance: ["#15803d", "#ecfdf3"], marketing: ["#c2410c", "#fff4ec"],
  coding: ["#1d4ed8", "#eef4ff"], design: ["#be185d", "#fdf0f6"],
};

const esc = (text) => String(text ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]);

// Words broken into lines of at most `width` letters, at most `max` lines (the last one ends in "…" when cut).
export function wrapLines(text, width, max) {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= width || !line) line = next;
    else { lines.push(line); line = word; }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    const kept = lines.slice(0, max);
    kept[max - 1] = `${kept[max - 1].replace(/[.,;:]?$/, "").slice(0, width - 1)}…`;
    return kept;
  }
  return lines.map((one) => (one.length > width ? `${one.slice(0, width - 1)}…` : one));
}

const text = (lines, x, y, gap, attrs) => lines.map((line, i) => `<text x="${x}" y="${y + i * gap}" ${attrs}>${esc(line)}</text>`).join("");

// The tag's outline: a card with clipped top corners and a punched hole for the hanger's hook.
const SHAPE = "M40 18 H160 L186 44 V292 Q186 304 174 304 H26 Q14 304 14 292 V44 Z";
const HOLE = `<circle cx="100" cy="40" r="7" fill="#000"/>`;

function svg(body, ink) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 310"><defs><mask id="m"><rect width="200" height="310" fill="#fff"/>${HOLE}</mask></defs><g mask="url(#m)"><path d="${SHAPE}" fill="${ink[1]}" stroke="${ink[0]}" stroke-opacity=".35" stroke-width="2"/>${body}</g></svg>`;
}
const uri = (markup) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`;

const FONT = `font-family="Geist, ui-sans-serif, system-ui, sans-serif"`;

// The front: the pack, a monogram, the agent's name and when it runs.
export function frontSvg(agent) {
  const ink = PAPER[agent.pack] ?? PAPER.everyday;
  const title = wrapLines(agent.title, 15, 4);
  const when = agent.schedule ? wrapLines(agent.schedule, 24, 2) : ["When you press Run"];
  const body = [
    `<rect x="14" y="60" width="172" height="4" fill="${ink[0]}" opacity=".9"/>`,
    text([agent.packLabel.toUpperCase()], 100, 86, 0, `${FONT} font-size="10" font-weight="700" letter-spacing="2" text-anchor="middle" fill="${ink[0]}"`),
    `<circle cx="100" cy="122" r="22" fill="${ink[0]}"/>`,
    text([agent.title.trim().charAt(0).toUpperCase()], 100, 130, 0, `${FONT} font-size="22" font-weight="700" text-anchor="middle" fill="#fff"`),
    text(title, 100, 172, 19, `${FONT} font-size="16" font-weight="700" text-anchor="middle" fill="#1c1926"`),
    `<line x1="34" x2="166" y1="${180 + title.length * 19}" y2="${180 + title.length * 19}" stroke="${ink[0]}" stroke-opacity=".3" stroke-dasharray="3 4"/>`,
    text(when, 100, 198 + title.length * 19, 13, `${FONT} font-size="10.5" text-anchor="middle" fill="#4b4660"`),
    text(["HUSHWORK"], 100, 292, 0, `${FONT} font-size="8.5" font-weight="700" letter-spacing="3" text-anchor="middle" fill="${ink[0]}" opacity=".7"`),
  ].join("");
  return uri(svg(body, ink));
}

// The back: what it does, step by step, and the promise that sending waits for an OK.
export function backSvg(agent) {
  const ink = PAPER[agent.pack] ?? PAPER.everyday;
  const steps = agent.steps.filter((step) => step.kind !== "trigger").slice(0, 4);
  let y = 92;
  const rows = steps.map((step, i) => {
    const lines = wrapLines(step.title, 21, 2);
    const row = `<circle cx="36" cy="${y - 4}" r="8" fill="${step.approve ? ink[0] : "#fff"}" stroke="${ink[0]}"/>`
      + text([String(i + 1)], 36, y - 0.5, 0, `${FONT} font-size="9" font-weight="700" text-anchor="middle" fill="${step.approve ? "#fff" : ink[0]}"`)
      + text(lines, 52, y, 12, `${FONT} font-size="10.5" fill="#1c1926"`);
    y += 14 + lines.length * 12;
    return row;
  }).join("");
  const body = [
    text(["WHAT IT DOES"], 100, 72, 0, `${FONT} font-size="10" font-weight="700" letter-spacing="2" text-anchor="middle" fill="${ink[0]}"`),
    rows,
    `<rect x="26" y="236" width="148" height="40" rx="8" fill="${ink[0]}" opacity=".1"/>`,
    text(wrapLines(needsLine(agent.needs), 26, 1), 100, 252, 0, `${FONT} font-size="9.5" font-weight="600" text-anchor="middle" fill="${ink[0]}"`),
    text(["Sends nothing without your OK"], 100, 266, 0, `${FONT} font-size="9.5" text-anchor="middle" fill="#4b4660"`),
  ].join("");
  return uri(svg(body, ink));
}

// The rail's items (RailGarment in the component): name, short text, a tag (when it runs), facts for the detail view, and the two pictures.
export function railAgents(ids = RAIL_IDS) {
  return ids.map((id) => publicAgent(id)).filter(Boolean).map((agent) => ({
    id: agent.id,
    name: agent.title,
    description: agent.body,
    tag: agent.schedule ? "Scheduled" : "On demand",
    details: [needsLine(agent.needs), agent.schedule || "Runs when you press Run", `${agent.steps.filter((step) => step.kind !== "trigger").length} steps, sending waits for your OK`],
    image: frontSvg(agent),
    backImage: backSvg(agent),
  }));
}
