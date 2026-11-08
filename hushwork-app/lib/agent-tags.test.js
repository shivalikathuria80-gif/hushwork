import test from "node:test";
import assert from "node:assert/strict";
import { wrapLines, railAgents, RAIL_IDS } from "./agent-tags.js";

test("lines wrap at word gaps and are cut with an ellipsis", () => {
  assert.deepEqual(wrapLines("Which task should I do first?", 15, 4), ["Which task", "should I do", "first?"]);
  assert.deepEqual(wrapLines("one two three four five six", 7, 2), ["one two", "three…"]);
  assert.deepEqual(wrapLines("Supercalifragilistic", 8, 2), ["Superca…"]);
  assert.deepEqual(wrapLines("", 8, 2), []);
});

test("every rail agent has a name, two pictures and facts, and text is escaped", () => {
  const items = railAgents();
  assert.ok(items.length >= 8 && items.length <= RAIL_IDS.length);
  for (const item of items) {
    assert.ok(item.name && item.description);
    assert.match(item.image, /^data:image\/svg\+xml;charset=utf-8,/);
    assert.match(item.backImage, /^data:image\/svg\+xml;charset=utf-8,/);
    assert.equal(item.details.length, 3);
    assert.doesNotMatch(decodeURIComponent(item.image), /<text[^>]*>[^<]*[<>&"][^<]*<\/text>/, "no raw markup inside text");
  }
  assert.deepEqual(railAgents(["nope"]), []);
});
