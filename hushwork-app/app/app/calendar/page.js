import { Suspense } from "react";
import CalendarData, { CalendarFallback } from "@/components/app/CalendarData";

export const metadata = { title: "Calendar - Hushwork", robots: { index: false, follow: false } };

// The page shell is built ahead of time. The calendar reads the session and the database, so it streams in behind <Suspense>.
export default function CalendarPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-mute">Calendar · next 7 days</p>
      <h1 tabIndex={-1} className="mt-2 text-[length:clamp(2.25rem,4.6vw,3.75rem)] font-extrabold leading-[1.02] tracking-[-0.04em] outline-offset-4">
        Your agents&rsquo; week, <span className="hw-grad-text">planned.</span>
      </h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Every run Hushwork will make for you, day by day, from your schedules. Anything that sends or creates still waits for your OK.</p>
      <Suspense fallback={<CalendarFallback />}>
        <CalendarData />
      </Suspense>
    </main>
  );
}
