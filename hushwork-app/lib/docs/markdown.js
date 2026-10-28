// A tiny markdown reader for the docs pages (content/docs/*.md). It turns text into plain data (blocks and pieces of text); components/docs/Markdown.js
// then draws that data as React elements. Nothing here ever makes HTML, so a page can never smuggle in a script.
//
// What it understands (and nothing more): "# Title", "## heading", "### heading", paragraphs, "- bullets", "1. numbers", > quotes, ``` code ```,
// | pipe | tables |, ---, and inside a line: `code`, **bold**, *italic*, [text](link). A link only counts if it starts with https://, http://, / or #.

const slugify = (text) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "section";

// A link is safe when it stays on the site (/docs/x, #part) or goes to a normal web address. "javascript:" and the like are refused.
export function safeHref(href) {
  const value = String(href ?? "").trim();
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("#")) return value;
  return null;
}

// One line of text -> pieces: { type: "text" | "code" | "bold" | "italic" | "link", text, href? }.
const INLINE = /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
export function parseInline(text) {
  const pieces = [];
  let last = 0;
  for (const match of String(text).matchAll(INLINE)) {
    if (match.index > last) pieces.push({ type: "text", text: text.slice(last, match.index) });
    if (match[1] !== undefined) pieces.push({ type: "code", text: match[1] });
    else if (match[2] !== undefined) pieces.push({ type: "bold", text: match[2] });
    else if (match[3] !== undefined) pieces.push({ type: "italic", text: match[3] });
    else {
      const href = safeHref(match[5]);
      pieces.push(href ? { type: "link", text: match[4], href } : { type: "text", text: match[4] });
    }
    last = match.index + match[0].length;
  }
  if (last < text.length) pieces.push({ type: "text", text: text.slice(last) });
  return pieces;
}

const splitRow = (line) => line.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
const isTableSeparator = (line) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line) && line.includes("|");

// The whole file -> { title, summary, blocks }. `title` is the first "# " line; `summary` is the first paragraph after it (used under the title and as the page description).
export function parseDoc(source) {
  const lines = String(source).split(/\r?\n/);
  const blocks = [];
  const usedIds = new Map();
  let title = "";
  let index = 0;

  const startsBlock = (line) => /^(#{1,3}\s|[-*]\s|\d+\.\s|>|```|\|)/.test(line) || /^-{3,}\s*$/.test(line);

  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    if (line.startsWith("```")) {
      const code = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith("```")) { code.push(lines[index]); index += 1; }
      index += 1; // the closing fence
      blocks.push({ type: "code", text: code.join("\n") });
      continue;
    }

    const heading = /^(#{1,3})\s+(.*?)\s*#*\s*$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (level === 1) { if (!title) title = heading[2]; }
      else {
        const base = slugify(heading[2]);
        const seen = usedIds.get(base) ?? 0;
        usedIds.set(base, seen + 1);
        blocks.push({ type: "heading", level, id: seen ? `${base}-${seen + 1}` : base, text: heading[2], inline: parseInline(heading[2]) });
      }
      index += 1;
      continue;
    }

    if (/^-{3,}\s*$/.test(line)) { blocks.push({ type: "rule" }); index += 1; continue; }

    if (line.trimStart().startsWith("|") && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const head = splitRow(line);
      const rows = [];
      index += 2;
      while (index < lines.length && lines[index].trimStart().startsWith("|")) { rows.push(splitRow(lines[index])); index += 1; }
      blocks.push({ type: "table", head: head.map(parseInline), rows: rows.map((row) => row.map(parseInline)) });
      continue;
    }

    if (line.startsWith(">")) {
      const quote = [];
      while (index < lines.length && lines[index].startsWith(">")) { quote.push(lines[index].replace(/^>\s?/, "")); index += 1; }
      blocks.push({ type: "quote", inline: parseInline(quote.join(" ").trim()) });
      continue;
    }

    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const number = /^\d+\.\s+(.*)$/.exec(line);
    if (bullet || number) {
      const ordered = Boolean(number);
      const items = [];
      while (index < lines.length) {
        const current = lines[index];
        const again = ordered ? /^\d+\.\s+(.*)$/.exec(current) : /^[-*]\s+(.*)$/.exec(current);
        if (again) { items.push(again[1]); index += 1; continue; }
        // an indented line carries on the item above it
        if (/^\s{2,}\S/.test(current) && items.length) { items[items.length - 1] += ` ${current.trim()}`; index += 1; continue; }
        break;
      }
      blocks.push({ type: ordered ? "ol" : "ul", items: items.map(parseInline) });
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim() && (paragraph.length === 0 || !startsBlock(lines[index]))) { paragraph.push(lines[index].trim()); index += 1; }
    blocks.push({ type: "paragraph", inline: parseInline(paragraph.join(" ")) });
  }

  const first = blocks.find((block) => block.type === "paragraph");
  const summary = first ? first.inline.map((piece) => piece.text).join("") : "";
  return { title, summary, blocks };
}

// The "##" headings, for the "On this page" list.
export const outline = (blocks) => blocks.filter((block) => block.type === "heading" && block.level === 2).map((block) => ({ id: block.id, text: block.text }));
