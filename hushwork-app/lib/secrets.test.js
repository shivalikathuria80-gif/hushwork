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
  assert.deepEqual(importers.sort(), ["lib/actions/plan.js", "lib/actions/runs.js", "lib/ai-status.js"]); // the two Server Actions that call the AI, and the helper that tells pages only "on or off"
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

test("web calls: only the Server Action imports the fetcher, the action checks who is calling first, and nothing else makes outside requests", () => {
  const importers = files.filter((file) => /from\s+["'](?:@\/lib\/connectors\/http|(?:\.\.?\/)+(?:connectors\/)?http)(?:\.js)?["']/.test(file.text)).map((file) => file.name).filter((name) => !name.endsWith(".test.js"));
  assert.deepEqual(importers, ["lib/actions/runs.js"]);
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  const body = action.slice(action.indexOf("export async function approveWebCall"));
  assert.ok(body.indexOf("requireUser(") > 0 && body.indexOf("requireUser(") < body.indexOf("loadPracticeStep("));
  assert.ok(body.indexOf("loadPracticeStep(") < body.indexOf("fetchPublic("), "the saved step is read before the address is fetched");
  assert.ok(!/fetchPublic\(\s*input/.test(action), "the address always comes from the saved run, never straight from the browser");
  // the Node https module (the one that can reach the outside) is imported in exactly one non-test file
  const raw = files.filter((file) => /from\s+["']node:https["']/.test(file.text)).map((file) => file.name).filter((name) => !name.endsWith(".test.js"));
  assert.deepEqual(raw, ["lib/connectors/http.js"]);
});

// The Linear key follows the same rules as the Groq key. Names are built from pieces so this file does not contain them.
const LINEAR_NAME = "LINEAR" + "_API_KEY";

test("the Linear key's name appears in code only in lib/connectors/linear-env.js (and docs, the example, this test and the Connections page)", () => {
  const allowed = new Set(["lib/connectors/linear-env.js", "lib/connectors/linear.js", "lib/connectors/linear.test.js", "lib/secrets.test.js", ".env.example", "README.md", "app/app/connections/page.js"]);
  assert.deepEqual(withText(LINEAR_NAME).filter((file) => !allowed.has(file)), []);
  assert.ok(withText(LINEAR_NAME).includes("lib/connectors/linear-env.js"));
});

test("linear-env.js is server-only and imported only by server code", () => {
  const env = files.find((file) => file.name === "lib/connectors/linear-env.js").text;
  assert.match(env, /^import "server-only";/m);
  const importers = files.filter((file) => /from\s+["'](?:@\/lib\/connectors\/linear-env|(?:\.\.?\/)+(?:connectors\/)?linear-env)(?:\.js)?["']/.test(file.text)).map((file) => file.name);
  assert.deepEqual(importers.sort(), ["lib/actions/runs.js", "lib/connector-status.js"]);
  for (const name of importers) assert.ok(!/^\s*["']use client["']/m.test(files.find((file) => file.name === name).text), `${name} must not be browser code`);
});

test("the Linear key is never NEXT_PUBLIC_, no real-looking key is written anywhere, and Linear's address is in one place", () => {
  assert.deepEqual(withText("NEXT_PUBLIC_" + "LINEAR"), []);
  const looksReal = new RegExp("lin_api_" + "[A-Za-z0-9]{30,}");
  assert.deepEqual(files.filter((file) => looksReal.test(file.text)).map((file) => file.name), []);
  const urls = files.filter((file) => /api\.linear\.app/.test(file.text)).map((file) => file.name).filter((name) => !name.endsWith(".test.js") && name !== "README.md");
  assert.deepEqual(urls.sort(), ["lib/connectors/linear-oauth.js", "lib/connectors/linear.js"], "Linear's addresses are written in these two files only");
});

test("approveLinearLookup asks who is calling first, reads the saved step, finds the person's permission, then asks Linear; Linear queries never change data", () => {
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  const body = action.slice(action.indexOf("export async function approveLinearLookup"));
  const order = ["requireUser(", "loadPracticeStep(", "linearAuthorization(", "fetchLinearIssues("].map((call) => body.indexOf(call));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  const linear = files.find((file) => file.name === "lib/connectors/linear.js").text;
  assert.ok(!/mutation/i.test(linear.replace(/\/\/.*$/gm, "")), "the Linear connector contains no mutation (a change request)");
});

// The Connect button's settings and its sign-in routes.
const APP_NAMES = ["LINEAR" + "_CLIENT_ID", "LINEAR" + "_CLIENT_SECRET", "CONNECTIONS" + "_KEY"];

test("the Connect settings' names appear in code only in lib/connectors/oauth-env.js (and docs, the example, the setup script, the Connections page and this test)", () => {
  const allowed = new Set(["lib/connectors/oauth-env.js", "lib/secrets.test.js", ".env.example", "README.md", "app/app/connections/page.js", "scripts/make-secret.mjs"]);
  for (const name of APP_NAMES) {
    assert.deepEqual(withText(name).filter((file) => !allowed.has(file)), [], name);
    assert.ok(withText(name).includes("lib/connectors/oauth-env.js"), `${name} is read in oauth-env.js`);
  }
});

test("oauth-env.js is server-only and imported only by server code, never by browser code", () => {
  const env = files.find((file) => file.name === "lib/connectors/oauth-env.js").text;
  assert.match(env, /^import "server-only";/m);
  const importers = files.filter((file) => /from\s+["'](?:@\/lib\/connectors\/oauth-env|(?:\.\.?\/)+(?:connectors\/)?oauth-env)(?:\.js)?["']/.test(file.text)).map((file) => file.name);
  assert.deepEqual(importers.sort(), ["app/api/connect/linear/callback/route.js", "app/api/connect/linear/route.js", "lib/actions/connections.js", "lib/actions/runs.js", "lib/connector-status.js"]);
  for (const name of importers) assert.ok(!/^\s*["']use client["']/m.test(files.find((file) => file.name === name).text), `${name} must not be browser code`);
});

test("Connect settings are never NEXT_PUBLIC_, and no real-looking secret is written in the project", () => {
  for (const name of APP_NAMES) assert.deepEqual(withText("NEXT_PUBLIC_" + name), [], name);
  // the setup script prints a line starting with the key's name, but never contains a value
  const script = files.find((file) => file.name === "scripts/make-secret.mjs").text;
  assert.ok(!/CONNECTIONS_KEY=[A-Za-z0-9+/]{20,}/.test(script));
});

test("the sign-in routes: signed-in people only, the state is checked before the code is used, and tokens are never put in an address", () => {
  const start = files.find((file) => file.name === "app/api/connect/linear/route.js").text;
  assert.ok(start.indexOf("requireUser(") > 0 && start.indexOf("requireUser(") < start.indexOf("authorizeUrl("));
  assert.match(start, /httpOnly: true/);
  const callback = files.find((file) => file.name === "app/api/connect/linear/callback/route.js").text;
  const order = ["requireUser(", "same(state, expected)", "exchangeCode(", "saveLinearConnection("].map((call) => callback.indexOf(call));
  assert.ok(order.every((index) => index > 0) && order.join() === [...order].sort((a, b) => a - b).join(), "requireUser, then the state check, then the code swap, then saving");
  assert.ok(!/redirect\([^)]*(?:token|secret)/i.test(callback), "no token or secret goes into a redirect address");
  const page = files.find((file) => file.name === "app/app/connections/page.js").text;
  assert.ok(/<a href="\/api\/connect\/linear"/.test(page) && !/<Link[^>]*api\/connect/.test(page), "the Connect button is a plain link (a pre-loaded link would start the sign-in by itself)");
});

test("approveAiStep: who is calling, then the saved step, then the secret check, then the AI; and the AI loop offers only tools with no input", () => {
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  const body = action.slice(action.indexOf("export async function approveAiStep"));
  const order = ["requireUser(", "getGroqKey(", "loadPracticeStep(", "looksSensitive(", "runAgent("].map((call) => body.indexOf(call));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.ok(!/runAgent\(\s*\{[^}]*input/.test(body), "the task always comes from the saved step");
  const agent = files.find((file) => file.name === "lib/ai/agent.js").text;
  assert.ok(agent.includes("properties: {}, additionalProperties: false"), "a tool takes no input from the model");
  assert.ok(!/api\.groq\.com/.test(agent), "the AI address comes from groq.js");
  assert.ok(!/key\.js|getGroqKey/.test(agent.replace(/\/\/.*$/gm, "")), "the agent is handed the key, it never reads it");
});
