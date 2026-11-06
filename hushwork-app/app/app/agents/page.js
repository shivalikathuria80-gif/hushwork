import { Suspense } from "react";
import { Icon } from "@/components/icons";
import AgentMaker from "@/components/app/AgentMaker";
import Drafts, { DraftsFallback } from "@/components/app/Drafts";

export const metadata = { title: "Agents - Hushwork", robots: { index: false, follow: false } };

// Agents: describe a task in one sentence and Hushwork makes it, saves it and runs it (lib/agents/create.js). The Builder is still there for
// people who like to set each step themselves; an agent is a workflow underneath, so its name opens it in the Builder too.
// The page shell is built ahead of time; the list reads the session and the database, so it streams in behind <Suspense>.
export default function AgentsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <header className="text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-accent text-on-accent"><Icon name="Bot" size={22} /></span>
        <h1 tabIndex={-1} className="mt-5 text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Tell an agent what to do</h1>
        <p className="mx-auto mt-3 max-w-[52ch] text-[15px] text-mute">Describe a task in plain English. Hushwork turns it into an agent, saves it and runs it straight away. Say when, and it runs on that schedule too. Steps that act on your apps wait for your approval.</p>
      </header>
      <div className="mt-8">
        <AgentMaker />
      </div>
      <section id="drafts" className="mt-10">
        <Suspense fallback={<DraftsFallback title="Your agents" agents />}>
          <Drafts openBase="/app/builder?draft=" agents />
        </Suspense>
      </section>
    </main>
  );
}
