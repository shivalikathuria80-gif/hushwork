import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Extra safety for the sign-in cookie. The library's own defaults let page scripts read it and never add Secure.
// httpOnly: only the server can read the cookie (this app has no browser Supabase client, so nothing needs it).
// secure: the browser sends it only over HTTPS. Switched on in production builds; on http://localhost during
// development the browser would refuse a Secure cookie, so it stays off there.
const COOKIE_SAFETY = { httpOnly: true, secure: process.env.NODE_ENV === "production" };

// Creates a Supabase client for Server Components and Server Actions.
// The sign-in "pass" lives in a cookie; this client reads it from the request and, when Supabase hands out a
// fresh one, writes it back. Make a new client for every request (never keep one in a global variable).
export async function createClient() {
  // Read the cookies first: with Cache Components this is the moment a page that is being pre-built at build time
  // stops and waits for a real request, so nothing below runs during the build.
  const cookieStore = await cookies();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing. Add it to .env.local and restart npm run dev.");
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing. Add it to .env.local and restart npm run dev.");

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, { ...options, ...COOKIE_SAFETY }));
        } catch {
          // Server Components are not allowed to write cookies. That is fine: proxy.js already refreshed
          // the cookie before this page started rendering. Server Actions can write them, so sign-in works.
        }
      },
    },
  });
}
