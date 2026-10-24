import { TEMPLATES } from "@/lib/templates";
import { STEP_KINDS } from "@/lib/steps";
import { packOf, suggestedSchedule } from "@/lib/template-packs";
import TemplateLibrary from "@/components/app/TemplateLibrary";

export const metadata = { title: "Templates - Hushwork", robots: { index: false, follow: false } };

// Static page: no session, no database. Each template opens in the Builder (?template=<id>), where it becomes a new workflow that can be
// changed step by step. The library is split into packs (Everyday, Finance, Marketing, Coding, Design: lib/template-packs.js) and a template
// that says what it needs ("Works with ...") can really run once those apps are connected and you press Approve on the Runs page. A template
// can suggest a schedule; the real one is set on the Workflows page.
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
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Starting points for common weekly jobs, in packs for the kind of work you do. A template opens in the Builder, where you can change every step. The ones marked “Works with” can do real things after you connect those apps and press Approve on the Runs page. Some suggest a schedule you can set on the Workflows page.</p>
      <TemplateLibrary items={items} />
    </main>
  );
}
