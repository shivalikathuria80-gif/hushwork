import test from "node:test";
import assert from "node:assert/strict";
import config from "../next.config.mjs";

test("every page is sent with the browser safety headers, and the policy never blocks the app's own scripts", async () => {
  const rules = await config.headers();
  assert.equal(rules.length, 1);
  assert.equal(rules[0].source, "/:path*");
  const sent = Object.fromEntries(rules[0].headers.map((header) => [header.key, header.value]));
  assert.deepEqual(Object.keys(sent).sort(), ["Content-Security-Policy", "Permissions-Policy", "Referrer-Policy", "Strict-Transport-Security", "X-Content-Type-Options", "X-Frame-Options"]);
  assert.equal(sent["X-Content-Type-Options"], "nosniff");
  assert.equal(sent["X-Frame-Options"], "DENY");
  assert.match(sent["Strict-Transport-Security"], /^max-age=\d{7,}$/, "no includeSubDomains or preload: those cannot be taken back");
  assert.match(sent["Content-Security-Policy"], /frame-ancestors 'none'/);
  assert.ok(!/script-src|default-src|style-src/.test(sent["Content-Security-Policy"]), "no script or style rule: Next.js needs inline scripts, so a rule here would break the app");
});
