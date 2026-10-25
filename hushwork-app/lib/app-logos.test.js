import test from "node:test";
import assert from "node:assert/strict";
import { ARTWORK, LOGOS, artFor, fallbackIcon, hasLogo, logoFor } from "./app-logos.js";
import { APP_LIST } from "./connectors/app-list.js";
import { COMPOSIO_APPS } from "./connectors/composio-apps.js";

test("every connection has a logo: each app in the list, each Composio app (Slack included), and the four Google products", () => {
  for (const app of [...APP_LIST, ...COMPOSIO_APPS.filter((one) => !one.lookupOf)]) assert.ok(hasLogo(app.id), `${app.id} has a logo`); // a second lookup shares its app's box and logo
  for (const id of ["calendar", "sheets", "gmail", "drive", "slack", "mcp"]) assert.ok(hasLogo(id), id);
});

test("the Google products and Slack are drawn in their real colours, not as one-colour silhouettes", () => {
  for (const id of ["gmail", "drive", "calendar", "sheets", "slack"]) {
    const art = artFor(id);
    assert.ok(art && art.title && /^0 0 [\d.]+ [\d.]+$/.test(art.viewBox) && art.shapes.length >= 3, id);
    const colours = new Set(art.shapes.map((shape) => shape.fill).filter((fill) => /^#[0-9a-fA-F]{6}$/.test(fill ?? "")));
    assert.ok(colours.size >= 2, `${id} uses several colours`);
  }
  assert.ok(new Set(ARTWORK.slack.shapes.map((shape) => shape.fill)).size === 4, "Slack has its four colours");
  assert.ok(new Set(ARTWORK.drive.shapes.map((shape) => shape.fill)).size >= 5, "Drive has its blue, green, yellow and red parts");
  assert.ok(!("gmail" in LOGOS) && !("drive" in LOGOS) && !("calendar" in LOGOS) && !("sheets" in LOGOS), "no one-colour version is left for them");
});

test("every drawn shape is plain data: a path, a rectangle or a few digits; colours are hex; nothing can carry markup", () => {
  for (const [id, art] of Object.entries(ARTWORK)) {
    for (const shape of art.shapes) {
      if (shape.d) assert.match(shape.d, /^[MmLlHhVvCcSsQqTtAaZz0-9eE.,\- ]+$/, `${id}: path data only`);
      else if (shape.rect) assert.ok(shape.rect.length === 5 && shape.rect.every(Number.isFinite), id);
      else assert.ok(typeof shape.text === "string" && /^[0-9]{1,3}$/.test(shape.text) && Number.isFinite(shape.x + shape.y + shape.size), `${id}: text is a few digits`);
      for (const colour of [shape.fill, shape.stroke].filter(Boolean)) assert.match(colour, /^(?:#[0-9a-fA-F]{6}|none)$/, id);
    }
  }
});

test("each one-colour logo is a real SVG shape with a six-digit brand colour; a made-up id has no logo and gets a plain icon", () => {
  for (const [id, logo] of Object.entries(LOGOS)) {
    assert.match(logo.hex, /^[0-9A-Fa-f]{6}$/, id);
    assert.match(logo.path, /^[Mm][\d.\- ,A-Za-z]+$/, `${id}: path looks like SVG path data`);
    assert.ok(logo.title, id);
  }
  for (const bad of ["", "nope", "__proto__", "constructor", 5, null, undefined, {}]) {
    assert.equal(logoFor(bad), null, String(bad));
    assert.equal(artFor(bad), null, String(bad));
    assert.equal(hasLogo(bad), false, String(bad));
  }
  assert.equal(fallbackIcon("web"), "Plug");
  assert.equal(fallbackIcon("__proto__"), "Plug");
});
