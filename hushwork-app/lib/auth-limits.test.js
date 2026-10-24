import test from "node:test";
import assert from "node:assert/strict";
import { allowAuthTry, makeAuthLimits } from "./auth-limits.js";

const NOW = Date.UTC(2026, 9, 24, 12, 0, 0);
const MINUTE = 60_000;

test("sign in: 8 tries per email in 10 minutes, capitals and spaces do not make a new email, and the window moves on", () => {
  const limits = makeAuthLimits();
  const ask = (email, now = NOW, visitor = "1.1.1.1") => allowAuthTry("signIn", { email, visitor }, { now, limits });
  for (let i = 0; i < 8; i += 1) assert.equal(ask(i % 2 ? " Ana@Example.com " : "ana@example.com"), true, `try ${i + 1}`);
  assert.equal(ask("ANA@example.com"), false, "the 9th try for the same email is refused");
  assert.equal(ask("someone@else.com"), true, "another email is fine");
  assert.equal(ask("ana@example.com", NOW + 11 * MINUTE), true, "ten minutes later it is allowed again");
});

test("sign in: one visitor address may try 30 times in 10 minutes across any emails; a refused try is not counted", () => {
  const limits = makeAuthLimits();
  for (let i = 0; i < 30; i += 1) assert.equal(allowAuthTry("signIn", { email: `user${i}@example.com`, visitor: "9.9.9.9" }, { now: NOW, limits }), true);
  assert.equal(allowAuthTry("signIn", { email: "another@example.com", visitor: "9.9.9.9" }, { now: NOW, limits }), false);
  assert.equal(allowAuthTry("signIn", { email: "another@example.com", visitor: "8.8.8.8" }, { now: NOW, limits }), true, "a different visitor is fine");
  const quiet = makeAuthLimits();
  for (let i = 0; i < 8; i += 1) allowAuthTry("signIn", { email: "a@b.co", visitor: "v" }, { now: NOW, limits: quiet });
  for (let i = 0; i < 20; i += 1) assert.equal(allowAuthTry("signIn", { email: "a@b.co", visitor: "v" }, { now: NOW, limits: quiet }), false);
  assert.equal(allowAuthTry("signIn", { email: "fresh@b.co", visitor: "v" }, { now: NOW, limits: quiet }), true, "the refused tries did not use up the visitor's allowance");
});

test("sign up: 3 tries per email and 6 per visitor in an hour; unknown kinds and odd input are refused or safe", () => {
  const limits = makeAuthLimits();
  const up = (email, visitor = "1.1.1.1") => allowAuthTry("signUp", { email, visitor }, { now: NOW, limits });
  assert.deepEqual([up("a@b.co"), up("a@b.co"), up("a@b.co"), up("a@b.co")], [true, true, true, false]);
  for (let i = 0; i < 3; i += 1) up(`other${i}@b.co`);
  assert.equal(up("last@b.co"), false, "the visitor's 6 are used (3 + 3 accepted, the refused one not counted)") ;
  assert.equal(allowAuthTry("signOut", { email: "a@b.co", visitor: "v" }, { now: NOW, limits }), false, "an unknown kind is refused");
  assert.equal(allowAuthTry("signIn", { email: undefined, visitor: undefined }, { now: NOW, limits: makeAuthLimits() }), true);
  assert.equal(allowAuthTry("signIn", { email: "x".repeat(5000), visitor: "y".repeat(5000) }, { now: NOW, limits: makeAuthLimits() }), true, "very long input is cut, not a crash");
});
