import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { connectorStatus } from "@/lib/connector-status";

export const metadata = { title: "Connections - Hushwork", robots: { index: false, follow: false } };

// The apps a workflow can act in. Telegram is the first real connection (a bot you create yourself, set up in .env.local).
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
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Connections let a workflow act in your other apps. Telegram and web addresses work: each acts only after you approve it on the Runs page.</p>

      <section aria-labelledby="telegram-heading" className="mt-8">
        <h2 id="telegram-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Telegram</h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <Suspense fallback={<span aria-hidden="true" className="block h-6 w-40 rounded-md bg-raised" />}>
            <TelegramStatus />
          </Suspense>
          <p className="mt-3 text-sm text-mute">A Telegram bot is a free account that can post into your chat. Hushwork uses yours to send a workflow{"’"}s message to you, and only to you.</p>
          <h3 className="mt-4 text-sm font-medium">Set it up (about five minutes)</h3>
          <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-mute">
            <li>In Telegram, open a chat with <b className="font-medium text-ink">@BotFather</b>, send <code>/newbot</code> and follow the questions. It gives you a <b className="font-medium text-ink">token</b>, a long secret code. Keep it private.</li>
            <li>Open your new bot and send it any message, for example {"“"}hi{"”"}.</li>
            <li>In a browser, open <code>https://api.telegram.org/bot</code> followed by your token and then <code>/getUpdates</code>. Find <code>{"\"chat\":{\"id\":"}</code> and the number after it. That number is your <b className="font-medium text-ink">chat id</b>.</li>
            <li>Open <code>hushwork-app/.env.local</code> and add two lines: <code>TELEGRAM_BOT_TOKEN=your token</code> and <code>TELEGRAM_CHAT_ID=your number</code>.</li>
            <li>Stop the app and start it again with <code>npm run dev</code>, so it reads the new lines. This card will then say Connected.</li>
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

async function TelegramStatus() {
  const { telegram } = await connectorStatus();
  return telegram ? (
    <p className="flex items-center gap-2 font-medium"><Icon name="CircleCheck" className="text-success" />Connected. Messages go to your own chat.</p>
  ) : (
    <p className="flex items-center gap-2 font-medium"><Icon name="CircleAlert" className="text-mute" />Not connected yet.</p>
  );
}
