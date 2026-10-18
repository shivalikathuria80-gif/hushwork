import Link from "next/link";
import { Icon } from "@/components/icons";
import { TEMPLATES } from "@/lib/templates";
import { STEP_KINDS } from "@/lib/steps";

export const metadata = { title: "Templates - Hushwork", robots: { index: false, follow: false } };

// Static page: no session, no database. Each template opens in the Builder (?template=<id>), where it becomes a new
// workflow that can be changed step by step. Nothing in a template runs or connects to anything.
export default function TemplatesPage() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8 lg:px-12 lg:py-16">
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em] outline-offset-4">Templates</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] text-mute">Starting points for common weekly jobs. A template opens in the Builder, where you can change every step. Nothing in a template runs or connects to anything.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TEMPLATES.map((template) => {
          const kinds = [...new Set(template.steps.map((step) => STEP_KINDS[step.kind].label))];
          return (
            <li key={template.id}>
              <Link
                href={`/app/builder?template=${template.id}`}
                className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 text-ink shadow-sm transition-[background-color,border-color,box-shadow] duration-120 ease-standard hover:border-line-strong hover:shadow-md active:bg-raised"
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={template.icon} size={18} /></span>
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
