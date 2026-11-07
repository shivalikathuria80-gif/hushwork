import { Suspense } from "react";
import WeekRecap, { WeekFallback } from "@/components/app/WeekRecap";

export const metadata = { title: "Your week - Hushwork", robots: { index: false, follow: false } };

// The page shell is built ahead of time. The recap reads the session and the database, so it streams in behind <Suspense>.
export default function WeekPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Your week</h1>
      <p className="mt-2 max-w-[62ch] text-[15px] text-mute">What Hushwork did for you in the last 7 days: the time it gave back, what still needs you, and which workflows worked hardest.</p>
      <Suspense fallback={<WeekFallback />}>
        <WeekRecap />
      </Suspense>
    </main>
  );
}
