import { Icon } from "@/components/icons";

export const metadata = { title: "Connections - Hushwork", robots: { index: false, follow: false } };

// The apps a workflow could one day act in. Nothing is connected: this page says so plainly, and has no Connect buttons
// that would not work. When the first connection is built, its card here becomes the place to set it up.
const APPS = [
  { name: "Slack", icon: "MessageSquare", does: "Post a message to a channel." },
  { name: "Google Sheets", icon: "Table", does: "Add a row to a spreadsheet." },
  { name: "Gmail", icon: "Mail", does: "Read and send email." },
  { name: "Google Calendar", icon: "Calendar", does: "Add and read events." },
  { name: "Google Drive", icon: "Folder", does: "File and find documents." },
];

export default function ConnectionsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Connections</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Connections let a workflow act in your other apps. None are connected yet, so every workflow is still a plan to read.</p>

      <section aria-labelledby="apps-heading" className="mt-8">
        <h2 id="apps-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Apps</h2>
        <ul className="mt-3 space-y-3">
          {APPS.map((app) => (
            <li key={app.name} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 shadow-sm">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={app.icon} size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">{app.name}</p>
                <p className="text-sm text-mute">{app.does}</p>
              </div>
              <span className="shrink-0 rounded-md border border-line bg-raised px-2 text-xs font-medium">Not connected</span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-mute">These are planned. Until one is built, the steps in a workflow only describe what would happen.</p>
      </section>
    </main>
  );
}
