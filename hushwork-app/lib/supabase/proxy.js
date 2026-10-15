import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Same extra safety as lib/supabase/server.js: HttpOnly always, Secure only in production builds
// (a Secure cookie would be refused over plain http://localhost in development).
const COOKIE_SAFETY = { httpOnly: true, secure: process.env.NODE_ENV === "production" };

// Check 1 of 3 ("the doorman"). Runs from proxy.js before /app/* and /login are rendered.
// Job: ask Supabase "is this pass genuine?" (getClaims), refresh the pass if it is about to expire, and send
// signed-out visitors away from /app. Server Components cannot write cookies, so this is the place that does.
export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });
  const path = request.nextUrl.pathname;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  let signedIn = false;
  if (url && key) {
    // Do not put any other code between creating the client and getClaims(): it can randomly sign people out.
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          // Give the refreshed pass to the page that is about to render (request) and to the browser (response).
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, { ...options, ...COOKIE_SAFETY }));
          Object.entries(headers).forEach(([header, value]) => supabaseResponse.headers.set(header, value));
        },
      },
    });
    try {
      const { data } = await supabase.auth.getClaims();
      signedIn = Boolean(data?.claims?.sub);
    } catch {
      signedIn = false; // if Supabase cannot be reached, fail closed: treat the visitor as signed out
    }
  }

  // Redirects must carry any refreshed cookie along, or the new pass would be lost.
  const redirectTo = (newPath) => {
    const target = request.nextUrl.clone();
    target.pathname = newPath;
    target.search = "";
    const response = NextResponse.redirect(target);
    supabaseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
    ["cache-control", "expires", "pragma"].forEach((header) => {
      const value = supabaseResponse.headers.get(header);
      if (value) response.headers.set(header, value);
    });
    return response;
  };

  if (!signedIn && (path === "/app" || path.startsWith("/app/"))) return redirectTo("/login");
  if (signedIn && path === "/login") return redirectTo("/app");

  // Must return this exact response object, or the cookies written above are dropped.
  return supabaseResponse;
}
