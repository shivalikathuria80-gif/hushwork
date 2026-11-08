"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Icon } from "../icons";
import { Spotlight } from "../ScrollFx";
import { Reveal, RevealItem } from "./RunMotion";
import { TEMPLATES } from "@/lib/templates";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";

// The middle of /app (Home). The request box that used to live here moved into the Builder as Hushwork AI, so Home shows a card that
// opens it, the chatbot plugin, a short row of templates that really work, then the saved workflows (rendered on the server and
// passed in as `children`). Anything that used to fill the box (the agent's "Do this", a draft) now opens the Builder instead,
// through useFillComposer(): a sentence goes to Hushwork AI (?ask=), a saved draft opens on the canvas (?draft=).
const FillContext = createContext(() => {});
export const useFillComposer = () => useContext(FillContext);

// Six templates that can really do something (they say what they need). The rest are on the Templates page.
const WORKING = TEMPLATES.filter((template) => template.needs).slice(0, 6);
const IDEAS = ["Every Friday, chase my unpaid Stripe invoices", "Every weekday, list today's meetings and email me", "Tell me which emails need a reply"];

// `ai` is { enabled } from the server (AiWorkspace.js): only whether Hushwork AI is on, never the key.
// `top` (optional) is shown first (the always-on agent). `plugin` (optional) is the chatbot plugin box.
export default function Workspace({ children, ai, top = null, plugin = null }) {
  const router = useRouter();
  const reduce = usePrefersReducedMotion();
  const fill = (text, plan, draft) => {
    if (draft?.id) router.push(`/app/builder?draft=${encodeURIComponent(draft.id)}`);
    else router.push(`/app/builder?ask=${encodeURIComponent(String(text ?? "").slice(0, 1000))}`);
  };

  return (
    <FillContext value={fill}>
      {top}
      <motion.div initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}>
        <Spotlight className="rounded-3xl">
          <Link id="task" href="/app/builder" className="hw-beam group relative block overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-6">
            <span className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent text-on-accent transition-transform duration-300 ease-standard group-hover:-rotate-6 group-hover:scale-110"><Icon name="Sparkles" size={22} weight="fill" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold tracking-[-0.01em]">Ask Hushwork AI in the Builder</span>
                <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-hint">
                  <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${ai?.enabled ? "hw-pulse-dot bg-success" : "bg-line-strong"}`} />Powered by Groq
                </span>
              </span>
              <Icon name="ArrowRight" size={20} className="shrink-0 text-mute transition-transform duration-200 group-hover:translate-x-1 group-hover:text-ink" />
            </span>
            <span className="mt-3 block text-[15px] text-mute">Say a chore in one sentence. It builds the workflow on the canvas, and anything that sends or creates waits for your OK.</span>
          </Link>
        </Spotlight>
        <ul className="mt-3 flex flex-wrap gap-2">
          {IDEAS.map((idea) => (
            <li key={idea}>
              <button type="button" onClick={() => fill(idea)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm transition-colors hover:border-accent hover:text-accent-text">{idea}</button>
            </li>
          ))}
        </ul>
      </motion.div>

      {plugin && <section aria-label="Chatbot plugin" className="mt-10">{plugin}</section>}

      <section aria-labelledby="working-heading" className="mt-10">
        <h2 id="working-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Or start from one that works</h2>
        <Reveal as="ul" className="mt-3 grid gap-3 sm:grid-cols-2">
          {WORKING.map((template) => (
            <RevealItem as="li" key={template.id} whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }}>
              <Spotlight className="h-full rounded-2xl">
              <Link
                href={`/app/builder?template=${template.id}`}
                className="flex h-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-ink shadow-sm transition-[background-color,border-color,box-shadow] duration-120 ease-standard hover:border-line-strong hover:shadow-md active:bg-raised"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-text transition-transform duration-200 ease-standard group-hover:-rotate-6 group-hover:scale-110"><Icon name={template.icon} size={18} /></span>
                <span className="min-w-0">
                  <span className="block font-medium">{template.title}</span>
                  <span className="mt-1 block font-mono text-xs text-mute">{template.needs === "Nothing" ? "Works now" : `Works with ${template.needs}`}</span>
                </span>
              </Link>
              </Spotlight>
            </RevealItem>
          ))}
        </Reveal>
        <p className="mt-3 text-sm"><Link href="/app/templates" className="font-medium text-accent-text hover:underline">See all templates</Link></p>
      </section>

      {children}
    </FillContext>
  );
}
