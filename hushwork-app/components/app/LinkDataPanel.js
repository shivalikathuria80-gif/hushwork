"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Icon } from "../icons";
import { EASE } from "../ui";
import { CAP_MAX, EXPORT_MAX, HOOK_DATA_SETUP, KEEP_DAYS } from "@/lib/hook-data";
import { forgetArrivals, setHookData } from "@/lib/actions/hook-data";

// "Your data" inside one start link's card: how long its arrivals are kept, how many runs it may start a day, and taking it all out or
// deleting it now. Three visual answers, one per question: a ruler of time (what is kept, what gets deleted), a meter (how much of today's
// limit is used), and a row of plain buttons. Same shapes as the rest of the page (hairlines, pills, mono labels) in Hushwork's own colours.

const pill = "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-colors duration-120 ease-standard disabled:pointer-events-none disabled:opacity-50 md:h-10";
const pillQuiet = `${pill} border border-line-strong bg-surface text-ink hover:bg-raised active:bg-line`;
const pillGhost = `${pill} text-mute hover:bg-raised hover:text-ink`;
const label = "font-mono text-[11px] font-medium uppercase tracking-[0.08em]";
const OFFLINE = { error: "Could not reach Hushwork. Check your connection and try again." };

// ---- THE RULER ----------------------------------------------------------------------------------------------------------------------
// Now on the left, older to the right. The stops are spaced evenly (not by days), so "1 day" is as easy to see as "90 days".
const STOPS = [0, ...KEEP_DAYS];
function place(daysAgo) {
  const days = Math.max(0, daysAgo);
  for (let i = 1; i < STOPS.length; i += 1) {
    if (days <= STOPS[i]) return ((i - 1 + (days - STOPS[i - 1]) / (STOPS[i] - STOPS[i - 1])) / (STOPS.length - 1)) * 100;
  }
  return 100;
}

function KeepRuler({ keepDays, ages, reduce }) {
  const kept = place(keepDays);
  return (
    <div className="relative mb-1 h-[58px] pt-3" role="img" aria-label={`Arrivals are kept for ${keepDays} ${keepDays === 1 ? "day" : "days"}, then deleted`}>
      {/* the deleted side: a dashed line */}
      <span aria-hidden="true" className="absolute left-0 right-0 top-[15px] border-t border-dashed border-line-strong" />
      {/* the kept side: a solid accent line that grows to the chosen stop */}
      <motion.span aria-hidden="true" initial={false} animate={{ width: `${kept}%` }} transition={reduce ? { duration: 0 } : { duration: 0.45, ease: EASE }} className="absolute left-0 top-[14px] h-[3px] rounded-full bg-accent" />
      {/* the arrivals Hushwork holds right now */}
      {ages.slice(0, 80).map((age, index) => (
        <span key={index} aria-hidden="true" className={`absolute top-[11px] h-[9px] w-[9px] -translate-x-1/2 rounded-full border-2 border-surface ${age <= keepDays ? "bg-accent-text" : "bg-line-strong"}`} style={{ left: `${place(age)}%` }} />
      ))}
      {STOPS.map((stop, index) => (
        <span key={stop} aria-hidden="true" className="absolute top-[22px] -translate-x-1/2 text-center" style={{ left: `${(index / (STOPS.length - 1)) * 100}%` }}>
          <span className={`mx-auto block h-1.5 w-px ${stop <= keepDays ? "bg-accent" : "bg-line-strong"}`} />
          <span className={`mt-1 block whitespace-nowrap font-mono text-[10.5px] ${stop === keepDays ? "font-semibold text-accent-text" : "text-mute"} ${index === 0 ? "translate-x-1/2" : index === STOPS.length - 1 ? "-translate-x-1/3" : ""}`}>{stop === 0 ? "now" : `${stop} d`}</span>
        </span>
      ))}
    </div>
  );
}

// ---- THE METER ----------------------------------------------------------------------------------------------------------------------
// One cell per run when the limit is small enough to count; a plain bar above that.
function CapMeter({ used, limit, own }) {
  const share = Math.min(1, used / Math.max(1, limit));
  const full = used >= limit;
  const tone = full ? "bg-warning" : own ? "bg-accent" : "bg-ink/70";
  return (
    <div role="img" aria-label={`${used} of ${limit} runs used today`}>
      {limit <= 30 ? (
        <div className="flex h-3 gap-[3px]">
          {Array.from({ length: limit }, (_, index) => <span key={index} className={`h-full flex-1 rounded-[2px] ${index < used ? tone : "bg-line-strong/70"}`} />)}
        </div>
      ) : (
        <div className="h-3 overflow-hidden rounded-full bg-line-strong/70"><span className={`block h-full rounded-full ${tone}`} style={{ width: `${share * 100}%` }} /></div>
      )}
    </div>
  );
}

function Stepper({ value, onChange, disabled }) {
  const set = (next) => onChange(Math.min(CAP_MAX, Math.max(1, next)));
  // What is typed stays as typed (it may be empty for a moment); it becomes a number from 1 to CAP_MAX when the box is left.
  const [typed, setTyped] = useState(null);
  const shown = typed ?? String(value);
  const settle = () => {
    if (typed === null) return;
    const n = Number(typed);
    if (n) set(n);
    setTyped(null);
  };
  return (
    <div className="inline-flex h-11 items-center rounded-full border border-field bg-surface md:h-10">
      <button type="button" aria-label="One fewer" disabled={disabled || value <= 1} onClick={() => { setTyped(null); set(value - 1); }} className="grid h-full w-11 place-items-center rounded-l-full text-mute hover:bg-raised hover:text-ink disabled:opacity-40"><Icon name="Minus" size={16} /></button>
      <input
        inputMode="numeric" value={shown} disabled={disabled} aria-label="Runs a day"
        onChange={(event) => { const digits = event.target.value.replace(/\D/g, "").slice(0, 2); setTyped(digits); const n = Number(digits); if (n >= 1 && n <= CAP_MAX) onChange(n); }}
        onBlur={settle} onKeyDown={(event) => { if (event.key === "Enter") settle(); }}
        className="h-full w-12 bg-transparent text-center text-[15px] font-semibold tabular-nums outline-none"
      />
      <button type="button" aria-label="One more" disabled={disabled || value >= CAP_MAX} onClick={() => { setTyped(null); set(value + 1); }} className="grid h-full w-11 place-items-center rounded-r-full text-mute hover:bg-raised hover:text-ink disabled:opacity-40"><Icon name="Plus" size={16} /></button>
    </div>
  );
}

// ---- THE PANEL ----------------------------------------------------------------------------------------------------------------------
// `ages`: days since each arrival of this link that Hushwork holds (from the page's 14 days). `today`: runs this link started today.
export default function LinkDataPanel({ link, ages, held, today, accountLimit, ready, reduce }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState(null);
  const [confirm, setConfirm] = useState(false);
  // The choices answer at once; the saved values win again as soon as the server sends different ones.
  const [keepLocal, setKeepLocal] = useState({ from: link.keepDays, value: link.keepDays });
  const keepDays = keepLocal.from === link.keepDays ? keepLocal.value : link.keepDays;
  const [capDraft, setCapDraft] = useState({ from: link.dailyCap, own: link.dailyCap !== null, value: link.dailyCap ?? 20 });
  const cap = capDraft.from === link.dailyCap ? capDraft : { from: link.dailyCap, own: link.dailyCap !== null, value: link.dailyCap ?? 20 };
  const capChanged = cap.own !== (link.dailyCap !== null) || (cap.own && cap.value !== link.dailyCap);
  const limit = cap.own ? cap.value : accountLimit;
  const leaving = ages.filter((age) => age > keepDays).length;

  // After a save the local choice is set to what was saved, so a later change made elsewhere (another tab) shows through.
  const save = (input, good, undo, saved) => start(async () => {
    setMessage(null);
    const result = await setHookData({ id: link.id, tzOffset: -new Date().getTimezoneOffset(), ...input }).catch(() => OFFLINE);
    if (result?.error) {
      undo?.();
      setMessage({ tone: "bad", words: result.error });
    } else {
      saved?.();
      setMessage({ tone: "good", words: good });
      router.refresh();
    }
  });
  const pickKeep = (days) => {
    if (days === keepDays) return;
    const before = keepDays;
    setKeepLocal({ from: link.keepDays, value: days });
    save({ keepDays: days }, days < before ? `Kept for ${days} ${days === 1 ? "day" : "days"} now. Anything older goes within a few minutes.` : `Kept for ${days} days now.`, () => setKeepLocal({ from: link.keepDays, value: before }), () => setKeepLocal({ from: days, value: days }));
  };
  const forgetAll = () => start(async () => {
    setMessage(null);
    const result = await forgetArrivals({ linkId: link.id }).catch(() => OFFLINE);
    setConfirm(false);
    if (result?.error) setMessage({ tone: "bad", words: result.error });
    else {
      setMessage({ tone: "good", words: result.deleted ? `Deleted ${result.deleted} ${result.deleted === 1 ? "arrival" : "arrivals"} and the words their runs' Start steps kept. The runs stay.` : "There was nothing to delete." });
      router.refresh();
    }
  });
  const exportHref = (format) => `/api/export/arrivals?link=${encodeURIComponent(link.id)}&format=${format}`;

  return (
    <section aria-label={`Your data for ${link.name}`} className="mt-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={`${label} text-mute`}>Your data</p>
          <h4 className="mt-1 text-[17px] font-semibold tracking-[-0.015em]">What this link keeps, and for how long</h4>
        </div>
        <p className="text-sm text-mute"><b className="font-semibold tabular-nums text-ink">{held}</b> {held === 1 ? "arrival" : "arrivals"} kept right now</p>
      </div>
      {!ready && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-line px-3 py-2 text-sm text-mute"><Icon name="Info" className="mt-0.5 shrink-0 text-accent-text" /><span>{HOOK_DATA_SETUP} Downloading works already.</span></p>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* 1. HOW LONG */}
        <div className="rounded-2xl border border-line p-4 sm:p-5">
          <p className={`${label} text-mute`}>Keep arrivals for</p>
          <div role="radiogroup" aria-label="Keep arrivals for" className="mt-3 grid grid-cols-4 gap-1 rounded-full bg-sunken p-1 sm:inline-grid">
            {KEEP_DAYS.map((days) => (
              <button
                key={days} type="button" role="radio" aria-checked={keepDays === days} disabled={!ready || pending} onClick={() => pickKeep(days)}
                className={`h-9 whitespace-nowrap rounded-full px-2 text-[13px] font-medium transition-colors duration-120 disabled:cursor-not-allowed sm:px-3.5 ${keepDays === days ? "bg-ink text-bg" : "text-mute hover:text-ink"} ${!ready ? "opacity-50" : ""}`}
              >{days === 1 ? "1 day" : `${days} days`}</button>
            ))}
          </div>
          <KeepRuler keepDays={keepDays} ages={ages} reduce={reduce} />
          <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-mute">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-accent-text" />Kept</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden="true" className="h-2 w-2 rounded-full bg-line-strong" />{leaving > 0 ? `${leaving} ${leaving === 1 ? "goes" : "go"} at the next clean-up` : "Deleted when older"}</span>
          </p>
          <p className="mt-2 text-sm text-mute">After that, each arrival is deleted together with the words its run&rsquo;s Start step kept. The run itself stays in your history.</p>
        </div>

        {/* 2. HOW MANY */}
        <div className="rounded-2xl border border-line p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <p className={`${label} text-mute`}>Runs a day from this link</p>
            <p className="text-right text-sm"><b className="text-[22px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{today}</b><span className="text-mute"> / {limit} today</span></p>
          </div>
          <div className="mt-4"><CapMeter used={today} limit={limit} own={cap.own} /></div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div role="radiogroup" aria-label="Daily limit" className="inline-flex gap-1 rounded-full bg-sunken p-1">
              {[[false, `Account limit (${accountLimit})`], [true, "Its own limit"]].map(([own, words]) => (
                <button key={String(own)} type="button" role="radio" aria-checked={cap.own === own} disabled={!ready || pending} onClick={() => setCapDraft({ ...cap, own })}
                  className={`h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-120 disabled:cursor-not-allowed ${cap.own === own ? "bg-ink text-bg" : "text-mute hover:text-ink"} ${!ready ? "opacity-50" : ""}`}>{words}</button>
              ))}
            </div>
            {cap.own && <Stepper value={cap.value} disabled={!ready || pending} onChange={(value) => setCapDraft({ ...cap, value })} />}
          </div>
          {capChanged && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" disabled={pending} onClick={() => { const next = cap.own ? cap.value : null; save({ dailyCap: next }, next ? `At most ${next} ${next === 1 ? "run" : "runs"} a day from this link now.` : "This link now follows the account limit only.", null, () => setCapDraft({ from: next, own: next !== null, value: next ?? 20 })); }} className={`${pill} bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active`}><Icon name={pending ? "Loader2" : "Check"} size={16} className={pending ? "hw-spin" : ""} />Save limit</button>
              <button type="button" onClick={() => setCapDraft({ from: link.dailyCap, own: link.dailyCap !== null, value: link.dailyCap ?? 20 })} className={pillGhost}>Undo</button>
            </div>
          )}
          <p className="mt-3 text-sm text-mute">{cap.own ? "Once it is reached, more arrivals are written down but start nothing until tomorrow (your clock)." : `Every link shares your account's ${accountLimit} runs a day. Give this one a lower limit if a busy form should not use them all.`}</p>
        </div>
      </div>

      {/* 3. TAKE IT OUT, OR DELETE IT */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a href={exportHref("csv")} className={pillQuiet}><Icon name="Download" size={16} />Download CSV</a>
        <a href={exportHref("json")} className={pillGhost}><Icon name="Download" size={16} />JSON</a>
        <span className="text-xs text-mute">The newest {EXPORT_MAX.toLocaleString("en")}, with their full words</span>
        {!confirm && <button type="button" disabled={!ready || pending || held === 0} onClick={() => setConfirm(true)} className={`${pillGhost} sm:ml-auto`}><Icon name="Trash" size={16} />Delete all arrivals now</button>}
      </div>
      {confirm && (
        <div role="group" aria-label="Delete all arrivals" className="mt-3 rounded-2xl border border-error/60 p-4">
          <p className="text-sm">Delete {held === 1 ? "this link's 1 arrival" : `all ${held} of this link's arrivals`}, and the words each run&rsquo;s Start step kept? The runs stay. This cannot be undone, so download them first if you need them.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={forgetAll} className={`${pill} bg-ink text-bg hover:bg-ink/85`}><Icon name={pending ? "Loader2" : "Trash"} size={16} className={pending ? "hw-spin" : ""} />Yes, delete them</button>
            <button type="button" onClick={() => setConfirm(false)} className={pillGhost}>Keep them</button>
          </div>
        </div>
      )}
      {message && <p role={message.tone === "bad" ? "alert" : "status"} className={`mt-3 flex items-start gap-2 rounded-2xl px-3 py-2 text-sm ${message.tone === "bad" ? "border border-error" : "bg-accent-subtle"}`}><Icon name={message.tone === "bad" ? "CircleAlert" : "CircleCheck"} className={`mt-0.5 shrink-0 ${message.tone === "bad" ? "text-error" : "text-accent-text"}`} />{message.words}</p>}
    </section>
  );
}
