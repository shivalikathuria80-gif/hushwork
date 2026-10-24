"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "../icons";
import { PACKS } from "@/lib/template-packs";

// The template cards with a row of pack buttons (Everyday, Finance, Marketing, Coding, Design) above them. The pack you pick is remembered in
// this browser, so the library opens on your kind of work next time. `items` come from the Templates page, already turned into plain data.
const KEY = "hw-template-pack";
const choices = ["all", ...PACKS.map((pack) => pack.id)];

export default function TemplateLibrary({ items }) {
  const [pack, setPack] = useState("all");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved && choices.includes(saved)) setPack(saved); // eslint-disable-line react-hooks/set-state-in-effect -- reading the saved choice after the page loads
    } catch {
      // private window or blocked storage: the library simply opens on All
    }
  }, []);

  function choose(next) {
    setPack(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // not remembered, still works
    }
  }

  const shown = pack === "all" ? items : items.filter((item) => item.pack === pack);
  const count = (id) => (id === "all" ? items.length : items.filter((item) => item.pack === id).length);
  const current = PACKS.find((one) => one.id === pack);

  return (
    <>
      <div role="group" aria-label="Template packs" className="mt-6 flex flex-wrap gap-2">
        {[{ id: "all", label: "All", icon: "Folder" }, ...PACKS].map((one) => (
          <button
            key={one.id} type="button" aria-pressed={pack === one.id} onClick={() => choose(one.id)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors duration-120 ease-standard ${pack === one.id ? "border-ink bg-ink text-bg" : "border-field bg-surface text-ink hover:bg-raised"}`}
          >
            <Icon name={one.icon} size={16} />{one.label}<span className={pack === one.id ? "text-bg/70" : "text-mute"}>{count(one.id)}</span>
          </button>
        ))}
      </div>
      {current && <p className="mt-3 text-sm text-mute">{current.blurb}</p>}

      {shown.length === 0 ? (
        <p className="mt-8 text-[15px] text-mute">No templates in this pack yet.</p>
      ) : (
        <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((template) => (
            <li key={template.id}>
              <Link
                href={`/app/builder?template=${template.id}`}
                className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 text-ink shadow-sm transition-[background-color,border-color,box-shadow] duration-120 ease-standard hover:border-line-strong hover:shadow-md"
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={template.icon} size={18} /></span>
                  {template.needs && (
                    <span className="rounded-md border border-line-strong bg-surface px-2 text-right text-xs font-medium text-ink">
                      {template.needs === "Nothing" ? "Works now" : `Works with ${template.needs}`}
                    </span>
                  )}
                </span>
                <span className="mt-3 block font-medium">{template.title}</span>
                <span className="mt-1 block text-sm text-mute">{template.body}</span>
                {template.schedule && (
                  <span className="mt-3 flex items-start gap-1.5 text-sm"><Icon name="Clock" size={16} className="mt-0.5 shrink-0 text-mute" /><span><span className="font-medium">Suggested schedule:</span> {template.schedule}. Set it on the Workflows page after you save.</span></span>
                )}
                <span className="mt-3 flex flex-wrap gap-1.5" aria-label="Kinds of step">
                  {template.kinds.map((label) => <span key={label} className="rounded-md border border-line bg-raised px-2 text-xs">{label}</span>)}
                </span>
                <span className="mt-auto flex items-end justify-between gap-3 pt-3">
                  <span className="font-mono text-xs text-mute">{template.steps} steps</span>
                  <span className="flex items-center gap-1 text-sm font-medium text-accent-text">Open in the Builder<Icon name="ArrowRight" size={16} /></span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
