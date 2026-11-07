"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";
import { checkId } from "@/lib/validate";
import { MAX_TOKENS, NO_TABLE, TOKEN_SETUP, checkTokenName, makeToken } from "@/lib/plugin/tokens";

// Settings > Chatbot plugin: make and remove the person's API tokens (lib/plugin/tokens.js, supabase/api-tokens.sql). Same habits as every
// action: requireUser first, validate, the person's own database client (user_id is filled in by the database), small answers.
// A new token is returned ONCE, in the answer to "Make a token"; only its hash is saved, so it can never be shown again.

export async function createApiToken(input) {
  const user = await requireUser();
  const name = checkTokenName(input?.name);
  if (name.error) return { error: name.error };
  const supabase = await createClient();
  const { count, error: countError } = await supabase.from("api_tokens").select("id", { count: "exact", head: true }).eq("user_id", user.id);
  if (countError) {
    console.error("counting tokens failed:", countError.code);
    return { error: NO_TABLE.has(countError.code) ? TOKEN_SETUP : "Could not make a token. Try again." };
  }
  if ((count ?? 0) >= MAX_TOKENS) return { error: `You can keep up to ${MAX_TOKENS} tokens. Remove one you no longer use first.` };
  const made = makeToken();
  const { error } = await supabase.from("api_tokens").insert({ name: name.value, token_hash: made.hash, prefix: made.prefix });
  if (error) {
    console.error("saving a token failed:", error.code);
    return { error: NO_TABLE.has(error.code) ? TOKEN_SETUP : "Could not make a token. Try again." };
  }
  revalidatePath("/app/settings");
  return { ok: true, token: made.token };
}

export async function deleteApiToken(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: "That token no longer exists." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("api_tokens").delete().eq("id", id.value).eq("user_id", user.id).select("id");
  if (error) {
    console.error("removing a token failed:", error.code);
    return { error: "Could not remove it. Try again." };
  }
  if (!data?.length) return { error: "That token no longer exists." };
  revalidatePath("/app/settings");
  return { ok: true };
}

// A chatbot connected with the Connect button (OAuth, lib/plugin/oauth.js): removing the grant ends its access and refresh tokens at once.
export async function disconnectChatbot(input) {
  const user = await requireUser();
  const id = checkId(input?.id);
  if (id.error) return { error: "That connection no longer exists." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("oauth_grants").delete().eq("id", id.value).eq("user_id", user.id).select("id");
  if (error) {
    console.error("removing a chatbot connection failed:", error.code);
    return { error: "Could not disconnect it. Try again." };
  }
  if (!data?.length) return { error: "That connection no longer exists." };
  revalidatePath("/app/settings");
  return { ok: true };
}
