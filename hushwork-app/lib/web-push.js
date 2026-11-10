// WEB PUSH, written with node:crypto only (no extra package). Two standards:
//   RFC 8291 + RFC 8188: the message is encrypted for ONE browser ("aes128gcm"), so the push service in between cannot read it.
//   RFC 8292 (VAPID): a short signed note says which server sends it, so a push address stolen from a browser is useless to anyone else.
// The keys come from the settings (VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY: base64url, made once with `npm run vapid`). With no keys push is off.
//
// A push address comes from a browser, so it is NOT trusted: Hushwork only ever posts to the real push services below (never to an address
// that could point inside a network), with a time limit and no redirects.
import { createECDH, createPrivateKey, createPublicKey, createCipheriv, hkdfSync, randomBytes, sign, verify } from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const unb64u = (text) => Buffer.from(String(text ?? ""), "base64url");

export const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /^(?:[a-z0-9-]+\.)*push\.apple\.com$/, /^(?:[a-z0-9-]+\.)*notify\.windows\.com$/];
export const PUSH_OFF = "Push notifications are not switched on for this Hushwork. Add VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY to the settings (npm run vapid makes them).";

// Is this a push address Hushwork may post to? Returns the URL, or null.
export function checkEndpoint(endpoint) {
  try {
    const url = new URL(String(endpoint));
    if (url.protocol !== "https:" || url.username || url.password || url.port) return null;
    if (String(endpoint).length > 800) return null;
    return PUSH_HOSTS.some((host) => host.test(url.hostname)) ? url : null;
  } catch {
    return null;
  }
}

// A browser's subscription as PushSubscription.toJSON() gives it. Returns { value: { endpoint, p256dh, auth } } or { error }.
export function checkSubscription(input) {
  const endpoint = typeof input?.endpoint === "string" ? input.endpoint : "";
  const p256dh = typeof input?.keys?.p256dh === "string" ? input.keys.p256dh : "";
  const auth = typeof input?.keys?.auth === "string" ? input.keys.auth : "";
  if (!checkEndpoint(endpoint)) return { error: "This browser's push service is not one Hushwork knows. Try Chrome, Edge, Firefox or Safari." };
  if (!/^[A-Za-z0-9_-]{80,100}$/.test(p256dh) || unb64u(p256dh).length !== 65 || unb64u(p256dh)[0] !== 4) return { error: "This browser sent a push key Hushwork cannot read." };
  if (!/^[A-Za-z0-9_-]{16,30}$/.test(auth) || unb64u(auth).length !== 16) return { error: "This browser sent a push key Hushwork cannot read." };
  return { value: { endpoint, p256dh, auth } };
}

// A new pair of VAPID keys (scripts/make-vapid.mjs). The public key is what browsers are given to subscribe with.
export function makeVapidKeys() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey(null, "uncompressed")), privateKey: b64u(ecdh.getPrivateKey()) };
}

const jwkOf = (publicKey, privateKey) => {
  const pub = unb64u(publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("bad public key");
  const jwk = { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) };
  return privateKey ? { ...jwk, d: b64u(unb64u(privateKey)) } : jwk;
};

// The VAPID header for one push address. `exp` is at most 24 hours ahead (12 here).
export function vapidHeader({ endpoint, publicKey, privateKey, subject, now = Date.now() }) {
  const audience = new URL(endpoint).origin;
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({ aud: audience, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const key = createPrivateKey({ key: jwkOf(publicKey, privateKey), format: "jwk" });
  const signature = sign("sha256", Buffer.from(`${header}.${claims}`), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${header}.${claims}.${b64u(signature)}, k=${publicKey}`;
}

// Checks a VAPID header's signature (used by the tests, and by nothing that sends).
export function verifyVapid(headerValue, publicKey) {
  const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(\S+)$/.exec(String(headerValue));
  if (!match || match[4] !== publicKey) return null;
  const key = createPublicKey({ key: jwkOf(publicKey), format: "jwk" });
  const good = verify("sha256", Buffer.from(`${match[1]}.${match[2]}`), { key, dsaEncoding: "ieee-p1363" }, unb64u(match[3]));
  return good ? { header: JSON.parse(unb64u(match[1])), claims: JSON.parse(unb64u(match[2])) } : null;
}

// RFC 8291 / 8188: the encrypted body for one browser. `salt` and `serverKeys` are only handed in by tests (the RFC's own example).
export function encryptPayload({ p256dh, auth, plaintext, salt = randomBytes(16), serverKeys = null }) {
  const uaPublic = unb64u(p256dh);
  const authSecret = unb64u(auth);
  const ecdh = createECDH("prime256v1");
  if (serverKeys) ecdh.setPrivateKey(unb64u(serverKeys.privateKey));
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(null, "uncompressed");
  const shared = ecdh.computeSecret(uaPublic);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync("sha256", shared, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0"), 16));
  const nonce = Buffer.from(hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0"), 12));

  const cipher = createCipheriv("aes-128-gcm", cek, nonce);
  const sealed = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const head = Buffer.alloc(21);
  Buffer.from(salt).copy(head, 0);
  head.writeUInt32BE(4096, 16);
  head.writeUInt8(asPublic.length, 20);
  return Buffer.concat([head, asPublic, sealed]);
}

// Sends one push. `subscription` = { endpoint, p256dh, auth } (already checked when saved; checked again here). `payload` is a small object
// (lib/approve-links.js pushPayload). Returns { ok: true } | { ok: false, gone: true } (the browser unsubscribed: delete it) | { ok: false }.
export async function sendPush({ subscription, payload, keys, fetchImpl = fetch, now = Date.now() }) {
  if (!keys?.publicKey || !keys?.privateKey) return { ok: false, off: true };
  const url = checkEndpoint(subscription?.endpoint);
  if (!url) return { ok: false, gone: true };
  try {
    const body = encryptPayload({ p256dh: subscription.p256dh, auth: subscription.auth, plaintext: JSON.stringify(payload).slice(0, 3000) });
    const answer = await fetchImpl(url.href, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: {
        authorization: vapidHeader({ endpoint: url.href, publicKey: keys.publicKey, privateKey: keys.privateKey, subject: keys.subject || "mailto:hello@hushwork.app", now }),
        "content-encoding": "aes128gcm",
        "content-type": "application/octet-stream",
        ttl: "86400",
        urgency: "normal",
      },
      body,
    });
    if (answer.status === 404 || answer.status === 410) return { ok: false, gone: true };
    return { ok: answer.status >= 200 && answer.status < 300 };
  } catch {
    return { ok: false };
  }
}
