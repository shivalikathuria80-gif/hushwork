import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import Markdown from "@/components/docs/Markdown";
import { DOC_PAGES, neighbours } from "@/lib/docs/pages";
import { loadDoc } from "@/lib/docs/load";
import { outline } from "@/lib/docs/markdown";

// One docs page per entry in lib/docs/pages.js. Built ahead of time; an address that is not in the list is a plain "not found".
export const generateStaticParams = () => DOC_PAGES.map((page) => ({ slug: page.slug }));

export async function generateMetadata({ params }) {
  const doc = await loadDoc((await params).slug);
  return doc ? { title: doc.title, description: doc.summary } : {};
}

// The page address (params) is read inside <Suspense>, so the frame shows at once while the page streams in.
export default function DocPage({ params }) {
  return <Suspense fallback={<div aria-busy="true" className="h-96" />}><DocContent params={params} /></Suspense>;
}

async function DocContent({ params }) {
  const { slug } = await params;
  const doc = await loadDoc(slug);
  if (!doc) notFound();
  const { previous, next } = neighbours(slug);
  const sections = outline(doc.blocks);

  return (
    <article>
      <p className="text-sm text-mute">{doc.group}</p>
      <h1 tabIndex={-1} className="mt-1 text-[length:clamp(1.75rem,2.6vw,2.25rem)] font-bold leading-[1.15] tracking-[-0.01em]">{doc.title}</h1>
      {sections.length >= 3 && (
        <nav aria-label="On this page" className="mt-4 rounded-xl border border-line bg-surface p-3 text-sm">
          <p className="font-medium">On this page</p>
          <ul className="mt-1 flex flex-wrap gap-x-4">
            {sections.map((section) => <li key={section.id}><a href={`#${section.id}`} className="inline-flex min-h-9 items-center text-accent-text hover:underline">{section.text}</a></li>)}
          </ul>
        </nav>
      )}
      <Markdown blocks={doc.blocks} />
      <nav aria-label="Previous and next page" className="mt-12 grid gap-3 border-t border-line pt-6 sm:grid-cols-2">
        {previous ? (
          <Link href={`/docs/${previous.slug}`} className="flex min-h-11 items-center gap-2 rounded-xl border border-line p-3 text-sm hover:border-line-strong"><Icon name="ArrowLeft" size={16} /><span><span className="block text-xs text-mute">Previous</span>{previous.title}</span></Link>
        ) : <span />}
        {next && (
          <Link href={`/docs/${next.slug}`} className="flex min-h-11 items-center justify-end gap-2 rounded-xl border border-line p-3 text-right text-sm hover:border-line-strong sm:col-start-2"><span><span className="block text-xs text-mute">Next</span>{next.title}</span><Icon name="ArrowRight" size={16} /></Link>
        )}
      </nav>
    </article>
  );
}
