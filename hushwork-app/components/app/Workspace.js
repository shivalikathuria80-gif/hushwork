"use client";

import { createContext, useContext, useRef, useState } from "react";
import Link from "next/link";
import Composer from "./Composer";
import { Icon } from "../icons";
import { TEMPLATES } from "@/lib/templates";

// The interactive middle of /app: the request box, then a short row of templates that really work.
// It keeps one small piece of state, `seed` (what to put in the box), and hands it to the Composer.
// The saved drafts list (rendered on the server and passed in as `children`) can fill the box too, through useFillComposer().
const FillContext = createContext(() => {});
export const useFillComposer = () => useContext(FillContext);

// Only the templates that can really do something (they say what they need). The rest are on the Templates page.
const WORKING = TEMPLATES.filter((template) => template.needs);

// `ai` is { enabled, limit } from the server (AiWorkspace.js): is AI planning available, and how many AI plans a person gets a day.
// It never holds the key.
export default function Workspace({ children, ai }) {
  const [seed, setSeed] = useState(null);
  const composer = useRef(null); // gives us the composer's guard: "are there unsaved step edits? ask first"
  // Every call gets a higher id, so clicking the same draft twice still counts as a new request.
  // `draft` ({ id, name, version }) is set when a saved draft is opened, so the composer can change that draft in place.
  const fill = (text, plan, draft) => {
    const apply = () => setSeed((previous) => ({ id: (previous?.id ?? 0) + 1, text, plan, draft }));
    if (composer.current) composer.current.guard(apply);
    else apply();
  };

  return (
    <FillContext value={fill}>
      <Composer ref={composer} seed={seed} ai={ai} />

      <section aria-labelledby="working-heading" className="mt-10">
        <h2 id="working-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Or start from one that works</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {WORKING.map((template) => (
            <li key={template.id}>
              <Link
                href={`/app/builder?template=${template.id}`}
                className="flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-ink shadow-sm transition-[background-color,border-color,box-shadow] duration-120 ease-standard hover:border-line-strong hover:shadow-md active:bg-raised"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={template.icon} size={18} /></span>
                <span className="min-w-0">
                  <span className="block font-medium">{template.title}</span>
                  <span className="mt-1 block font-mono text-xs text-mute">{template.needs === "Nothing" ? "Works now" : `Works with ${template.needs}`}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm"><Link href="/app/templates" className="font-medium text-accent-text hover:underline">See all templates</Link></p>
      </section>

      {children}
    </FillContext>
  );
}
