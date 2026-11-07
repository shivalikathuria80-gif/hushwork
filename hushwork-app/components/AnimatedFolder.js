"use client";

import { motion } from "motion/react";
import { Icon } from "./icons";

// A folder that opens on its bottom edge and fans out the papers inside it. Used by the landing page's Example workflows
// and by the category folders on the public /agents page. The parent decides when it is open; every other prop
// (aria-*, event handlers) goes on the button itself.
// `papers` is a list of [title, note] pairs, at most three are drawn. `compact` makes a smaller folder for a row of five.
export const FOLDER_SPRING = { type: "spring", stiffness: 170, damping: 20, mass: 0.9 };

export default function AnimatedFolder({ name, color, icon, papers, count, unit = "workflows", open, compact = false, selected = false, className = "", ...button }) {
  const tint = (pct) => `color-mix(in oklab, ${color} ${pct}%, var(--surface))`;
  const shown = papers.slice(0, 3);
  const lift = compact ? 70 : 96;
  const step = compact ? 26 : 34;
  return (
    <button
      type="button"
      {...button}
      className={`group relative block w-full rounded-3xl text-left outline-offset-4 [perspective:1100px] ${compact ? "h-[230px]" : "h-[300px]"} ${className}`}
    >
      {/* A soft glow under the open folder. */}
      <motion.span aria-hidden="true" className="absolute inset-x-8 bottom-4 h-16 rounded-full blur-2xl" style={{ background: color }} animate={{ opacity: open ? 0.35 : selected ? 0.2 : 0.08 }} transition={{ duration: 0.4 }} />

      {/* The folder's back, with its tab. */}
      <span aria-hidden="true" className={`absolute bottom-6 rounded-2xl border ${selected ? "border-2" : "border-line"} ${compact ? "inset-x-2 top-12" : "inset-x-4 top-16"}`} style={{ background: tint(30), borderColor: selected ? color : undefined }}>
        <span className={`absolute left-0 rounded-t-xl border border-b-0 border-line ${compact ? "-top-4 h-5 w-20" : "-top-5 h-6 w-28"}`} style={{ background: tint(30) }} />
      </span>

      {/* The papers inside, which fan out when the folder opens. */}
      {shown.map(([title, note], i) => (
        <motion.span
          key={title} aria-hidden="true"
          className={`absolute flex flex-col justify-between rounded-xl border border-line bg-surface shadow-md ${compact ? "inset-x-5 bottom-9 h-[72px] p-2.5" : "inset-x-9 bottom-10 h-24 p-3"}`}
          initial={false}
          animate={open
            ? { y: -lift - (shown.length - 1 - i) * step, rotate: (i - 1) * 4, x: (i - 1) * (compact ? 6 : 10), opacity: 1 }
            : { y: -i * (compact ? 6 : 8), rotate: 0, x: 0, opacity: 1 - i * 0.15 }}
          transition={{ ...FOLDER_SPRING, delay: open ? i * 0.07 : (2 - i) * 0.04 }}
          style={{ zIndex: 1 + i }}
        >
          <span className={`flex items-center gap-2 font-medium text-ink ${compact ? "text-[13px]" : "text-sm"}`}>
            <span className={`grid shrink-0 place-items-center rounded-md ${compact ? "h-5 w-5" : "h-6 w-6"}`} style={{ background: tint(18), color }}><Icon name={icon} size={compact ? 11 : 13} /></span>
            <span className="truncate">{title}</span>
          </span>
          <span className="flex items-center justify-between gap-2 text-xs text-mute">
            <span className="flex min-w-0 items-center gap-1"><Icon name="Clock" size={12} className="shrink-0" /><span className="truncate">{note}</span></span>
            {!compact && <span className="rounded-md border border-line bg-raised px-1.5 font-medium">Sample</span>}
          </span>
        </motion.span>
      ))}

      {/* The front flap, which tips forward on its bottom edge. */}
      <motion.span
        aria-hidden="true"
        className={`absolute bottom-6 z-10 flex flex-col justify-end rounded-2xl border border-line shadow-lg backdrop-blur-md ${compact ? "inset-x-2 h-[112px] p-3.5" : "inset-x-4 h-[150px] p-5"}`}
        style={{ background: `linear-gradient(160deg, ${tint(42)}, ${tint(22)})`, transformOrigin: "50% 100%" }}
        initial={false}
        animate={{ rotateX: open ? -32 : 0, y: open ? 6 : 0 }}
        transition={FOLDER_SPRING}
      >
        <span className={`flex items-center ${compact ? "gap-2" : "gap-3"}`}>
          <span className={`grid shrink-0 place-items-center rounded-xl bg-surface/80 shadow-sm ${compact ? "h-8 w-8" : "h-10 w-10"}`} style={{ color }}><Icon name={open ? "FolderOpen" : "Folder"} size={compact ? 17 : 20} /></span>
          <span className="min-w-0">
            <span className={`block truncate font-semibold text-ink ${compact ? "text-[15px]" : "text-lg"}`}>{name}</span>
            <span className={`block text-mute ${compact ? "text-xs" : "text-sm"}`}>{count ?? papers.length} {unit}</span>
          </span>
          <Icon name="ArrowRight" size={compact ? 16 : 18} className={`ml-auto shrink-0 text-mute transition-transform duration-200 group-hover:rotate-0 ${compact ? "hidden" : ""} ${selected ? "rotate-90" : "-rotate-45"}`} />
        </span>
      </motion.span>
    </button>
  );
}
