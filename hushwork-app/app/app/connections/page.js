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
import { GOOGLE_SOON, googleOpenFor } from "@/lib/connectors/google-gate";

export const metadata = { title: "Connections - Hushwork", robots: { index: false, follow: false } };

// Which logos stand for each connection: Google is four products behind one sign-in. Anything else uses its own id (lib/app-logos.js).
const LOGO_IDS = { google: ["calendar", "sheets", "gmail", "drive"] };

// The Composio apps that belong to Google (Gmail and every "google..." toolkit): they get their own Google Workspace box instead of sitting in More apps.
const isGoogle = (app) => app.toolkit === "gmail" || app.toolkit.startsWith("google");

// What the short message in the address means (the Connect button sends the person back with ?linear=... or ?google=...).
const RESULTS = {
  connected: ["ok", "Connected."],
  denied: ["problem", "You pressed Cancel, so nothing was connected."],
  expired: ["problem", "That took too long, or it came from another window. Press Connect again."],
  failed: ["problem", "The sign-in was not accepted. Press Connect again."],
  save: ["problem", "The app said yes, but saving it failed. Try again in a minute."],
  setup: ["problem", "That app is not available yet."],
  soon: ["problem", GOOGLE_SOON],
};

const buttonLook = "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-transparent bg-accent px-5 text-[15px] font-semibold text-on-accent transition-[background-color] duration-120 ease-standard hover:bg-accent-hover active:bg-accent-active md:h-9 md:text-sm";

export default function ConnectionsPage({ searchParams }) {
  const fallback = <span aria-hidden="true" className="block h-6 w-40 rounded-md bg-raised" />;
  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Connections</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Connect your apps so workflows can use them. Nothing runs until you approve it.</p>

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

      <section aria-labelledby="workspace-heading" className="mt-8">
        <div className="flex items-center gap-3">
          <AppLogos ids={COMPOSIO_APPS.filter(isGoogle).slice(0, 4).map((app) => app.id)} size={32} />
          <h2 id="workspace-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Google Workspace (through Composio)</h2>
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <Suspense fallback={fallback}><MoreApps searchParams={searchParams} group="google" /></Suspense>
        </div>
      </section>

      <section aria-labelledby="more-heading" className="mt-8">
        <div className="flex items-center gap-3">
          <AppLogos ids={COMPOSIO_APPS.slice(0, 6).map((app) => app.id)} size={32} />
          <h2 id="more-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">More apps (through Composio)</h2>
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <Suspense fallback={fallback}><MoreApps searchParams={searchParams} group="other" /></Suspense>
        </div>
      </section>

      <section aria-labelledby="web-heading" className="mt-8">
        <div className="flex items-center gap-3">
          <AppLogo id="web" label="Web addresses" />
          <h2 id="web-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Web addresses</h2>
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="flex items-center gap-2 font-medium"><Icon name="CircleCheck" className="text-success" />Works now. Nothing to set up.</p>
          <p className="mt-2 text-sm text-mute">Reads one https web page when you approve it.</p>
        </div>
      </section>

      <section aria-labelledby="mcp-heading" className="mt-8">
        <div className="flex items-center gap-3">
          <AppLogo id="mcp" label="MCP servers" />
          <h2 id="mcp-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">MCP servers</h2>
        </div>
        <div className="mt-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
          <p className="flex items-center gap-2 font-medium"><Icon name="CircleCheck" className="text-success" />Works now. Nothing to set up.</p>
          <p className="mt-2 text-sm text-mute">Lets the AI use read-only tools from an MCP server you add to a workflow.</p>
        </div>
      </section>

    </main>
  );
}

// What the short message in the address means after the Composio sign-in page sends the person back (?composio=...).
const COMPOSIO_RESULTS = {
  done: ["ok", "Back from the sign-in. If you finished it, the app now says Connected."],
  setup: ["problem", "More apps is not available yet."],
  failed: ["problem", "Composio could not start that sign-in. Try again in a minute."],
  unavailable: ["problem", "That app cannot be connected yet. Its box says why."],
  slow: ["problem", "You pressed Connect a lot. Wait a minute and try again."],
};

// "More apps": apps reached through Composio (composio.dev), which keeps each person's sign-in. It reads the session and asks
// Composio which apps this person connected, so it sits inside <Suspense>.
async function MoreApps({ searchParams, group }) {
  const user = await requireUser();
  const params = await searchParams;
  const result = params.composio;
  const note = typeof result === "string" && Object.hasOwn(COMPOSIO_RESULTS, result) ? COMPOSIO_RESULTS[result] : null;
  const key = getComposioKey();
  const listed = key ? await listConnected({ key, userId: user.id }) : null;
  const connected = new Set((listed?.accounts ?? []).map((account) => account.toolkit));
  const apps = COMPOSIO_APPS.filter((app) => !app.lookupOf && isGoogle(app) === (group === "google"));
  if (group === "google" && (!key || listed?.error)) {
    return <p role={key ? "alert" : undefined} className="text-sm text-mute">{key ? listed.error : "Not available yet."}</p>;
  }

  return (
    <div>
      {note && (
        <p role="status" className="mb-3 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm">
          <Icon name={note[0] === "ok" ? "CircleCheck" : "CircleAlert"} className={`mt-0.5 shrink-0 ${note[0] === "ok" ? "text-success" : "text-error"}`} />{note[1]}
        </p>
      )}
      <p className="text-sm text-mute">{group === "google" ? "Send email, add events, and create Sheets, Docs, Slides and Drive folders when you approve it." : "Reads from your apps, and acts only when you approve it."}</p>

      {!key ? (
        <p className="mt-4 text-sm text-mute">Not available yet.</p>
      ) : listed?.error ? (
        <p role="alert" className="mt-4 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{listed.error}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {apps.map((app) => (
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

// One app's box (one entry of lib/connectors/app-list.js). It reads the session and the database, so it sits inside <Suspense>.
async function AppCard({ entry, searchParams }) {
  const app = entry.id;
  const user = await requireUser();
  const params = await searchParams;
  const status = (await connectorStatus(await createClient(), user.id))[app];
  const result = params[app];
  const note = typeof result === "string" && Object.hasOwn(RESULTS, result) ? RESULTS[result] : null;
  const soon = app === "google" && !googleOpenFor(user.id); // paused for this account until Google approves Hushwork (lib/connectors/google-gate.js)
  const ready = status.hasApp && status.hasKey && !status.tableMissing && !soon; // the one-time setup is done
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
            <Icon name={status.personalKey ? "CircleCheck" : soon ? "Clock" : "CircleAlert"} className={status.personalKey ? "text-success" : "text-mute"} />
            {status.personalKey ? "Working with the key in .env.local (this computer only)." : soon ? "Coming soon." : ready ? "Not connected yet." : "Not available yet."}
          </p>
          {/* A plain link on purpose: it must not be pre-loaded in the background, because opening it starts the sign-in. */}
          {ready && <a href={`/api/connect/${app}`} className={buttonLook}>Connect {name}</a>}
        </div>
      )}

      <p className="mt-3 text-sm text-mute">{entry.about}</p>
    </div>
  );
}
