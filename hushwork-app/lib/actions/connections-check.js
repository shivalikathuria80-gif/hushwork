"use server";

import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { testAllConnections } from "@/lib/run-core";

// The "Test all my connections" button on the Connections page. Signed-in people only; the person is the one in the session. It only READS
// (see testAllConnections in lib/run-core.js) and is limited to a few runs every five minutes. Returns { groups, off } or { error }.
export async function testConnections() {
  const user = await requireUser();
  const supabase = await createClient();
  return testAllConnections({ user, supabase });
}
