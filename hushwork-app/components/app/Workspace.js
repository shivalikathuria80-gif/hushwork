"use client";

import { createContext, useContext, useRef, useState } from "react";
import Composer from "./Composer";
import { Icon } from "../icons";

// The interactive middle of /app: the request box plus the cards and recipe tiles that fill it.
// It keeps one small piece of state, `seed` (what to put in the box), and hands it to the Composer.
// The saved drafts list (rendered on the server and passed in as `children`) can fill the box too, through useFillComposer().
const FillContext = createContext(() => {});
export const useFillComposer = () => useContext(FillContext);

// Cards teach how to phrase a request: each one starts a sentence.
const STARTERS = [
  ["Clock", "On a schedule", "Every day, week or month.", "Every weekday at 9am, "],
  ["Mail", "When something arrives", "A new email, lead or payment.", "When a new email arrives, "],
  ["Zap", "When I ask", "You press the button when you want it done.", "Whenever I ask, "],
];

// Recipes are ready-made jobs. `meta` names tools the preview plan would use; nothing is connected to them.
const RECIPES = [
  { icon: "Receipt", title: "Chase unpaid invoices", body: "Spot invoices more than 7 days late and draft a polite reminder for each client.", meta: "In the plan: Stripe, Gmail", large: true,
    text: "Every weekday at 9am, find invoices more than 7 days overdue and draft a polite reminder for each client. Ask me before anything is sent." },
  { icon: "FileBarChart", title: "Send a weekly client report", body: "Gather what you finished this week and write a short summary for each client to check.", meta: "In the plan: Linear", large: true,
    text: "Every Friday at 4pm, summarise what I finished this week for each client and draft an email with the summary. Ask me before anything is sent." },
  { icon: "Inbox", title: "Sort your inbox", body: "File newsletters, star client mail and get one digest.",
    text: "Every morning at 8am, file newsletters into Reading, star emails from clients and send me one short digest." },
  { icon: "UserPlus", title: "Follow up new leads", body: "Reply to each new enquiry and remind you to chase it.",
    text: "When a new lead fills in my contact form, thank them within an hour and remind me to follow up after 3 days." },
  { icon: "FolderOpen", title: "Keep admin tidy", body: "Gather receipts and contracts and add deadlines to your calendar.",
    text: "Every month, gather my receipts and contracts into one folder and add upcoming deadlines to my calendar." },
];

// `ai` is { enabled, limit } from the server (AiWorkspace.js): is AI planning available, and how many AI plans a person gets a day.
// It never holds the key.
export default function Workspace({ children, ai }) {
  const [seed, setSeed] = useState(null);
  const composer = useRef(null); // gives us the composer's guard: "are there unsaved step edits? ask first"
  // Every call gets a higher id, so clicking the same tile twice still counts as a new request.
  // `draft` ({ id, name, version }) is set when a saved draft is opened, so the composer can change that draft in place.
  const fill = (text, plan, draft) => {
    const apply = () => setSeed((previous) => ({ id: (previous?.id ?? 0) + 1, text, plan, draft }));
    if (composer.current) composer.current.guard(apply);
    else apply();
  };

  return (
    <FillContext value={fill}>
      <Composer ref={composer} seed={seed} ai={ai} />

      <section aria-labelledby="when-heading" className="mt-10">
        <h2 id="when-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">When should it happen?</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {STARTERS.map(([icon, title, line, start]) => (
            <li key={title}>
              <button
                type="button" onClick={() => fill(start)}
                className="flex h-full w-full items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left shadow-sm transition-[background-color,border-color,box-shadow] duration-120 ease-standard hover:border-line-strong hover:shadow-md active:bg-raised sm:flex-col"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={icon} size={18} /></span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="mt-1 block text-sm text-mute">{line}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="recipes-heading" className="mt-10">
        <h2 id="recipes-heading" className="text-xl font-semibold leading-[1.35] tracking-tight">Recipes</h2>
        <p className="mt-1 text-[15px] text-mute">Common weekly jobs. Pick one to fill the box, change the words, then preview the plan.</p>
        <ul className="mt-3 grid gap-3 md:grid-cols-6">
          {RECIPES.map((recipe) => (
            <li key={recipe.title} className={recipe.large ? "md:col-span-3" : "md:col-span-2"}>
              <button
                type="button" onClick={() => fill(recipe.text)}
                className={`flex h-full w-full flex-col rounded-2xl border border-line bg-surface p-4 text-left shadow-sm transition-[background-color,border-color,box-shadow] duration-120 ease-standard hover:border-line-strong hover:shadow-md active:bg-raised ${recipe.large ? "min-h-44" : "min-h-30"}`}
              >
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={recipe.icon} size={18} /></span>
                <span className="mt-3 block font-medium">{recipe.title}</span>
                <span className="mt-1 block text-sm text-mute">{recipe.body}</span>
                <span className="mt-auto flex items-end justify-between gap-3 pt-3">
                  <span className="font-mono text-xs text-mute">{recipe.meta}</span>
                  <Icon name="ArrowRight" size={18} className="ml-auto shrink-0 text-mute" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {children}
    </FillContext>
  );
}
