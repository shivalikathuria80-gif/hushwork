"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { checkEmail, checkPassword, EMAIL_RULE, PASSWORD_RULE } from "@/lib/validate";
import { allowAuthTry } from "@/lib/auth-limits";
import { visitorAddress } from "@/lib/visitor";

// A Server Action is a function that runs only on the server but can be called straight from a <form>.
// Treat each one as a public door: anyone can send it anything, so it checks its input every time.
// It returns a small object for the form to show: { kind, error, field } (never a raw Supabase error, which may
// reveal things we do not want to show).

const MESSAGE = {
  credentials: "That email and password do not match. Check both and try again.",
  exists: "We could not create that account. If you already have one, sign in instead.",
  rate: "Too many attempts. Wait a few minutes and try again.",
  unconfirmed: "Confirm your email first.",
  signupOff: "New accounts are switched off right now.",
  setup: "Sign-in is not set up on this computer yet. Add the two Supabase settings to .env.local, then restart npm run dev.",
  other: "Something went wrong. Try again.",
};

// Turns a Supabase error into one of our sentences by its error code. Only the code is logged, never a password.
function explain(error) {
  const code = error.code || error.name || "unknown";
  console.error("Supabase auth error:", code);
  if (code === "invalid_credentials") return { kind: "credentials", error: MESSAGE.credentials };
  if (code === "user_already_exists" || code === "email_exists") return { kind: "exists", error: MESSAGE.exists };
  if (code === "weak_password") return { kind: "field", field: "password", error: PASSWORD_RULE };
  if (code === "email_address_invalid") return { kind: "field", field: "email", error: EMAIL_RULE };
  if (code === "email_not_confirmed") return { kind: "other", error: MESSAGE.unconfirmed };
  if (code === "signup_disabled") return { kind: "other", error: MESSAGE.signupOff };
  if (error.status === 429 || code.includes("rate_limit")) return { kind: "other", error: MESSAGE.rate };
  return { kind: "other", error: MESSAGE.other };
}

async function openSupabase() {
  try {
    return await createClient();
  } catch {
    return null; // the two settings are missing from .env.local
  }
}

export async function signIn(formData) {
  // A Server Action can be called by anyone with anything. If it did not get a form, stop before touching it.
  if (!(formData instanceof FormData)) return { kind: "other", error: MESSAGE.other };
  const email = checkEmail(formData.get("email"));
  const password = checkPassword(formData.get("password"), false);
  if (email.error) return { kind: "field", field: "email", error: email.error };
  if (password.error) return { kind: "field", field: "password", error: password.error };
  if (!allowAuthTry("signIn", { email: email.value, visitor: visitorAddress(await headers()) })) return { kind: "other", error: MESSAGE.rate }; // the app's own brake, before the password is checked

  const supabase = await openSupabase();
  if (!supabase) return { kind: "other", error: MESSAGE.setup };

  let error;
  try {
    ({ error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value }));
  } catch {
    return { kind: "other", error: MESSAGE.other };
  }
  if (error) return explain(error);

  redirect("/app"); // outside any try/catch on purpose: redirect works by throwing
}

export async function signUp(formData) {
  // A Server Action can be called by anyone with anything. If it did not get a form, stop before touching it.
  if (!(formData instanceof FormData)) return { kind: "other", error: MESSAGE.other };
  const email = checkEmail(formData.get("email"));
  const password = checkPassword(formData.get("password"), true);
  if (email.error) return { kind: "field", field: "email", error: email.error };
  if (password.error) return { kind: "field", field: "password", error: password.error };
  if (!allowAuthTry("signUp", { email: email.value, visitor: visitorAddress(await headers()) })) return { kind: "other", error: MESSAGE.rate };

  const supabase = await openSupabase();
  if (!supabase) return { kind: "other", error: MESSAGE.setup };

  let result;
  try {
    result = await supabase.auth.signUp({ email: email.value, password: password.value });
  } catch {
    return { kind: "other", error: MESSAGE.other };
  }
  const { data, error } = result;
  if (error) return explain(error);

  // A session means the account is ready and we are signed in (this is the case when "Confirm email" is off).
  if (data.session) redirect("/app");

  // No session and no identities: Supabase hides "this address already has an account" like this.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { kind: "exists", error: MESSAGE.exists };
  }

  // No session: "Confirm email" is switched on in the dashboard, so a confirmation email was sent.
  return { kind: "confirm", email: email.value };
}

export async function signOut() {
  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" }); // ends this browser's session and removes the cookie
  } catch {
    console.error("Sign out could not reach Supabase; sending the visitor to /login anyway.");
  }
  redirect("/login");
}
