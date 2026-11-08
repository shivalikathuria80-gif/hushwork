import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { Btn } from "@/components/ui";
import Builder from "@/components/app/Builder";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { builderStart } from "@/lib/builder-start";
import { connectionStates } from "@/lib/skills/connection-status";
import { aiStatus } from "@/lib/ai-status";
import { runRows } from "@/lib/builder-runs";

export const metadata = { title: "Builder - Hushwork", robots: { index: false, follow: false } };

// The page shell (heading and intro) is built ahead of time. What the Builder opens with depends on the address
// (`?template=`, `?skill=` or `?draft=`) and on who is signed in, so it is decided in BuilderLoader, behind <Suspense>.
// The Builder is a full-height studio: a copilot chat on the left, the workflow drawn as a canvas on the right, and a bar on top
// (Editor / Executions, Undo, Saved, Test, Publish). The shell is built ahead of time; what it opens with depends on the address
// (`?template=`, `?skill=` or `?draft=`) and on who is signed in, so it is decided in BuilderLoader, behind <Suspense>.
export default function BuilderPage({ searchParams }) {
  return (
    <main id="main" className="relative flex min-h-dvh w-full flex-col lg:h-dvh">
      <h1 tabIndex={-1} className="sr-only">Builder</h1>
      <Suspense fallback={<div aria-busy="true" className="flex-1 p-6"><p role="status" className="sr-only">Loading the Builder</p><div aria-hidden="true" className="h-full min-h-72 rounded-2xl border border-line bg-raised" /></div>}>
        <BuilderLoader searchParams={searchParams} />
      </Suspense>
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
  // Which apps are connected, so a step whose app is missing can say so in place. If this cannot be read the Builder simply shows no warnings.
  let connections;
  try {
    connections = await connectionStates(await createClient(), user.id);
  } catch {
    connections = undefined;
  }
  // The Executions tab: this workflow's last runs. Missing or unreadable means an empty list, never a broken page.
  let runs = [];
  if (start.draft?.id) {
    try {
      const read = await (await createClient()).from("runs").select("id, mode, created_at, results").eq("user_id", user.id).eq("workflow_id", start.draft.id).order("created_at", { ascending: false }).limit(25);
      runs = read.error ? [] : runRows(read.data);
    } catch {
      runs = [];
    }
  }
  const ai = await aiStatus();
  // A different draft or template is a different Builder: the key makes React start fresh instead of reusing the old one.
  return <Builder key={start.draft?.id ?? start.name ?? "new"} initial={start} connections={connections} runs={runs} ai={ai} ask={typeof params?.ask === "string" ? params.ask.slice(0, 1000) : ""} />;
}

function Notice({ title, children }) {
  return (
    <div className="m-5 max-w-xl rounded-2xl border border-line bg-surface p-4 shadow-sm sm:m-8">
      <p className="flex items-center gap-2 font-medium"><Icon name="CircleAlert" className="shrink-0 text-error" />{title}</p>
      <p className="mt-1 text-[15px] text-mute">{children}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Btn href="/app#drafts" variant="secondary" size="sm">Your workflows</Btn>
        <Btn href="/app/builder" size="sm" icon="Plus">Start a new workflow</Btn>
      </div>
    </div>
  );
}
