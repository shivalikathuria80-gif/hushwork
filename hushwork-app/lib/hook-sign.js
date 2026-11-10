// START LINKS: the sender check. A link can ask that every arrival carries a signature made with a secret only the sender and the owner
// know, so holding the address alone is not enough to start the workflow. Each style below is the way one real sender signs its webhooks,
// so the owner pastes the same secret in both places and nothing else changes on the sender's side.
//
// Plain data and the browser's own WebCrypto, no imports: the Start links page uses signArrival() to sign "Send a test", and the server
// (lib/hooks.js verifySignature) checks with Node's crypto. The tests sign here and check there, so both halves always agree.

// header: where the signature travels (lower case). secret: "paste" = the sender makes the secret and the owner copies it in;
// "either" = the owner may also let Hushwork make one and paste it into the sender.
export const SIGNING_STYLES = {
  tally: { name: "Tally", header: "tally-signature", secret: "either", where: "In Tally: Integrations, Webhooks, then Signing secret. Paste the same secret in both places." },
  typeform: { name: "Typeform", header: "typeform-signature", secret: "either", where: "In Typeform: Connect, Webhooks, Edit, then Secret. Paste the same secret in both places." },
  stripe: { name: "Stripe", header: "stripe-signature", secret: "paste", where: "In Stripe: Developers, Webhooks, your endpoint, then Signing secret (it starts with whsec_). Copy it here." },
  github: { name: "GitHub", header: "x-hub-signature-256", secret: "either", where: "In GitHub: Settings, Webhooks, then Secret. Paste the same secret in both places." },
  hushwork: { name: "Your own app", header: "x-hushwork-signature", secret: "either", where: "Send the header X-Hushwork-Signature: sha256= followed by the HMAC-SHA256 of the exact body, in hex, made with this secret." },
};
export const STYLE_KEYS = Object.keys(SIGNING_STYLES);
export const STRIPE_TOLERANCE_S = 300; // a Stripe signature older than five minutes is refused, like Stripe's own libraries do
export const SECRET_SHAPE = /^[\x21-\x7e][\x20-\x7e]{6,198}[\x21-\x7e]$/; // 8 to 200 plain characters; spaces only inside (GitHub allows them)
// Every header a sender may set when posting from a browser (the page's "Send a test" does), for the address's CORS answer.
export const SIGNED_HEADERS = ["content-type", "idempotency-key", "x-hushwork-delivery", ...STYLE_KEYS.map((key) => SIGNING_STYLES[key].header)];

const bytes = (text) => new TextEncoder().encode(String(text));
const hex = (buffer) => [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const base64 = (buffer) => btoa(String.fromCharCode(...new Uint8Array(buffer)));

async function hmac(secret, text) {
  const key = await crypto.subtle.importKey("raw", bytes(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", key, bytes(text));
}

// The headers a sender of `style` would add to `body` (the exact text that is posted). `nowSeconds` only matters for Stripe.
// Returns {} for no style, so an unsigned link is posted to exactly as before.
export async function signArrival(style, secret, body, nowSeconds = Math.floor(Date.now() / 1000)) {
  const one = SIGNING_STYLES[style];
  if (!one || !secret) return {};
  if (style === "stripe") return { [one.header]: `t=${nowSeconds},v1=${hex(await hmac(secret, `${nowSeconds}.${body}`))}` };
  const mac = await hmac(secret, body);
  if (style === "tally") return { [one.header]: base64(mac) };
  if (style === "typeform") return { [one.header]: `sha256=${base64(mac)}` };
  return { [one.header]: `sha256=${hex(mac)}` }; // github and hushwork
}
