import { createAdminClient, createTokenClient } from "@/lib/supabase/admin";
import { bearerToken, findTokenOwner } from "@/lib/plugin/tokens";
import { handleBody } from "@/lib/plugin/mcp";
import { makeLimiter } from "@/lib/ai/limits";
import { getGroqKey } from "@/lib/ai/key";
import { AI_LIMITS } from "@/lib/ai/plan";
import { loadMemory } from "@/lib/ai/memory";
import { takeDbSlot } from "@/lib/db-limits";
import { createAgent } from "@/lib/agents/create";
import { approveStep, rejectStep, startPracticeRun } from "@/lib/run-core";

// The Hushwork plugin's MCP endpoint: a chatbot (Claude, or any app that speaks MCP) sends JSON-RPC here with the person's own API token
// ("Authorization: Bearer hw_...", made on the Settings page). The token says WHO it is; nothing in the body can. From there every call goes
// through the same code, limits and write gates as the app's own buttons (lib/plugin/tools.js), using the all-access client for that one
// person (the way scheduled runs work, lib/supabase/admin.js), so every query names the person.
const json = (body, status, extra = {}) => new Response(body === null ? null : JSON.stringify(body), {
  status, headers: { ...(body === null ? {} : { "content-type": "application/json" }), "cache-control": "no-store", ...extra },
});
const CHALLENGE = { "www-authenticate": 'Bearer realm="hushwork", error="invalid_token", error_description="Make a token on the Hushwork Settings page"' };
const unauthorized = () => json({ jsonrpc: "2.0", id: null, error: { code: -32001, message: "Hushwork needs your API token. Make one on the Settings page, under Chatbot plugin." } }, 401, CHALLENGE);

// A busy chat is a few calls a minute; these only stop a runaway loop. In memory, per server (the real limits on AI and on sending are
// the app's own, counted in the database).
const limits = () => (globalThis.__hushworkMcpLimits ??= { minute: makeLimiter({ max: 60, windowMs: 60_000 }), day: makeLimiter({ max: 2000, windowMs: 86_400_000, calendar: true }) });

// A browser page may not drive this endpoint (DNS rebinding, a stolen tab): a request that carries an Origin must come from Hushwork itself.
function badOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host !== new URL(request.url).host;
  } catch {
    return true;
  }
}

async function accountEmail(admin, userId) {
  try {
    const { data } = await admin.auth.admin.getUserById(userId);
    return data?.user?.email ?? "";
  } catch {
    return "";
  }
}

export async function POST(request) {
  if (badOrigin(request)) return json({ error: "Not allowed from a web page." }, 403);
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) return unauthorized();
  const lookup = createAdminClient();
  if (!lookup) return json({ jsonrpc: "2.0", id: null, error: { code: -32002, message: "This Hushwork server is not set up for the plugin yet (its all-access database key is missing, see docs/deploy.md)." } }, 503);
  const owner = await findTokenOwner(lookup, token);
  if (!owner) return unauthorized();

  const now = Date.now();
  const limit = limits();
  if (limit.minute.left(owner.userId, now) < 1 || limit.day.left(owner.userId, now) < 1) {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32003, message: "Too many requests. Wait a minute and try again." } }, 429, { "retry-after": "60" });
  }
  limit.minute.take(owner.userId, now);
  limit.day.take(owner.userId, now);

  const raw = await request.text();
  if (raw.length > 64_000) return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Request too large" } }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400);
  }

  const supabase = createTokenClient(owner.userId);
  const who = { user: { id: owner.userId, email: await accountEmail(supabase, owner.userId) }, supabase };
  const deps = {
    createAgent: async ({ prompt, tzOffset }) => createAgent({
      prompt, user: who.user, supabase, groqKey: getGroqKey(), memory: await loadMemory(supabase, owner.userId),
      dbTake: () => takeDbSlot(supabase, "ai_plan", AI_LIMITS.perUserMinute, AI_LIMITS.perUserDay), tzOffset,
    }),
    startRun: startPracticeRun,
    approveStep,
    rejectStep,
  };
  const answer = await handleBody(body, who, deps);
  return json(answer.body, answer.status);
}

// This server never opens a stream and keeps no session, so GET and DELETE say so (the MCP spec's answer for that).
export const GET = () => json({ error: "Method not allowed. Send MCP messages with POST." }, 405, { allow: "POST" });
export const DELETE = () => json({ error: "Method not allowed. This server keeps no sessions." }, 405, { allow: "POST" });
