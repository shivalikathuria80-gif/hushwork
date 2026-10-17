"use client";

import { Btn } from "@/components/ui";

// Shown if something in /app crashes. It never prints the technical error (that could leak details).
// In Next.js 16 the button prop is `retry`: it asks the server for the page again, not just a redraw.
export default function AppError({ retry }) {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-16 sm:px-8">
      <h1 className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em]">Something went wrong</h1>
      <p className="mt-3 text-[15px] text-mute">This page could not load. Try again in a moment.</p>
      <Btn className="mt-6" icon="RotateCcw" onClick={() => retry()}>Try again</Btn>
    </main>
  );
}
