import { Suspense } from "react";
import AppNav from "@/components/app/AppNav";
import UserBadge from "@/components/app/UserBadge";

export const metadata = { robots: { index: false, follow: false } };

// The frame around /app and /app/runs. Everything here is static except the user badge, which reads the session
// and therefore sits inside <Suspense>. This layout is NOT a security gate: proxy.js, requireUser() and the
// database rules do that (layouts are not re-run on every navigation).
export default function AppLayout({ children }) {
  return (
    <div className="min-h-dvh lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-3 focus:text-bg">
        Skip to content
      </a>
      <AppNav
        userBadge={
          <Suspense fallback={<span aria-hidden="true" className="block h-8 w-44 rounded-full bg-raised" />}>
            <UserBadge />
          </Suspense>
        }
      />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
