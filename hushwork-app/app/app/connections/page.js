import { Suspense } from "react";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { connectorStatus } from "@/lib/connector-status";
import { APP_LIST } from "@/lib/connectors/app-list";
import { COMPOSIO_APPS } from "@/lib/connectors/composio-apps";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { listConnected } from "@/lib/connectors/composio";
import DisconnectApp from "@/components/app/DisconnectApp";
import AppLogo, { AppLogos } from "@/components/AppLogo";

export const metadata = { title: "Connections - Hushwork", robots: { index: false, follow: false } };

// The apps a workflow can act in. Web addresses, Linear and Google Calendar work now. The others are planned and say so:
// there are no Connect buttons that would not work.
const APPS = [
  { name: "Slack", logo: "slack", does: "Post a message to a channel." },
  { name: "Gmail (sending)", logo: "gmail", does: "Send email. Reading your inbox already works with Google above." },
];

// Which logos stand for each connection: Google is four products behind one sign-in. Anything else uses its own id (lib/app-logos.js).
const LOGO_IDS = { google: ["calendar", "sheets", "gmail", "drive"] };

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
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Connections let a workflow act in your other apps. Web addresses, Linear (reading your tasks and adding a new one), Google Calendar, Google Sheets, reading your Gmail inbox, seeing your recent Drive files and a few more apps through Composio work, and only after you approve them on the Runs page. The rest are planned.</p>

      {APP_LIST.map((entry) => (
        <section key={entry.id} aria-labelledby={`${entry.id}-heading`} className="mt-8">
          <div className="flex items-center gap-3">
            <AppLogos ids={LOGO_IDS[entry.id] ?? [entry.id]} />
            <h2 id={`${entry.id}-heading`} className="text-xl font-semibold leading-[1.35] tracking-tight">{entry.heading}</h2>
          </div>
          <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <Suspense fallback={fallback}><AppCard entry={entry} searchParams={searchParams} /></Suspense>
          </div>
        </section>
      ))}

      <section aria-labelledby="more-heading" className="mt-8">
        <div className="flex items-center gap-3">
          <AppLogos ids={COMPOSIO_APPS.slice(0, 6).map((app) => app.id)} size={32} />
          <h2 id="more-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">More apps (through Composio)</h2>
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <Suspense fallback={fallback}><MoreApps searchParams={searchParams} /></Suspense>
        </div>
      </section>

      <section aria-labelledby="web-heading" className="mt-8">
        <div className="flex items-center gap-3">
          <AppLogo id="web" label="Web addresses" />
          <h2 id="web-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Web addresses</h2>
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="flex items-center gap-2 font-medium"><Icon name="CircleCheck" className="text-success" />Works now. Nothing to set up.</p>
          <p className="mt-2 text-sm text-mute">A {"“"}Call a web address{"”"} step asks one https address for information (a read-only request) after you approve it on the Runs page. Private and internal addresses are refused. Never put a password or key in the address.</p>
        </div>
      </section>

      <section aria-labelledby="mcp-heading" className="mt-8">
        <div className="flex items-center gap-3">
          <AppLogo id="mcp" label="MCP servers" />
          <h2 id="mcp-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">MCP servers</h2>
        </div>
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
              <AppLogo id={app.logo} label={app.name} size={36} />
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

// What the short message in the address means after the Composio sign-in page sends the person back (?composio=...).
const COMPOSIO_RESULTS = {
  done: ["ok", "Back from the sign-in. If you finished it, the app now says Connected."],
  setup: ["problem", "More apps is not switched on yet. See the steps below."],
  failed: ["problem", "Composio could not start that sign-in. Try again in a minute."],
  unavailable: ["problem", "That app cannot be connected yet. Its box says why."],
  slow: ["problem", "You pressed Connect a lot. Wait a minute and try again."],
};

// "More apps": apps reached through Composio (composio.dev), which keeps each person's sign-in. It reads the session and asks
// Composio which apps this person connected, so it sits inside <Suspense>.
async function MoreApps({ searchParams }) {
  const user = await requireUser();
  const params = await searchParams;
  const result = params.composio;
  const note = typeof result === "string" && Object.hasOwn(COMPOSIO_RESULTS, result) ? COMPOSIO_RESULTS[result] : null;
  const key = getComposioKey();
  const listed = key ? await listConnected({ key, userId: user.id }) : null;
  const connected = new Set((listed?.accounts ?? []).map((account) => account.toolkit));

  return (
    <div>
      {note && (
        <p role="status" className="mb-3 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm">
          <Icon name={note[0] === "ok" ? "CircleCheck" : "CircleAlert"} className={`mt-0.5 shrink-0 ${note[0] === "ok" ? "text-success" : "text-error"}`} />{note[1]}
        </p>
      )}
      <p className="text-sm text-mute">Composio is a company that already holds the sign-in for many apps, so you do not have to make an app for each one. When you press Connect, you sign in on Composio{"’"}s page and Composio keeps the permission. Hushwork can only <b className="font-medium text-ink">read</b> one fixed thing from each app, plus one fixed action in Gmail (send an email, through the Gmail (send) connection), Slack (send a message), GitHub (create an issue) and Todoist (add a task), and the action happens only when a step says so and you approve it. It also asks Composio to refuse everything else, and what it reads or sends passes through Composio. You can press Disconnect any time.</p>

      {!key ? (
        <div className="mt-4 rounded-xl border border-line bg-raised p-3">
          <h3 className="text-sm font-medium">One-time setup (the owner does this once)</h3>
          <ol className="mt-2 space-y-2 text-sm text-mute">
            <li className="flex gap-2"><Done yes={false} /><span><b className="font-medium text-ink">1.</b> Make a free account at <code className={code}>composio.dev</code> (the free plan has 100,000 uses a month).</span></li>
            <li className="flex gap-2"><Done yes={false} /><span><b className="font-medium text-ink">2.</b> In Composio open <b className="font-medium text-ink">Settings</b>, then <b className="font-medium text-ink">Project Settings</b>, then <b className="font-medium text-ink">API Keys</b>, and copy the <b className="font-medium text-ink">Project API key</b> (it starts with <code className={code}>ak_</code>). It is private.</span></li>
            <li className="flex gap-2"><Done yes={false} /><span><b className="font-medium text-ink">3.</b> Put it in <code className={code}>hushwork-app/.env.local</code> as <code className={code}>COMPOSIO_API_KEY=...</code>, then stop the app and start it again with <code className={code}>npm run dev</code>.</span></li>
          </ol>
        </div>
      ) : listed?.error ? (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{listed.error}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {COMPOSIO_APPS.map((app) => (
            <li key={app.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-3">
                <AppLogo id={app.id} label={app.name} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{app.name}</p>
                  <p className="text-sm text-mute">{app.unavailable ?? app.about}</p>
                </div>
                {app.unavailable ? (
                  <p className="max-w-[28ch] text-sm text-mute">Not available yet</p>
                ) : connected.has(app.toolkit) ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="flex items-center gap-2 text-sm font-medium"><Icon name="CircleCheck" className="text-success" />Connected</p>
                    <DisconnectApp app={app.id} label={app.name} through="composio" />
                  </div>
                ) : (
                  /* A plain link on purpose: it must not be pre-loaded in the background, because opening it starts the sign-in. */
                  <a href={`/api/composio/${app.id}`} className={buttonLook}>Connect {app.name}</a>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
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
