import { after } from "next/server";
import { createAdminClient, createTokenClient } from "@/lib/supabase/admin";
import { receiveArrival, hookLimiter } from "@/lib/hook-receive";
import { HOOK_LIMITS } from "@/lib/hooks";
import { startPracticeRun } from "@/lib/run-core";
import { notifyWatch } from "@/lib/schedule-notify";
import { isPaused } from "@/lib/app-controls";
import { takeDbSlot } from "@/lib/db-limits";
import { makeLimiter } from "@/lib/ai/limits";

// A START LINK's address (supabase/hooks.sql, lib/hook-receive.js). A form tool, a shop or any other app sends a POST here and the link's
// workflow starts as its owner, with writing switched OFF. The long random code in the address is the only key; nothing in the body can
// choose a person or a workflow. The answer is tiny and never holds anyone's data. The run itself happens AFTER the answer is sent, so a
// form never waits on the AI.
export const maxDuration = 60;

// Any site may post here (that is the point: the owner's own contact form lives on another site), and no cookie is ever read.
const OPEN = { "access-control-allow-origin": "*", "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", "cache-control": "no-store", "x-robots-tag": "noindex" };
const json = (status, body) => Response.json(body, { status, headers: OPEN });
// A plain HTML form sends the visitor's browser here, so it gets a small page instead of raw JSON. Fixed words only.
const page = (status, words) => new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${words}</title><body style="margin:0;display:grid;place-items:center;min-height:100vh;font:16px/1.5 system-ui,sans-serif;background:#0b0b0f;color:#f4f4f6"><p>${words}</p></body>`, { status, headers: { ...OPEN, "content-type": "text/html; charset=utf-8" } });

// Reads at most a little over the allowed size, so a huge upload is dropped instead of filling the server's memory.
async function readText(request) {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > HOOK_LIMITS.bodyBytes) return null;
  const reader = request.body?.getReader();
  if (!reader) return "";
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > HOOK_LIMITS.bodyBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function POST(request, { params }) {
  const { code } = await params;
  const type = request.headers.get("content-type") ?? "";
  const fromForm = type.includes("x-www-form-urlencoded") && (request.headers.get("accept") ?? "").includes("text/html");
  const text = await readText(request).catch(() => null);
  if (text === null) return json(413, { ok: false, error: "That is too much data for one arrival." });

  const admin = createAdminClient();
  const { answer, finish } = await receiveArrival(
    {
      admin,
      clientFor: (userId) => createTokenClient(userId),
      run: startPracticeRun,
      nudge: (found) => notifyWatch({ admin, ...found }),
      paused: isPaused,
      takeSlot: (client) => takeDbSlot(client, "hook", HOOK_LIMITS.perMinute, HOOK_LIMITS.perDay),
      limiter: hookLimiter(makeLimiter),
    },
    { code, text, type },
  );
  if (finish) after(() => finish().catch(() => console.error("finishing an arrival crashed")));
  if (fromForm) return page(answer.status, answer.body.ok ? "Thank you. Your message was received." : answer.body.error);
  return json(answer.status, answer.body);
}

export const OPTIONS = () => new Response(null, { status: 204, headers: OPEN });
// Opening the address in a browser says what it is, and nothing about whether the code is right.
export const GET = () => json(405, { ok: false, error: "This is a Hushwork start link. Send a POST to it to start its workflow." });
