import { Suspense } from "react";
import LinksData, { LinksFallback } from "@/components/app/LinksData";

export const metadata = { title: "Start links - Hushwork", robots: { index: false, follow: false } };

// The page shell is built ahead of time. The links read the session and the database, so they stream in behind <Suspense>.
export default function LinksPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-mute">Start links · from outside and from your apps</p>
      <h1 tabIndex={-1} className="mt-2 text-[length:clamp(2.25rem,4.6vw,3.75rem)] font-semibold leading-[1.04] tracking-[-0.035em] outline-offset-4">
        Something arrives. <span className="text-accent-text">Work starts.</span>
      </h1>
      <p className="mt-3 max-w-[62ch] text-[15px] text-mute">Give a workflow its own private address, or let a new email or calendar event start it. When something arrives, the workflow starts by itself and reads what came in. Anything that sends or creates still waits for your OK.</p>
      <Suspense fallback={<LinksFallback />}>
        <LinksData />
      </Suspense>
    </main>
  );
}
