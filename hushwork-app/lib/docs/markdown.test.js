import test from "node:test";
import assert from "node:assert/strict";
import { parseDoc, parseInline, safeHref, outline } from "./markdown.js";

test("safeHref: only normal web addresses, site paths and #parts are kept", () => {
  assert.equal(safeHref("https://example.com/a"), "https://example.com/a");
  assert.equal(safeHref("/docs/welcome"), "/docs/welcome");
  assert.equal(safeHref("#limits"), "#limits");
  for (const bad of ["javascript:alert(1)", "//evil.com", "data:text/html,x", "mailto:a@b.c", "", null, undefined]) assert.equal(safeHref(bad), null, String(bad));
});

test("parseInline: code, bold, italic and links; a bad link keeps only its words", () => {
  const pieces = parseInline("Use `npm test`, **carefully** and *slowly* in [the guide](/docs/safety) or [bad](javascript:alert(1)).");
  assert.deepEqual(pieces.map((p) => p.type), ["text", "code", "text", "bold", "text", "italic", "text", "link", "text", "text", "text"]);
  assert.equal(pieces.find((p) => p.type === "link").href, "/docs/safety");
  assert.ok(!pieces.some((p) => p.href?.startsWith("javascript")));
});

test("parseInline: HTML is just text (it is never turned into elements)", () => {
  const pieces = parseInline("<script>alert(1)</script> and <b>x</b>");
  assert.deepEqual(pieces, [{ type: "text", text: "<script>alert(1)</script> and <b>x</b>" }]);
});

test("parseDoc: title, summary, headings with unique ids, lists, quotes, code and tables", () => {
  const doc = parseDoc([
    "# My page", "", "One plain sentence.", "", "## Same", "", "Words", "more words.", "", "## Same", "",
    "- one", "- two", "  carries on", "", "1. first", "2. second", "", "> **Note:** careful", "", "```", "code line", "```", "",
    "| A | B |", "| --- | --- |", "| 1 | `2` |", "", "---", "", "### Small",
  ].join("\r\n"));
  assert.equal(doc.title, "My page");
  assert.equal(doc.summary, "One plain sentence.");
  const headings = doc.blocks.filter((b) => b.type === "heading");
  assert.deepEqual(headings.map((h) => h.id), ["same", "same-2", "small"]);
  assert.deepEqual(outline(doc.blocks), [{ id: "same", text: "Same" }, { id: "same-2", text: "Same" }]);
  const types = doc.blocks.map((b) => b.type);
  assert.deepEqual(types, ["paragraph", "heading", "paragraph", "heading", "ul", "ol", "quote", "code", "table", "rule", "heading"]);
  assert.equal(doc.blocks.find((b) => b.type === "paragraph" && b !== doc.blocks[0]).inline[0].text, "Words more words.");
  assert.equal(doc.blocks.find((b) => b.type === "ul").items.length, 2);
  assert.equal(doc.blocks.find((b) => b.type === "ul").items[1][0].text, "two carries on");
  assert.equal(doc.blocks.find((b) => b.type === "code").text, "code line");
  const table = doc.blocks.find((b) => b.type === "table");
  assert.equal(table.head.length, 2);
  assert.equal(table.rows[0][1][0].type, "code");
});

test("parseDoc: an unfinished code fence or an empty file does not crash", () => {
  assert.equal(parseDoc("").blocks.length, 0);
  assert.equal(parseDoc("# T\n\n```\nnever closed").blocks[0].text, "never closed");
});
