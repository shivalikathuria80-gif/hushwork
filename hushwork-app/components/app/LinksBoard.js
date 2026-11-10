"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Icon } from "../icons";
import { EASE, Switch } from "../ui";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { pulse } from "./AppScene";
import { INCOMING_TAG, TEST_ARRIVAL, dailyCounts, snippets } from "@/lib/hook-tags";
import { createHook, deleteHook, renewHook, setHookEnabled } from "@/lib/actions/hooks";

// "Start links": the browser half. One motion language for the whole page: a signal travelling a hairline, from "something arrives" to
// "you approve". It moves only when something really arrived (or a test was sent), never as decoration, and stands still with reduce motion.
// Shapes follow the owner's design system (hairlines, large tight headings, quiet copy, pill controls, 28px frames) in Hushwork's own colours.

const pill = "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-colors duration-120 ease-standard disabled:pointer-events-none disabled:opacity-50 md:h-10";
const pillPrimary = `${pill} bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active`;
const pillQuiet = `${pill} border border-line-strong bg-surface text-ink hover:bg-raised active:bg-line`;
const pillGhost = `${pill} text-mute hover:bg-raised hover:text-ink`;
const label = "font-mono text-[11px] font-medium uppercase tracking-[0.08em]";
const frame = "rounded-[28px] border border-line bg-surface";

const STATUS = {
  started: ["Started", "border-success/50 text-success"],
  limited: ["Too many at once", "border-warning/60 text-warning"],
  off: ["Link was off", "border-line-strong text-mute"],
  failed: ["Could not start", "border-error/60 text-error"],
};

// The time on the visitor's own clock. null on the server and on the first paint, so both render the same HTML.
let cached = null;
const read = () => cached;
const subscribe = (notify) => {
  const tick = () => { cached = Date.now(); notify(); };
  tick();
  const id = setInterval(tick, 30_000);
  return () => clearInterval(id);
};
const useNow = () => useSyncExternalStore(subscribe, read, () => null);

function ago(at, now) {
  const then = Date.parse(at);
  if (now === null || !Number.isFinite(then)) return "";
  const minutes = Math.max(0, Math.round((now - then) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / (60 * 24))} d ago`;
}

// ---- THE SIGNAL STAGE ---------------------------------------------------------------------------------------------------------------
// Four stations on one hairline. `beat` is how far the signal has travelled: 0 = resting, 1..4 = the station it has reached.
const STATIONS = [
  { icon: "Inbox", step: "01", title: "Something arrives", words: "A form, a booking, an order" },
  { icon: "Link", step: "02", title: "Start link", words: "Its private address" },
  { icon: "Bot", step: "03", title: "The workflow runs", words: "Reads it, thinks, drafts" },
  { icon: "ShieldCheck", step: "04", title: "You approve", words: "Nothing is sent before" },
];

function SignalStage({ beat, numbers, reduce }) {
  const reached = (index) => beat === 0 || beat > index; // resting: every station is calmly lit
  const position = beat === 0 ? 0 : (beat - 0.5) * 25; // the middle of the station's quarter, in percent
  return (
    <section aria-label="How a start link works" className="relative overflow-hidden rounded-[28px] bg-[#0c0a10] px-5 py-7 text-[#f7f6f9] sm:px-8 sm:py-9">
      <div className="relative">
        {/* The hairline: drawn in once, left to right (top to bottom on a phone). */}
        <motion.span
          aria-hidden="true" initial={reduce ? false : { scaleX: 0, scaleY: 0 }} animate={{ scaleX: 1, scaleY: 1 }} transition={{ duration: 0.9, ease: EASE }}
          className="absolute left-[21px] top-0 h-full w-px origin-top bg-white/25 lg:left-0 lg:top-[21px] lg:h-px lg:w-full lg:origin-left"
        />
        {/* The signal itself. */}
        {beat > 0 && !reduce && (
          <>
            <span aria-hidden="true" className="absolute left-[21px] z-10 -ml-[5px] -mt-[5px] h-[11px] w-[11px] rounded-full bg-[#c3a5ff] shadow-[0_0_0_5px_rgba(139,92,246,0.3)] transition-[top] duration-700 ease-standard lg:hidden" style={{ top: `${position}%` }} />
            <span aria-hidden="true" className="absolute top-[21px] z-10 -ml-[5px] -mt-[5px] hidden h-[11px] w-[11px] rounded-full bg-[#c3a5ff] shadow-[0_0_0_5px_rgba(139,92,246,0.3)] transition-[left] duration-700 ease-standard lg:block" style={{ left: `${position}%` }} />
          </>
        )}
        <ol className="relative grid gap-7 lg:grid-cols-4 lg:gap-6">
          {STATIONS.map((station, index) => (
            <li key={station.step} className="flex gap-4 lg:block">
              <span className={`relative z-[1] grid h-[43px] w-[43px] shrink-0 place-items-center rounded-full border bg-[#0c0a10] transition-colors duration-340 ease-standard ${reached(index) ? "border-[#a476ff] text-[#c3a5ff]" : "border-white/20 text-white/45"}`}>
                <Icon name={station.icon} size={18} />
              </span>
              <div className="min-w-0 lg:mt-5">
                <p className={`${label} text-white/55`}>{station.step}</p>
                <p className="mt-1 text-[19px] font-semibold leading-tight tracking-[-0.02em]">{station.title}</p>
                <p className="mt-1 text-sm text-white/65">{station.words}</p>
                <p className="mt-3 text-[28px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{numbers[index].value}</p>
                <p className="mt-1 text-xs text-white/55">{numbers[index].words}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---- SMALL PARTS --------------------------------------------------------------------------------------------------------------------
function CopyButton({ text, children = "Copy", className = pillQuiet, what = "Address" }) {
  const [state, setState] = useState("");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setState("done");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(""), 2200);
  }
  return (
    <button type="button" onClick={copy} className={className}>
      <Icon name={state === "done" ? "Check" : "Copy"} size={16} />
      {state === "done" ? "Copied" : state === "failed" ? "Select and copy it by hand" : children}
      <span role="status" className="sr-only">{state === "done" ? `${what} copied` : ""}</span>
    </button>
  );
}

// Fourteen small bars: arrivals per day, today on the right.
function DayBars({ counts }) {
  const most = Math.max(1, ...counts);
  const total = counts.reduce((sum, count) => sum + count, 0);
  return (
    <div role="img" aria-label={`${total} ${total === 1 ? "arrival" : "arrivals"} in the last 14 days`} className="flex h-10 items-end gap-[3px]">
      {counts.map((count, index) => (
        <span key={index} className={`w-full rounded-[2px] ${count ? "bg-accent" : "bg-line-strong"}`} style={{ height: count ? `${Math.max(18, (count / most) * 100)}%` : "3px" }} />
      ))}
    </div>
  );
}

const TABS = [["form", "HTML form"], ["tool", "Form tool"], ["curl", "Terminal"], ["js", "JavaScript"]];
function Snippets({ url, id }) {
  const [tab, setTab] = useState("form");
  const made = useMemo(() => snippets(url), [url]);
  return (
    <div className="mt-5 border-t border-line pt-5">
      <p className={`${label} text-mute`}>Connect it</p>
      <div role="tablist" aria-label="Ways to send to this link" className="mt-3 flex flex-wrap gap-1.5">
        {TABS.map(([key, name]) => (
          <button
            key={key} type="button" role="tab" id={`${id}-tab-${key}`} aria-selected={tab === key} aria-controls={`${id}-panel`} onClick={() => setTab(key)}
            className={`h-9 rounded-full px-3.5 text-[13px] font-medium transition-colors duration-120 ${tab === key ? "bg-ink text-bg" : "text-mute hover:bg-raised hover:text-ink"}`}
          >{name}</button>
        ))}
      </div>
      <div role="tabpanel" id={`${id}-panel`} aria-labelledby={`${id}-tab-${tab}`} className="mt-3">
        {tab === "tool" ? (
          <ul className="space-y-2 text-sm text-mute">
            <li><b className="font-medium text-ink">Tally:</b> open your form, then Integrations, then Webhooks, and paste the address.</li>
            <li><b className="font-medium text-ink">Typeform:</b> open your form, then Connect, then Webhooks, and paste the address.</li>
            <li><b className="font-medium text-ink">Anything else:</b> look for &ldquo;webhook&rdquo; in its settings. It needs to send a POST to the address; Hushwork reads the fields by their names.</li>
          </ul>
        ) : (
          <div className="relative">
            <pre tabIndex={0} className="max-h-56 overflow-auto rounded-2xl bg-sunken p-4 pr-4 font-mono text-[12.5px] leading-relaxed text-ink"><code>{made[tab]}</code></pre>
            <div className="mt-2"><CopyButton text={made[tab]} what="Example" className={pillGhost}>Copy this</CopyButton></div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- ONE LINK -----------------------------------------------------------------------------------------------------------------------
function LinkCard({ link, times, now, tzOffset, onSignal, index }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState(null); // { tone: "good" | "bad", words }
  const [confirm, setConfirm] = useState(""); // "" | "renew" | "remove"
  // The switch answers at once; the saved value wins again as soon as the server sends a different one.
  const [local, setLocal] = useState({ from: link.enabled, value: link.enabled });
  const enabled = local.from === link.enabled ? local.value : link.enabled;
  const setEnabled = (value) => setLocal({ from: link.enabled, value });
  const timers = useRef([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);
  const counts = useMemo(() => dailyCounts(times, now ?? 0, 14, tzOffset), [times, now, tzOffset]);
  const act = (action, input, good) => start(async () => {
    setMessage(null);
    const result = await action(input).catch(() => ({ error: "Could not reach Hushwork. Check your connection and try again." }));
    if (result?.error) setMessage({ tone: "bad", words: result.error });
    else {
      if (good) setMessage({ tone: "good", words: good });
      router.refresh();
    }
    setConfirm("");
  });
  function toggle(next) {
    setEnabled(next);
    start(async () => {
      const result = await setHookEnabled({ id: link.id, enabled: next, tzOffset: -new Date().getTimezoneOffset() }).catch(() => ({ error: "Could not reach Hushwork. Check your connection and try again." }));
      if (result?.error) {
        setEnabled(!next);
        setMessage({ tone: "bad", words: result.error });
      } else router.refresh();
    });
  }
  // A test walks the real road: the browser posts a made-up arrival to the link's own address.
  async function sendTest() {
    setTesting(true);
    setMessage(null);
    try {
      const response = await fetch(link.url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(TEST_ARRIVAL) });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) {
        onSignal();
        pulse("good");
        setMessage({ tone: "good", words: "Test received. The workflow is running now; its run shows up under Arrivals in a few seconds." });
        timers.current.push(setTimeout(() => router.refresh(), 2500), setTimeout(() => router.refresh(), 9000), setTimeout(() => router.refresh(), 20000));
      } else {
        setMessage({ tone: "bad", words: body?.error || "The link did not accept the test. Try again in a minute." });
        router.refresh();
      }
    } catch {
      setMessage({ tone: "bad", words: "Could not reach the link from this browser. Check your connection and try again." });
    }
    setTesting(false);
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  return (
    <motion.li initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.05 * index }} className={`${frame} min-w-0 p-5 sm:p-7`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`${label} ${enabled ? "text-success" : "text-mute"}`}>{enabled ? "Listening" : "Switched off"}</p>
          <h3 className="mt-1 break-words text-[22px] font-semibold leading-tight tracking-[-0.02em]">{link.name}</h3>
        </div>
        <label className="flex items-center gap-2 text-sm text-mute">
          <span>{enabled ? "On" : "Off"}</span>
          <Switch checked={enabled} onChange={toggle} label={`Start link for ${link.name}`} disabled={pending} />
        </label>
      </div>

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code tabIndex={0} aria-label="The address of this start link" className="block min-w-0 flex-1 overflow-x-auto whitespace-nowrap rounded-full border border-line bg-sunken px-4 py-2.5 font-mono text-[13px] text-ink">{link.url}</code>
        <CopyButton text={link.url}>Copy address</CopyButton>
      </div>
      <p className="mt-2 text-xs text-mute">Anyone who has this address can start this workflow, so share it only with the form or app that should. It can never send anything by itself.</p>

      <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <DayBars counts={counts} />
          <p className="mt-2 text-sm text-mute"><b className="font-semibold tabular-nums text-ink">{total}</b> in the last 14 days{link.lastAt && now !== null ? `, last one ${ago(link.lastAt, now)}` : link.count === 0 ? ". Nothing has arrived yet" : ""}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={sendTest} disabled={!enabled || testing} className={pillPrimary}><Icon name={testing ? "Loader2" : "Send"} size={16} className={testing ? "hw-spin" : ""} />Send a test</button>
          <Link href={`/app/builder?draft=${encodeURIComponent(link.workflowId)}`} className={pillQuiet}><Icon name="Workflow" size={16} />Open workflow</Link>
        </div>
      </div>
      {message && <p role={message.tone === "bad" ? "alert" : "status"} className={`mt-3 flex items-start gap-2 rounded-2xl px-3 py-2 text-sm ${message.tone === "bad" ? "border border-error" : "bg-accent-subtle"}`}><Icon name={message.tone === "bad" ? "CircleAlert" : "CircleCheck"} className={`mt-0.5 shrink-0 ${message.tone === "bad" ? "text-error" : "text-accent-text"}`} />{message.words}</p>}

      {!link.readsIncoming && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-line px-3 py-2 text-sm text-mute">
          <Icon name="Info" className="mt-0.5 shrink-0 text-accent-text" />
          <span>This workflow starts when something arrives, but does not read it yet. In the Builder, write <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[12.5px] text-ink">{INCOMING_TAG}</code> in the job of an Ask the AI step, like &ldquo;Read {INCOMING_TAG} and draft a short friendly reply&rdquo;.</span>
        </p>
      )}

      <Snippets url={link.url} id={`link-${link.id}`} />

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {confirm === "" && (
          <>
            <button type="button" onClick={() => setConfirm("renew")} className={pillGhost}><Icon name="RotateCcw" size={16} />New address</button>
            <button type="button" onClick={() => setConfirm("remove")} className={pillGhost}><Icon name="Trash" size={16} />Remove link</button>
          </>
        )}
        {confirm !== "" && (
          <div role="group" aria-label={confirm === "renew" ? "Make a new address" : "Remove this link"} className="flex flex-wrap items-center gap-2">
            <p className="basis-full text-sm">{confirm === "renew" ? "The old address stops working at once. You will need to paste the new one wherever you used it." : "The address stops working at once. The workflow itself stays."}</p>
            <button type="button" disabled={pending} onClick={() => (confirm === "renew" ? act(renewHook, { id: link.id }, "New address made. The old one no longer works.") : act(deleteHook, { id: link.id }))} className={`${pill} bg-ink text-bg hover:bg-ink/85`}>{confirm === "renew" ? "Yes, make a new address" : "Yes, remove it"}</button>
            <button type="button" onClick={() => setConfirm("")} className={pillGhost}>Keep it</button>
          </div>
        )}
      </div>
    </motion.li>
  );
}

// ---- MAKE A LINK --------------------------------------------------------------------------------------------------------------------
const STARTER = "When a new lead arrives, read {incoming} and draft a short friendly reply for me to approve";
function NewLink({ candidates, first, full, maxLinks }) {
  const router = useRouter();
  const ready = candidates.filter((flow) => flow.hasStart);
  const [choice, setChoice] = useState(ready[0]?.id ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const picked = ready.some((flow) => flow.id === choice) ? choice : ready[0]?.id ?? "";
  const make = () => start(async () => {
    setError("");
    const result = await createHook({ workflowId: picked, tzOffset: -new Date().getTimezoneOffset() }).catch(() => ({ error: "Could not reach Hushwork. Check your connection and try again." }));
    if (result?.error) setError(result.error);
    else {
      pulse("good");
      router.refresh();
    }
  });
  return (
    <section aria-labelledby="new-link" className={`${first ? frame : "rounded-[28px] border border-dashed border-line-strong"} p-5 sm:p-7`}>
      <p className={`${label} text-mute`}>{first ? "Start here" : "Another one"}</p>
      <h2 id="new-link" className={`mt-1 font-semibold tracking-[-0.025em] ${first ? "text-[28px] leading-tight" : "text-[20px]"}`}>{first ? "Pick a workflow. Get its address." : "Give another workflow an address"}</h2>
      {full ? (
        <p className="mt-2 text-sm text-mute">You have {maxLinks} start links, which is the most you can keep. Remove one you no longer use to make another.</p>
      ) : ready.length > 0 ? (
        <>
          {first && <p className="mt-2 max-w-[58ch] text-sm text-mute">The address is made in a second. Paste it into your form, and every answer starts the workflow.</p>}
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="new-link-flow" className="sr-only">Workflow</label>
            <div className="relative min-w-0 flex-1">
              <select id="new-link-flow" value={picked} onChange={(event) => setChoice(event.target.value)} className="h-11 w-full appearance-none truncate rounded-full border border-field bg-surface pl-4 pr-10 text-[15px] md:h-10">
                {ready.map((flow) => <option key={flow.id} value={flow.id}>{flow.name}</option>)}
              </select>
              <Icon name="ChevronDown" size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-mute" />
            </div>
            <button type="button" onClick={make} disabled={pending || !picked} className={pillPrimary}><Icon name={pending ? "Loader2" : "Link"} size={16} className={pending ? "hw-spin" : ""} />Make its start link</button>
          </div>
          {error && <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-error px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{error}</p>}
        </>
      ) : (
        <p className="mt-2 max-w-[58ch] text-sm text-mute">{candidates.length ? "Your other workflows have no Start step yet, so nothing could start them. Add one in the Builder." : first ? "You have no workflow yet. Hushwork AI can write one that answers new leads, then you give it an address here." : "Every workflow you have already has its link."}</p>
      )}
      {(first || (!full && ready.length === 0)) && (
        <div className="mt-4">
          <Link href={`/app/builder?ask=${encodeURIComponent(STARTER)}`} className={first && ready.length === 0 ? pillPrimary : pillQuiet}><Icon name="Sparkles" size={16} />Write a lead-reply workflow with Hushwork AI</Link>
        </div>
      )}
    </section>
  );
}

// ---- ARRIVALS -----------------------------------------------------------------------------------------------------------------------
function Arrivals({ arrivals, now }) {
  const [all, setAll] = useState(false);
  const shown = all ? arrivals.slice(0, 60) : arrivals.slice(0, 8);
  return (
    <section aria-labelledby="arrivals" className={`${frame} p-5 sm:p-7`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={`${label} text-mute`}>Last 14 days</p>
          <h2 id="arrivals" className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">Arrivals</h2>
        </div>
        <p className="text-sm text-mute">Only a short preview is kept here. The full words are on the run.</p>
      </div>
      {arrivals.length === 0 ? (
        <p className="mt-5 border-t border-line pt-5 text-sm text-mute">Nothing has arrived yet. Press <b className="font-medium text-ink">Send a test</b> on a link to see one travel the line.</p>
      ) : (
        <ol className="mt-5">
          {shown.map((arrival) => {
            const [words, tone] = STATUS[arrival.status] ?? STATUS.failed;
            return (
              <li key={arrival.id} className="grid gap-2 border-t border-line py-4 sm:grid-cols-[7.5rem_minmax(0,1fr)_auto] sm:items-start sm:gap-4">
                <p className="font-mono text-[12px] text-mute">{ago(arrival.at, now) || " "}</p>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
                    <span className="break-words">{arrival.name}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{words}</span>
                    {arrival.test && <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-medium text-mute">Test</span>}
                  </p>
                  {arrival.fields.length > 0 ? (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {arrival.fields.map((field, index) => (
                        <li key={index} className="max-w-full truncate rounded-full bg-raised px-2.5 py-1 text-[12.5px]"><span className="text-mute">{field.name}</span> {field.value}</li>
                      ))}
                    </ul>
                  ) : <p className="mt-1 text-sm text-mute">Nothing came with it.</p>}
                </div>
                {arrival.runId ? <Link href={`/app/runs?run=${encodeURIComponent(arrival.runId)}`} className="inline-flex h-9 items-center gap-1.5 self-start rounded-full px-3 text-sm font-medium text-accent-text hover:bg-accent-subtle">Open run<Icon name="ArrowRight" size={14} /></Link> : arrival.status === "started" ? <p className="self-start px-3 py-2 text-sm text-mute">Running…</p> : <span />}
              </li>
            );
          })}
        </ol>
      )}
      {arrivals.length > 8 && <button type="button" onClick={() => setAll(!all)} className={`${pillGhost} mt-1`}>{all ? "Show fewer" : `Show ${Math.min(arrivals.length, 60) - 8} more`}</button>}
    </section>
  );
}

export default function LinksBoard({ links, arrivals, candidates, limits }) {
  const now = useNow();
  const reduce = usePrefersReducedMotion();
  const tzOffset = now === null ? 0 : -new Date(now).getTimezoneOffset();
  const [beat, setBeat] = useState(0);
  const timers = useRef([]);
  const signal = () => {
    timers.current.forEach(clearTimeout);
    setBeat(1);
    timers.current = [setTimeout(() => setBeat(2), 750), setTimeout(() => setBeat(3), 1500), setTimeout(() => setBeat(4), 2250), setTimeout(() => setBeat(0), 4200)];
  };
  // Replays the newest arrival once when the page opens, if it came in the last ten minutes: you see what just happened, not a loop.
  const newest = arrivals[0];
  const replayed = useRef(false);
  useEffect(() => {
    if (replayed.current || now === null || !newest || newest.status !== "started") return;
    replayed.current = true;
    if (now - Date.parse(newest.at) < 10 * 60_000) timers.current = [setTimeout(signal, 400)];
  }, [now, newest]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const started = arrivals.filter((arrival) => arrival.status === "started");
  const numbers = [
    { value: arrivals.length, words: "arrived in 14 days" },
    { value: links.filter((link) => link.enabled).length, words: links.length === 1 ? "link listening" : "links listening" },
    { value: started.length, words: started.length === 1 ? "run started" : "runs started" },
    { value: 0, words: "sent without your OK" },
  ];
  const timesOf = useMemo(() => {
    const map = new Map();
    for (const arrival of arrivals) map.set(arrival.linkId, [...(map.get(arrival.linkId) ?? []), arrival.at]);
    return map;
  }, [arrivals]);

  return (
    <div className="mt-8 min-w-0 space-y-6">
      <SignalStage beat={beat} numbers={numbers} reduce={reduce} />
      {links.length === 0 && <NewLink candidates={candidates} first full={false} maxLinks={limits.maxLinks} />}
      {links.length > 0 && (
        <ul className="grid grid-cols-[minmax(0,1fr)] gap-6">
          {links.map((link, index) => <LinkCard key={link.id} link={link} times={timesOf.get(link.id) ?? []} now={now} tzOffset={tzOffset} onSignal={signal} index={index} />)}
        </ul>
      )}
      {links.length > 0 && <Arrivals arrivals={arrivals} now={now} />}
      {links.length > 0 && <NewLink candidates={candidates} first={false} full={links.length >= limits.maxLinks} maxLinks={limits.maxLinks} />}
      <p className="text-xs text-mute">Each person&rsquo;s links can start up to {limits.perMinute} runs a minute and {limits.perDay} a day; more than that is written down and not run. Fields that look like a card number or a secret key are left out before anything is saved.</p>
    </div>
  );
}
