import test from "node:test";
import assert from "node:assert/strict";
import { FALLBACK_ICONS, LOGOS, logoFor, fallbackIcon } from "./app-logos.js";
import { APP_LIST } from "./connectors/app-list.js";
import { COMPOSIO_APPS } from "./connectors/composio-apps.js";

test("every connection has a logo: each app in the list, each Composio app, and the four Google products", () => {
  // Slack is not in the logo package, so it is the one app shown with a plain icon instead.
  for (const app of [...APP_LIST, ...COMPOSIO_APPS]) assert.ok(logoFor(app.id) || FALLBACK_ICONS[app.id], `${app.id} has a logo or a plain icon`);
  assert.deepEqual(COMPOSIO_APPS.filter((app) => !logoFor(app.id)).map((app) => app.id), ["slack"]);
  for (const id of ["calendar", "sheets", "gmail", "drive", "mcp"]) assert.ok(logoFor(id), id);
});

test("each logo is a real SVG shape with a six-digit brand colour; a made-up id has no logo and gets a plain icon", () => {
  for (const [id, logo] of Object.entries(LOGOS)) {
    assert.match(logo.hex, /^[0-9A-Fa-f]{6}$/, id);
    assert.match(logo.path, /^[Mm][\d.\- ,A-Za-z]+$/, `${id}: path looks like SVG path data`);
    assert.ok(logo.title, id);
  }
  for (const bad of ["", "nope", "__proto__", "constructor", 5, null, undefined, {}]) assert.equal(logoFor(bad), null, String(bad));
  assert.equal(fallbackIcon("web"), "Plug");
  assert.equal(fallbackIcon("slack"), "MessageSquare");
  assert.equal(fallbackIcon("__proto__"), "Plug");
});
