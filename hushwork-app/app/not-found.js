import { Btn } from "@/components/ui";

export const metadata = { title: "Page not found - Hushwork", robots: { index: false, follow: false } };

// Shown for any address that does not exist (a mistyped address, an old link, or an unknown app name in /api/connect/<app>).
export default function NotFound() {
  return (
    <main id="main" className="mx-auto max-w-xl px-5 py-16 sm:px-8">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">That page does not exist</h1>
      <p className="mt-3 text-[15px] text-mute">The address may be mistyped, or the page may have moved. Your work is safe.</p>
      <Btn className="mt-6" icon="ArrowRight" href="/app">Go to your workspace</Btn>
    </main>
  );
}
