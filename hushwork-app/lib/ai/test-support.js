// Small helpers shared by the AI tests (not a test file itself). No test ever talks to a real AI service:
//   - blockRealFetch() makes any call to the real `fetch` count as a failure,
//   - mockFetch() is the fake `fetch` each test hands to the code,
//   - captureConsole() records everything printed, so tests can prove nothing secret is logged.
import { after } from "node:test";
import assert from "node:assert/strict";

export function blockRealFetch() {
  const state = { calls: 0 };
  globalThis.fetch = () => { state.calls++; throw new Error("A test called the real fetch"); };
  after(() => assert.equal(state.calls, 0, "a test called the real fetch"));
}

// handler(callNumber, url, init) returns a Response (or throws). `calls` holds every request that was made.
export function mockFetch(handler) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return handler(calls.length, url, init);
  };
  impl.calls = calls;
  return impl;
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

export const STEPS = [
  { icon: "Clock", title: "Run every weekday", detail: "9:00 am" },
  { icon: "CreditCard", title: "Find overdue invoices", detail: "Stripe, older than 7 days" },
  { icon: "PenLine", title: "Draft a polite reminder", detail: "In your tone" },
];

// What the AI service answers when all is well: the plan as JSON text inside the usual envelope.
export function groqAnswer(plan = { steps: STEPS }, extra = {}) {
  const message = { role: "assistant", content: typeof plan === "string" ? plan : JSON.stringify(plan), ...(extra.message ?? {}) };
  return {
    choices: [{ message, finish_reason: extra.finish ?? "stop" }],
    usage: { prompt_tokens: 812, completion_tokens: 300, completion_tokens_details: { reasoning_tokens: 120 } },
  };
}

export function captureConsole() {
  const lines = [];
  const original = {};
  for (const name of ["log", "info", "warn", "error", "debug"]) {
    original[name] = console[name];
    console[name] = (...args) => lines.push(args.map((arg) => (typeof arg === "string" ? arg : JSON.stringify(arg))).join(" "));
  }
  return { lines, restore: () => Object.assign(console, original) };
}

// Text that must never be sent to an outside service. Shared by plan.test.js (the check itself) and preview.test.js
// (nothing is sent, nothing costs a plan). All keys and numbers here are made up.
const fullWidth = (digits) => digits.replace(/\d/g, (digit) => String.fromCodePoint(0xff10 + Number(digit)));
export const SENSITIVE_SAMPLES = [
  "my card is 4111 1111 1111 1111 please charge it",
  "4111-1111-1111-1111",
  "4111111111111111",
  "4111  1111  1111  1111", // double spaces
  "4111\n1111\n1111\n1111", // line breaks
  "4111.1111.1111.1111", // dots
  "4111/1111/1111/1111", // slashes
  "4111\u{a0}1111\u{a0}1111\u{a0}1111", // non-breaking spaces
  fullWidth("4111111111111111"), // full-width digits
  "4111\u{200b}1111\u{200b}1111\u{200b}1111", // zero-width spaces
  "4111\u{200b}\u{200b}\u{200b}1111\u{200b}\u{200b}\u{200b}1111\u{200b}\u{200b}\u{200b}1111", // three invisible characters between groups
  "key sk-abcdefgh\u{200d}ijklmnopqrstuvwxyz1234", // an invisible character hidden inside a key
  "key sk-abcdefghijklmnopqrstuvwxyz123456 here",
  "sk_" + "live_abcdefghijklmnop1234",
  "sb_secret_abcdefghijklmnopqrstuv",
  "token gh" + "p_abcdefghijklmnopqrstuvwxyz0123456789",
  "github_pat_" + "a1B2c3D4e5".repeat(4),
  "aws AKIA" + "ABCDEFGHIJKLMNOP",
  "xox" + "b-1234567890-abcdefghijklmnop",
  "gsk_" + "a".repeat(30),
  "AIza" + "B".repeat(30),
  "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.abcdef",
  "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----",
  "-----BEGIN RSA PRIVATE KEY-----",
  "-----BEGIN OPENSSH PRIVATE KEY-----",
];
