import { Logo } from "@/components/ui";
import ThemeToggle from "@/components/app/ThemeToggle";
import LoginForm from "@/components/login/LoginForm";
import SculpturePanel, { PanelFooter } from "@/components/login/SculpturePanel";

export const metadata = {
  title: "Sign in - Hushwork",
  robots: { index: false, follow: false },
};

// A picture pair, one per theme. Whichever is hidden by CSS is never downloaded, and nothing is downloaded at
// all on screens 1024px and wider (they get the live panel instead).
const bandImage = "mx-auto h-28 w-full max-w-3xl object-contain sm:h-44";

// This page is static: it never reads the visitor's cookies itself. If someone who is already signed in opens
// it, proxy.js redirects them to /app before this page is even rendered.
export default function LoginPage() {
  return (
    <div className="relative min-h-dvh lg:grid lg:grid-cols-2">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-3 focus:text-bg">
        Skip to content
      </a>
      <header>
        <Logo href="/" className="absolute left-5 top-1 z-10 sm:left-8 lg:left-7 lg:top-5" />
        <div className="absolute right-3 top-2 z-10 sm:right-6"><ThemeToggle /></div>
      </header>

      {/* Phones and tablets: a still picture above the form. No WebGL here. The picture is drawn on exactly the
          panel colour (bg-sunken), so no edge of the image shows. */}
      <div aria-hidden="true" className="pt-14 lg:hidden">
        <div className="mx-3 overflow-hidden rounded-3xl bg-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative, already optimised .webp; the lazy pair is the point */}
          <img src="/sculpture/light.webp" alt="" width="1983" height="793" loading="lazy" decoding="async" fetchPriority="low" className={`${bandImage} dark:hidden`} />
          {/* eslint-disable-next-line @next/next/no-img-element -- see above */}
          <img src="/sculpture/dark.webp" alt="" width="1983" height="793" loading="lazy" decoding="async" fetchPriority="low" className={`${bandImage} hidden dark:block`} />
        </div>
      </div>

      {/* Desktop: the left half of the screen holds the sculpture, as a rounded panel inset 12px from the screen edge. */}
      <div className="relative hidden lg:sticky lg:top-0 lg:block lg:h-svh lg:p-3">
        <div className="relative h-full overflow-hidden rounded-3xl bg-sunken">
          <SculpturePanel />
        </div>
      </div>

      <main id="main" className="mx-auto flex w-full max-w-[400px] flex-col justify-center px-5 pb-12 pt-8 lg:min-h-svh lg:pt-12">
        <LoginForm />
      </main>

      <PanelFooter />
    </div>
  );
}
