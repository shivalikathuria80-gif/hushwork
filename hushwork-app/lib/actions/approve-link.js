"use server";

import { createAdminClient, createTokenClient } from "@/lib/supabase/admin";
import { approveStep, rejectStep } from "@/lib/run-core";
import { readRun } from "@/lib/plugin/tools";
import { decideLink } from "@/lib/approve-decide";

// The two buttons on a "review and approve" page (app/a/[code]). Nobody is signed in there: the single-use code in the link is the key, and
// lib/approve-decide.js does the careful part (claim the link once, then the same action as the Runs page with the words the page showed).
// `input` = { code, decision: "approve" | "turn_down", seen }. Small answers only.
export async function decideFromLink(input) {
  const admin = createAdminClient();
  if (!admin) return { error: "Hushwork cannot do this right now. Open the Runs page instead." };
  return decideLink(
    { admin, readRun, approveStep, rejectStep, clientFor: (userId) => createTokenClient(userId) },
    { code: String(input?.code ?? ""), decision: input?.decision, seen: typeof input?.seen === "string" ? input.seen : undefined },
  );
}
