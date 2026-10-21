import { Suspense } from "react";
import { Btn } from "@/components/ui";
import Drafts, { DraftsFallback } from "@/components/app/Drafts";

export const metadata = { title: "Workflows - Hushwork", robots: { index: false, follow: false } };

// All of a person's saved workflows. The page shell is built ahead of time; the list reads the session and the database,
// so it streams in behind <Suspense>. Each workflow opens in the Builder (openBase), where its steps can be changed.
export default function WorkflowsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Workflows</h1>
        <Btn href="/app/builder" icon="Plus" size="sm">New in the Builder</Btn>
      </div>
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Your saved workflows. Open one in the Builder to change its steps. Pick Manual (you approve each step that acts on your apps) or Auto (Hushwork does them all) below, then press the run button.</p>
      <section className="mt-8">
        <Suspense fallback={<DraftsFallback title="Your workflows" />}>
          <Drafts openBase="/app/builder?draft=" />
        </Suspense>
      </section>
    </main>
  );
}
