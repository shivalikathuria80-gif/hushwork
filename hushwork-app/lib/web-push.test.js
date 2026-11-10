import test from "node:test";
import assert from "node:assert/strict";
import { createDecipheriv, createECDH, hkdfSync } from "node:crypto";
import { checkEndpoint, checkSubscription, encryptPayload, makeVapidKeys, sendPush, vapidHeader, verifyVapid } from "./web-push.js";

// RFC 8291, Appendix A: the standard's own worked example. Same keys and salt in, the very same bytes out.
const RFC = {
  plaintext: "When I grow up, I want to be a watermelon",
  asPrivate: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw",
  uaPublic: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
  auth: "BTBZMqHH6r4Tts7J_aSIgg",
  salt: "DGv6ra1nlYgDCS1FRnbzlw",
  body: "DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN",
};

test("push encryption matches the RFC 8291 example byte for byte", () => {
  const out = encryptPayload({ p256dh: RFC.uaPublic, auth: RFC.auth, plaintext: RFC.plaintext, salt: Buffer.from(RFC.salt, "base64url"), serverKeys: { privateKey: RFC.asPrivate } });
  assert.equal(out.toString("base64url"), RFC.body);
});

// What a browser does with it: so the round trip is checked with fresh keys too, not only the example.
function decrypt(body, uaPrivate, uaPublic, auth) {
  const salt = body.subarray(0, 16);
  const idLength = body[20];
  const asPublic = body.subarray(21, 21 + idLength);
  const ecdh = createECDH("prime256v1");
  ecdh.setPrivateKey(uaPrivate);
  const shared = ecdh.computeSecret(asPublic);
  const ikm = Buffer.from(hkdfSync("sha256", shared, auth, Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]), 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));
  const sealed = body.subarray(21 + idLength);
  const decipher = createDecipheriv("aes-128-gcm", cek, nonce);
  decipher.setAuthTag(sealed.subarray(sealed.length - 16));
  const plain = Buffer.concat([decipher.update(sealed.subarray(0, sealed.length - 16)), decipher.final()]);
  assert.equal(plain.at(-1), 2, "the last-record marker");
  return plain.subarray(0, -1).toString();
}

test("a fresh browser key pair can read what Hushwork encrypts, and nobody else can", () => {
  const browser = createECDH("prime256v1");
  browser.generateKeys();
  const auth = Buffer.from("0123456789abcdef");
  const body = encryptPayload({ p256dh: browser.getPublicKey(null, "uncompressed").toString("base64url"), auth: auth.toString("base64url"), plaintext: '{"title":"hi"}' });
  assert.equal(decrypt(body, browser.getPrivateKey(), browser.getPublicKey(null, "uncompressed"), auth), '{"title":"hi"}');
  const stranger = createECDH("prime256v1");
  stranger.generateKeys();
  assert.throws(() => decrypt(body, stranger.getPrivateKey(), browser.getPublicKey(null, "uncompressed"), auth));
});

test("VAPID: signed by the server's key, for the push service's origin only, expiring within a day", () => {
  const keys = makeVapidKeys();
  const now = Date.parse("2026-11-10T09:00:00Z");
  const value = vapidHeader({ endpoint: "https://fcm.googleapis.com/fcm/send/abc", ...keys, subject: "mailto:a@b.c", now });
  const read = verifyVapid(value, keys.publicKey);
  assert.ok(read, "the signature checks out");
  assert.equal(read.claims.aud, "https://fcm.googleapis.com");
  assert.ok(read.claims.exp - now / 1000 <= 86400);
  assert.equal(verifyVapid(value, makeVapidKeys().publicKey), null, "another key does not match");
});

test("push addresses: only the real push services, https, no ports or passwords", () => {
  for (const good of ["https://fcm.googleapis.com/fcm/send/x", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://web.push.apple.com/x", "https://wns2-par02p.notify.windows.com/w/?token=x"]) assert.ok(checkEndpoint(good), good);
  for (const bad of ["http://fcm.googleapis.com/x", "https://localhost/x", "https://169.254.169.254/latest", "https://fcm.googleapis.com.evil.com/x", "https://evilpush.apple.com.example/x", "https://u:p@fcm.googleapis.com/x", "https://fcm.googleapis.com:8443/x", "not a url"]) assert.equal(checkEndpoint(bad), null, bad);
  const browser = createECDH("prime256v1");
  browser.generateKeys();
  const keys = { p256dh: browser.getPublicKey(null, "uncompressed").toString("base64url"), auth: Buffer.alloc(16, 1).toString("base64url") };
  assert.ok(checkSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys }).value);
  assert.ok(checkSubscription({ endpoint: "https://evil.example/x", keys }).error);
  assert.ok(checkSubscription({ endpoint: "https://fcm.googleapis.com/fcm/send/x", keys: { ...keys, auth: "short" } }).error);
});

test("sendPush: posts the encrypted body with the VAPID header; 404/410 means the browser is gone; no keys means off", async () => {
  const browser = createECDH("prime256v1");
  browser.generateKeys();
  const subscription = { endpoint: "https://fcm.googleapis.com/fcm/send/x", p256dh: browser.getPublicKey(null, "uncompressed").toString("base64url"), auth: Buffer.alloc(16, 7).toString("base64url") };
  const keys = makeVapidKeys();
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init }); return { status: calls.length === 1 ? 201 : 410 }; };
  assert.deepEqual(await sendPush({ subscription, payload: { title: "t" }, keys, fetchImpl }), { ok: true });
  assert.equal(calls[0].init.headers["content-encoding"], "aes128gcm");
  assert.equal(calls[0].init.redirect, "manual");
  assert.ok(verifyVapid(calls[0].init.headers.authorization, keys.publicKey));
  assert.equal(decrypt(calls[0].init.body, browser.getPrivateKey(), browser.getPublicKey(null, "uncompressed"), Buffer.alloc(16, 7)), '{"title":"t"}');
  assert.deepEqual(await sendPush({ subscription, payload: {}, keys, fetchImpl }), { ok: false, gone: true });
  assert.deepEqual(await sendPush({ subscription, payload: {}, keys: {}, fetchImpl }), { ok: false, off: true });
  assert.deepEqual(await sendPush({ subscription: { ...subscription, endpoint: "https://evil.example/x" }, payload: {}, keys, fetchImpl }), { ok: false, gone: true });
  assert.equal(calls.length, 2, "never posts to an unknown address");
});
