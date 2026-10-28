"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_GROUPS } from "@/lib/docs/pages";

// The side menu of the docs: every page, grouped. On a phone it folds into a "Menu" button (a plain <details>, no JavaScript needed to open it).
export default function DocsNav() {
  const pathname = usePathname();
  const links = (
    <nav aria-label="Docs pages" className="space-y-5">
      {DOC_GROUPS.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-mute">{group.title}</p>
          <ul className="mt-1">
            {group.pages.map((page) => {
              const active = pathname === `/docs/${page.slug}`;
              return (
                <li key={page.slug}>
                  <Link
                    href={`/docs/${page.slug}`} aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center rounded-xl px-3 text-sm transition-colors duration-120 ease-standard md:min-h-9 ${active ? "bg-accent-subtle font-medium text-accent-text" : "text-mute hover:bg-raised hover:text-ink"}`}
                  >{page.title}</Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
  return (
    <>
      <details className="rounded-xl border border-line bg-surface lg:hidden">
        <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-medium">Menu: all docs pages</summary>
        <div className="border-t border-line p-2">{links}</div>
      </details>
      <div className="sticky top-16 hidden max-h-[calc(100dvh-5rem)] overflow-y-auto pb-8 lg:block">{links}</div>
    </>
  );
}
