import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { connectorStatus } from "@/lib/connector-status";
import { APP_LIST } from "@/lib/connectors/app-list";
import DisconnectApp from "@/components/app/DisconnectApp";

export const metadata = { title: "Connections - Hushwork", robots: { index: false, follow: false } };

// The apps a workflow can act in. Web addresses, Linear and Google Calendar work now. The others are planned and say so:
// there are no Connect buttons that would not work.
const APPS = [
  { name: "Slack", icon: "MessageSquare", does: "Post a message to a channel." },
  { name: "Gmail (sending)", icon: "Mail", does: "Send email. Reading your inbox already works with Google above." },
  { name: "Google Drive", icon: "Folder", does: "File and find documents." },
];

// What the short message in the address means (the Connect button sends the person back with ?linear=... or ?google=...).
const RESULTS = {
  connected: ["ok", "Connected."],
  denied: ["problem", "You pressed Cancel, so nothing was connected."],
  expired: ["problem", "That took too long, or it came from another window. Press Connect again."],
  failed: ["problem", "The sign-in was not accepted. Press Connect again."],
  save: ["problem", "The app said yes, but saving it failed. One of the setup steps below may be missing."],
  setup: ["problem", "The Connect button needs its one-time setup first. See below."],
};

const buttonLook = "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent bg-accent px-5 text-[15px] font-semibold text-on-accent transition-[background-color] duration-120 ease-standard hover:bg-accent-hover active:bg-accent-active md:h-9 md:text-sm";
const code = "rounded bg-sunken px-1 py-0.5 text-[13px]";

export default function ConnectionsPage({ searchParams }) {
  const fallback = <span aria-hidden="true" className="block h-6 w-40 rounded-md bg-raised" />;
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Connections</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Connections let a workflow act in your other apps. Web addresses, Linear, Google Calendar, Google Sheets and reading your Gmail inbox work, and only after you approve them on the Runs page. The rest are planned.</p>

      {APP_LIST.map((entry) => (
        <section key={entry.id} aria-labelledby={`${entry.id}-heading`} className="mt-8">
          <h2 id={`${entry.id}-heading`} className="text-xl font-semibold leading-[1.35] tracking-tight">{entry.heading}</h2>
          <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <Suspense fallback={fallback}><AppCard entry={entry} searchParams={searchParams} /></Suspense>
          </div>
        </section>
      ))}

      <section aria-labelledby="web-heading" className="mt-8">
        <h2 id="web-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Web addresses</h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="flex items-center gap-2 font-medium"><Icon name="CircleCheck" className="text-success" />Works now. Nothing to set up.</p>
          <p className="mt-2 text-sm text-mute">A {"“"}Call a web address{"”"} step asks one https address for information (a read-only request) after you approve it on the Runs page. Private and internal addresses are refused. Never put a password or key in the address.</p>
        </div>
      </section>

      <section aria-labelledby="mcp-heading" className="mt-8">
        <h2 id="mcp-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">MCP servers</h2>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="flex items-center gap-2 font-medium"><Icon name="CircleCheck" className="text-success" />Works now. Nothing to set up.</p>
          <p className="mt-2 text-sm text-mute">MCP is a standard way for apps to offer tools to an AI. Drag the {"“"}MCP server{"”"} block into a workflow, paste the https address of a server that needs no login (for example <code className="rounded bg-sunken px-1 py-0.5 text-[13px]">https://mcp.deepwiki.com/mcp</code>), and after you approve it on the Runs page the AI may use that server{"’"}s read-only tools. Tools that could change or delete anything are never used.</p>
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

// Turns **bold** and `code` in a line of setup text (from lib/connectors/app-list.js) into real bold and code, and fills in the
// {callback}, {id} and {secret} placeholders. Text only: nothing in the list is ever treated as HTML.
function Rich({ text, entry }) {
  const filled = text
    .replaceAll("{callback}", `http://localhost:3100/api/connect/${entry.id}/callback`)
    .replaceAll("{id}", `${entry.envPrefix}_CLIENT_ID`)
    .replaceAll("{secret}", `${entry.envPrefix}_CLIENT_SECRET`);
  return filled.split(/(\*\*[^*]+\*\*|`[^`]+`)/).map((part, index) =>
    part.startsWith("**") ? <b key={index} className="font-medium text-ink">{part.slice(2, -2)}</b>
      : part.startsWith("`") ? <code key={index} className={code}>{part.slice(1, -1)}</code>
      : part,
  );
}

const Done = ({ yes }) => <Icon name={yes ? "CircleCheck" : "CircleAlert"} className={`mt-0.5 shrink-0 ${yes ? "text-success" : "text-mute"}`} />;

// One app's box (one entry of lib/connectors/app-list.js). It reads the session and the database, so it sits inside <Suspense>.
async function AppCard({ entry, searchParams }) {
  const app = entry.id;
  const user = await requireUser();
  const params = await searchParams;
  const status = (await connectorStatus(await createClient(), user.id))[app];
  const result = params[app];
  const note = typeof result === "string" && Object.hasOwn(RESULTS, result) ? RESULTS[result] : null;
  const ready = status.hasApp && status.hasKey && !status.tableMissing; // the one-time setup is done
  const name = entry.name;

  return (
    <div>
      {note && (
        <p role="status" className="mb-3 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm">
          <Icon name={note[0] === "ok" ? "CircleCheck" : "CircleAlert"} className={`mt-0.5 shrink-0 ${note[0] === "ok" ? "text-success" : "text-error"}`} />{note[1]}
        </p>
      )}

      {status.connected ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex min-w-0 flex-1 items-center gap-2 font-medium"><Icon name="CircleCheck" className="text-success" />Connected.</p>
          <DisconnectApp app={app} label={name} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p className="flex min-w-0 flex-1 items-center gap-2 font-medium">
            <Icon name={status.personalKey ? "CircleCheck" : "CircleAlert"} className={status.personalKey ? "text-success" : "text-mute"} />
            {status.personalKey ? "Working with the key in .env.local (this computer only)." : "Not connected yet."}
          </p>
          {/* A plain link on purpose: it must not be pre-loaded in the background, because opening it starts the sign-in. */}
          {ready && <a href={`/api/connect/${app}`} className={buttonLook}>Connect {name}</a>}
        </div>
      )}

      <p className="mt-3 text-sm text-mute">
        {entry.about}
      </p>

      {!ready && !status.connected && (
        <div className="mt-4 rounded-xl border border-line bg-raised p-3">
          <h3 className="text-sm font-medium">One-time setup (the owner does this once, then everybody just presses Connect)</h3>
          <ol className="mt-2 space-y-3 text-sm text-mute">
            <li className="flex gap-2"><Done yes={!status.tableMissing} /><span><b className="font-medium text-ink">1. A place to keep connections.</b> In Supabase open <b className="font-medium text-ink">SQL Editor</b>, paste everything from the file <code className={code}>supabase/connections.sql</code>, and press Run.{app !== "linear" && <> If the table already exists from an earlier app, paste <code className={code}>supabase/connections-any-app.sql</code> instead (a small change that lets the table hold more apps).</>}</span></li>
            <li className="flex gap-2"><Done yes={status.hasKey} /><span><b className="font-medium text-ink">2. A secret to lock the connections.</b> In the terminal run <code className={code}>npm run secret</code>, copy the line it prints (it starts with <code className={code}>CONNECTIONS_KEY=</code>) into <code className={code}>hushwork-app/.env.local</code>.</span></li>
            <li className="flex gap-2"><Done yes={status.hasApp} /><span>
              <b className="font-medium text-ink">3. Hushwork{"’"}s own app in {name}.</b> <Rich text={entry.setup.intro} entry={entry} />
              <ol className="mt-1 list-decimal space-y-1 pl-5">
                {entry.setup.steps.map((line) => <li key={line}><Rich text={line} entry={entry} /></li>)}
              </ol>
              {entry.setup.note && <span className="mt-1 block"><Rich text={entry.setup.note} entry={entry} /></span>}
            </span></li>
            <li className="flex gap-2"><Done yes={ready} /><span><b className="font-medium text-ink">4.</b> Stop the app and start it again with <code className={code}>npm run dev</code>. The Connect {name} button then appears here.</span></li>
          </ol>
        </div>
      )}
    </div>
  );
}
