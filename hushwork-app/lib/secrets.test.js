// Run with: npm test   (or: node --test lib/secrets.test.js)
// Reads the project's source files as plain text and checks the rules that keep the AI key secret. It never opens
// .env.local (the file that holds the real key) and never needs one.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SKIP_DIRS = new Set(["node_modules", ".next", ".build-check", "public", ".git"]);
const CODE = /\.(js|mjs|cjs|jsx|ts|tsx|css|json|md)$/;

// Every source file in the project (not dependencies, builds or images). `.env.example` is included on purpose.
function sourceFiles(dir = root, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sourceFiles(path.join(dir, entry.name), found);
    } else if (CODE.test(entry.name) || entry.name === ".env.example") {
      found.push(path.join(dir, entry.name));
    }
  }
  return found;
}
const relative = (file) => path.relative(root, file).split(path.sep).join("/");
const files = sourceFiles().map((file) => ({ name: relative(file), text: fs.readFileSync(file, "utf8") }));
const withText = (needle) => files.filter((file) => file.text.includes(needle)).map((file) => file.name);

// Built from pieces so this test file does not contain the words it forbids elsewhere.
const KEY_NAME = "GROQ" + "_API_KEY";

test("the key's name appears in code only in lib/ai/key.js (and docs, the settings example and this test)", () => {
  const allowed = new Set(["lib/ai/key.js", "lib/secrets.test.js", ".env.example", "README.md"]);
  const unexpected = withText(KEY_NAME).filter((name) => !allowed.has(name));
  assert.deepEqual(unexpected, []);
  assert.ok(withText(KEY_NAME).includes("lib/ai/key.js"), "key.js reads it");
});

test("lib/ai/key.js is marked server-only and is imported only by server code", () => {
  const key = files.find((file) => file.name === "lib/ai/key.js").text;
  assert.match(key, /^import "server-only";/m);
  const importers = files.filter((file) => /from\s+["'](?:@\/lib\/ai\/key|(?:\.\.?\/)+(?:lib\/)?(?:ai\/)?key)(?:\.js)?["']/.test(file.text)).map((file) => file.name);
  assert.deepEqual(importers.sort(), ["lib/actions/plan.js", "lib/ai-status.js"]); // the Server Action, and the helper that tells pages only "on or off"
  for (const name of importers) {
    const text = files.find((file) => file.name === name).text;
    assert.ok(!/^\s*["']use client["']/m.test(text), `${name} is browser code and must not import the key reader`);
  }
});

test("the key is never given a NEXT_PUBLIC_ name (that prefix copies a value into the browser)", () => {
  assert.deepEqual(withText("NEXT_PUBLIC_" + "GROQ"), []);
  assert.deepEqual(withText("NEXT_PUBLIC_" + "ANTHROPIC"), []);
});

test("no real-looking Groq key is written anywhere", () => {
  const looksReal = new RegExp("gsk_" + "[A-Za-z0-9]{20,}");
  const hits = files.filter((file) => looksReal.test(file.text)).map((file) => file.name);
  assert.deepEqual(hits, []); // even the tests use obviously fake keys that do not look real
});

test("nothing from the old AI provider is left in code", () => {
  for (const word of ["ANTHROPIC", "sk-ant-"]) {
    const hits = withText(word).filter((name) => !name.startsWith("docs/") && name !== "lib/secrets.test.js");
    assert.deepEqual(hits, [], word);
  }
});

test("source files never point the key reader at a hard-coded secret", () => {
  const key = files.find((file) => file.name === "lib/ai/key.js").text;
  assert.ok(!/process\.env\.GROQ_API_KEY\s*\|\|\s*["'`]/.test(key), "no fallback value");
  const urls = files.filter((file) => /api\.groq\.com/.test(file.text)).map((file) => file.name).filter((name) => !name.endsWith(".test.js") && name !== "README.md");
  assert.deepEqual(urls, ["lib/ai/groq.js"], "the Groq address is written in one place");
});

test("previewPlan: 'use server' comes first and it asks who is calling before anything else", () => {
  const action = files.find((file) => file.name === "lib/actions/plan.js").text;
  assert.match(action, /^\s*["']use server["'];?/, '"use server" is the first statement');
  const start = action.indexOf("export async function previewPlan");
  assert.ok(start > 0, "previewPlan exists");
  const body = action.slice(start);
  const order = ["requireUser(", "checkPrompt(", "getGroqKey("].map((call) => body.indexOf(call));
  assert.ok(order.every((index) => index > 0) && body.includes("makePreview("), "all four calls are inside previewPlan");
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "requireUser, then checkPrompt, then getGroqKey (which is read as makePreview's argument)");
  assert.ok(!/export (?:const|let|var|default)\s/.test(action), "a 'use server' file may export only async functions");
});
