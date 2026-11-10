import { Suspense } from "react";
import { connection } from "next/server";
import { createAdminClient, createTokenClient } from "@/lib/supabase/admin";
import { readRun } from "@/lib/plugin/tools";
import { viewLink } from "@/lib/approve-decide";
import ApproveCard from "@/components/approve/ApproveCard";

// A "review and approve" link from an email, a Slack message or a push notification (lib/approve-links.js). Opening this page NEVER does
// anything: mail scanners and link previews open links by themselves. It shows the step's exact words as they are now; only a button press on
// it acts (lib/actions/approve-link.js). Nobody needs to be signed in: the single-use code is the key. Never indexed, and the address is never
// handed on to another site (no referrer). The shell is built ahead of time; the step streams in behind <Suspense>.
export const metadata = { title: "Review a step - Hushwork", robots: { index: false, follow: false }, referrer: "no-referrer" };

export default function ReviewPage({ params }) {
  return (
    <main id="main" className="min-h-dvh bg-bg px-4 py-10 text-ink sm:px-8 sm:py-16">
      <Suspense fallback={<div aria-hidden="true" className="mx-auto h-96 max-w-2xl rounded-[28px] border border-line bg-surface" />}>
        <Review params={params} />
      </Suspense>
    </main>
  );
}

async function Review({ params }) {
  const { code } = await params;
  await connection(); // a real request first: the link's time limit uses the clock
  const admin = createAdminClient();
  const shown = admin
    ? await viewLink({ admin, readRun, clientFor: (userId) => createTokenClient(userId) }, String(code ?? "")).catch(() => ({ problem: "unknown", words: "This link does not work right now. Open the Runs page instead." }))
    : { problem: "unknown", words: "Hushwork cannot open this link right now. Open the Runs page instead." };
  return <ApproveCard code={String(code ?? "")} shown={shown} />;
}
