"use client";

import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { Btn, EASE, Logo } from "./ui";
import { Icon } from "./icons";
import { useTheme } from "./useTheme";

const LINKS = [["How it works", "#how"], ["Automations", "#auto"], ["Features", "#features"], ["Try it", "#agent"]];
const linkClass = "rounded-xl px-3 py-2 text-sm text-mute transition-colors hover:bg-raised hover:text-ink";

export default function Nav() {
  const [dark, toggleTheme] = useTheme();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // The bar firms up once the page has moved, so it stays readable over content. State only changes when it flips.
  const { scrollY } = useScroll();
  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  const themeLabel = dark === null ? "Toggle theme" : dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-3" onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
      {/* Blur is kept on this bar only: page content scrolls underneath it, so the blur has a job. */}
      <nav aria-label="Main" className={`hw-nav mx-auto flex h-14 max-w-5xl items-center gap-2 rounded-2xl border border-line px-4 backdrop-blur-xl transition-colors duration-300 ${scrolled ? "bg-surface/95" : "bg-surface/70"}`}>
        <Logo />
        <div className="mx-auto hidden items-center gap-1 md:flex">
          {LINKS.map(([label, href]) => <a key={label} href={href} className={linkClass}>{label}</a>)}
        </div>
        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <motion.button
            onClick={toggleTheme} aria-label={themeLabel}
            whileTap={{ scale: 0.88, rotate: 18 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="grid h-11 w-11 place-items-center rounded-xl text-mute transition-colors hover:bg-raised hover:text-ink md:h-9 md:w-9"
          >
            <span className="hidden dark:block"><Icon name="Sun" size={18} /></span>
            <span className="dark:hidden"><Icon name="Moon" size={18} /></span>
          </motion.button>
          <Btn href="#wait" size="sm" className="hidden sm:inline-flex">Join the waitlist</Btn>
          <button
            className="grid h-11 w-11 place-items-center rounded-xl text-mute hover:bg-raised hover:text-ink md:hidden"
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
            className="mx-auto mt-2 max-w-5xl rounded-2xl border border-line bg-surface p-2 md:hidden"
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2, ease: EASE }}
          >
            {LINKS.map(([label, href]) => (
              <a key={label} href={href} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-ink hover:bg-raised">{label}</a>
            ))}
            <Btn href="#wait" onClick={() => setOpen(false)} className="mt-2 w-full">Join the waitlist</Btn>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
