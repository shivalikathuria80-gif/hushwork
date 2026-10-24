// Helpers for tests that RUN the real server code (lib/run-core.js and friends) instead of only reading its text: a small in-memory database
// that answers the few queries the code makes, and a pretend Composio. Needs `--import ./scripts/test-hooks.mjs` (npm test does that).
import { randomUUID } from "node:crypto";

// ---- a pretend Supabase -------------------------------------------------------------------------------------------------------------------------
// Supports exactly what the app uses: from(table).select/insert/delete/eq/gte/contains/order/limit, rpc(), and auth.admin.getUserById.
// `asUser` is who rows belong to when a signed-in person inserts (the real database fills user_id in from the session).
export function makeFakeSupabase({ asUser = null, workflows = [], emails = {}, rpc = () => ({ data: "ok", error: null }), admin = false } = {}) {
  const tables = { workflows: workflows.map((row) => ({ ...row })), runs: [] };
  let tick = Date.parse("2026-10-24T08:00:00Z");
  const subset = (needle, row) => Object.entries(needle).every(([key, value]) => row?.[key] === value);

  class Query {
    constructor(name) { this.name = name; this.filters = []; this.mode = "select"; this.rows = []; this.max = Infinity; this.sort = null; this.wantsRows = false; }
    select() { this.wantsRows = true; return this; }
    insert(values) { this.mode = "insert"; this.values = values; return this; }
    delete() { this.mode = "delete"; return this; }
    eq(column, value) { this.filters.push((row) => row[column] === value); return this; }
    gte(column, value) { this.filters.push((row) => String(row[column]) >= String(value)); return this; }
    contains(column, json) {
      const needle = JSON.parse(json); // the app passes JSON text on purpose
      this.filters.push((row) => Array.isArray(row[column]) && needle.every((one) => row[column].some((have) => subset(one, have))));
      return this;
    }
    order(column, { ascending = true } = {}) { this.sort = { column, ascending }; return this; }
    limit(count) { this.max = count; return this; }
    then(resolve, reject) {
      try { resolve(this.run()); } catch (error) { if (reject) reject(error); else throw error; }
    }
    run() {
      const table = tables[this.name];
      if (!table) return { data: null, error: { code: "42P01" } };
      if (this.mode === "insert") {
        tick += 1000;
        const row = { id: randomUUID(), created_at: new Date(tick).toISOString(), ...(asUser && !admin ? { user_id: asUser } : {}), ...this.values };
        table.push(row);
        return this.wantsRows ? { data: [{ ...row }], error: null } : { error: null };
      }
      let found = table.filter((row) => this.filters.every((test) => test(row)));
      if (this.mode === "delete") { for (const row of found) table.splice(table.indexOf(row), 1); return { error: null }; }
      if (this.sort) found = [...found].sort((a, b) => String(a[this.sort.column]).localeCompare(String(b[this.sort.column])) * (this.sort.ascending ? 1 : -1));
      return { data: found.slice(0, this.max).map((row) => ({ ...row })), error: null };
    }
  }

  const client = {
    tables,
    from: (name) => new Query(name),
    rpc: async (fn, args) => rpc(fn, args),
    auth: { admin: { getUserById: async (id) => ({ data: { user: emails[id] ? { id, email: emails[id] } : null }, error: null }) } },
  };
  if (admin) client.__hushworkAdmin = true;
  return client;
}

// ---- a pretend Composio -------------------------------------------------------------------------------------------------------------------------
// Replaces the global fetch for the length of a test. `tools` maps a tool name to { inputs, answer } where `inputs` is the tool's input list and
// `answer` is what running it says ({ successful, data, error }) or a number for an HTTP status. `groq` is the list of texts the AI answers with.
// Every call is remembered in `calls`.
export function fakeComposio(tools = {}, { groq = [] } = {}) {
  const calls = [];
  const original = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const u = new URL(String(url));
    const path = u.pathname.replace("/api/v3.1", "");
    // The AI (Groq): answers with the next prepared text, one per call (the last one repeats).
    if (u.hostname.includes("groq")) {
      calls.push({ method: init.method ?? "GET", path: "groq", body: init.body ? JSON.parse(init.body) : undefined });
      const text = groq[Math.min(calls.filter((call) => call.path === "groq").length - 1, groq.length - 1)] ?? "A short answer.";
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: "assistant", content: text } }] }), text: async () => "" };
    }
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ method: init.method ?? "GET", path, body });
    const reply = (status, json) => ({ ok: status >= 200 && status < 300, status, json: async () => json, text: async () => JSON.stringify(json) });
    const described = path.match(/^\/tools\/([A-Z0-9_]+)$/);
    if (described && (init.method ?? "GET") === "GET") return tools[described[1]] ? reply(200, { input_parameters: tools[described[1]].inputs }) : reply(404, { error: "no such tool" });
    const executed = path.match(/^\/tools\/execute\/([A-Z0-9_]+)$/);
    if (executed) {
      const answer = tools[executed[1]]?.answer;
      if (typeof answer === "number") return reply(answer, { error: { message: "refused" } });
      return reply(200, answer ?? { successful: true, data: {} });
    }
    return reply(404, {});
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

export const GMAIL_TOOL = { inputs: { recipient_email: { required: true }, subject: {}, body: { required: true } } };
export const NOTION_TOOL = { inputs: { parent_id: { required: true }, title: { required: true } } };
