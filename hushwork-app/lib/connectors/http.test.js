import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { checkRequestUrl, isPublicIp, fetchPublic, HTTP_FAILED } from "./http.js";

test("addresses that are fine", () => {
  assert.equal(checkRequestUrl("https://api.example.com/status?x=1").value, "https://api.example.com/status?x=1");
  assert.equal(checkRequestUrl("  https://Example.com  ").value, "https://example.com/");
});

test("addresses that are refused, each with a plain sentence", () => {
  const bad = [
    "", "   ", 5, null, "example.com", "http://example.com", "ftp://example.com", "file:///etc/passwd", "javascript:alert(1)",
    "https://user:pw@example.com", "https://example.com:8443/", "https://localhost/", "https://LOCALHOST./", "https://intranet/", "https://printer.local/",
    "https://db.internal/", "https://127.0.0.1/", "https://10.0.0.5/", "https://169.254.169.254/latest/meta-data", "https://[::1]/", "https://[fd00::1]/",
    "https://2130706433/", "https://0x7f.1/", `https://example.com/${"a".repeat(200)}`,
  ];
  for (const text of bad) {
    const result = checkRequestUrl(text);
    assert.equal(typeof result.error, "string", JSON.stringify(text));
    assert.equal(result.value, undefined);
  }
});

test("isPublicIp: private, loopback, link-local, mapped and odd addresses are not public", () => {
  const notPublic = ["0.0.0.0", "10.1.2.3", "127.0.0.1", "169.254.169.254", "172.16.0.1", "172.31.255.255", "192.168.1.1", "100.64.0.1", "224.0.0.1", "255.255.255.255", "192.0.2.5", "198.18.0.1",
    "::", "::1", "fc00::1", "fd12:3456::1", "fe80::1", "ff02::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1", "2001:db8::1", "2002:7f00:1::", "64:ff9b::7f00:1", "not an ip", "", null, 5];
  for (const address of notPublic) assert.equal(isPublicIp(address), false, String(address));
  const open = ["8.8.8.8", "1.1.1.1", "93.184.216.34", "172.32.0.1", "172.15.255.255", "100.63.0.1", "2606:4700:4700::1111", "2a00:1450:4009:81f::200e", "::ffff:8.8.8.8"];
  for (const address of open) assert.equal(isPublicIp(address), true, address);
});

// A pretend https.request. `answer` describes what the "server" says; the guarded lookup is exercised for real.
function fakes({ addresses, answer }) {
  const seen = { lookups: [], options: null };
  const lookup = (host, opts, cb) => { seen.lookups.push(host); cb(null, addresses.map((address) => ({ address, family: address.includes(":") ? 6 : 4 }))); };
  const request = (href, options, onResponse) => {
    seen.href = href;
    seen.options = options;
    const req = new EventEmitter();
    req.destroy = () => {};
    req.end = () => {
      options.lookup(new URL(href).hostname, { all: true }, (error) => {
        if (error) return req.emit("error", error);
        const res = new EventEmitter();
        res.statusCode = answer.status;
        res.headers = answer.headers ?? {};
        res.destroy = () => res.emit("end");
        onResponse(res);
        for (const piece of answer.body ?? []) res.emit("data", Buffer.from(piece));
        res.emit("end");
      });
    };
    return req;
  };
  return { lookup, request, seen };
}

test("a public address is fetched: GET only, no redirects, a short text excerpt comes back", async () => {
  const f = fakes({ addresses: ["93.184.216.34"], answer: { status: 200, headers: { "content-type": "application/json; charset=utf-8" }, body: ['{"ok":', "true}\n"] } });
  const result = await fetchPublic("https://api.example.com/status", f);
  assert.deepEqual(result, { ok: true, status: 200, type: "application/json", excerpt: '{"ok":true}' });
  assert.equal(f.seen.options.method, "GET");
  assert.equal(f.seen.options.agent, false);
  assert.deepEqual(Object.keys(f.seen.options.headers).sort(), ["accept", "user-agent"], "no cookies, no keys");
});

test("a name that points inside is refused at connection time, even if one answer is public", async () => {
  for (const addresses of [["127.0.0.1"], ["10.0.0.5"], ["169.254.169.254"], ["93.184.216.34", "192.168.0.1"], ["::1"], []]) {
    const f = fakes({ addresses, answer: { status: 200, headers: { "content-type": "text/plain" }, body: ["SECRET"] } });
    assert.deepEqual(await fetchPublic("https://evil.example.com/", f), { ok: false, error: HTTP_FAILED.blocked }, addresses.join());
  }
});

test("a redirect is reported and not followed; binary answers give no excerpt; huge answers are cut", async () => {
  const redirect = await fetchPublic("https://example.com/", fakes({ addresses: ["93.184.216.34"], answer: { status: 301, headers: { location: "http://127.0.0.1/", "content-type": "text/html" }, body: [""] } }));
  assert.equal(redirect.status, 301);
  assert.equal(redirect.excerpt, "");
  const binary = await fetchPublic("https://example.com/", fakes({ addresses: ["93.184.216.34"], answer: { status: 200, headers: { "content-type": "image/png" }, body: ["PNG..."] } }));
  assert.equal(binary.excerpt, "");
  const big = await fetchPublic("https://example.com/", fakes({ addresses: ["93.184.216.34"], answer: { status: 200, headers: { "content-type": "text/plain" }, body: ["a".repeat(70000), "b"] } }));
  assert.ok(big.excerpt.length <= 400 && !big.excerpt.includes("b"));
});

test("bad input never reaches the network, and a network error becomes a fixed sentence", async () => {
  const never = { lookup: () => assert.fail("looked up"), request: () => assert.fail("requested") };
  assert.equal((await fetchPublic("http://example.com", never)).ok, false);
  assert.equal((await fetchPublic("https://127.0.0.1/", never)).ok, false);
  const request = () => { const req = new EventEmitter(); req.destroy = () => {}; req.end = () => req.emit("error", new Error("ECONNRESET https://secret")); return req; };
  assert.deepEqual(await fetchPublic("https://example.com/", { request, lookup: () => {} }), { ok: false, error: HTTP_FAILED.network });
});

test("a slow server is stopped", async () => {
  const request = () => { const req = new EventEmitter(); req.destroy = () => {}; req.end = () => {}; return req; };
  assert.deepEqual(await fetchPublic("https://example.com/", { request, lookup: () => {}, timeoutMs: 20 }), { ok: false, error: HTTP_FAILED.slow });
});
