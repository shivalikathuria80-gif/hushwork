import { Logo } from "@/components/ui";
import DocsNav from "@/components/docs/DocsNav";
import ThemeToggle from "@/components/app/ThemeToggle";
import { mainSiteUrl } from "@/lib/docs/site";

export const metadata = {
  title: { default: "Hushwork docs", template: "%s | Hushwork docs" },
  description: "How to use Hushwork: describe a chore, check the plan, practise it, and approve every step before anything is sent or created.",
};

// The frame of the docs site (docs.hushwork.in, also reachable at /docs). It is open to everyone: nothing here reads a sign-in.
export default function DocsLayout({ children }) {
  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-3 focus:text-bg">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-5 md:px-10">
          <div className="flex items-center gap-3">
            <Logo href="/docs" />
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-xs text-mute">docs</span>
          </div>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <a href={`${mainSiteUrl()}/app`} className="inline-flex h-11 items-center rounded-xl bg-accent px-4 text-sm font-semibold text-on-accent transition-colors duration-120 ease-standard hover:bg-accent-hover md:h-9">Open Hushwork</a>
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-6 px-5 py-8 md:px-10 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
        <aside><DocsNav /></aside>
        <main id="main" className="min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}
