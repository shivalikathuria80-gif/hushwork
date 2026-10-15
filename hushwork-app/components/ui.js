"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Icon } from "./icons";

// The one easing curve used for arrivals: fast start, soft landing.
export const EASE = [0.16, 1, 0.3, 1];

// Buttons are solid. Shape rule: controls 12px (rounded-xl), cards 16px (rounded-2xl), big panels 24px (rounded-3xl).
// Pass `href` to get a real link that looks like a button (a button inside a link is invalid HTML).
export function Btn({ variant = "primary", size = "md", loading, icon, iconRight, type = "button", href, className = "", children, ...props }) {
  const look = {
    primary: "border border-accent bg-accent text-white hover:-translate-y-0.5 hover:bg-accent/90",
    secondary: "border border-field bg-surface text-ink hover:-translate-y-0.5 hover:bg-raised",
    ghost: "border border-transparent text-mute hover:bg-raised hover:text-ink",
    dark: "border border-ink bg-ink text-bg hover:-translate-y-0.5 hover:bg-ink/90",
  }[variant];
  const height = { sm: "h-11 px-3.5 text-sm md:h-9", md: "h-11 px-5 text-[15px]", lg: "h-12 px-6 text-base" }[size];
  const classes = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-[background-color,border-color,color,transform] duration-200 ease-out active:translate-y-0 active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 ${look} ${height} ${className}`;
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

export function Logo({ className = "" }) {
  return (
    <a href="#top" className={`inline-flex min-h-11 items-center gap-2 font-semibold tracking-tight text-ink ${className}`}>
      <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-[15px] font-bold text-white">H</span>Hushwork
    </a>
  );
}

// Fades and lifts into place the first time it scrolls into view.
// If the visitor asked for reduced motion, only the fade remains.
export function Reveal({ children, className = "", delay = 0, y = 16 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

// One row of a workflow plan. Used by the live agent box and by the feature samples.
// Give it `delay` to animate in on its own, or `variants` to be animated by a parent list.
export const rowVariants = { hidden: { opacity: 0.35 }, show: { opacity: 1, transition: { duration: 0.4, ease: EASE } } };
export function StepRow({ icon, title, sub, right, delay = -1, variants }) {
  const animation = variants
    ? { variants }
    : delay >= 0
      ? { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.4, delay, ease: EASE } }
      : {};
  return (
    <motion.li className="flex items-center gap-3 rounded-xl px-2 py-2" {...animation}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-raised text-ink"><Icon name={icon} size={16} /></span>
      <div className="min-w-0 flex-1 text-sm"><b className="font-medium">{title}</b><p className="text-mute">{sub}</p></div>
      {right}
    </motion.li>
  );
}
