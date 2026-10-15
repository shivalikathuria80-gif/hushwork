import RunsViewer from "@/components/app/RunsViewer";

export const metadata = { title: "Runs - Hushwork", robots: { index: false, follow: false } };

// Static page: no session read, no database. Nothing has run yet, so it is an empty state plus one labelled Sample.
export default function RunsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,3vw,2.25rem)] font-semibold leading-[1.1] tracking-tight outline-offset-4">Runs</h1>
      <RunsViewer />
    </main>
  );
}
