"use client";

import { useState, useTransition } from "react";
import { motion } from "motion/react";
import { Icon } from "../icons";
import { EASE, Switch } from "../ui";
import { usePrefersReducedMotion } from "../usePrefersReducedMotion";
import { noticeText, noticeTitle, pushPayload, slackText } from "@/lib/approve-words";
import { cancelApproveLinks, removePushBrowsers, savePushBrowser, saveNotifySettings, sendTestNotice } from "@/lib/actions/notify";

// Settings > Notifications. Left: the choices (where, when, and whether a message may carry a review link). Right: what the person will
// actually get, drawn live from the very same words the server sends (lib/approve-words.js), on an email card, a Slack message and a lock
// screen. Shapes follow the owner's design system (hairlines, mono labels, pill controls, 28px frames) in Hushwork's own colours.

const pill = "inline-flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full px-5 text-sm font-semibold transition-colors duration-120 ease-standard disabled:pointer-events-none disabled:opacity-50 md:h-10";
const pillPrimary = `${pill} bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active`;
const pillQuiet = `${pill} border border-line-strong bg-surface text-ink hover:bg-raised active:bg-line`;
const label = "font-mono text-[11px] font-medium uppercase tracking-[0.08em]";
const HOURS = Array.from({ length: 12 }, (_, index) => index + 8);
const SAMPLE = [
  { workflow: "Lead replies", title: "Send an email (Gmail)", step: 3 },
  { workflow: "Invoices", title: "Send a Slack message", step: 2 },
];
const SITE = "https://hushwork.app";
const STATUS_WORDS = { sent: "sent", off: "not switched on for this Hushwork", no_address: "no address", not_sent: "could not be sent", error: "could not be sent", no_browser: "no browser switched on" };

function urlBase64ToUint8Array(base64) {
  const padded = `${base64}${"=".repeat((4 - (base64.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

function Channel({ icon, title, words, checked, onChange, children, disabled }) {
  return (
    <div className={`rounded-[20px] border p-4 transition-colors ${checked ? "border-accent-edge bg-accent-subtle" : "border-line bg-surface"}`}>
      <div className="flex items-start gap-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${checked ? "bg-accent text-on-accent" : "bg-raised text-mute"}`}><Icon name={icon} size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">{title}</p>
          <p className="text-sm text-mute">{words}</p>
        </div>
        <Switch checked={checked} onChange={onChange} label={title} disabled={disabled} />
      </div>
      {children}
    </div>
  );
}

function Preview({ form }) {
  const still = usePrefersReducedMotion();
  const reason = form.digest ? "digest" : "arrived";
  const items = SAMPLE.slice(0, form.digest ? 2 : 1).map((item, index) => (form.links ? { ...item, url: `${SITE}/a/hwa_${"x".repeat(6)}${index}` } : item));
  const words = { reason, name: "Lead replies", items, siteUrl: SITE };
  const push = pushPayload(words);
  const appear = (delay) => (still ? {} : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.35, ease: EASE, delay } });
  const key = `${form.digest}-${form.links}`;
  return (
    <div className="flex flex-col gap-4" aria-label="What you will get">
      <p className={`${label} text-mute`}>What you will get{form.digest ? ` · every day at ${String(form.digestHour).padStart(2, "0")}:00` : " · each time a step waits"}</p>
      {form.email && (
        <motion.figure key={`e-${key}`} {...appear(0)} className="rounded-[20px] border border-line bg-surface p-4">
          <figcaption className={`${label} flex items-center gap-2 text-mute`}><Icon name="Mail" size={14} />Email to you</figcaption>
          <p className="mt-2 text-[15px] font-semibold">{noticeTitle(reason, items.length)}</p>
          <pre className="mt-2 whitespace-pre-wrap break-words font-sans text-[13px] leading-relaxed text-mute">{noticeText(words).split("\nTo change how")[0]}</pre>
        </motion.figure>
      )}
      {form.slack && (
        <motion.figure key={`s-${key}`} {...appear(0.06)} className="rounded-[20px] border border-line bg-surface p-4">
          <figcaption className={`${label} flex items-center gap-2 text-mute`}><Icon name="MessageSquare" size={14} />Slack, a direct message to you</figcaption>
          <div className="mt-2 text-[13px] leading-relaxed">
            {slackText(words).split("\n").map((line, index) => (
              <p key={index} className={index === 0 ? "font-semibold" : "text-mute"}>{line.replace(/<([^|>]+)\|([^>]+)>/g, (_, __, text) => `[${text}]`).replace(/^\*|\*$/g, "")}</p>
            ))}
          </div>
        </motion.figure>
      )}
      {form.push && (
        <motion.figure key={`p-${key}`} {...appear(0.12)} className="mx-auto w-full max-w-[300px] rounded-[28px] border border-line bg-sunken p-3">
          <figcaption className="sr-only">Push notification</figcaption>
          <p className="text-center font-mono text-[28px] font-light tracking-tight text-ink">09:41</p>
          <div className="mt-3 rounded-2xl bg-surface/90 p-3 shadow-sm">
            <p className={`${label} flex items-center gap-1.5 text-mute`}><Icon name="Bell" size={12} />Hushwork · now</p>
            <p className="mt-1 text-[13px] font-semibold">{push.title}</p>
            <p className="text-[13px] text-mute">{push.body}</p>
          </div>
          <p className="mt-2 text-center text-[12px] text-mute">Tap opens {push.url.includes("/a/") ? "the review page" : "Runs"}</p>
        </motion.figure>
      )}
      {form.links && (
        <div className="rounded-[20px] border border-dashed border-line-strong p-4 text-sm">
          <p className={`${label} text-mute`}>A link opens a page like this</p>
          <ol className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[["Bell", "We told you"], ["Eye", "You read the exact words"], ["ShieldCheck", "You press Approve"]].map(([icon, words], index) => (
              <li key={words} className="flex flex-col items-center gap-1.5">
                <span className={`grid size-8 place-items-center rounded-full ${index === 2 ? "bg-accent text-on-accent" : "border border-line-strong text-mute"}`}><Icon name={icon} size={14} /></span>
                <span className="text-[12px] text-mute">{words}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

export default function NotifySettings({ initial, pushKey, pushBrowsers, openLinks, mailReady }) {
  const [form, setForm] = useState(initial);
  const [message, setMessage] = useState(null);
  const [pending, start] = useTransition();
  const [browsers, setBrowsers] = useState(pushBrowsers);
  const [open, setOpen] = useState(openLinks);
  const set = (patch) => { setForm((now) => ({ ...now, ...patch })); setMessage(null); };
  const say = (tone, words) => setMessage({ tone, words });

  const save = () => start(async () => {
    const result = await saveNotifySettings({ ...form, tzOffset: -new Date().getTimezoneOffset() });
    if (result?.error) say("bad", result.error);
    else say("good", "Saved.");
  });
  const test = () => start(async () => {
    const result = await sendTestNotice();
    if (result?.error) return say("bad", result.error);
    const parts = Object.entries(result.told).filter(([channel]) => form[channel]).map(([channel, status]) => `${channel === "push" ? "Push" : channel === "slack" ? "Slack" : "Email"}: ${STATUS_WORDS[status] ?? status}`);
    say(result.ok ? "good" : "bad", `${result.ok ? "Test sent." : "Nothing was sent."} ${parts.join(" · ")}`);
  });
  const pushOn = () => start(async () => {
    try {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return say("bad", "This browser cannot get push notifications. On iPhone, add Hushwork to your Home Screen first.");
      const allowed = await Notification.requestPermission();
      if (allowed !== "granted") return say("bad", "Notifications are blocked for this site in your browser settings.");
      const registration = await navigator.serviceWorker.register("/hw-sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;
      const subscription = (await registration.pushManager.getSubscription()) ?? (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(pushKey) }));
      const result = await savePushBrowser(subscription.toJSON());
      if (result?.error) return say("bad", result.error);
      setBrowsers((count) => count + 1);
      set({ push: true });
      say("good", "Push is on in this browser. Press Save to keep it.");
    } catch {
      say("bad", "This browser did not allow push. Try again, or use email.");
    }
  });
  const pushOff = () => start(async () => {
    const result = await removePushBrowsers();
    if (result?.error) return say("bad", result.error);
    try { const registration = await navigator.serviceWorker?.getRegistration("/"); await (await registration?.pushManager.getSubscription())?.unsubscribe(); } catch { /* the server side is gone already */ }
    setBrowsers(0);
    set({ push: false });
  });
  const cancel = () => start(async () => {
    const result = await cancelApproveLinks();
    if (result?.error) return say("bad", result.error);
    setOpen(0);
    say("good", "Every open link stopped working.");
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5">
        <div>
          <p className={`${label} text-mute`}>01 · Where</p>
          <div className="mt-2 flex flex-col gap-2">
            <Channel icon="Mail" title="Email" words={mailReady ? "Through your Gmail connection, to your own address." : "Needs More apps and a Gmail (send) connection."} checked={form.email} onChange={(email) => set({ email })} />
            <Channel icon="MessageSquare" title="Slack" words="A direct message to you only, never a channel." checked={form.slack} onChange={(slack) => set({ slack })}>
              {form.slack && (
                <label className="mt-3 block text-sm">
                  <span className="text-mute">Your Slack member ID</span>
                  <input value={form.slackTo} onChange={(event) => set({ slackTo: event.target.value })} placeholder="U04ABCDE12" maxLength={16} autoComplete="off" spellCheck={false} className="mt-1 block h-11 w-full rounded-full border border-field bg-surface px-4 font-mono text-[13px] uppercase text-ink" />
                  <span className="mt-1 block text-[12px] text-mute">In Slack: your profile picture, Profile, the three dots, Copy member ID.</span>
                </label>
              )}
            </Channel>
            <Channel icon="Bell" title="Push" words={pushKey ? (browsers ? `On in ${browsers} ${browsers === 1 ? "browser" : "browsers"}.` : "On this phone or computer, even when Hushwork is closed.") : "Not switched on for this Hushwork yet."} checked={form.push} onChange={(push) => (push && !browsers ? pushOn() : set({ push }))} disabled={!pushKey || pending}>
              {pushKey && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={pushOn} disabled={pending} className={pillQuiet}><Icon name="Bell" size={14} />{browsers ? "Add this browser" : "Switch on in this browser"}</button>
                  {browsers > 0 && <button type="button" onClick={pushOff} disabled={pending} className={pillQuiet}><Icon name="X" size={14} />Turn off everywhere</button>}
                </div>
              )}
            </Channel>
          </div>
        </div>

        <div>
          <p className={`${label} text-mute`}>02 · When</p>
          <div role="radiogroup" aria-label="When to tell you" className="mt-2 inline-flex rounded-full border border-line bg-sunken p-1">
            {[[false, "Each time"], [true, "Once a day"]].map(([digest, words]) => (
              <button key={words} type="button" role="radio" aria-checked={form.digest === digest} onClick={() => set({ digest })} className={`h-9 rounded-full px-4 text-sm font-semibold transition-colors ${form.digest === digest ? "bg-surface text-ink shadow-sm" : "text-mute hover:text-ink"}`}>{words}</button>
            ))}
          </div>
          {form.digest ? (
            <label className="mt-3 flex items-center gap-3 text-sm">
              <span className="text-mute">One digest at</span>
              <select value={form.digestHour} onChange={(event) => set({ digestHour: Number(event.target.value) })} className="h-10 rounded-full border border-field bg-surface px-4 font-mono text-[13px] text-ink">
                {HOURS.map((hour) => <option key={hour} value={hour}>{String(hour).padStart(2, "0")}:00</option>)}
              </select>
              <span className="text-mute">your time</span>
            </label>
          ) : (
            <p className="mt-2 text-sm text-mute">Never between 20:00 and 08:00, and at most 3 a day.</p>
          )}
        </div>

        <div>
          <p className={`${label} text-mute`}>03 · Approve from the message</p>
          <div className="mt-2 rounded-[20px] border border-line bg-surface p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">Add a review link to each step</p>
                <p className="text-sm text-mute">The link opens a page with the exact words the step will send, and an Approve button. Opening it does nothing by itself. Each link works once, for 48 hours, for one step. Anyone you forward the message to could use it.</p>
              </div>
              <Switch checked={form.links} onChange={(links) => set({ links })} label="Add a review link to each step" />
            </div>
            {open > 0 && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-sm">
                <span className="text-mute">{open} open {open === 1 ? "link" : "links"} not used yet</span>
                <button type="button" onClick={cancel} disabled={pending} className={pillQuiet}><Icon name="Trash" size={14} />Cancel them</button>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={save} disabled={pending} className={pillPrimary}>{pending ? <Icon name="Loader2" size={16} className="hw-spin" /> : <Icon name="Save" size={16} />}Save</button>
          <button type="button" onClick={test} disabled={pending} className={pillQuiet}><Icon name="Send" size={16} />Send me a test</button>
        </div>
        {message && <p role={message.tone === "bad" ? "alert" : "status"} className={`flex items-start gap-2 rounded-2xl px-3 py-2 text-sm ${message.tone === "bad" ? "border border-error" : "bg-accent-subtle"}`}><Icon name={message.tone === "bad" ? "CircleAlert" : "CircleCheck"} className={`mt-0.5 shrink-0 ${message.tone === "bad" ? "text-error" : "text-accent-text"}`} />{message.words}</p>}
      </div>
      <Preview form={form} />
    </div>
  );
}
