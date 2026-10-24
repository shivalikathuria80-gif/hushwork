import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { isLeakedPassword } from "./leaked-password.js";

const sha1 = (text) => createHash("sha1").update(text).digest("hex").toUpperCase();
const reply = (body, ok = true) => async () => ({ ok, text: async () => body });

test("leaked password: only the first 5 characters of the fingerprint leave the server, and the match is found in the answer's list", async () => {
  const password = "correct horse battery staple";
  const full = sha1(password);
  let asked;
  const fetchImpl = async (url, init) => {
    asked = { url, init };
    return { ok: true, text: async () => `0018A45C4D1DEF81644B54AB7F969B88D65:3\r\n${full.slice(5)}:12345\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2` };
  };
  assert.equal(await isLeakedPassword(password, { fetchImpl }), true);
  assert.equal(asked.url, `https://api.pwnedpasswords.com/range/${full.slice(0, 5)}`);
  assert.ok(!asked.url.includes(password) && !asked.url.includes(full.slice(5)), "neither the password nor the rest of the fingerprint is sent");
  assert.equal(asked.init.headers["Add-Padding"], "true");
});

test("leaked password: a password that is not in the list, padded fake entries (count 0), and a missing password are not leaked", async () => {
  const full = sha1("a-very-unusual-password-9f3k2");
  assert.equal(await isLeakedPassword("a-very-unusual-password-9f3k2", { fetchImpl: reply("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:4\n") }), false);
  assert.equal(await isLeakedPassword("a-very-unusual-password-9f3k2", { fetchImpl: reply(`${full.slice(5)}:0\n`) }), false, "padding entries have a count of 0");
  for (const value of ["", undefined, null, 5, {}]) assert.equal(await isLeakedPassword(value, { fetchImpl: reply("") }), false);
});

test("leaked password: a down, slow or odd service never blocks sign-up", async () => {
  assert.equal(await isLeakedPassword("x", { fetchImpl: reply("", false) }), false);
  assert.equal(await isLeakedPassword("x", { fetchImpl: async () => { throw new Error("offline"); } }), false);
  const started = Date.now();
  assert.equal(await isLeakedPassword("x", { fetchImpl: () => new Promise(() => {}), timeoutMs: 30 }), false, "a service that never answers is given up on");
  assert.ok(Date.now() - started < 1000, "and quickly");
});
