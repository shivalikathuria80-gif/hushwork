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
import { SIGNING_STYLES, STYLE_KEYS, signArrival } from "@/lib/hook-sign";
import { createHook, deleteHook, renewHook, replayHookEvent, setHookEnabled, setHookSigning } from "@/lib/actions/hooks";
import { fieldTag } from "@/lib/hook-fields";
import { checkWatchNow, setWatchEnabled } from "@/lib/actions/app-events";
import { WATCH_SOURCES } from "@/lib/app-events";
import AppLogo from "../AppLogo";
import { forgetArrivals } from "@/lib/actions/hook-data";
import LinkDataPanel from "./LinkDataPanel";

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
  refused: ["Signature did not match", "border-error/60 text-error"],
  duplicate: ["Repeat, skipped", "border-line-strong text-mute"],
  capped: ["Over its daily limit", "border-warning/60 text-warning"],
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
  { icon: "Inbox", step: "01", title: "Something arrives", words: "A form, an email, a new event" },
  { icon: "Link", step: "02", title: "Hushwork notices", words: "Its start link, or your apps" },
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

// ---- FIELDS: what a step can use -----------------------------------------------------------------------------------------------------
// One chip per field of the newest arrival: its name, a sample of what came, and its tag. Pressing a chip copies the tag. Next to them, a small
// picture of an email step with the tags in place, so "To = the address that arrived" is seen, not explained.
function TagChip({ field }) {
  const [state, setState] = useState("");
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(field.tag);
      setState("done");
    } catch {
      setState("failed");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(""), 1800);
  }
  return (
    <li className="min-w-0">
      <button type="button" onClick={copy} title={state === "failed" ? "Select and copy it by hand" : `Copy ${field.tag}`} className="group flex w-full min-w-0 items-center gap-3 rounded-2xl border border-line bg-surface px-3 py-2 text-left transition-colors duration-120 hover:border-accent hover:bg-accent-subtle">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{field.name}</span>
          <span className="block truncate text-xs text-mute">{field.sample || "(empty)"}</span>
        </span>
        <code className="shrink-0 rounded-full bg-sunken px-2 py-0.5 font-mono text-[11.5px] text-accent-text group-hover:bg-surface">{state === "done" ? "Copied" : field.tag}</code>
        <span role="status" className="sr-only">{state === "done" ? `${field.tag} copied` : ""}</span>
      </button>
    </li>
  );
}

const looksLikeEmail = (field) => /email|e-mail|mail/i.test(field.name) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.sample);
function FieldsPanel({ link }) {
  const fields = link.fields ?? [];
  const missing = link.missing ?? [];
  const email = fields.find(looksLikeEmail);
  const other = fields.find((field) => field !== email && /subject|topic|title|name/i.test(field.name)) ?? fields.find((field) => field !== email);
  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <p className={`${label} text-mute`}>Fields your steps can use</p>
        {fields.length > 0 && <p className="text-xs text-mute">From the last arrival. Press one to copy its tag.</p>}
      </div>
      {fields.length === 0 ? (
        <p className="mt-3 text-sm text-mute">Nothing with fields has arrived yet. Press <b className="font-medium text-ink">Send a test</b>, or wait for the first answer from your form, and every field it sent shows up here with its tag.</p>
      ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,19rem)]">
          <ul className="grid grid-cols-[minmax(0,1fr)] content-start gap-2 sm:grid-cols-2">
            {fields.map((field) => <TagChip key={field.tag} field={field} />)}
          </ul>
          {/* The picture: a "Do something in another app" email with the tags where they go. */}
          <figure aria-label="Example: an email step that uses these fields" className="rounded-2xl bg-sunken p-4">
            <figcaption className={`${label} text-mute`}>In a step, like this</figcaption>
            <div className="mt-3 rounded-xl border border-line bg-surface p-3 text-[13px] shadow-sm">
              <p className="flex items-center gap-2 font-medium"><Icon name="Mail" size={14} className="text-accent-text" />Send an email</p>
              <dl className="mt-2 space-y-1.5">
                <div className="flex gap-2"><dt className="w-14 shrink-0 text-mute">To</dt><dd className="min-w-0 truncate font-mono text-[12px] text-accent-text">{email ? email.tag : "{incoming.email}"}</dd></div>
                <div className="flex gap-2"><dt className="w-14 shrink-0 text-mute">Subject</dt><dd className="min-w-0 truncate"><span>Thanks, </span><span className="font-mono text-[12px] text-accent-text">{other ? other.tag : "{incoming.name}"}</span></dd></div>
                <div className="flex gap-2"><dt className="w-14 shrink-0 text-mute">Text</dt><dd className="min-w-0 truncate font-mono text-[12px] text-accent-text">{"{answer}"}</dd></div>
              </dl>
            </div>
            <p className="mt-2 text-xs text-mute">The real values go in when the step waits for you, so you read the actual address and subject before you press Approve.</p>
          </figure>
        </div>
      )}
      {missing.length > 0 && (
        <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-warning/60 px-3 py-2 text-sm">
          <Icon name="CircleAlert" className="mt-0.5 shrink-0 text-warning" />
          <span>Your steps use {missing.map((key, index) => <span key={key}>{index > 0 ? ", " : ""}<code className="rounded bg-sunken px-1 py-0.5 font-mono text-[12.5px]">{`{incoming.${key}}`}</code></span>)}, but the last arrival had no field with {missing.length === 1 ? "that name" : "those names"}. Those steps will wait and say so. Rename the field in your form, or change the tag in the Builder.</span>
        </p>
      )}
    </div>
  );
}

// ---- THE SENDER CHECK ---------------------------------------------------------------------------------------------------------------
// Who may start this link: anyone holding the address, or only one sender that signs with a shared secret (lib/hook-sign.js). Drawn as a
// small three-stop line, in the same language as the signal stage: sender, the check, the workflow. A refused knock never reaches stop 3.
const NO_CHECK = "none";
const hidden = (secret) => (secret.length > 10 ? `${secret.slice(0, 4)}${"•".repeat(10)}${secret.slice(-4)}` : "•".repeat(secret.length));

function CheckLine({ style }) {
  const on = style !== NO_CHECK;
  const sender = on ? SIGNING_STYLES[style].name : "Anyone with the address";
  const stops = [
    { icon: on ? "Key" : "Link", words: on ? `${sender} signs with the secret` : sender },
    { icon: "ShieldCheck", words: on ? "Hushwork checks the signature" : "No check" },
    { icon: "Workflow", words: on ? "Only a match starts the workflow" : "The workflow starts" },
  ];
  return (
    <ol aria-label="Who can start this link" className="relative mt-4 grid gap-3 sm:grid-cols-3 sm:gap-4">
      <span aria-hidden="true" className="absolute left-[15px] top-2 h-[calc(100%-16px)] w-px bg-line-strong sm:left-4 sm:right-4 sm:top-[15px] sm:h-px sm:w-auto" />
      {stops.map((stop, index) => {
        const lit = on || index !== 1;
        return (
          <li key={index} className="relative flex items-center gap-3 sm:block">
            <span className={`relative z-[1] grid h-[31px] w-[31px] shrink-0 place-items-center rounded-full border bg-surface transition-colors duration-340 ease-standard ${lit ? (on ? "border-accent text-accent-text" : "border-line-strong text-ink") : "border-dashed border-line-strong text-mute"}`}>
              <Icon name={stop.icon} size={15} />
            </span>
            <p className={`text-[13px] leading-snug sm:mt-2 ${lit ? "text-ink" : "text-mute"}`}>{stop.words}</p>
          </li>
        );
      })}
    </ol>
  );
}

function SenderCheck({ link, limits }) {
  const router = useRouter();
  const saved = link.signing;
  const [choice, setChoice] = useState(saved.style);
  const [secret, setSecret] = useState("");
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState(null);
  const [changing, setChanging] = useState(false);
  const editing = choice !== saved.style || changing || (choice !== NO_CHECK && !saved.secret);
  const one = choice === NO_CHECK ? null : SIGNING_STYLES[choice];
  const save = (input, good) => start(async () => {
    setMessage(null);
    const result = await setHookSigning({ id: link.id, ...input }).catch(() => ({ error: "Could not reach Hushwork. Check your connection and try again." }));
    if (result?.error) setMessage({ tone: "bad", words: result.error });
    else {
      setSecret("");
      setChanging(false);
      setShow(Boolean(input.make));
      setMessage({ tone: "good", words: good });
      if (input.style !== NO_CHECK) pulse("good");
      router.refresh();
    }
  });
  const options = [[NO_CHECK, "Anyone"], ...STYLE_KEYS.map((key) => [key, SIGNING_STYLES[key].name])];
  return (
    <div className="mt-5 border-t border-line pt-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={`${label} text-mute`}>Sender check</p>
        <p className={`${label} ${saved.style === NO_CHECK ? "text-mute" : "text-success"}`}>{saved.style === NO_CHECK ? "Open to the address" : `Signed by ${SIGNING_STYLES[saved.style].name} only`}</p>
      </div>
      {!link.signingReady ? (
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-line px-3 py-2 text-sm text-mute"><Icon name="Info" className="mt-0.5 shrink-0 text-accent-text" />The sender check needs one setup step: open supabase/hooks-signing.sql and run it in Supabase.</p>
      ) : (
        <>
          <div role="radiogroup" aria-label="Who may start this link" className="mt-3 flex flex-wrap gap-1.5">
            {options.map(([key, name]) => (
              <button
                key={key} type="button" role="radio" aria-checked={choice === key} onClick={() => { setChoice(key); setChanging(false); setMessage(null); setSecret(""); }}
                className={`h-9 rounded-full border px-3.5 text-[13px] font-medium transition-colors duration-120 ${choice === key ? "border-ink bg-ink text-bg" : "border-line text-mute hover:bg-raised hover:text-ink"}`}
              >{name}</button>
            ))}
          </div>
          <CheckLine style={choice} />

          {editing && choice === NO_CHECK && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <p className="basis-full text-sm text-mute">Anyone holding the address can start this workflow again. Nothing is ever sent without your OK either way.</p>
              <button type="button" disabled={pending} onClick={() => save({ style: NO_CHECK }, "The sender check is off.")} className={pillQuiet}>Turn the check off</button>
              <button type="button" onClick={() => setChoice(saved.style)} className={pillGhost}>Keep it on</button>
            </div>
          )}
          {editing && one && (
            <div className="mt-4 rounded-2xl bg-sunken p-4">
              <p className="text-sm text-mute">{one.where}</p>
              <form className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center" onSubmit={(event) => { event.preventDefault(); save({ style: choice, secret }, `Saved. Only arrivals signed by ${one.name} start this workflow now.`); }}>
                <label htmlFor={`secret-${link.id}`} className="sr-only">{one.name} signing secret</label>
                <input
                  id={`secret-${link.id}`} type="password" autoComplete="off" spellCheck={false} value={secret} onChange={(event) => setSecret(event.target.value)}
                  placeholder={choice === "stripe" ? "whsec_..." : "Paste the signing secret"}
                  className="h-11 min-w-0 flex-1 rounded-full border border-field bg-surface px-4 font-mono text-[13px] md:h-10"
                />
                <button type="submit" disabled={pending || secret.trim().length < 8} className={pillPrimary}><Icon name={pending ? "Loader2" : "ShieldCheck"} size={16} className={pending ? "hw-spin" : ""} />Save the check</button>
              </form>
              {one.secret === "either" && (
                <button type="button" disabled={pending} onClick={() => save({ style: choice, make: true }, `Secret made. Copy it into ${one.name}; until then its arrivals are refused.`)} className={`${pillGhost} mt-2`}><Icon name="Key" size={16} />No secret yet? Make one for me</button>
              )}
              {saved.style !== NO_CHECK && <button type="button" onClick={() => { setChoice(saved.style); setChanging(false); }} className={`${pillGhost} mt-2`}>Cancel</button>}
            </div>
          )}
          {!editing && saved.style !== NO_CHECK && (
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
              <code tabIndex={0} aria-label={`The ${SIGNING_STYLES[saved.style].name} signing secret`} className="block w-full min-w-0 flex-1 overflow-x-auto whitespace-nowrap sm:w-auto rounded-full border border-line bg-sunken px-4 py-2.5 font-mono text-[13px] text-ink">{show ? saved.secret : hidden(saved.secret)}</code>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => setShow(!show)} aria-pressed={show} className={pillGhost}><Icon name={show ? "EyeOff" : "Eye"} size={16} />{show ? "Hide" : "Show"}</button>
                <CopyButton text={saved.secret} what="Secret">Copy secret</CopyButton>
                <button type="button" onClick={() => { setChanging(true); setMessage(null); }} className={pillGhost}><Icon name="Pencil" size={16} />Change secret</button>
              </div>
            </div>
          )}
          {message && <p role={message.tone === "bad" ? "alert" : "status"} className={`mt-3 flex items-start gap-2 rounded-2xl px-3 py-2 text-sm ${message.tone === "bad" ? "border border-error" : "bg-accent-subtle"}`}><Icon name={message.tone === "bad" ? "CircleAlert" : "CircleCheck"} className={`mt-0.5 shrink-0 ${message.tone === "bad" ? "text-error" : "text-accent-text"}`} />{message.words}</p>}
        </>
      )}
      <p className="mt-4 flex items-start gap-2 text-sm text-mute">
        <Icon name="Repeat" className="mt-0.5 shrink-0 text-accent-text" />
        <span>Repeats are skipped. When a sender tries the same delivery again, or the same words arrive twice within {limits.repeatMinutes} minutes, only one run starts. Delivery ids are remembered for {limits.repeatDays} days.</span>
      </p>
    </div>
  );
}

// ---- ONE LINK -----------------------------------------------------------------------------------------------------------------------
function LinkCard({ link, times, startedTimes, now, tzOffset, onSignal, index, limits, dataReady, reduce }) {
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
      // Signed like the real sender would (so the check is tested too), with a fresh delivery id (so two tests are two arrivals).
      const body = JSON.stringify(TEST_ARRIVAL);
      const signed = await signArrival(link.signing.style, link.signing.secret, body);
      const delivery = `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const response = await fetch(link.url, { method: "POST", headers: { "content-type": "application/json", "x-hushwork-delivery": delivery, ...signed }, body });
      const answer = await response.json().catch(() => null);
      if (response.ok && answer?.ok) {
        onSignal();
        pulse("good");
        setMessage({ tone: "good", words: "Test received. The workflow is running now; its run shows up under Arrivals in a few seconds." });
        timers.current.push(setTimeout(() => router.refresh(), 2500), setTimeout(() => router.refresh(), 9000), setTimeout(() => router.refresh(), 20000));
      } else {
        setMessage({ tone: "bad", words: answer?.error || "The link did not accept the test. Try again in a minute." });
        router.refresh();
      }
    } catch {
      setMessage({ tone: "bad", words: "Could not reach the link from this browser. Check your connection and try again." });
    }
    setTesting(false);
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  const today = useMemo(() => dailyCounts(startedTimes, now ?? 0, 1, link.tzOffset ?? tzOffset)[0], [startedTimes, now, link.tzOffset, tzOffset]); // the same day the server counts
  const ages = useMemo(() => (now === null ? [] : times.map((at) => (now - Date.parse(at)) / 86_400_000).filter(Number.isFinite)), [times, now]);
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
        <code tabIndex={0} aria-label="The address of this start link" className="block w-full min-w-0 flex-1 overflow-x-auto whitespace-nowrap sm:w-auto rounded-full border border-line bg-sunken px-4 py-2.5 font-mono text-[13px] text-ink">{link.url}</code>
        <CopyButton text={link.url}>Copy address</CopyButton>
      </div>
      <p className="mt-2 text-xs text-mute">{link.signing.style === "none" ? "Anyone who has this address can start this workflow, so share it only with the form or app that should, or turn on the sender check below." : `Only arrivals signed by ${SIGNING_STYLES[link.signing.style]?.name ?? "your sender"} start this workflow; anything else is refused.`} It can never send anything by itself.</p>

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
          <span>This workflow starts when something arrives, but does not read it yet. In the Builder, write <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[12.5px] text-ink">{INCOMING_TAG}</code> in the job of an Ask the AI step, like &ldquo;Read {INCOMING_TAG} and draft a short friendly reply&rdquo;, or put one field&rsquo;s tag, like <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[12.5px] text-ink">{fieldTag("email")}</code>, in the To of an email step.</span>
        </p>
      )}

      <FieldsPanel link={link} />

      <SenderCheck link={link} limits={limits} />

      <Snippets url={link.url} id={`link-${link.id}`} />

      <LinkDataPanel link={link} ages={ages} held={Number.isInteger(link.held) ? link.held : times.length} today={today} accountLimit={limits.perDay} ready={dataReady} reduce={reduce} />

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
          <Link href={`/app/builder?ask=${encodeURIComponent(STARTER)}`} className={`${first && ready.length === 0 ? pillPrimary : pillQuiet} h-auto min-h-11 max-w-full whitespace-normal! py-2 text-center md:min-h-10`}><Icon name="Sparkles" size={16} />Write a lead-reply workflow with Hushwork AI</Link>
        </div>
      )}
    </section>
  );
}

// ---- FROM YOUR APPS -----------------------------------------------------------------------------------------------------------------
// A workflow whose Start says "When an email arrives" or "When a calendar event is added" is watched (lib/app-events.js). It is MADE by saving
// that Start in the Builder, so this part only shows, switches and checks. Same frame, hairlines and pills as a link, so the two read as one family.
const WATCH_STATUS = {
  ok: "nothing new",
  new: "started the workflow",
  limited: "held back: too many at once",
};
const ASK = {
  gmail: "When an email arrives, read {incoming} and draft a short friendly reply for me to approve",
  calendar: "When a calendar event is added, read {incoming} and write me a short prep note for it",
};

function WatchCard({ watch, times, now, tzOffset, onSignal, index }) {
  const router = useRouter();
  const source = WATCH_SOURCES[watch.source];
  const [pending, start] = useTransition();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState(null);
  const [local, setLocal] = useState({ from: watch.enabled, value: watch.enabled });
  const enabled = local.from === watch.enabled ? local.value : watch.enabled;
  const counts = useMemo(() => dailyCounts(times, now ?? 0, 14, tzOffset), [times, now, tzOffset]);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const problem = enabled && (watch.status === "not_connected" || watch.status === "failed") ? watch.error || "Hushwork could not look the last time. It tries again in a few minutes." : "";
  function toggle(next) {
    setLocal({ from: watch.enabled, value: next });
    start(async () => {
      const result = await setWatchEnabled({ id: watch.id, enabled: next, tzOffset: -new Date().getTimezoneOffset() }).catch(() => ({ error: "Could not reach Hushwork. Check your connection and try again." }));
      if (result?.error) {
        setLocal({ from: watch.enabled, value: !next });
        setMessage({ tone: "bad", words: result.error });
      } else router.refresh();
    });
  }
  async function checkNow() {
    setChecking(true);
    setMessage(null);
    const result = await checkWatchNow({ id: watch.id }).catch(() => ({ error: "Could not reach Hushwork. Check your connection and try again." }));
    if (result?.error) setMessage({ tone: "bad", words: result.error });
    else {
      if (/started/.test(result.words)) {
        onSignal();
        pulse("good");
      } else pulse("rest");
      setMessage({ tone: "good", words: result.words });
    }
    router.refresh();
    setChecking(false);
  }
  const which = watch.filter ? (watch.source === "gmail" ? "New emails matching" : "New events with") : `Every new ${source.noun}`;
  return (
    <motion.li initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE, delay: 0.05 * index }} className={`${frame} min-w-0 p-5 sm:p-7`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <AppLogo id={source.logo} label={source.app} size={44} />
          <div className="min-w-0">
            <p className={`${label} ${!enabled ? "text-mute" : problem ? "text-error" : "text-success"}`}>{!enabled ? "Switched off" : problem ? "Needs you" : `Watching ${source.app}`}</p>
            <h3 className="mt-1 break-words text-[22px] font-semibold leading-tight tracking-[-0.02em]">{watch.name}</h3>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-mute">
          <span>{enabled ? "On" : "Off"}</span>
          <Switch checked={enabled} onChange={toggle} label={`Watch ${source.app} for ${watch.name}`} disabled={pending} />
        </label>
      </div>

      <p className="mt-5 flex flex-wrap items-center gap-2 text-[15px]">
        <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-sunken px-3.5 py-1.5">
          <Icon name={source.icon} size={16} className="shrink-0 text-accent-text" />
          <span className="min-w-0 truncate">{which}{watch.filter && <> <code className="font-mono text-[13px] text-ink">{watch.filter}</code>{watch.source === "calendar" && " in the title"}</>}</span>
        </span>
        <span className="text-sm text-mute">{watch.source === "gmail" ? "in your inbox, never your own" : "on your main calendar"}, looked at every 2 minutes</span>
      </p>
      {problem ? (
        <p role="alert" className="mt-3 flex flex-wrap items-start gap-2 rounded-2xl border border-error px-3 py-2 text-sm">
          <Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />
          <span className="min-w-[12rem] flex-1">{problem}</span>
          {watch.status === "not_connected" && <Link href="/app/connections" className="font-medium text-accent-text underline-offset-4 hover:underline">Open Connections</Link>}
        </p>
      ) : (
        <p className="mt-2 text-sm text-mute">{!enabled ? "Nothing is looked at while it is off. Switched back on, it starts from that moment." : watch.checkedAt && now !== null ? `Looked ${ago(watch.checkedAt, now)}${WATCH_STATUS[watch.status] ? `: ${WATCH_STATUS[watch.status]}` : ""}.` : "It looks for the first time within 2 minutes. Only what arrives from now on counts."}</p>
      )}

      <div className="mt-5 grid gap-5 border-t border-line pt-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <DayBars counts={counts} />
          <p className="mt-2 text-sm text-mute"><b className="font-semibold tabular-nums text-ink">{total}</b> started in the last 14 days{watch.lastAt && now !== null ? `, last one ${ago(watch.lastAt, now)}` : watch.count === 0 ? `. No new ${source.noun} has started it yet` : ""}.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={checkNow} disabled={!enabled || checking} className={pillPrimary}><Icon name={checking ? "Loader2" : "RefreshCw"} size={16} className={checking ? "hw-spin" : ""} />Check now</button>
          <Link href={`/app/builder?draft=${encodeURIComponent(watch.workflowId)}`} className={pillQuiet}><Icon name="Workflow" size={16} />Open workflow</Link>
        </div>
      </div>
      {message && <p role={message.tone === "bad" ? "alert" : "status"} className={`mt-3 flex items-start gap-2 rounded-2xl px-3 py-2 text-sm ${message.tone === "bad" ? "border border-error" : "bg-accent-subtle"}`}><Icon name={message.tone === "bad" ? "CircleAlert" : "CircleCheck"} className={`mt-0.5 shrink-0 ${message.tone === "bad" ? "text-error" : "text-accent-text"}`} />{message.words}</p>}
      {!watch.readsIncoming && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl border border-line px-3 py-2 text-sm text-mute">
          <Icon name="Info" className="mt-0.5 shrink-0 text-accent-text" />
          <span>This workflow starts on every new {source.noun}, but does not read it yet. In the Builder, write <code className="rounded bg-sunken px-1 py-0.5 font-mono text-[12.5px] text-ink">{INCOMING_TAG}</code> in the job of an Ask the AI step, like &ldquo;Read {INCOMING_TAG} and draft a short reply&rdquo;.</span>
        </p>
      )}
    </motion.li>
  );
}

function AppWatches({ watches, setup, arrivals, now, tzOffset, onSignal }) {
  const timesOf = useMemo(() => {
    const map = new Map();
    for (const arrival of arrivals) if (arrival.watchId && arrival.status === "started") map.set(arrival.watchId, [...(map.get(arrival.watchId) ?? []), arrival.at]);
    return map;
  }, [arrivals]);
  const missing = Object.keys(WATCH_SOURCES).filter((id) => !watches.some((watch) => watch.source === id));
  return (
    <section aria-labelledby="from-apps" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-2 pt-2">
        <div>
          <p className={`${label} text-mute`}>From your apps</p>
          <h2 id="from-apps" className="mt-1 text-[length:clamp(1.6rem,3vw,2.1rem)] font-semibold leading-tight tracking-[-0.03em]">A new email or event <span className="text-accent-text">starts the work.</span></h2>
        </div>
        <p className="max-w-[44ch] text-sm text-mute">Set a workflow&rsquo;s Start step in the Builder and save. Hushwork reads and drafts by itself; sending still waits for you.</p>
      </div>
      {setup ? (
        <p className={`${frame} flex items-start gap-2 p-5 text-sm`}><Icon name="Info" className="mt-0.5 shrink-0 text-accent-text" /><span><b className="font-semibold">One setup step is left.</b> Open supabase/app-events.sql and run it in Supabase. Start links are not affected.</span></p>
      ) : (
        <>
          {watches.length > 0 && (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-6">
              {watches.map((watch, index) => <WatchCard key={watch.id} watch={watch} times={timesOf.get(watch.id) ?? []} now={now} tzOffset={tzOffset} onSignal={onSignal} index={index} />)}
            </ul>
          )}
          {missing.length > 0 && (
            <ul className={`grid gap-4 ${missing.length > 1 ? "md:grid-cols-2" : ""}`}>
              {missing.map((id) => {
                const source = WATCH_SOURCES[id];
                return (
                  <li key={id} className={`${watches.length ? "rounded-[28px] border border-dashed border-line-strong" : frame} flex min-w-0 flex-col p-5 sm:p-7`}>
                    <AppLogo id={source.logo} label={source.app} size={40} />
                    <h3 className="mt-4 text-[20px] font-semibold tracking-[-0.02em]">{id === "gmail" ? "When an email arrives" : "When a calendar event is added"}</h3>
                    <p className="mt-1 flex-1 text-sm text-mute">{id === "gmail" ? "Every new email, or only the ones that match Gmail search words like from:ana@example.com or subject:invoice. Your own emails never count." : "Every new event on your main calendar, or only ones with a word in the title, like interview. Edits to old events do not count."}</p>
                    <div className="mt-4"><Link href={`/app/builder?ask=${encodeURIComponent(ASK[id])}`} className={pillQuiet}><Icon name="Sparkles" size={16} />{id === "gmail" ? "Write an email-reply workflow" : "Write a meeting-prep workflow"}</Link></div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

// ---- ARRIVALS -----------------------------------------------------------------------------------------------------------------------
function ForgetOne({ arrival, ready }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState("");
  if (!ready) return null;
  const forget = () => start(async () => {
    setError("");
    const result = await forgetArrivals({ linkId: arrival.linkId, eventId: arrival.id }).catch(() => ({ error: "Could not reach Hushwork. Try again." }));
    if (result?.error) setError(result.error);
    else router.refresh();
    setAsking(false);
  });
  return (
    <span className="flex flex-wrap items-center gap-1">
      {asking ? (
        <>
          <button type="button" disabled={pending} onClick={forget} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3 text-sm font-medium text-bg hover:bg-ink/85"><Icon name={pending ? "Loader2" : "Trash"} size={14} className={pending ? "hw-spin" : ""} />Delete</button>
          <button type="button" onClick={() => setAsking(false)} className="inline-flex h-9 items-center rounded-full px-3 text-sm font-medium text-mute hover:bg-raised hover:text-ink">Keep</button>
        </>
      ) : (
        <button type="button" onClick={() => setAsking(true)} aria-label={`Delete this arrival from ${arrival.name}`} className="grid h-9 w-9 place-items-center rounded-full text-mute hover:bg-raised hover:text-ink"><Icon name="Trash" size={16} /></button>
      )}
      {error && <span role="alert" className="basis-full text-xs text-error">{error}</span>}
    </span>
  );
}

// One arrival: a line with its first fields, and two buttons. "All fields" opens every field with its tag; "Replay" runs the workflow again with
// exactly these fields (writing stays off, so a send still waits for Approve).
function ArrivalRow({ arrival, now, dataReady }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [result, setResult] = useState(null); // { runId, waiting } | { error }
  const [words, tone] = STATUS[arrival.status] ?? STATUS.failed;
  const panel = `arrival-${arrival.id}-fields`;
  const replay = () => start(async () => {
    setResult(null);
    pulse("think");
    const done = await replayHookEvent({ id: arrival.id }).catch(() => ({ error: "Could not reach Hushwork. Check your connection and try again." }));
    setResult(done?.ok ? { runId: done.runId, waiting: done.waiting } : { error: done?.error || "Could not replay it. Try again." });
    pulse(done?.ok ? "good" : "bad");
    if (done?.ok) router.refresh();
  });
  return (
    <li className="grid gap-2 border-t border-line py-4 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:items-start sm:gap-4">
      <p className="font-mono text-[12px] text-mute">{ago(arrival.at, now) || " "}</p>
      <div className="min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className="flex min-w-0 flex-wrap items-center gap-2 text-[15px] font-medium">
            <span className="break-words">{arrival.name}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}>{words}</span>
            {arrival.test && <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-medium text-mute">Test</span>}
            {arrival.source && <span className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-medium text-mute"><Icon name={WATCH_SOURCES[arrival.source]?.icon ?? "Plug"} size={12} />{WATCH_SOURCES[arrival.source]?.app ?? "App"}</span>}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            {arrival.fields.length > 0 && (
              <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-mute hover:bg-raised hover:text-ink">
                <Icon name="ChevronDown" size={14} className={`transition-transform duration-120 ${open ? "rotate-180" : ""}`} />{open ? "Hide fields" : arrival.full ? `All ${arrival.fields.length} ${arrival.fields.length === 1 ? "field" : "fields"}` : "Preview"}
              </button>
            )}
            {!arrival.source && <button type="button" onClick={replay} disabled={pending || !arrival.full} title={arrival.full ? "Run the workflow again with these fields" : "Only a short preview was kept for this one, so it cannot be replayed"} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3 text-sm font-medium hover:bg-raised disabled:pointer-events-none disabled:opacity-50">
              <Icon name={pending ? "Loader2" : "RotateCcw"} size={14} className={pending ? "hw-spin" : ""} />{pending ? "Replaying" : "Replay"}
            </button>}
            {arrival.runId ? <Link href={`/app/runs?run=${encodeURIComponent(arrival.runId)}`} className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-accent-text hover:bg-accent-subtle">Open run<Icon name="ArrowRight" size={14} /></Link> : arrival.status === "started" ? <span className="px-3 py-2 text-sm text-mute">Running…</span> : null}
            {(arrival.runId || arrival.status !== "started") && <ForgetOne arrival={arrival} ready={dataReady} />}
          </div>
        </div>
        {arrival.fields.length === 0 ? <p className="mt-1 text-sm text-mute">Nothing came with it.</p> : !open && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {arrival.fields.slice(0, 4).map((field, index) => (
              <li key={index} className="max-w-full truncate rounded-full bg-raised px-2.5 py-1 text-[12.5px] sm:max-w-[18rem]"><span className="text-mute">{field.name}</span> {field.value.replace(/\s+/g, " ").slice(0, 80)}</li>
            ))}
            {arrival.fields.length > 4 && <li className="rounded-full px-2 py-1 text-[12.5px] text-mute">+{arrival.fields.length - 4} more</li>}
          </ul>
        )}
        {open && (
          <motion.dl id={panel} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }} className="mt-3 overflow-hidden rounded-2xl border border-line">
            {arrival.fields.map((field, index) => (
              <div key={index} className={`grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:gap-4 ${index > 0 ? "border-t border-line" : ""}`}>
                <dt className="min-w-0">
                  <span className="block break-words text-[13px] font-medium">{field.name}</span>
                  {arrival.full && <code className="mt-0.5 block truncate font-mono text-[11.5px] text-accent-text">{fieldTag(field.name)}</code>}
                </dt>
                <dd className="min-w-0 whitespace-pre-wrap break-words text-sm">{field.value}</dd>
              </div>
            ))}
            <p className="border-t border-line bg-sunken px-4 py-2 text-xs text-mute">{arrival.source ? "A short preview of what started it. The full words are on the run." : arrival.full ? "Someone else wrote this. Hushwork only ever uses it as information." : "Only this short preview was kept, from before Hushwork kept every field."}</p>
          </motion.dl>
        )}
        {result && (result.error
          ? <p role="alert" className="mt-3 flex items-start gap-2 rounded-2xl border border-error px-3 py-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0 text-error" />{result.error}</p>
          : <p role="status" className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-accent-subtle px-3 py-2 text-sm"><Icon name="CircleCheck" className="shrink-0 text-accent-text" />Replayed.{result.waiting > 0 ? ` ${result.waiting === 1 ? "A step is" : `${result.waiting} steps are`} waiting for your Approve.` : ""}<Link href={`/app/runs?run=${encodeURIComponent(result.runId)}`} className="font-medium text-accent-text underline-offset-2 hover:underline">Open the new run</Link></p>)}
      </div>
    </li>
  );
}

function Arrivals({ arrivals, now, keepsFields, dataReady }) {
  const [all, setAll] = useState(false);
  const shown = all ? arrivals.slice(0, 60) : arrivals.slice(0, 8);
  return (
    <section aria-labelledby="arrivals" className={`${frame} p-5 sm:p-7`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className={`${label} text-mute`}>Last 14 days</p>
          <h2 id="arrivals" className="mt-1 text-[22px] font-semibold tracking-[-0.02em]">Arrivals</h2>
        </div>
        <p className="max-w-[46ch] text-sm text-mute">{keepsFields ? "Every field is kept. Open one to read it all, or replay it after you change the workflow. Deleting one also removes the words its run kept." : "Only a short preview is kept until supabase/hook-fields.sql is run in Supabase. Then every field is kept and can be replayed."}</p>
      </div>
      {arrivals.length === 0 ? (
        <p className="mt-5 border-t border-line pt-5 text-sm text-mute">Nothing has arrived yet. Press <b className="font-medium text-ink">Send a test</b> on a link, or <b className="font-medium text-ink">Check now</b> after a new email, to see one travel the line.</p>
      ) : (
        <ol className="mt-5">
          {shown.map((arrival) => <ArrivalRow key={arrival.id} arrival={arrival} now={now} dataReady={dataReady} />)}
        </ol>
      )}
      {arrivals.length > 8 && <button type="button" onClick={() => setAll(!all)} className={`${pillGhost} mt-1`}>{all ? "Show fewer" : `Show ${Math.min(arrivals.length, 60) - 8} more`}</button>}
    </section>
  );
}

export default function LinksBoard({ links, arrivals, candidates, limits, keepsFields = true, watches = [], watchSetup = false, linksSetup = "", dataReady = false }) {
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
    { value: links.filter((link) => link.enabled).length + watches.filter((watch) => watch.enabled).length, words: "listening now" },
    { value: started.length, words: started.length === 1 ? "run started" : "runs started" },
    { value: 0, words: "sent without your OK" },
  ];
  const timesOf = useMemo(() => {
    const map = new Map();
    for (const arrival of arrivals) if (arrival.linkId) map.set(arrival.linkId, [...(map.get(arrival.linkId) ?? []), arrival.at]);
    return map;
  }, [arrivals]);
  const startedOf = useMemo(() => {
    const map = new Map();
    for (const arrival of arrivals) if (arrival.status === "started") map.set(arrival.linkId, [...(map.get(arrival.linkId) ?? []), arrival.at]);
    return map;
  }, [arrivals]);

  return (
    <div className="mt-8 min-w-0 space-y-6">
      <SignalStage beat={beat} numbers={numbers} reduce={reduce} />
      {linksSetup ? (
        <p className={`${frame} flex items-start gap-2 p-5 text-sm`}><Icon name="Info" className="mt-0.5 shrink-0 text-accent-text" /><span><b className="font-semibold">Start links need one setup step.</b> {linksSetup}</span></p>
      ) : (
        <>
          {links.length === 0 && <NewLink candidates={candidates} first full={false} maxLinks={limits.maxLinks} />}
          {links.length > 0 && (
            <ul className="grid grid-cols-[minmax(0,1fr)] gap-6">
              {links.map((link, index) => <LinkCard key={link.id} link={link} times={timesOf.get(link.id) ?? []} now={now} tzOffset={tzOffset} onSignal={signal} index={index} limits={limits} startedTimes={startedOf.get(link.id) ?? []} dataReady={dataReady} reduce={reduce} />)}
            </ul>
          )}
          {links.length > 0 && <NewLink candidates={candidates} first={false} full={links.length >= limits.maxLinks} maxLinks={limits.maxLinks} />}
        </>
      )}
      <AppWatches watches={watches} setup={watchSetup} arrivals={arrivals} now={now} tzOffset={tzOffset} onSignal={signal} />
      {(links.length > 0 || watches.length > 0) && <Arrivals arrivals={arrivals} now={now} keepsFields={keepsFields} dataReady={dataReady} />}
      <p className="text-xs text-mute">Each person&rsquo;s links can start up to {limits.perMinute} runs a minute and {limits.perDay} a day, and new emails and events up to {limits.watchPerDay} a day; more than that is written down and not run. A link can also have its own lower limit. Fields that look like a card number or a secret key are left out before anything is saved.</p>
    </div>
  );
}
