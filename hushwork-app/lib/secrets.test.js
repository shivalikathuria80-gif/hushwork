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
  assert.deepEqual(importers.sort(), ["lib/actions/runs.js", "lib/connectors/mcp.js"]); // the Server Action, and the MCP client (which sends through the same guarded request)
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
  assert.deepEqual(urls.sort(), ["lib/connectors/app-list.js", "lib/connectors/linear-create.js", "lib/connectors/linear.js"], "Linear's addresses are written in these three files only");
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
const APP_NAMES = ["LINEAR" + "_CLIENT_ID", "LINEAR" + "_CLIENT_SECRET", "GOOGLE" + "_CLIENT_ID", "GOOGLE" + "_CLIENT_SECRET", "CONNECTIONS" + "_KEY"];

test("the Connect settings' names appear in no code except one setup sentence on the Connections page (and docs, the example, the setup script and this test); oauth-env.js builds them from each app's prefix and is the only file that reads them", () => {
  const allowed = new Set(["lib/connectors/oauth-env.js", "lib/secrets.test.js", ".env.example", "README.md", "scripts/make-secret.mjs", "app/app/connections/page.js"]);
  for (const name of APP_NAMES) assert.deepEqual(withText(name).filter((file) => !allowed.has(file)), [], name);
  const env = files.find((file) => file.name === "lib/connectors/oauth-env.js").text;
  assert.ok(env.includes("`${entry.envPrefix}_CLIENT_ID`") && env.includes("`${entry.envPrefix}_CLIENT_SECRET`") && env.includes('read("CONNECTIONS_KEY")'));
  const readers = files.filter((file) => /process\.env\[/.test(file.text) && !file.name.endsWith(".test.js")).map((file) => file.name);
  assert.deepEqual(readers, ["lib/connectors/oauth-env.js"], "the only code that reads a setting by a built-up name");
});

test("oauth-env.js is server-only and imported only by server code, never by browser code", () => {
  const env = files.find((file) => file.name === "lib/connectors/oauth-env.js").text;
  assert.match(env, /^import "server-only";/m);
  const importers = files.filter((file) => /from\s+["'](?:@\/lib\/connectors\/oauth-env|(?:\.\.?\/)+(?:connectors\/)?oauth-env)(?:\.js)?["']/.test(file.text)).map((file) => file.name);
  assert.deepEqual(importers.sort(), ["lib/actions/connections.js", "lib/actions/runs.js", "lib/connections/oauth-flow.js", "lib/connector-status.js"]);
  for (const name of importers) assert.ok(!/^\s*["']use client["']/m.test(files.find((file) => file.name === name).text), `${name} must not be browser code`);
});

test("Connect settings are never NEXT_PUBLIC_, and no real-looking secret is written in the project", () => {
  for (const name of APP_NAMES) assert.deepEqual(withText("NEXT_PUBLIC_" + name), [], name);
  // the setup script prints a line starting with the key's name, but never contains a value
  const script = files.find((file) => file.name === "scripts/make-secret.mjs").text;
  assert.ok(!/CONNECTIONS_KEY=[A-Za-z0-9+/]{20,}/.test(script));
});

test("the sign-in flow: signed-in people only, the state is checked before the code is used, tokens are never put in an address, and every app route is a thin wrapper", () => {
  const flow = files.find((file) => file.name === "lib/connections/oauth-flow.js").text;
  assert.match(flow, /^import "server-only";/m);
  const start = flow.slice(flow.indexOf("export async function startConnect"), flow.indexOf("export async function finishConnect"));
  assert.ok(start.indexOf("requireUser(") > 0 && start.indexOf("requireUser(") < start.indexOf("authorizeUrl("));
  assert.match(start, /httpOnly: true/);
  const finish = flow.slice(flow.indexOf("export async function finishConnect"));
  const order = ["requireUser(", "same(state, expected)", "exchangeCode(", "saveConnection("].map((call) => finish.indexOf(call));
  assert.ok(order.every((index) => index > 0) && order.join() === [...order].sort((a, b) => a - b).join(), "requireUser, then the state check, then the code swap, then saving");
  assert.ok(!/redirect\([^)]*(?:token|secret)/i.test(flow), "no token or secret goes into a redirect address");
  for (const [file, call] of [["app/api/connect/[provider]/route.js", "startConnect"], ["app/api/connect/[provider]/callback/route.js", "finishConnect"]]) {
    const text = files.find((entry) => entry.name === file).text;
    assert.ok(text.includes(`${call}((await params).provider, request)`), `${file} calls ${call} with the address's app id`);
    assert.ok(text.split("\n").filter((line) => line.trim() && !line.trim().startsWith("//")).length <= 3, `${file} stays a thin wrapper`);
  }
  assert.ok(flow.indexOf("findApp(provider)") > 0 && flow.indexOf("notFound()") > 0, "an app id that is not in the list is a 404");
  assert.ok(start.indexOf("findApp(provider)") < start.indexOf("requireUser(") && finish.indexOf("findApp(provider)") < finish.indexOf("requireUser("), "the id is checked against the list first");
  const page = files.find((file) => file.name === "app/app/connections/page.js").text;
  assert.ok(/<a href=\{`\/api\/connect\/\$\{app\}`\}/.test(page) && !/<Link[^>]*api\/connect/.test(page), "the Connect button is a plain link (a pre-loaded link would start the sign-in by itself)");
});

test("Google: exactly four permissions are asked for, each address is in one file, the calendar, sheets and gmail connectors can only do their one thing, and approvals ask who is calling first", () => {
  const oauth = files.find((file) => file.name === "lib/connectors/app-list.js").text;
  const scopes = oauth.match(/https:\/\/www\.googleapis\.com\/auth\/[a-z.]+/g) ?? [];
  assert.deepEqual([...new Set(scopes)].sort(), ["https://www.googleapis.com/auth/calendar.readonly", "https://www.googleapis.com/auth/drive.metadata.readonly", "https://www.googleapis.com/auth/gmail.readonly", "https://www.googleapis.com/auth/spreadsheets"]);
  const only = (pattern) => files.filter((file) => pattern.test(file.text)).map((file) => file.name).filter((name) => !name.endsWith(".test.js") && name !== "README.md");
  assert.deepEqual(only(/googleapis\.com\/calendar/), ["lib/connectors/google-calendar.js"]);
  assert.deepEqual(only(/sheets\.googleapis\.com/), ["lib/connectors/google-sheets.js"]);
  assert.deepEqual(only(/gmail\.googleapis\.com/), ["lib/connectors/google-gmail.js"]);
  assert.deepEqual(only(/googleapis\.com\/drive\/v3/), ["lib/connectors/google-drive.js"]);
  const drive = files.find((file) => file.name === "lib/connectors/google-drive.js").text.replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/method:\s*["'](?:POST|PUT|PATCH|DELETE)/.test(drive) && !/alt=media|\/export|\/copy|\/permissions/.test(drive), "the drive connector only sends GET and never asks for a file's contents");
  assert.ok(drive.includes('"files(name,mimeType,modifiedTime)"'), "only name, kind and time are asked for");
  const gmail = files.find((file) => file.name === "lib/connectors/google-gmail.js").text.replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/method:\s*["'](?:POST|PUT|PATCH|DELETE)/.test(gmail) && !/\/(?:send|modify|trash|delete|drafts|batch)/i.test(gmail), "the gmail connector only sends GET and never names a send, change or delete address");
  assert.ok(gmail.includes('"metadata"') && !gmail.includes('"full"') && !gmail.includes("format=raw"), "only the headers are asked for, never the body of an email");
  const calendar = files.find((file) => file.name === "lib/connectors/google-calendar.js").text.replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/method:\s*["'](?:POST|PUT|PATCH|DELETE)/.test(calendar), "the calendar connector only sends GET");
  const sheets = files.find((file) => file.name === "lib/connectors/google-sheets.js").text.replace(/^\s*\/\/.*$/gm, "");
  assert.deepEqual(sheets.match(/method:\s*["'][A-Z]+["']/g), ['method: "POST"'], "the sheets connector sends exactly one kind of request: an append");
  assert.ok(sheets.includes("values/A1:append") && sheets.includes('"RAW"') && !sheets.includes("USER_ENTERED"), "append only, as plain text (never formulas)");
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  for (const [fn, steps] of [["approveCalendarLookup", ["requireUser(", "loadPracticeStep(", "googleAuthorization(", "fetchUpcomingEvents("]], ["approveGmailLookup", ["requireUser(", "loadPracticeStep(", "googleAuthorization(", "limitError(", "fetchInbox("]], ["approveDriveLookup", ["requireUser(", "loadPracticeStep(", "googleAuthorization(", "limitError(", "fetchRecentFiles("]], ["approveSheetsRow", ["requireUser(", "loadPracticeStep(", "parseSheetUrl(", "findAnswer(", "googleAuthorization(", "appendRow("]]]) {
    const body = action.slice(action.indexOf(`export async function ${fn}`));
    const order = steps.map((call) => body.indexOf(call));
    assert.ok(order.every((index) => index > 0), fn);
    assert.deepEqual(order, [...order].sort((a, b) => a - b), fn);
  }
  assert.ok(!/appendRow\(\{[^}]*input/.test(action), "the sheet and the boxes always come from the saved run");
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

test("deleteRun asks who is calling first, checks the id, and only ever deletes the caller's own run", () => {
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  const body = action.slice(action.indexOf("export async function deleteRun"));
  const order = ["requireUser(", "checkId(", '.from("runs").delete()', '.eq("user_id", user.id)'].map((call) => body.indexOf(call));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test("MCP: the client only POSTs through the guarded request, only read-only tools are ever offered or called, and the Server Action checks the address first", () => {
  const mcp = files.find((file) => file.name === "lib/connectors/mcp.js").text.replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/node:https|\bfetch\(/.test(mcp), "no raw network access: everything goes through publicRequest");
  assert.ok(mcp.includes("isReadOnlyTool(tool)") && mcp.includes("allowed.has(name)"), "offered and called tools are filtered");
  assert.ok(mcp.includes("destructiveHint === true"), "a destructive tool is never read-only");
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  const body = action.slice(action.indexOf('} else if (uses === "mcp")'), action.indexOf('} else if (uses === "web")'));
  assert.ok(body.indexOf("checkRequestUrl(") > 0 && body.indexOf("checkRequestUrl(") < body.indexOf("openMcp("));
  assert.ok(!/openMcp\([^)]*input/.test(action), "the server address always comes from the saved step");
});

test("audit fixes stay fixed: the owner's personal Linear key never works in production, limits come before outside requests, saved steps are re-checked, the one-try cookie is cleared with its path", () => {
  const runs = files.find((file) => file.name === "lib/actions/runs.js").text;
  assert.match(runs, /process\.env\.NODE_ENV === "production" \? null : getLinearKey\(\)/, "the personal key is dev-only");
  const status = files.find((file) => file.name === "lib/connector-status.js").text;
  assert.match(status, /NODE_ENV !== "production" && Boolean\(getLinearKey\(\)\)/);
  const ai = runs.slice(runs.indexOf("export async function approveAiStep"), runs.indexOf("export async function deleteRun"));
  assert.ok(ai.indexOf("limitError(aiLimits()") > 0 && ai.indexOf("limitError(aiLimits()") < ai.indexOf("openMcp("), "the AI-step limit is counted before an MCP server is contacted");
  assert.ok(ai.indexOf("limitError(aiLimits()") < ai.indexOf("fetchPublic("), "...and before a web page is fetched");
  const loader = runs.slice(runs.indexOf("async function loadPracticeStep"), runs.indexOf("// Checks the person's limits"));
  assert.ok(loader.includes("checkSteps(["), "a saved step is validated again before it is acted on");
  const flow = files.find((file) => file.name === "lib/connections/oauth-flow.js").text;
  assert.ok(flow.includes("jar.delete({ name: cookieName(provider), path:"), "the state cookie is deleted with the path it was set with");
});

test("repository hygiene: .env.local is git-ignored, no Google client secret is written anywhere, and browser components never import the token code", () => {
  const ignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
  assert.match(ignore, /^\.env\*$/m); // covers .env.local (the .env.example is let through on the next line)
  assert.match(ignore, /^!\.env\.example$/m);
  const googleSecret = new RegExp("GOC" + "SPX-[A-Za-z0-9_-]{20,}");
  assert.deepEqual(files.filter((file) => googleSecret.test(file.text)).map((file) => file.name), []);
  const serverOnly = ["lib/connections/store.js", "lib/connections/crypto.js", "lib/connections/oauth-flow.js", "lib/connectors/oauth-env.js", "lib/connectors/linear-env.js", "lib/ai/key.js"];
  for (const file of files.filter((entry) => /^\s*["']use client["']/m.test(entry.text))) {
    for (const name of serverOnly) {
      const stem = name.replace(/\.js$/, "");
      assert.ok(!new RegExp(`from\\s+["'][^"']*${stem.split("/").slice(-2).join("/")}(?:\\.js)?["']`).test(file.text), `${file.name} (browser code) must not import ${name}`);
    }
  }
});

test("the {answer} lookup only reads the signed-in person's own real runs of the same workflow", () => {
  const text = files.find((file) => file.name === "lib/run-answer.js").text;
  assert.ok(text.includes('.eq("user_id", userId)') && text.includes('.eq("workflow_id", run.workflow_id)') && text.includes('.eq("mode", "live")'));
  assert.ok(!/\.(?:insert|update|delete|upsert)\(/.test(text), "it only reads");
});

test("Linear task creating: the only write is one fixed issueCreate request in its own file, the text travels as variables, and approving asks who is calling first and refuses a second copy", () => {
  const create = files.find((file) => file.name === "lib/connectors/linear-create.js").text.replace(/^\s*\/\/.*$/gm, "");
  assert.deepEqual(create.match(/mutation\s+\w+/g), ["mutation CreateTask"], "exactly one mutation");
  assert.deepEqual([...new Set(create.match(/(?:issue|comment|project|team|user|label|cycle)\w*(?:Create|Update|Delete|Archive)\w*|\w+(?:Update|Delete|Archive)/g) ?? [])].filter((name) => name !== "issueCreate"), [], "no other kind of change");
  assert.ok(create.includes("variables: { input }") && !/\$\{[^}]*title|\+\s*title/.test(create), "what is written is sent as variables, never glued into the request text");
  const only = files.filter((file) => /mutation\s+\w+\s*\(/.test(file.text)).map((file) => file.name).filter((name) => !name.endsWith(".test.js"));
  assert.deepEqual(only, ["lib/connectors/linear-create.js"], "no other file sends a change to Linear");
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  const body = action.slice(action.indexOf("export async function approveLinearCreate"));
  const order = ["requireUser(", "loadPracticeStep(", "wasApproved(", "fillAnswerText(", "looksSensitive(", "linearAuthorization(", "limitError(", "createIssue("].map((call) => body.indexOf(call));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
});

test("Composio: the key is read only in composio-env.js (server-only, never NEXT_PUBLIC_), the tool that runs always comes from the list with no arguments, and approving asks who is calling first", () => {
  const KEY_NAME = "COMPOSIO" + "_API_KEY";
  // runs.js and composio.js only NAME the setting inside a sentence shown to the owner; only composio-env.js reads it
  const allowed = new Set(["lib/connectors/composio-env.js", "lib/secrets.test.js", ".env.example", "README.md", "app/app/connections/page.js", "lib/actions/runs.js", "lib/connectors/composio.js"]);
  assert.ok(!/process\.env/.test(files.find((file) => file.name === "lib/connectors/composio.js").text) && files.find((file) => file.name === "lib/connectors/composio-env.js").text.includes("process.env"), "only the env file reads settings");
  assert.deepEqual(withText(KEY_NAME).filter((file) => !allowed.has(file)), []);
  assert.deepEqual(withText("NEXT_PUBLIC_" + KEY_NAME), []);
  const env = files.find((file) => file.name === "lib/connectors/composio-env.js").text;
  assert.match(env, /^import "server-only";/m);
  const importers = files.filter((file) => /from\s+["']@\/lib\/connectors\/composio-env["']/.test(file.text)).map((file) => file.name);
  assert.deepEqual(importers.sort(), ["app/app/connections/page.js", "lib/actions/composio.js", "lib/actions/runs.js", "lib/connections/composio-flow.js"]);
  for (const name of importers) assert.ok(!/^\s*["']use client["']/m.test(files.find((file) => file.name === name).text), `${name} must not be browser code`);
  const client = files.find((file) => file.name === "lib/connectors/composio.js").text.replace(/^\s*\/\/.*$/gm, "");
  assert.deepEqual(client.match(/\/tools\/execute\/[^`"']*/g), ["/tools/execute/${app.tool}"], "the one tool that runs is the one in the list");
  assert.ok(client.includes("arguments: {}"), "always called with nothing to fill in");
  assert.ok(client.includes("restrict_to_following_tools: [app.tool]"), "the sign-in is limited to that one tool at Composio too");
  assert.deepEqual(files.filter((file) => /backend\.composio\.dev/.test(file.text)).map((file) => file.name).filter((name) => !name.endsWith(".test.js") && name !== "README.md"), ["lib/connectors/composio.js"]);
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  const body = action.slice(action.indexOf("export async function approveAppLookup"));
  const order = ["requireUser(", "loadPracticeStep(", "findComposioApp(", "getComposioKey(", "limitError(", "runReadTool("].map((call) => body.indexOf(call));
  assert.ok(order.every((index) => index > 0));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  const flow = files.find((file) => file.name === "lib/connections/composio-flow.js").text;
  assert.ok(flow.indexOf("findComposioApp(appId)") < flow.indexOf("requireUser("), "an unknown app is a 404 before anything else");
  const page = files.find((file) => file.name === "app/app/connections/page.js").text;
  assert.ok(/<a href=\{`\/api\/composio\/\$\{app\.id\}`\}/.test(page), "the Connect button is a plain link (a pre-loaded link would start the sign-in by itself)");
});

test("when a built-in tool of an Ask the AI step fails, the person is told the real reason (not the AI's vague paraphrase) and nothing is saved as a success", () => {
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  const body = action.slice(action.indexOf("export async function approveAiStep"), action.indexOf('// The "Approve and look at my calendar" button'));
  assert.ok(body.includes("failed(answer.error)") && !/return answer\.error;/.test(body.replace(/\/\/.*$/gm, "")), "every tool failure is recorded");
  assert.ok(body.indexOf("if (toolError) return { error: toolError };") > body.indexOf("await runAgent(") && body.indexOf("if (toolError) return { error: toolError };") < body.indexOf("saveLiveRun("));
});

test("every lookup result is the AI's summary followed by the app's own list; the AI is skipped (not an error) when it is off or limited, and the list is always kept", () => {
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  const helper = action.slice(action.indexOf("async function withSummary"), action.indexOf("// One line per event") > 0 ? action.indexOf("// The \"Approve and ask Linear\"") : undefined);
  assert.ok(helper.includes("return plain") && helper.includes("exactly as it answered"), "the list is always part of the result");
  assert.ok(helper.indexOf("getGroqKey()") < helper.indexOf("summarizeData("), "the key is checked first");
  assert.ok(helper.indexOf("aiLimits().minute.left") < helper.indexOf("summarizeData("), "the person's AI limit is checked before anything is sent");
  for (const fn of ["approveLinearLookup", "approveCalendarLookup", "approveGmailLookup", "approveDriveLookup", "approveAppLookup"]) {
    const body = action.slice(action.indexOf(`export async function ${fn}`));
    assert.ok(body.slice(0, body.indexOf("\n}\n")).includes("withSummary("), `${fn} uses the summary`);
  }
  const agent = files.find((file) => file.name === "lib/ai/agent.js").text;
  const summarize = agent.slice(agent.indexOf("export async function summarizeData"));
  assert.ok(!/tools|tool_choice/.test(summarize), "the summariser has no tools");
});

test("Auto mode: only an explicit true turns it on; it uses the very same Approve actions (so every check and limit applies), goes in order, stops at the first failure and is capped", () => {
  const action = files.find((file) => file.name === "lib/actions/runs.js").text;
  const start = action.slice(action.indexOf("export async function startPracticeRun"), action.indexOf("// Real actions are rare and deliberate"));
  assert.ok(start.includes("input?.auto === true"), "only a real true");
  assert.ok(start.indexOf('from("runs")') < start.indexOf("runAutomatically("), "the practice run is saved before anything real happens");
  const loop = action.slice(action.indexOf("async function runAutomatically"), action.indexOf("export async function startPracticeRun"));
  assert.ok(loop.includes("Math.min(results.length, 20)") && loop.includes("if (outcome?.error) return"), "capped, and stops at the first failure");
  assert.ok(loop.includes("await action("), "one step at a time, in order");
  const table = action.slice(action.indexOf("const AUTO_ACTIONS"), action.indexOf("async function runAutomatically"));
  for (const name of ["approveAiStep", "approveLinearLookup", "approveCalendarLookup", "approveGmailLookup", "approveDriveLookup", "approveLinearCreate", "approveAppLookup", "approveSheetsRow", "approveWebCall"]) assert.ok(table.includes(`${name}(input)`), `${name} is run through its normal Approve action`);
  assert.ok(!/fetchLinearIssues|createIssue|appendRow|fetchInbox|runReadTool|fetchPublic/.test(table + loop), "Auto mode never reaches a connector without going through an Approve action");
  const mode = files.find((file) => file.name === "components/app/RunMode.js").text;
  assert.match(mode, /localStorage\.getItem\(KEY\) === "auto" \? "auto" : "manual"/, "Manual is the default and anything unexpected means Manual");
});

test("every jsonb containment lookup on saved runs is handed JSON TEXT, never a JavaScript array (the database client would turn an array into a Postgres list that matches nothing)", () => {
  for (const name of ["lib/run-answer.js", "components/app/RunsViewer.js"]) {
    const text = files.find((file) => file.name === name).text;
    const calls = text.match(/\.contains\([^)]*\)/g) ?? [];
    assert.ok(calls.length > 0, name);
    for (const call of calls) assert.ok(/\.contains\("results", JSON\.stringify\(/.test(call), `${name}: ${call}`);
  }
});
