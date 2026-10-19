import { Suspense } from "react";
import RunsViewer, { RunsFallback } from "@/components/app/RunsViewer";

export const metadata = { title: "Runs - Hushwork", robots: { index: false, follow: false } };

// The page shell is built ahead of time. The list reads the session and the database, so it streams in behind <Suspense>.
// searchParams (the "?run=" in the address) is a Promise in Next.js 16; RunsViewer awaits it inside the boundary.
export default function RunsPage({ searchParams }) {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Runs</h1>
      <Suspense fallback={<RunsFallback />}>
        <RunsViewer searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
