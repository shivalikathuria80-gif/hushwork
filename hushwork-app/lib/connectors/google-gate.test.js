import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { googleOpenFor } from "./google-gate.js";

const ME = "11111111-1111-4111-8111-111111111111";

test("googleOpenFor: no setting = open to everyone; a setting = only the accounts listed, by exact id", () => {
  assert.equal(googleOpenFor(ME, undefined), true);
  assert.equal(googleOpenFor(ME, " , "), true, "an empty list is no list");
  assert.equal(googleOpenFor(ME, ` ${ME} ,other`), true);
  assert.equal(googleOpenFor("someone-else", ME), false);
  assert.equal(googleOpenFor(ME.slice(0, 10), ME), false, "part of an id is not enough");
  for (const odd of [undefined, null, 5, {}]) assert.equal(googleOpenFor(odd, ME), false);
});

test("the gate sits where every Google use passes: the token, both halves of Connect, and the Connections page", () => {
  const core = fs.readFileSync(new URL("../run-core.js", import.meta.url), "utf8");
  const auth = core.slice(core.indexOf("export async function googleAuthorization"));
  assert.match(auth.slice(0, 200), /if \(!googleOpenFor\(userId\)\) return null;/, "the first line of the one function that hands out a Google token");
  const flow = fs.readFileSync(new URL("../connections/oauth-flow.js", import.meta.url), "utf8");
  assert.equal(flow.match(/provider === "google" && !googleOpenFor\(user\.id\)/g).length, 2, "start and finish of Connect");
  const page = fs.readFileSync(new URL("../../app/app/connections/page.js", import.meta.url), "utf8");
  assert.ok(page.includes('const soon = app === "google" && !googleOpenFor(user.id);') && page.includes("&& !soon; // the one-time setup is done"));
  assert.ok(!/NEXT_PUBLIC_GOOGLE_ONLY_FOR/.test(core + flow + page), "the list is a server setting only");
});
