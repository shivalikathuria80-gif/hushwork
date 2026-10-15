import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Check 2 of 3: the one place that asks "who is this?". The proxy is not enough on its own, so every component
// that reads drafts and every Server Action calls requireUser() right next to the data.
//
// getClaims() checks that the sign-in pass is genuine (signed by Supabase) and returns the facts inside it.
// Never trust getSession() on the server: it does not re-check the pass.
// Because this reads cookies, call it only inside a <Suspense> boundary (the project uses Cache Components).
// cache() makes it run once per request, however many components ask.
const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/login");
  return user;
}
