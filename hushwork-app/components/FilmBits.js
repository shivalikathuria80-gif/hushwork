"use client";

import { motion, useTransform } from "motion/react";

// Small parts shared by the landing page's full-screen photo scenes (HowItWorks.js, BeforeAfter.js), styled like a cinema title card:
// black stage, very thin oversized type, one italic serif word, white hairlines, and a credit-roll strip along the bottom.

// The bottom strip: one cell per chapter, a hairline above, and a thin line that fills under the chapter being shown.
// `progress` is a motion value from 0 to 1 across the whole scene.
export function FilmReel({ items, progress, active }) {
  return (
    <div aria-hidden="true" className="absolute inset-x-0 bottom-0 z-20 border-t border-white/25 bg-black/40 backdrop-blur-[2px]">
      <ol className="mx-auto grid max-w-6xl px-5" style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}>
        {items.map(([num, label], i) => (
          <ReelCell key={label} num={num} label={label} index={i} count={items.length} progress={progress} on={i === active} />
        ))}
      </ol>
    </div>
  );
}

function ReelCell({ num, label, index, count, progress, on }) {
  const fill = useTransform(progress, [index / count, (index + 1) / count], [0, 1], { clamp: true });
  return (
    <li className="relative py-4 pr-3">
      <motion.span className="absolute inset-x-0 top-0 h-px origin-left bg-white" style={{ scaleX: fill }} />
      <span className={`block text-[11px] font-medium uppercase leading-none tracking-[0.18em] transition-colors duration-300 sm:text-xs ${on ? "text-white" : "text-white/45"}`}>
        <span className="tabular-nums">{num}</span><span className="ml-3 hidden sm:inline">{label}</span>
      </span>
    </li>
  );
}

// A huge, very thin headline with one word in italic serif (written *like this*).
export function FilmTitle({ text, className = "" }) {
  return (
    <span className={`block text-[length:clamp(2.75rem,8.5vw,8rem)] font-extralight leading-[0.92] tracking-[-0.045em] ${className}`}>
      {text.split(/(\*[^*]+\*)/).filter(Boolean).map((part, i) => (part.startsWith("*")
        ? <span key={i} className="font-serif italic tracking-[-0.02em]">{part.slice(1, -1)}</span>
        : <span key={i}>{part}</span>))}
    </span>
  );
}
