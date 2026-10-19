// Scrambles (encrypts) a secret before it is saved in the database, and unscrambles it when the server needs it.
// Method: AES-256-GCM, the standard choice. A fresh random "iv" is made for every secret, and GCM adds a tag that makes
// the unscrambling FAIL if anyone changed the scrambled text. The format is "v1." plus one piece of base64url text.
// The key (32 random bytes written as text) is handed in from .env.local by lib/connectors/oauth-env.js: this file never
// reads it itself, which also lets tests use a made-up key.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const PREFIX = "v1.";

// "base64 text of 32 bytes" -> Buffer, or null when it is not a usable key.
export function parseKey(text) {
  if (typeof text !== "string") return null;
  const bytes = Buffer.from(text.trim(), "base64");
  return bytes.length === 32 ? bytes : null;
}

export function encryptText(plain, keyText) {
  const key = parseKey(keyText);
  if (!key) throw new Error("bad key");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const data = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

// Returns the original text, or throws when the key is wrong or the text was changed.
export function decryptText(scrambled, keyText) {
  const key = parseKey(keyText);
  if (!key || typeof scrambled !== "string" || !scrambled.startsWith(PREFIX)) throw new Error("cannot read");
  const bytes = Buffer.from(scrambled.slice(PREFIX.length), "base64url");
  if (bytes.length < 28) throw new Error("cannot read");
  const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, 12));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}
