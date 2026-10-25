import { Suspense } from "react";
import { Icon } from "@/components/icons";
import BundleCard from "@/components/app/BundleCard";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { connectorStatus } from "@/lib/connector-status";
import { getComposioKey } from "@/lib/connectors/composio-env";
import { listConnected } from "@/lib/connectors/composio";
import { COMPOSIO_APPS } from "@/lib/connectors/composio-apps";
import { BUNDLES, describeBundle } from "@/lib/skills/bundles";
import { enabledBundleIds, SKILLS_FAILED } from "@/lib/skills/enable";

export const metadata = { title: "Skills - Hushwork", robots: { index: false, follow: false } };

// Skill Bundles (plugins). A skill is one small capability; a bundle is a package of skills for one kind of work, with the apps it needs and a few ready-made
// workflows. The page shell is built ahead of time; what is turned on and which apps are connected need a real request, so the list sits in <Suspense>.
export default function SkillsPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Skills</h1>
      <p className="mt-3 max-w-[62ch] text-[15px] text-mute">A skill is one small thing Hushwork can do, like “Find unpaid payments”. A bundle is a package of skills for one kind of work, with ready-made workflows. Read what each skill can read and write, then turn a bundle on with one click: its workflows are saved to your list.</p>
      <div className="mt-5 max-w-[62ch] rounded-2xl border border-line-strong bg-raised p-4 text-sm">
        <p className="flex items-center gap-2 font-semibold"><Icon name="ShieldCheck" size={18} className="text-accent-text" />The safety rules do not change</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-mute">
          <li><b className="font-medium text-ink">Reading</b> skills only look. They cannot change anything.</li>
          <li><b className="font-medium text-ink">Writing</b> skills (send an email, add a task) still wait for your <b className="font-medium text-ink">Approve</b> click on the Runs page. Only Auto mode, or a schedule where you tick “Let it write by itself”, approves ahead of time, and that is your choice.</li>
          <li>Turning a bundle on connects no app, makes no schedule and runs nothing. If a run stops half way, “Continue from where it stopped” never repeats a step that is done.</li>
        </ul>
      </div>
      <Suspense fallback={<div aria-busy="true" className="mt-8"><p role="status" className="sr-only">Loading bundles</p><div aria-hidden="true" className="grid gap-4 md:grid-cols-2">{[0, 1, 2].map((row) => <div key={row} className="h-64 rounded-2xl border border-line bg-raised" />)}</div></div>}>
        <Bundles />
      </Suspense>
    </main>
  );
}

// Which apps are connected: yes, no, or null when that cannot be checked (for example Composio is not set up on this server).
async function connectionChecker(supabase, user) {
  const own = await connectorStatus(supabase, user.id);
  const key = getComposioKey();
  const listed = key ? await listConnected({ key, userId: user.id }) : null;
  const toolkits = listed && !listed.error ? new Set(listed.accounts.map((account) => account.toolkit)) : null;
  return (connection) => {
    if (connection.own) return Boolean(own[connection.id]?.usable);
    const app = COMPOSIO_APPS.find((one) => one.id === connection.id);
    return app && toolkits ? toolkits.has(app.toolkit) : null;
  };
}

async function Bundles() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ ids, missing, failed }, isConnected] = await Promise.all([enabledBundleIds(supabase, user.id), connectionChecker(supabase, user)]);
  return (
    <>
      {missing && <p role="status" className="mt-6 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{SKILLS_FAILED.setup}</p>}
      {failed && <p role="alert" className="mt-6 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />Could not check which bundles are on. Try again in a minute.</p>}
      <ul className="mt-8 grid gap-4">
        {BUNDLES.map((bundle) => {
          const info = describeBundle(bundle);
          const states = Object.fromEntries(info.connections.map((connection) => [connection.id, connection.unavailable ? "unavailable" : isConnected(connection)]));
          return <BundleCard key={bundle.id} info={info} on={ids.has(bundle.id)} disabled={missing} states={states} />;
        })}
      </ul>
    </>
  );
}
