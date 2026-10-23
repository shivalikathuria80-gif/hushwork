"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { disconnectEverything } from "@/lib/connectors/composio";
import { deleteAccountCore } from "@/lib/account-core";

// The "Delete my account" button. Only the signed-in person's OWN account can be deleted: the id comes from requireUser(), never from the
// browser, and the person must type the confirmation words first. This is the one place besides the clock that uses the all-access client.
export async function deleteMyAccount(input) {
  const user = await requireUser();
  const result = await deleteAccountCore({
    userId: user.id,
    confirm: input?.confirm,
    admin: createAdminClient(),
    disconnectAll: async (userId) => {
      const key = getComposioKey();
      if (key) await disconnectEverything({ key, userId });
    },
  });
  if (result.error) return { error: result.error };
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" }); // the sign-in row is gone already; this just removes this browser's cookie
  } catch {
    // nothing to do: the cookie no longer opens anything
  }
  redirect("/?account=deleted");
}
