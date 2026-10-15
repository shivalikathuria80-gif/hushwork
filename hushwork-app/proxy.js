import { updateSession } from "@/lib/supabase/proxy";

// In Next.js 16 this file replaces what older versions called "middleware": it runs on the server before a page.
// The matcher keeps it away from everything else, so the landing page, /privacy and the waitlist are never touched.
export async function proxy(request) {
  return updateSession(request);
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
