"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { motion } from "motion/react";
import { Icon } from "../icons";
import { EASE } from "../ui";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { decideFromLink } from "@/lib/actions/approve-link";

// The page behind a notification's "review and approve" link. One idea, drawn: three stations on a hairline, "We told you" -> "You read it" ->
// "You decide". The signal stands at the second station while the person reads, and only moves on when they press a button. The words are
// the hero of the page, in a sunken frame, exactly as they will be sent. Shapes from the owner's design system (hairlines, large tight
// headings, mono labels, pill buttons, 28px frames) in Hushwork's own colours.

const pill = "inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 text-[15px] font-semibold transition-colors duration-120 ease-standard disabled:pointer-events-none disabled:opacity-50";
const label = "font-mono text-[11px] font-medium uppercase tracking-[0.08em]";
const frame = "rounded-[28px] border border-line bg-surface";
const STATIONS = [
  { icon: "Bell", title: "We told you" },
  { icon: "Eye", title: "You read it" },
  { icon: "ShieldCheck", title: "You decide" },
];

let cached = null;
const subscribe = (notify) => { const tick = () => { cached = Date.now(); notify(); }; tick(); const id = setInterval(tick, 60_000); return () => clearInterval(id); };
const useNow = () => useSyncExternalStore(subscribe, () => cached, () => null);
const left = (until, now) => {
  const ms = Date.parse(until) - (now ?? 0);
  if (now === null || !Number.isFinite(ms)) return "";
  const hours = Math.floor(ms / 3_600_000);
  return hours >= 1 ? `${hours} h left` : `${Math.max(1, Math.round(ms / 60_000))} min left`;
};

function Signal({ at }) {
  const still = usePrefersReducedMotion();
  return (
    <ol aria-label="Where this step is" className="relative grid grid-cols-3">
      <span aria-hidden="true" className="absolute left-[16.6%] right-[16.6%] top-5 h-px bg-line-strong" />
      <motion.span aria-hidden="true" className="absolute left-[16.6%] top-5 h-px origin-left bg-accent" style={{ width: "66.8%" }} initial={false} animate={{ scaleX: at <= 0 ? 0 : at === 1 ? 0.5 : 1 }} transition={still ? { duration: 0 } : { duration: 0.7, ease: EASE }} />
      {STATIONS.map((station, index) => {
        const reached = index <= at;
        return (
          <li key={station.title} className="relative flex flex-col items-center gap-2 text-center" aria-current={index === at ? "step" : undefined}>
            <motion.span className={`grid size-10 place-items-center rounded-full border ${reached ? "border-accent bg-accent text-on-accent" : "border-line-strong bg-surface text-mute"}`} initial={false} animate={still || index !== at ? { scale: 1 } : { scale: [1, 1.12, 1] }} transition={{ duration: 0.6, ease: EASE }}>
              <Icon name={index < at ? "Check" : station.icon} size={18} />
            </motion.span>
            <span className={`${label} ${reached ? "text-ink" : "text-mute"}`}>{station.title}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Problem({ shown }) {
  const used = shown.problem === "used";
  return (
    <section className={`${frame} mx-auto max-w-xl p-6 sm:p-8`} aria-labelledby="problem-heading">
      <p className={`${label} text-mute`}>Hushwork · review link</p>
      <h1 id="problem-heading" className="mt-3 text-[length:clamp(1.75rem,5vw,2.5rem)] font-semibold leading-[1.08] tracking-[-0.03em]">
        {used ? (shown.usedAs === "turned_down" ? "Already turned down." : "Already decided.") : shown.problem === "done" ? "Nothing waits here now." : shown.problem === "expired" ? "This link has expired." : "This link does not work."}
      </h1>
      <p className="mt-3 text-[15px] text-mute">{shown.words}</p>
      <a href="/app/runs" className={`${pill} mt-6 border border-line-strong bg-surface text-ink hover:bg-raised`}>Open Runs<Icon name="ArrowRight" size={16} /></a>
    </section>
  );
}

export default function ApproveCard({ code, shown }) {
  const now = useNow();
  const [words, setWords] = useState(shown.view?.words ?? "");
  const [changed, setChanged] = useState(Boolean(shown.view?.changed));
  const [outcome, setOutcome] = useState(null); // { tone: "good" | "bad", words, decision? }
  const [pending, start] = useTransition();
  const [choice, setChoice] = useState(null);
  // Kept from the first render: a decision refreshes this page from the server, which then (rightly) says the link is used. The person should
  // still see what they just did, not "already decided".
  const [view] = useState(shown.view ?? null);
  if (!view) return <Problem shown={shown} />;
  const decided = outcome?.tone === "good";

  const decide = (decision) => {
    setChoice(decision);
    start(async () => {
      const result = await decideFromLink({ code, decision, seen: decision === "approve" ? words : undefined });
      if (result?.ok) {
        setOutcome({ tone: "good", decision, words: decision === "approve" ? (result.result ? `Done. ${result.result}` : "Done. Hushwork did this step.") : "Turned down. Nothing was sent." });
        return;
      }
      if (result?.changed && typeof result.wordsNow === "string") { setWords(result.wordsNow); setChanged(true); }
      setOutcome({ tone: "bad", words: result?.error ?? "Something went wrong. Nothing was approved." });
    });
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <header>
        <p className={`${label} text-mute`}>Waiting for your OK · {view.workflow}</p>
        <h1 className="mt-3 text-[length:clamp(2rem,6vw,3.25rem)] font-semibold leading-[1.04] tracking-[-0.035em]">
          {decided ? (outcome.decision === "approve" ? <>Approved. <span className="text-accent-text">Done.</span></> : <>Turned down.</>) : <>Read it. <span className="text-accent-text">Then decide.</span></>}
        </h1>
        <p className="mt-3 text-[15px] text-mute">Step {view.step} of {Math.max(view.total - 1, view.step)}: <span className="text-ink">{view.title}</span>{view.stopped ? " (it stopped earlier; you can still approve it)" : ""}</p>
      </header>

      <div className={`${frame} px-4 py-5 sm:px-8`}><Signal at={decided ? 2 : 1} /></div>

      <section aria-labelledby="words-heading" className={`${frame} p-5 sm:p-7`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="words-heading" className={`${label} text-mute`}>{view.writes ? "Exactly what will be sent" : "Exactly what this step will do"}</h2>
          {view.writes && <span className={`${label} rounded-full border border-warning/60 px-2.5 py-1 text-warning`}>Sends or creates</span>}
        </div>
        {changed && <p role="status" className="mt-3 flex items-start gap-2 rounded-2xl border border-warning/60 px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-warning" />These words changed after we told you (the AI step ran again). Read them again before you decide.</p>}
        <pre tabIndex={0} className="mt-4 max-h-[50vh] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-sunken p-4 font-mono text-[13px] leading-relaxed text-ink">{words}</pre>
      </section>

      {outcome && <p role={outcome.tone === "bad" ? "alert" : "status"} className={`flex items-start gap-2 rounded-2xl px-4 py-3 text-[15px] ${outcome.tone === "bad" ? "border border-error" : "bg-accent-subtle"}`}><Icon name={outcome.tone === "bad" ? "CircleAlert" : "CircleCheck"} className={`mt-0.5 shrink-0 ${outcome.tone === "bad" ? "text-error" : "text-accent-text"}`} />{outcome.words}</p>}

      {!decided ? (
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-mute">One step only. This link works once{left(view.expiresAt, now) ? ` · ${left(view.expiresAt, now)}` : ""}.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <button type="button" onClick={() => decide("turn_down")} disabled={pending} className={`${pill} border border-line-strong bg-surface text-ink hover:bg-raised`}>
              {pending && choice === "turn_down" ? <Icon name="Loader2" size={16} className="hw-spin" /> : <Icon name="X" size={16} />}Turn down
            </button>
            <button type="button" onClick={() => decide("approve")} disabled={pending} className={`${pill} bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active`}>
              {pending && choice === "approve" ? <Icon name="Loader2" size={16} className="hw-spin" /> : <Icon name="ShieldCheck" size={16} />}Approve these words
            </button>
          </div>
        </div>
      ) : (
        <a href={`/app/runs?run=${encodeURIComponent(view.runId)}`} className={`${pill} self-start border border-line-strong bg-surface text-ink hover:bg-raised`}>See the run<Icon name="ArrowRight" size={16} /></a>
      )}
    </div>
  );
}
