"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Btn, EASE, Logo } from "./ui";
import { Icon } from "./icons";
import { useTheme } from "./useTheme";

const LINKS = [["How it works", "#how"], ["Automations", "#auto"], ["Features", "#features"], ["Try it", "#agent"]];
const linkClass = "rounded-xl px-3 py-2 text-sm text-ink transition-colors duration-120 ease-standard hover:bg-raised active:bg-line";

export default function Nav() {
  const [dark, toggleTheme] = useTheme();
  const [open, setOpen] = useState(false);

  const themeLabel = dark === null ? "Toggle theme" : dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      {/* Glass (see .hw-glass in globals.css): page content scrolls underneath this bar, so the blur has a job. Text on it is --ink. */}
      <nav aria-label="Main" className="hw-glass mx-auto flex h-14 max-w-5xl items-center gap-2 rounded-2xl px-4">
        <Logo />
        <div className="mx-auto hidden items-center gap-1 md:flex">
          {LINKS.map(([label, href]) => <a key={label} href={href} className={linkClass}>{label}</a>)}
        </div>
        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <button
            onClick={toggleTheme} aria-label={themeLabel}
            className="grid h-11 w-11 place-items-center rounded-xl text-mute transition-colors duration-120 ease-standard hover:bg-raised hover:text-ink active:bg-line md:h-9 md:w-9"
          >
            <span className="hidden dark:block"><Icon name="Sun" size={18} /></span>
            <span className="dark:hidden"><Icon name="Moon" size={18} /></span>
          </button>
          {/* Wrapped so "hidden on phones" cannot be overridden by the button's own display style. */}
          <div className="hidden sm:block"><Btn href="#wait" size="sm">Join the waitlist</Btn></div>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl text-mute transition-colors duration-120 ease-standard hover:bg-raised hover:text-ink active:bg-line md:hidden"
            aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}
          >
            <Icon name={open ? "X" : "Menu"} size={18} />
          </button>
        </div>
      </nav>
      <AnimatePresence>
        {open && (
          <motion.div
            id="mobile-menu"
            className="hw-glass mx-auto mt-2 max-w-5xl rounded-2xl p-2 shadow-lg md:hidden"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: EASE }}
          >
            {LINKS.map(([label, href]) => (
              <a key={label} href={href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-ink transition-colors duration-120 ease-standard hover:bg-raised active:bg-line">{label}</a>
            ))}
            <Btn href="#wait" onClick={() => setOpen(false)} className="mt-2 w-full">Join the waitlist</Btn>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
