import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Btn } from "@/components/ui";
import Builder from "@/components/app/Builder";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { builderStart } from "@/lib/builder-start";

export const metadata = { title: "Builder - Hushwork", robots: { index: false, follow: false } };

// The page shell (heading and intro) is built ahead of time. What the Builder opens with depends on the address
// (`?template=` or `?draft=`) and on who is signed in, so it is decided in BuilderLoader, behind <Suspense>.
export default function BuilderPage({ searchParams }) {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Builder</h1>
      <p className="mt-3 max-w-[62ch] text-[15px] text-mute">
        Build a workflow by hand: add steps from the list and fill in the blanks. This only describes the workflow. Nothing runs and nothing is connected.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div aria-busy="true"><p role="status" className="sr-only">Loading the Builder</p><div aria-hidden="true" className="h-72 rounded-2xl border border-line bg-raised" /></div>}>
          <BuilderLoader searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}

async function BuilderLoader({ searchParams }) {
  const params = await searchParams;
  const user = await requireUser(); // outside try/catch on purpose: a signed-out visitor is redirected

  let start;
  try {
    start = await builderStart(await createClient(), user.id, params);
  } catch {
    start = { start: "failed" }; // for example the Supabase settings are missing or the network is down
  }

  if (start.start === "missing") {
    return (
      <Notice title="That workflow no longer exists.">
        It may have been deleted, or the address is wrong.
      </Notice>
    );
  }
  if (start.start === "failed") {
    return (
      <Notice title="Could not open that workflow.">
        Check your connection and reload the page.
      </Notice>
    );
  }
  // A different draft or template is a different Builder: the key makes React start fresh instead of reusing the old one.
  return <Builder key={start.draft?.id ?? start.name ?? "new"} initial={start} />;
}

function Notice({ title, children }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <p className="flex items-center gap-2 font-medium"><Icon name="CircleAlert" className="shrink-0 text-error" />{title}</p>
      <p className="mt-1 text-[15px] text-mute">{children}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn href="/app/workflows" variant="secondary" size="sm">Your workflows</Btn>
        <Btn href="/app/builder" size="sm" icon="Plus">Start a new workflow</Btn>
      </div>
    </div>
  );
}
