import { TEMPLATES } from "@/lib/templates";
import { STEP_KINDS } from "@/lib/steps";
import { packOf, suggestedSchedule } from "@/lib/template-packs";
import { Suspense } from "react";
import TemplateLibrary from "@/components/app/TemplateLibrary";
import { Icon } from "@/components/icons";
import BundleCard from "@/components/app/BundleCard";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { connectionStates } from "@/lib/skills/connection-status";
import { BUNDLES, describeBundle } from "@/lib/skills/bundles";
import { enabledBundleIds, SKILLS_FAILED } from "@/lib/skills/enable";

export const metadata = { title: "Templates - Hushwork", robots: { index: false, follow: false } };

// Static page: no session, no database. Each template opens in the Builder (?template=<id>), where it becomes a new workflow that can be
// changed step by step. The library is split into packs (Everyday, Finance, Marketing, Coding, Design: lib/template-packs.js) and a template
// that says what it needs ("Works with ...") can really run once those apps are connected and you press Approve on the Runs page. A template
// can suggest a schedule; the real one is set on the home page.
export default function TemplatesPage() {
  const items = TEMPLATES.map((template) => ({
    id: template.id,
    icon: template.icon,
    title: template.title,
    body: template.body,
    needs: template.needs ?? "",
    pack: packOf(template),
    schedule: suggestedSchedule(template),
    kinds: [...new Set(template.steps.map((step) => STEP_KINDS[step.kind].label))],
    steps: template.steps.length,
  }));
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Templates</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Starting points for common weekly jobs, in packs for the kind of work you do. A template opens in the Builder, where you can change every step. The ones marked “Works with” can do real things after you connect those apps and press Approve on the Runs page. Some suggest a schedule you can set on the home page.</p>
      <TemplateLibrary items={items} />
      {/* Packs (they used to have their own Skills page): several ready-made workflows for one kind of work, saved with one click. */}
      <section id="packs" aria-labelledby="packs-heading" className="mt-14 scroll-mt-20">
        <h2 id="packs-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Packs</h2>
        <p className="mt-2 max-w-[62ch] text-[15px] text-mute">A pack saves several ready-made workflows for one kind of work in one click. Turning one on connects no app, makes no schedule and runs nothing. Steps that write still wait for your OK on the Runs page.</p>
        <Suspense fallback={<div aria-busy="true" className="mt-6"><p role="status" className="sr-only">Loading packs</p><div aria-hidden="true" className="grid gap-4 md:grid-cols-2">{[0, 1].map((row) => <div key={row} className="h-64 rounded-2xl border border-line bg-raised" />)}</div></div>}>
          <Bundles />
        </Suspense>
      </section>
    </main>
  );
}

async function Bundles() {
  const user = await requireUser();
  const supabase = await createClient();
  const [{ ids, missing, failed }, connected] = await Promise.all([enabledBundleIds(supabase, user.id), connectionStates(supabase, user.id)]);
  return (
    <>
      {missing && <p role="status" className="mt-6 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{SKILLS_FAILED.setup}</p>}
      {failed && <p role="alert" className="mt-6 flex items-start gap-2 rounded-xl bg-raised px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />Could not check which bundles are on. Try again in a minute.</p>}
      <ul className="mt-8 grid gap-4">
        {BUNDLES.map((bundle) => {
          const info = describeBundle(bundle);
          const states = Object.fromEntries(info.connections.map((connection) => [connection.id, connected[connection.id] ?? null]));
          return <BundleCard key={bundle.id} info={info} on={ids.has(bundle.id)} disabled={missing} states={states} />;
        })}
      </ul>
    </>
  );
}
