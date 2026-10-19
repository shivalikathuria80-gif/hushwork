// A small MCP client. MCP (Model Context Protocol) is a standard way for an app or a company to offer "tools" to an AI: a
// server lists its tools, and a client (here Hushwork's "Ask the AI" step) asks the server to run one. This file speaks the
// "Streamable HTTP" version of the protocol (https://modelcontextprotocol.io/specification/2025-06-18/basic/transports):
// every message is one POST of a small JSON note (JSON-RPC) to the server's address, and the answer is JSON or a short
// event stream.
//
// Safety, all tested in mcp.test.js:
//   - the address is typed by a person, so every request goes through publicRequest (lib/connectors/http.js): https only,
//     public addresses only (checked at connection time), no redirects, size and time limits, no cookies or secrets sent.
//   - only READ-ONLY tools are offered to the AI: tools the server itself marks read-only (readOnlyHint), or, when it says
//     nothing, tools whose name is a plain reading word (get, list, read, search...) and that are not marked destructive.
//     Everything else (anything that could create, change or delete) is never offered and never called.
//   - at most 8 tools and one small input shape per tool are kept; what a tool answers is cut to 3000 characters before the
//     AI sees it, and is wrapped as data by the AI loop (lib/ai/agent.js).
//   - no login: a server that asks for one is refused with a plain sentence (Hushwork cannot send passwords or tokens here).
// `send` can be replaced so tests never touch the network.
import { publicRequest } from "./http.js";

const PROTOCOL = "2025-06-18";
const KNOWN_PROTOCOLS = new Set(["2025-06-18", "2025-03-26", "2024-11-05"]);
const MAX_TOOLS = 8;
const MAX_SCHEMA = 2500;
const MAX_ANSWER = 3000;
const READING_NAME = /^(?:get|list|read|search|find|fetch|query|lookup|ask|describe|show|view)(?:[_.-]|[A-Z]|$)/;

export const MCP_FAILED = {
  login: "That MCP server asks for a login, which Hushwork cannot give yet. Pick a server that needs none.",
  protocol: "That address did not answer like an MCP server.",
  noTools: "That MCP server has no read-only tools Hushwork may use.",
  toolFailed: "The MCP server could not run that tool.",
};

// The JSON note we send, and reading the answer (a JSON object, or events like "data: {...}" separated by blank lines).
function parseAnswer(answer, id) {
  const type = String(answer.headers["content-type"] ?? "");
  const text = answer.bytes.toString("utf8");
  let messages = [];
  try {
    if (type.includes("text/event-stream")) {
      for (const event of text.split(/\r?\n\r?\n/)) {
        const data = event.split(/\r?\n/).filter((line) => line.startsWith("data:")).map((line) => line.slice(5).replace(/^ /, "")).join("\n");
        if (data.trim()) messages.push(JSON.parse(data));
      }
    } else {
      const parsed = JSON.parse(text);
      messages = Array.isArray(parsed) ? parsed : [parsed];
    }
  } catch {
    return null;
  }
  return messages.find((message) => message && typeof message === "object" && message.id === id && ("result" in message || "error" in message)) ?? null;
}

async function rpc(url, session, message, { send, expectAnswer = true }) {
  const headers = {
    "content-type": "application/json",
    accept: "application/json, text/event-stream",
    ...(session.protocol ? { "mcp-protocol-version": session.protocol } : {}),
    ...(session.id ? { "mcp-session-id": session.id } : {}),
  };
  const answer = await send(url, { method: "POST", headers, body: JSON.stringify(message), maxBytes: 262144, timeoutMs: 15000 });
  if (!answer.ok) return { error: answer.error };
  if (answer.status === 401 || answer.status === 403) return { error: MCP_FAILED.login };
  if (!expectAnswer) return answer.status < 300 ? { ok: true, headers: answer.headers } : { error: MCP_FAILED.protocol };
  if (answer.status >= 300) return { error: MCP_FAILED.protocol };
  const reply = parseAnswer(answer, message.id);
  if (!reply || "error" in reply) return { error: MCP_FAILED.protocol };
  return { result: reply.result ?? {}, headers: answer.headers };
}

// Is the AI allowed to use this tool? (See the safety list at the top.)
export function isReadOnlyTool(tool) {
  if (!tool || typeof tool.name !== "string" || !/^[A-Za-z0-9_.-]{1,64}$/.test(tool.name)) return false;
  const hints = tool.annotations && typeof tool.annotations === "object" ? tool.annotations : {};
  if (hints.destructiveHint === true) return false;
  if (hints.readOnlyHint === true) return true;
  if (hints.readOnlyHint === false) return false;
  return READING_NAME.test(tool.name);
}

// The input shape the server declared for a tool, kept only if it is a plain object shape of a sensible size.
function inputShape(schema) {
  if (!schema || typeof schema !== "object" || schema.type !== "object") return { type: "object", properties: {} };
  const { $schema, ...rest } = schema;
  return JSON.stringify(rest).length <= MAX_SCHEMA ? rest : null;
}

const cut = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);

// Connects and lists the tools the AI may use. Returns { ok: true, tools: [{ name, description, parameters }], call } or
// { ok: false, error }. call(name, args) runs one of THOSE tools and returns text (never throws).
export async function openMcp(url, { send = publicRequest } = {}) {
  const session = { id: "", protocol: "" };
  const init = await rpc(url, session, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: PROTOCOL, capabilities: {}, clientInfo: { name: "hushwork", version: "1.0.0" } } }, { send });
  if (init.error) return { ok: false, error: init.error };
  const wanted = init.result?.protocolVersion;
  session.protocol = KNOWN_PROTOCOLS.has(wanted) ? wanted : PROTOCOL;
  const sessionId = init.headers["mcp-session-id"];
  session.id = typeof sessionId === "string" && /^[\x21-\x7e]{1,200}$/.test(sessionId) ? sessionId : "";

  const ready = await rpc(url, session, { jsonrpc: "2.0", method: "notifications/initialized" }, { send, expectAnswer: false });
  if (ready.error) return { ok: false, error: ready.error };

  const listed = await rpc(url, session, { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }, { send });
  if (listed.error) return { ok: false, error: listed.error };
  const all = Array.isArray(listed.result?.tools) ? listed.result.tools : [];
  const tools = [];
  for (const tool of all) {
    if (tools.length >= MAX_TOOLS) break;
    if (!isReadOnlyTool(tool)) continue;
    const parameters = inputShape(tool.inputSchema);
    if (parameters) tools.push({ name: tool.name, description: cut(tool.description, 300) || tool.name, parameters });
  }
  if (tools.length === 0) return { ok: false, error: MCP_FAILED.noTools };

  const allowed = new Set(tools.map((tool) => tool.name));
  let nextId = 10;
  async function call(name, args) {
    if (!allowed.has(name)) return "That tool is not available.";
    const done = await rpc(url, session, { jsonrpc: "2.0", id: (nextId += 1), method: "tools/call", params: { name, arguments: args && typeof args === "object" && !Array.isArray(args) ? args : {} } }, { send });
    if (done.error) return done.error === MCP_FAILED.protocol ? MCP_FAILED.toolFailed : done.error;
    const parts = Array.isArray(done.result?.content) ? done.result.content : [];
    const text = parts.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n").slice(0, MAX_ANSWER);
    return done.result?.isError ? `The tool reported an error. ${cut(text, 300)}` : text || "(the tool returned no text)";
  }
  return { ok: true, tools, call };
}
