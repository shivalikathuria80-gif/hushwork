// A small, stateless MCP server (Model Context Protocol, "Streamable HTTP" transport answering with plain JSON) for the Hushwork plugin.
// app/api/mcp/route.js checks the token and hands each JSON-RPC message here; lib/plugin/tools.js does the work. Plain code, so tests can
// call it directly. Stateless on purpose: no session id, no server-sent events, every POST is answered on its own. That is all a chatbot
// needs to list and call tools, and it works the same on any number of servers.
import { TOOLS, callTool } from "./tools.js";

export const SERVER_INFO = { name: "hushwork", title: "Hushwork", version: "1.0.0" };
const VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];
const INSTRUCTIONS = [
  "Hushwork runs the person's agents and workflows across their apps (Gmail, Google Calendar, Linear, Slack and more).",
  "Reading, looking things up and AI steps happen by themselves. A step that sends or creates something always waits for the person's approval:",
  "show them its will_do words, get a clear yes in this conversation, then call approve_step with those words as `seen`. Never approve on your own.",
].join(" ");

const reply = (id, result) => ({ jsonrpc: "2.0", id, result });
const failure = (id, code, message) => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

// One JSON-RPC message in, one answer out (or null for a notification, which gets no answer).
export async function handleMessage(message, who, deps) {
  if (!message || typeof message !== "object" || message.jsonrpc !== "2.0" || typeof message.method !== "string") return failure(message?.id, -32600, "Invalid request");
  const { id, method, params } = message;
  const isNotification = id === undefined || id === null;
  if (isNotification) return null; // notifications/initialized, notifications/cancelled...

  switch (method) {
    case "initialize": {
      const asked = params?.protocolVersion;
      return reply(id, {
        protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: SERVER_INFO,
        instructions: INSTRUCTIONS,
      });
    }
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools: TOOLS });
    case "tools/call": {
      const name = params?.name;
      if (typeof name !== "string") return failure(id, -32602, "Missing tool name");
      const result = await callTool(name, params?.arguments, who, deps);
      if (result?.unknownTool) return failure(id, -32602, result.error);
      const isError = Boolean(result?.error);
      const body = isError ? { error: result.error, ...Object.fromEntries(Object.entries(result).filter(([key]) => key !== "error")) } : result;
      return reply(id, {
        content: [{ type: "text", text: JSON.stringify(body, null, 2) }],
        ...(isError ? { isError: true } : { structuredContent: body }),
      });
    }
    case "resources/list":
      return reply(id, { resources: [] });
    case "prompts/list":
      return reply(id, { prompts: [] });
    default:
      return failure(id, -32601, `Method not found: ${String(method).slice(0, 60)}`);
  }
}

// A POST body (one message or a batch). Returns { status, body } : 202 with no body when everything was a notification.
export async function handleBody(body, who, deps) {
  if (Array.isArray(body)) {
    if (!body.length || body.length > 20) return { status: 400, body: failure(null, -32600, "Invalid batch") };
    const answers = (await Promise.all(body.map((one) => handleMessage(one, who, deps)))).filter(Boolean);
    return answers.length ? { status: 200, body: answers } : { status: 202, body: null };
  }
  const answer = await handleMessage(body, who, deps);
  return answer ? { status: 200, body: answer } : { status: 202, body: null };
}
