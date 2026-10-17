import { Suspense } from "react";
import { Icon } from "@/components/icons";
import Workspace from "@/components/app/Workspace";
import Drafts, { DraftsFallback } from "@/components/app/Drafts";

export const metadata = { title: "Workspace - Hushwork", robots: { index: false, follow: false } };

// The workspace page is static (nothing here reads the session), so it appears instantly.
// The signed-in email lives in the layout's user badge; the drafts list reads the session, so it sits in <Suspense>
// and streams in below while everything above it is already on screen.
export default function AppPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <header className="text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-accent text-on-accent"><Icon name="Workflow" size={22} /></span>
        <h1 tabIndex={-1} className="mt-5 text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">What should Hushwork take off your plate?</h1>
        <p className="mx-auto mt-3 max-w-[48ch] text-[15px] text-mute">Describe something you do every week. You get a plan to read, not a workflow that runs.</p>
      </header>
      <div className="mt-8">
        <Workspace>
          <section id="drafts" className="mt-10">
            <Suspense fallback={<DraftsFallback />}>
              <Drafts />
            </Suspense>
          </section>
        </Workspace>
      </div>
    </main>
  );
}
