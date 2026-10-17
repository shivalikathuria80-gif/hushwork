"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "./icons";

// The one easing curve (Arjun AI "standard"): the same curve as --ease in globals.css. Durations: 120ms, 200ms, 340ms.
export const EASE = [0.4, 0, 0.2, 1];

// Buttons are solid. Shape rule: chips 6px (rounded-md), controls 10px (rounded-xl), cards 16px (rounded-2xl), big panels 22px (rounded-3xl).
// Hover is one colour step, press is two. Nothing moves or scales.
// Pass `href` to get a real link that looks like a button (a button inside a link is invalid HTML).
export function Btn({ variant = "primary", size = "md", loading, icon, iconRight, type = "button", href, className = "", children, ...props }) {
  const look = {
    primary: "border border-transparent bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-active",
    secondary: "border border-field bg-surface text-ink shadow-sm hover:bg-raised active:bg-line",
    ghost: "border border-transparent text-mute hover:bg-raised hover:text-ink active:bg-line",
    dark: "border border-ink bg-ink text-bg hover:bg-ink/90 active:bg-ink/80",
  }[variant];
  const height = { sm: "h-11 px-4 text-sm md:h-9", md: "h-11 px-5 text-[15px]", lg: "h-12 px-6 text-base" }[size];
  const classes = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,border-color,color,box-shadow] duration-120 ease-standard disabled:pointer-events-none disabled:opacity-50 ${look} ${height} ${className}`;
  const content = (
    <>
      {loading ? <Icon name="Loader2" className="hw-spin" /> : icon && <Icon name={icon} />}
      {children}
      {iconRight && !loading && <Icon name={iconRight} />}
    </>
  );
  if (href && href.startsWith("/")) return <Link {...props} href={href} className={classes}>{content}</Link>;
  if (href) return <a {...props} href={href} className={classes}>{content}</a>;
  return <button {...props} type={type} aria-busy={loading || undefined} disabled={props.disabled || loading} className={classes}>{content}</button>;
}

// href defaults to "#top" (the landing page). The app passes "/app" and the sign-in page passes "/".
export function Logo({ className = "", href = "#top" }) {
  const classes = `inline-flex min-h-11 items-center gap-2 font-semibold tracking-tight text-ink ${className}`;
  const content = (
    <>
      <span className="grid h-7 w-7 place-items-center rounded-xl bg-accent text-[15px] font-bold text-on-accent">H</span>Hushwork
    </>
  );
  if (href.startsWith("/")) return <Link href={href} className={classes}>{content}</Link>;
  return <a href={href} className={classes}>{content}</a>;
}

// The "Pause motion" / "Play motion" button. Used by the landing workflow band and the sign-in sculpture.
// `glass` makes it a pill of frosted glass with ink text (the sign-in panel); otherwise it is a plain ghost button.
export function PauseButton({ paused, onToggle, glass = false }) {
  const look = glass ? "hw-glass rounded-full text-ink hover:bg-raised" : "rounded-xl text-mute hover:bg-raised hover:text-ink";
  return (
    <button onClick={onToggle} className={`inline-flex h-11 items-center gap-2 px-3 text-sm transition-colors duration-120 ease-standard ${look}`}>
      <Icon name={paused ? "Play" : "Pause"} size={14} />{paused ? "Play motion" : "Pause motion"}
    </button>
  );
}

// Fades and lifts into place the first time it scrolls into view.
// If the visitor asked for reduced motion, only the fade remains.
export function Reveal({ children, className = "", delay = 0, y = 12 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.34, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// One row of a workflow plan. Used by the live agent box and by the feature samples.
// Give it `delay` to animate in on its own, or `variants` to be animated by a parent list.
export const rowVariants = { hidden: { opacity: 0.35 }, show: { opacity: 1, transition: { duration: 0.2, ease: EASE } } };
export function StepRow({ icon, title, sub, right, delay = -1, variants }) {
  const animation = variants
    ? { variants }
    : delay >= 0
      ? { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.2, delay, ease: EASE } }
      : {};
  return (
    <motion.li className="flex items-center gap-3 rounded-xl px-2 py-2" {...animation}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={icon} size={16} fallback="Workflow" /></span>
      <div className="min-w-0 flex-1 text-sm"><b className="font-medium">{title}</b><p className="text-mute">{sub}</p></div>
      {right}
    </motion.li>
  );
}

// An on/off switch. 40x24 to look at, but the touch area is taller (the ::before box) so it is easy to hit on a phone.
// `label` is what a screen reader announces. The thumb slides with a short tween (no spring).
export function Switch({ checked, onChange, label, className = "", ...props }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} {...props}
      className={`relative h-6 w-10 shrink-0 rounded-full border transition-colors duration-120 ease-standard before:absolute before:-inset-x-1 before:-inset-y-2.5 before:content-[''] disabled:pointer-events-none disabled:opacity-50 ${checked ? "border-accent bg-accent" : "border-field bg-raised"} ${className}`}
    >
      <span className={`absolute left-[2px] top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition-transform duration-120 ease-standard ${checked ? "translate-x-4" : ""}`} />
    </button>
  );
}
