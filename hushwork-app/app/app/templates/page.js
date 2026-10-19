import Link from "next/link";
import { Icon } from "@/components/icons";
import { TEMPLATES } from "@/lib/templates";
import { STEP_KINDS } from "@/lib/steps";

export const metadata = { title: "Templates - Hushwork", robots: { index: false, follow: false } };

// Static page: no session, no database. Each template opens in the Builder (?template=<id>), where it becomes a new
// workflow that can be changed step by step. A template that says what it needs (Linear, Google) can really run once that
// app is connected and you press Approve on the Runs page; the others only describe a plan.
export default function TemplatesPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Templates</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Starting points for common weekly jobs. A template opens in the Builder, where you can change every step. The ones marked “Works” can do real things after you connect the app and press Approve; the others only describe a plan.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template) => {
          const kinds = [...new Set(template.steps.map((step) => STEP_KINDS[step.kind].label))];
          return (
            <li key={template.id}>
              <Link
                href={`/app/builder?template=${template.id}`}
                className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 text-ink shadow-sm transition-[background-color,border-color,box-shadow] duration-120 ease-standard hover:border-line-strong hover:shadow-md active:bg-raised"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={template.icon} size={18} /></span>
                  {template.needs && (
                    <span className="rounded-md border border-line-strong bg-surface px-2 text-xs font-medium text-ink">
                      {template.needs === "Nothing" ? "Works now" : `Works with ${template.needs}`}
                    </span>
                  )}
                </span>
                <span className="mt-3 block font-medium">{template.title}</span>
                <span className="mt-1 block text-sm text-mute">{template.body}</span>
                <span className="mt-3 flex flex-wrap gap-1.5" aria-label="Kinds of step">
                  {kinds.map((label) => <span key={label} className="rounded-md border border-line bg-raised px-2 text-xs">{label}</span>)}
                </span>
                <span className="mt-auto flex items-end justify-between gap-3 pt-3">
                  <span className="font-mono text-xs text-mute">{template.steps.length} steps</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-accent-text">Open in the Builder<Icon name="ArrowRight" size={16} /></span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
