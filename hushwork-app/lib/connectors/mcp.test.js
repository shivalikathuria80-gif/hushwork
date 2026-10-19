import test from "node:test";
import assert from "node:assert/strict";
import { isReadOnlyTool, openMcp, MCP_FAILED } from "./mcp.js";

// A pretend MCP server. `behave(message, headers)` returns { status, type, body, headers } for each note it is sent.
function pretend(behave) {
  const log = [];
  const send = async (url, init) => {
    const message = JSON.parse(init.body);
    log.push({ url, headers: init.headers, message });
    const r = behave(message, init.headers) ?? {};
    const type = r.type ?? "application/json";
    const body = r.body === undefined ? "" : typeof r.body === "string" ? r.body : JSON.stringify(r.body);
    return { ok: true, status: r.status ?? 200, headers: { "content-type": type, ...(r.headers ?? {}) }, bytes: Buffer.from(body) };
  };
  return { send, log };
}
const rpcResult = (message, result) => ({ body: { jsonrpc: "2.0", id: message.id, result } });
const TOOLS = [
  { name: "read_wiki", description: "Read a wiki page", annotations: { readOnlyHint: true }, inputSchema: { type: "object", properties: { repo: { type: "string" } }, required: ["repo"], $schema: "x" } },
  { name: "delete_page", description: "Delete a page", annotations: { destructiveHint: true }, inputSchema: { type: "object", properties: {} } },
  { name: "create_issue", description: "Create an issue", inputSchema: { type: "object", properties: {} } },
  { name: "search_docs", description: "  Search\nthe docs  ", inputSchema: { type: "object", properties: { q: { type: "string" } } } },
  { name: "get_secret", description: "Get a secret", annotations: { readOnlyHint: false }, inputSchema: { type: "object", properties: {} } },
  { name: "huge", description: "Huge schema", annotations: { readOnlyHint: true }, inputSchema: { type: "object", properties: { a: { type: "string", description: "x".repeat(3000) } } } },
  { name: "bad name!", annotations: { readOnlyHint: true } },
];
function server() {
  return pretend((message) => {
    if (message.method === "initialize") return { ...rpcResult(message, { protocolVersion: "2025-03-26", capabilities: {}, serverInfo: { name: "fake" } }), headers: { "mcp-session-id": "sess-123" } };
    if (message.method === "notifications/initialized") return { status: 202 };
    if (message.method === "tools/list") return rpcResult(message, { tools: TOOLS });
    if (message.method === "tools/call") return rpcResult(message, { content: [{ type: "text", text: `ran ${message.params.name} with ${JSON.stringify(message.params.arguments)}` }, { type: "image", data: "xx" }] });
    return { status: 400 };
  });
}

test("which tools count as read-only: the server's own hint first, then plain reading words, never anything destructive", () => {
  const yes = [{ name: "read_wiki", annotations: { readOnlyHint: true } }, { name: "search_docs" }, { name: "get_page" }, { name: "listFiles" }, { name: "ask_question" }, { name: "x", annotations: { readOnlyHint: true } }];
  const no = [{ name: "delete_page" }, { name: "create_issue" }, { name: "update" }, { name: "send_email" }, { name: "get_secret", annotations: { readOnlyHint: false } }, { name: "read_all", annotations: { destructiveHint: true } },
    { name: "getaway" }, { name: "bad name!", annotations: { readOnlyHint: true } }, { name: "" }, { name: 5 }, null, undefined, "str", {}];
  for (const tool of yes) assert.equal(isReadOnlyTool(tool), true, JSON.stringify(tool));
  for (const tool of no) assert.equal(isReadOnlyTool(tool), false, JSON.stringify(tool));
});

test("connecting follows the protocol: initialize, then the 'initialized' note, then the tool list, with the session and version headers", async () => {
  const s = server();
  const mcp = await openMcp("https://mcp.example.com/mcp", { send: s.send });
  assert.equal(mcp.ok, true);
  assert.deepEqual(s.log.map((entry) => entry.message.method), ["initialize", "notifications/initialized", "tools/list"]);
  assert.match(s.log[0].headers.accept, /application\/json/);
  assert.match(s.log[0].headers.accept, /text\/event-stream/);
  assert.equal(s.log[0].headers["mcp-session-id"], undefined, "no session yet on the first note");
  assert.equal(s.log[1].headers["mcp-session-id"], "sess-123");
  assert.equal(s.log[2].headers["mcp-protocol-version"], "2025-03-26", "the version the server chose");
  assert.equal(s.log.every((entry) => entry.url === "https://mcp.example.com/mcp"), true);
});

test("only read-only tools are offered, their shapes are kept (cleaned), and a huge or badly named tool is dropped", async () => {
  const mcp = await openMcp("https://mcp.example.com/mcp", { send: server().send });
  assert.deepEqual(mcp.tools.map((tool) => tool.name), ["read_wiki", "search_docs"]);
  assert.deepEqual(mcp.tools[0].parameters, { type: "object", properties: { repo: { type: "string" } }, required: ["repo"] }, "$schema is removed");
  assert.equal(mcp.tools[1].description, "Search the docs");
});

test("calling a tool sends its name and input, returns only the text parts, and refuses any tool that was not offered", async () => {
  const s = server();
  const mcp = await openMcp("https://mcp.example.com/mcp", { send: s.send });
  assert.equal(await mcp.call("read_wiki", { repo: "a/b" }), 'ran read_wiki with {"repo":"a/b"}');
  assert.equal(await mcp.call("read_wiki", "not an object"), "ran read_wiki with {}");
  for (const name of ["delete_page", "create_issue", "__proto__", "get_secret", 5, undefined]) {
    assert.equal(await mcp.call(name, {}), "That tool is not available.", String(name));
  }
  assert.ok(!s.log.some((entry) => entry.message.params?.name === "delete_page"), "a forbidden tool never reaches the server");
});

test("answers that arrive as an event stream work, and very long answers are cut", async () => {
  const s = pretend((message) => {
    if (message.method === "initialize") return { type: "text/event-stream", body: `event: message\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } })}\n\n` };
    if (message.method === "notifications/initialized") return { status: 202 };
    if (message.method === "tools/list") return { type: "text/event-stream", body: `data: ${JSON.stringify({ jsonrpc: "2.0", method: "notifications/message", params: {} })}\n\ndata: ${JSON.stringify({ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "get_page", inputSchema: { type: "object", properties: {} } }] } })}\n\n` };
    return rpcResult(message, { content: [{ type: "text", text: "z".repeat(10000) }] });
  });
  const mcp = await openMcp("https://mcp.example.com/mcp", { send: s.send });
  assert.deepEqual(mcp.tools.map((tool) => tool.name), ["get_page"]);
  assert.equal((await mcp.call("get_page", {})).length, 3000);
});

test("a tool that reports an error, or a server error, becomes a plain sentence", async () => {
  const failing = pretend((message) => {
    if (message.method === "initialize") return rpcResult(message, {});
    if (message.method === "notifications/initialized") return { status: 202 };
    if (message.method === "tools/list") return rpcResult(message, { tools: [{ name: "get_page", inputSchema: { type: "object", properties: {} } }] });
    if (message.params.arguments.mode === "rpc") return { body: { jsonrpc: "2.0", id: message.id, error: { code: -32000, message: "secret internal detail" } } };
    return rpcResult(message, { isError: true, content: [{ type: "text", text: "page not found" }] });
  });
  const mcp = await openMcp("https://mcp.example.com/mcp", { send: failing.send });
  assert.equal(await mcp.call("get_page", {}), "The tool reported an error. page not found");
  assert.equal(await mcp.call("get_page", { mode: "rpc" }), MCP_FAILED.toolFailed);
});

test("refusals: a login wall, a server that is not MCP, no usable tools, and network problems are all fixed sentences", async () => {
  const wall = await openMcp("https://x.example.com/mcp", { send: pretend(() => ({ status: 401 })).send });
  assert.deepEqual(wall, { ok: false, error: MCP_FAILED.login });
  const notMcp = await openMcp("https://x.example.com/mcp", { send: pretend(() => ({ type: "text/html", body: "<html>hi</html>" })).send });
  assert.deepEqual(notMcp, { ok: false, error: MCP_FAILED.protocol });
  const garbage = await openMcp("https://x.example.com/mcp", { send: pretend(() => ({ body: "{not json" })).send });
  assert.deepEqual(garbage, { ok: false, error: MCP_FAILED.protocol });
  const onlyWrites = pretend((message) => {
    if (message.method === "initialize") return rpcResult(message, {});
    if (message.method === "notifications/initialized") return { status: 202 };
    return rpcResult(message, { tools: [{ name: "create_issue" }, { name: "delete_all" }] });
  });
  assert.deepEqual(await openMcp("https://x.example.com/mcp", { send: onlyWrites.send }), { ok: false, error: MCP_FAILED.noTools });
  const blocked = await openMcp("https://x.example.com/mcp", { send: async () => ({ ok: false, error: "That address points to a private or internal place, so it was not contacted." }) });
  assert.equal(blocked.ok, false);
  assert.match(blocked.error, /private or internal/);
});

test("a bad address never reaches the network (the shared guard refuses it before any request)", async () => {
  for (const url of ["http://mcp.example.com/mcp", "https://127.0.0.1/mcp", "https://localhost/mcp", "https://user:pw@mcp.example.com/mcp"]) {
    const result = await openMcp(url);
    assert.equal(result.ok, false, url);
  }
});
