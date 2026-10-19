import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { decryptText, encryptText, parseKey } from "./crypto.js";

const key = randomBytes(32).toString("base64");

test("a secret goes in scrambled and comes back the same", () => {
  const scrambled = encryptText("lin_oauth_secret_value", key);
  assert.ok(scrambled.startsWith("v1."));
  assert.ok(!scrambled.includes("secret_value"));
  assert.equal(decryptText(scrambled, key), "lin_oauth_secret_value");
  assert.notEqual(encryptText("same", key), encryptText("same", key), "a fresh random start every time");
  assert.equal(decryptText(encryptText("", key), key), "");
  assert.equal(decryptText(encryptText("héllo 😀", key), key), "héllo 😀");
});

test("a wrong key, a changed text or rubbish all fail instead of giving back something wrong", () => {
  const scrambled = encryptText("abc", key);
  assert.throws(() => decryptText(scrambled, randomBytes(32).toString("base64")));
  const flipped = `${scrambled.slice(0, -2)}${scrambled.endsWith("AA") ? "BB" : "AA"}`;
  assert.throws(() => decryptText(flipped, key));
  for (const bad of ["", "v1.", "v1.abc", "plain", null, undefined, 5]) assert.throws(() => decryptText(bad, key), String(bad));
});

test("only a 32-byte key is accepted", () => {
  assert.equal(parseKey(key).length, 32);
  assert.equal(parseKey(` ${key}\n`).length, 32);
  for (const bad of ["", "short", randomBytes(16).toString("base64"), randomBytes(33).toString("base64"), null, undefined, 5]) assert.equal(parseKey(bad), null, String(bad));
  assert.throws(() => encryptText("x", "short"));
});
