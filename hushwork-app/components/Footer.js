"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { Icon } from "./icons";
import { EASE, Logo } from "./ui";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// Draws the word as a field of dots on a canvas. The dot colour comes from the --mute token and is
// redrawn when the theme changes, so it works in both light and dark.
function DotWord({ word = "hushwork" }) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const draw = () => {
      const wrap = wrapRef.current;
      const width = wrap && wrap.clientWidth;
      if (!width) return;
      const canvas = canvasRef.current;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fontSize = width / (word.length * 0.56);
      const height = Math.round(fontSize * 0.62);
      const cell = Math.max(6, Math.round(width / 150));
      canvas.width = width * dpr; canvas.height = height * dpr;
      canvas.style.width = width + "px"; canvas.style.height = height + "px";

      // Step 1: write the word in plain text on a hidden canvas, so we can see where the letters are.
      const family = getComputedStyle(document.body).fontFamily; // the page's own Geist
      const scratch = document.createElement("canvas");
      scratch.width = width; scratch.height = height + fontSize * 0.35;
      const sx = scratch.getContext("2d");
      sx.font = `600 ${fontSize}px ${family}`; sx.textAlign = "center"; sx.textBaseline = "alphabetic"; sx.fillStyle = "#fff";
      sx.fillText(word, width / 2, fontSize * 0.95);
      const pixels = sx.getImageData(0, 0, scratch.width, scratch.height).data;

      // Step 2: draw one dot per grid cell, bigger where the letter is thicker.
      const g = canvas.getContext("2d");
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, width, height);
      g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--mute").trim();
      const top = fontSize * 0.32;
      for (let py = 0; py < height; py += cell) {
        for (let px = 0; px < width; px += cell) {
          let sum = 0, count = 0;
          for (let j = 0; j < cell; j += 2) for (let i = 0; i < cell; i += 2) {
            const yy = Math.floor(py + top + j);
            if (yy >= scratch.height) continue;
            sum += pixels[(yy * scratch.width + Math.floor(px + i)) * 4 + 3]; count++;
          }
          const coverage = count ? sum / count / 255 : 0;
          if (coverage > 0.04) { g.beginPath(); g.arc(px + cell / 2, py + cell / 2, Math.max(0.6, coverage * cell * 0.5), 0, 7); g.fill(); }
        }
      }
    };

    document.fonts.ready.then(draw, draw);
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(wrapRef.current);
    const themeObserver = new MutationObserver(draw);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => { resizeObserver.disconnect(); themeObserver.disconnect(); };
  }, [word]);

  return <div ref={wrapRef} className="w-full overflow-hidden" role="img" aria-label={word}><canvas ref={canvasRef} className="block" aria-hidden="true" /></div>;
}

const COLUMNS = [
  ["Product", [["How it works", "#how"], ["Automations", "#auto"], ["Features", "#features"], ["Try it", "#agent"], ["Waitlist", "#wait"]]],
  ["Company", [["Privacy", "/privacy"], ["Terms", "/terms"]]],
];
const linkClass = "inline-flex min-h-11 items-center text-mute transition-colors duration-120 ease-standard hover:text-ink";

export default function Footer() {
  const reduce = usePrefersReducedMotion();
  const watchRef = useRef(null);
  const seen = useInView(watchRef, { once: true, amount: 0.3 });
  return (
    <footer className="border-t border-line bg-bg px-5 pt-14 text-sm md:px-10">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-3">
        <div><Logo /><p className="mt-3 max-w-xs text-mute">Describe the task. Hushwork handles it.</p></div>
        {COLUMNS.map(([heading, links]) => (
          <div key={heading}>
            <p className="font-medium">{heading}</p>
            <ul className="mt-1">
              {links.map(([label, href]) => (
                <li key={label}>{href.startsWith("/") ? <Link href={href} className={linkClass}>{label}</Link> : <a href={href} className={linkClass}>{label}</a>}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-12 flex max-w-6xl items-center justify-between border-t border-line pt-4 text-mute">
        <span>© 2026 Hushwork</span>
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="inline-flex h-11 items-center gap-2 rounded-xl px-2 transition-colors duration-120 ease-standard hover:text-ink">
          Back to top<Icon name="ArrowUp" size={14} />
        </button>
      </div>
      {/* The closing moment: the wordmark fades in when the footer reaches the screen.
          The outer box watches for that moment; the inner box does the fading (watching an element that is itself hidden is unreliable). */}
      <div ref={watchRef} className="mx-auto mt-10 max-w-[1500px] md:mt-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: seen ? 1 : 0 }}
          transition={{ duration: reduce ? 0 : 0.34, ease: EASE }}
        >
          <DotWord />
        </motion.div>
      </div>
    </footer>
  );
}
