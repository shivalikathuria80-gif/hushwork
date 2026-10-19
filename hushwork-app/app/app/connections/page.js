import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { connectorStatus } from "@/lib/connector-status";

export const metadata = { title: "Connections - Hushwork", robots: { index: false, follow: false } };

// The apps a workflow can act in. Web addresses and Linear work now (Linear needs one key in .env.local).
// The others are planned and say so: there are no Connect buttons that would not work.
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
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Connections let a workflow act in your other apps. Web addresses and Linear work, and only after you approve them on the Runs page. The rest are planned.</p>

      <section aria-labelledby="linear-heading" className="mt-8">
        <h2 id="linear-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Linear</h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <Suspense fallback={<span aria-hidden="true" className="block h-6 w-40 rounded-md bg-raised" />}>
            <LinearStatus />
          </Suspense>
          <p className="mt-3 text-sm text-mute">Hushwork can read your open Linear tasks. It can only look. It cannot change anything in Linear.</p>
          <h3 className="mt-4 text-sm font-medium">Connect it (about two minutes)</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-mute">
            <li>In Linear, click your workspace name (top left), then <b className="font-medium text-ink">Settings</b>.</li>
            <li>Open <b className="font-medium text-ink">Security &amp; access</b>, then <b className="font-medium text-ink">Personal API keys</b>, then <b className="font-medium text-ink">New API key</b>. Name it Hushwork and copy the key. It is a secret code, so keep it private.</li>
            <li>Open <code>hushwork-app/.env.local</code> and add one line: <code>LINEAR_API_KEY=your key</code></li>
            <li>Stop the app and start it again with <code>npm run dev</code>. This card will then say Connected.</li>
            <li>In the Builder, drag in the <b className="font-medium text-ink">Linear</b> block, save it, press Practice run, then Approve.</li>
          </ol>
        </div>
      </section>

      <section aria-labelledby="web-heading" className="mt-8">
        <h2 id="web-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Web addresses</h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="flex items-center gap-2 font-medium"><Icon name="CircleCheck" className="text-success" />Works now. Nothing to set up.</p>
          <p className="mt-2 text-sm text-mute">A {"“"}Call a web address{"”"} step asks one https address for information (a read-only request) after you approve it on the Runs page. Private and internal addresses are refused. Never put a password or key in the address.</p>
        </div>
      </section>

      <section aria-labelledby="apps-heading" className="mt-8">
        <h2 id="apps-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Planned apps</h2>
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
        <p className="mt-4 text-sm text-mute">These are planned. Until one is built, steps for them only describe what would happen.</p>
      </section>
    </main>
  );
}

async function LinearStatus() {
  const { linear } = await connectorStatus();
  return linear ? (
    <p className="flex items-center gap-2 font-medium"><Icon name="CircleCheck" className="text-success" />Connected.</p>
  ) : (
    <p className="flex items-center gap-2 font-medium"><Icon name="CircleAlert" className="text-mute" />Not connected yet.</p>
  );
}
