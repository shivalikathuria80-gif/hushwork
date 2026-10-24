"use server";

import { headers } from "next/headers";
import { joinWaitlistCore } from "@/lib/waitlist-core";
import { visitorAddress } from "@/lib/visitor";

// The "Join the waitlist" form. It runs on the server so a script cannot skip the page's checks and talk to the database directly from the
// browser: every try is counted per visitor address and for everybody (lib/waitlist-core.js). Returns a short word the form turns into a sentence.
export async function joinWaitlist(input) {
  const sent = await headers();
  return joinWaitlistCore({
    email: input?.email,
    trap: input?.trap,
    visitor: visitorAddress(sent),
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
