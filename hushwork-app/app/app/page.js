import { Suspense } from "react";
import { Icon } from "@/components/icons";
import Workspace from "@/components/app/Workspace";
import AiWorkspace from "@/components/app/AiWorkspace";
import GettingStarted from "@/components/app/GettingStarted";
import Drafts, { DraftsFallback } from "@/components/app/Drafts";
import AgentPanel from "@/components/app/AgentPanel";
import ChatbotCard from "@/components/app/ChatbotCard";
import ChatbotPlugin from "@/components/ChatbotPlugin";

export const metadata = { title: "Home - Hushwork", robots: { index: false, follow: false } };

// The page shell is built ahead of time (nothing in it reads the session), so it appears instantly. Two parts then
// stream in from the server: AiWorkspace (is AI planning on?) and the drafts list (it reads the session and the
// database). While AiWorkspace checks, the same workspace shows with its AI line left blank: it takes a moment, so
// nothing jumps.
// The signed-in email lives in the layout's user badge.
export default function AppPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <header className="text-center">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-accent text-on-accent"><Icon name="Workflow" size={22} /></span>
        <h1 tabIndex={-1} className="mt-5 text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">What should Hushwork take off your plate?</h1>
        <p className="mx-auto mt-3 max-w-[48ch] text-[15px] text-mute">Tell Hushwork AI in the Builder, or pick up one of your workflows below. Anything that sends or creates waits for your OK.</p>
      </header>
      <div className="mt-8">
        <Suspense fallback={null}><GettingStarted /></Suspense>
        <Suspense
          fallback={
            <Workspace ai={{ enabled: false, limit: 0, pending: true }} plugin={<ChatbotPlugin place="app" />}>
              <section id="drafts" className="mt-10 scroll-mt-20"><DraftsFallback title="Your workflows" /></section>
            </Workspace>
          }
        >
          <AiWorkspace top={<Suspense fallback={null}><AgentPanel /></Suspense>} plugin={<Suspense fallback={<ChatbotPlugin place="app" />}><ChatbotCard /></Suspense>}>
            <section id="drafts" className="mt-10 scroll-mt-20">
              <Suspense fallback={<DraftsFallback title="Your workflows" />}>
                <Drafts openBase="/app/builder?draft=" />
              </Suspense>
            </section>
          </AiWorkspace>
        </Suspense>
      </div>
    </main>
  );
}
