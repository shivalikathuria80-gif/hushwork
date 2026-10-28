import Link from "next/link";
import { DOC_GROUPS } from "@/lib/docs/pages";
import { loadDoc } from "@/lib/docs/load";

export const metadata = { title: { absolute: "Hushwork docs: how to use Hushwork" } };

// The docs home: every page, grouped, with the one-sentence summary from the top of each file.
export default async function DocsHome() {
  const groups = await Promise.all(
    DOC_GROUPS.map(async (group) => ({ title: group.title, pages: await Promise.all(group.pages.map(async (page) => ({ ...page, summary: (await loadDoc(page.slug))?.summary ?? "" }))) })),
  );
  return (
    <div>
      <h1 tabIndex={-1} className="text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em]">Hushwork docs</h1>
      <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-mute">Everything about Hushwork in plain words: what it does, how to use each page, what each connection can and cannot do, and how it keeps you in control. New here? Start with <Link href="/docs/quick-start" className="font-medium text-accent-text hover:underline">Your first 5 minutes</Link>.</p>
      {groups.map((group) => (
        <section key={group.title} aria-label={group.title} className="mt-10">
          <h2 className="text-xl font-semibold tracking-tight">{group.title}</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {group.pages.map((page) => (
              <li key={page.slug}>
                <Link href={`/docs/${page.slug}`} className="block h-full rounded-2xl border border-line bg-surface p-4 shadow-sm transition-[background-color,border-color] duration-120 ease-standard hover:border-line-strong active:bg-raised">
                  <span className="block font-medium text-ink">{page.title}</span>
                  <span className="mt-1 block text-sm text-mute">{page.summary}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
