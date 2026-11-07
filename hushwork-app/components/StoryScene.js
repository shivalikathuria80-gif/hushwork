"use client";

import { useEffect, useRef } from "react";
import AppLogo from "./AppLogo";
import { useMotionPause } from "./MotionProvider";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

// A 15 second film that plays behind the rotating workflow cards, in four acts:
// 1. Chaos: a pile of chores shakes on screen while a cursor darts between them (someone, unseen, is overwhelmed).
// 2. Mind map: the chores are pulled into Hushwork, and lines reach out to the apps where the work lives.
// 3. Workflow: the apps line up into one workflow, and each step lights up as it runs.
// 4. Done: a large tick draws at the end of the row. Then it loops.
// Everything is moved with transforms from one clock (no React re-renders per frame), so it stays smooth.
// It stops off screen and when the page's Pause button is pressed. With "reduce motion" on it shows the
// finished workflow and the tick, standing still.

const T = 15; // seconds per loop
const CHORES = [
  "Reply to 43 emails", "Invoice #1042 overdue", "Update the CRM", "Weekly report due", "Book the client call",
  "Chase Fern & Co", "3 missed Slack pings", "Sheet out of date", "Approve expenses", "Prep Monday standup",
  "Follow up with the lead", "Card expiring on Stripe", "Move the 2pm", "Log this week's tickets",
];
const APPS = [["gmail", "Gmail"], ["calendar", "Calendar"], ["slack", "Slack"], ["sheets", "Sheets"], ["stripe", "Stripe"], ["linear", "Linear"]];
const CAPTIONS = [
  [0.3, 4.2, "Monday, 9:04. Forty-seven things need you."],
  [4.6, 8.2, "Hushwork finds where each task lives."],
  [8.6, 11.8, "Then turns it into one workflow, and runs it."],
  [12.2, 14.4, "Done. You didn't lift a finger."],
];

const clamp = (v) => Math.max(0, Math.min(1, v));
const ease = (v) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);
const span = (t, a, b) => ease(clamp((t - a) / (b - a)));
const lerp = (a, b, k) => a + (b - a) * k;
// The same "random" numbers on every visit, so the chaos looks designed.
const rand = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

export default function StoryScene({ className = "" }) {
  const stage = useRef(null);
  const svg = useRef(null);
  const chores = useRef([]);
  const apps = useRef([]);
  const checks = useRef([]);
  const lines = useRef([]);
  const pulses = useRef([]);
  const row = useRef(null);
  const hub = useRef(null);
  const cursor = useRef(null);
  const tick = useRef(null);
  const captions = useRef([]);
  const { paused } = useMotionPause();
  const reduce = usePrefersReducedMotion();
  const engine = useRef(null);

  useEffect(() => {
    const el = stage.current;
    let L = null; // the layout, in pixels
    let time = 0;

    const measure = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      const small = w < 640;
      const zone = h - (small ? 200 : 230); // the part above the cards
      const cx = w / 2;
      const cy = zone * (small ? 0.6 : 0.62);
      const rx = Math.min(w * (small ? 0.42 : 0.4), 520);
      const ry = zone * (small ? 0.34 : 0.32);
      const node = small ? 40 : 52;
      const scale = small ? 0.8 : 1; // the app tiles are drawn at 48px
      const spread = Math.min(w * (small ? 0.8 : 0.62), 700);
      const rowStart = cx - spread / 2 - (small ? 0 : 34);
      const gap = spread / (APPS.length - 1);
      L = {
        w, h, cx, cy, small, node, scale,
        map: APPS.map((_, i) => {
          const a = Math.PI + (i / (APPS.length - 1)) * Math.PI; // a half ring over the hub
          const k = i % 2 ? 0.62 : 1; // every other app sits closer in, so neighbours never overlap
          return [cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k];
        }),
        row: APPS.map((_, i) => [rowStart + i * gap, cy]),
        // On a phone the row fills the width, so the tick lands below it.
        tickAt: small ? [cx, cy + 92] : [rowStart + (APPS.length - 1) * gap + 92, cy],
        // Spread on a loose grid (5 across, 3 down) so the pile covers the whole stage, then nudged off the grid.
        chaos: CHORES.map((_, i) => [w * (0.1 + ((i % 5) + rand(i) * 0.8 - 0.4) * 0.2), h * (0.16 + (Math.floor(i / 5) + rand(i + 40) * 0.7 - 0.35) * 0.3)]),
      };
      svg.current.setAttribute("viewBox", `0 0 ${w} ${h}`);
      // The curved lines from the hub to each app.
      lines.current.forEach((path, i) => {
        const [x, y] = L.map[i];
        const qx = (cx + x) / 2;
        const qy = Math.min(cy, y) - 60;
        path.setAttribute("d", `M ${cx} ${cy} Q ${qx} ${qy} ${x} ${y}`);
        path._len = path.getTotalLength();
        path.style.strokeDasharray = `${path._len}`;
      });
      const end = small ? L.row[APPS.length - 1][0] : L.tickAt[0];
      row.current.setAttribute("d", `M ${L.row[0][0]} ${cy} L ${end} ${cy}`);
      row.current._len = end - L.row[0][0];
      row.current.style.strokeDasharray = `${row.current._len}`;
      draw(time);
    };

    const set = (node, x, y, s = 1, o = 1, r = 0) => {
      if (!node) return;
      node.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${s}) rotate(${r}deg)`;
      node.style.opacity = o;
    };

    const draw = (t) => {
      if (!L) return;
      const { cx, cy } = L;
      const out = 1 - span(t, 14.3, 15); // everything fades before the loop restarts
      const fadeIn = span(t, 0, 0.6);

      // Act 1: the chores shake, then get pulled into the hub.
      const shake = 1 - span(t, 3.4, 4.2);
      chores.current.forEach((n, i) => {
        const [x0, y0] = L.chaos[i];
        const pull = span(t, 3.8 + i * 0.05, 5 + i * 0.05);
        const jx = Math.sin(t * (9 + i) + i) * 3 * shake + Math.sin(t * 0.7 + i) * 14;
        const jy = Math.cos(t * (11 + i) + i * 2) * 3 * shake + Math.cos(t * 0.6 + i) * 10;
        const pop = span(t, 0.1 + i * 0.12, 0.5 + i * 0.12);
        set(n, lerp(x0 + jx, cx, pull), lerp(y0 + jy, cy, pull), lerp(1, 0.25, pull) * lerp(0.6, 1, pop), pop * (1 - pull) * out, Math.sin(t * 6 + i) * 2.5 * shake);
      });

      // The unseen person's cursor, darting from chore to chore and clicking.
      const hop = Math.floor(t * 2.2);
      const hopK = ease(clamp((t * 2.2) % 1 / 0.55));
      const a = L.chaos[(hop * 5) % L.chaos.length];
      const b = L.chaos[((hop + 1) * 5) % L.chaos.length];
      const click = hopK > 0.9 ? 0.82 : 1;
      set(cursor.current, lerp(a[0], b[0], hopK) + 18, lerp(a[1], b[1], hopK) + 14, click, (1 - span(t, 3.4, 3.9)) * span(t, 0.4, 0.8));

      // Act 2: the hub appears, lines reach out, the apps pop in and pulses run along the lines.
      const hubIn = span(t, 4.2, 5);
      const hubOut = span(t, 8.2, 9);
      set(hub.current, cx, cy, L.scale * lerp(0.4, 1, hubIn) * lerp(1, 0.6, hubOut) * (1 + Math.sin(t * 3) * 0.03), hubIn * (1 - hubOut) * out);
      lines.current.forEach((path, i) => {
        const grow = span(t, 5 + i * 0.12, 6.1 + i * 0.12);
        path.style.strokeDashoffset = `${path._len * (1 - grow)}`;
        path.style.opacity = `${(1 - hubOut) * out}`;
        const dot = pulses.current[i];
        const run = ((t - 6.2 - i * 0.2) / 1.1) % 1;
        const on = t > 6.2 + i * 0.2 && t < 8.2;
        if (on && path._len) {
          const p = path.getPointAtLength(path._len * clamp(1 - run));
          dot.setAttribute("cx", p.x);
          dot.setAttribute("cy", p.y);
        }
        dot.style.opacity = on ? `${Math.sin(clamp(run) * Math.PI)}` : "0";
      });

      // Act 3: the apps slide from the map into a row, and the row runs step by step.
      const line = span(t, 8.4, 9.6);
      const prog = clamp((t - 9.4) / 2.6); // how far the run has got along the row
      row.current.style.strokeDashoffset = `${row.current._len * (1 - prog)}`;
      row.current.style.opacity = `${span(t, 8.6, 9.2) * out}`;
      apps.current.forEach((n, i) => {
        const [mx, my] = L.map[i];
        const [rx, ry] = L.row[i];
        const appear = span(t, 5.6 + i * 0.12, 6.3 + i * 0.12);
        const step = i / (APPS.length);
        const lit = t > 9.4 && prog > step;
        const bob = Math.sin(t * 1.6 + i) * 4 * (1 - line);
        set(n, lerp(mx, rx, line), lerp(my, ry, line) + bob, L.scale * lerp(0.5, 1, appear) * (lit && prog < step + 0.12 ? 1.12 : 1), appear * out);
        n.dataset.lit = lit ? "1" : "0";
        set(checks.current[i], lerp(mx, rx, line) + L.node * 0.42, lerp(my, ry, line) - L.node * 0.62 + bob, lit ? 1 : 0.4, lit ? out : 0);
      });

      // Act 4: the big tick.
      const ring = span(t, 12, 12.7);
      const mark = span(t, 12.5, 13.1);
      set(tick.current, L.tickAt[0], L.tickAt[1], lerp(0.6, 1, ring) + Math.sin(clamp((t - 13.1) / 0.5) * Math.PI) * 0.08, ring * out);
      const [circle, check] = tick.current.querySelectorAll("circle, path");
      circle.style.strokeDashoffset = `${176 * (1 - ring)}`;
      check.style.strokeDashoffset = `${48 * (1 - mark)}`;

      captions.current.forEach((c, i) => {
        const [s, e] = CAPTIONS[i];
        const o = span(t, s, s + 0.5) * (1 - span(t, e - 0.4, e));
        c.style.opacity = `${o * fadeIn}`;
        c.style.transform = `translateY(${(1 - span(t, s, s + 0.5)) * 10}px)`;
      });
    };

    let frame = 0;
    let running = false;
    let visible = false;
    let last = 0;
    const loop = (now) => {
      frame = requestAnimationFrame(loop);
      time = (time + Math.max(0, Math.min(0.05, (now - last) / 1000))) % T;
      last = now;
      draw(time);
    };
    const start = () => { if (running || !visible) return; running = true; last = performance.now(); frame = requestAnimationFrame(loop); };
    const stop = () => { running = false; cancelAnimationFrame(frame); };
    const still = (at) => { stop(); time = at; draw(at); };

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) stop();
      else if (engine.current?.wanted) start();
    });
    io.observe(el);
    measure();
    engine.current = { start, stop, still, wanted: false };
    // For checking a frame by hand: /?story=10.5 freezes the film at 10.5 seconds.
    const frozen = parseFloat(new URLSearchParams(location.search).get("story"));
    if (frozen >= 0) engine.current.frozen = frozen;
    return () => { stop(); ro.disconnect(); io.disconnect(); engine.current = null; };
  }, []);

  useEffect(() => {
    const e = engine.current;
    if (!e) return;
    e.wanted = !paused && !reduce && e.frozen === undefined;
    if (e.frozen !== undefined) e.still(e.frozen);
    else if (reduce) e.still(13.6); // the finished workflow with its tick
    else if (paused) e.stop();
    else e.start();
  }, [paused, reduce]);

  return (
    <div ref={stage} aria-hidden="true" className={`pointer-events-none absolute inset-0 overflow-hidden select-none ${className}`}>
      {/* Captions, top centre */}
      <div className="absolute inset-x-0 top-6 flex justify-center px-5 md:top-8">
        <div className="relative h-8 w-full max-w-xl text-center">
          {CAPTIONS.map(([, , text], i) => (
            <p key={i} ref={(n) => (captions.current[i] = n)} className="absolute inset-x-0 top-0 text-sm font-medium tracking-tight text-mute opacity-0 md:text-base">
              {i === 3 ? <span className="text-success">{text}</span> : text}
            </p>
          ))}
        </div>
      </div>

      <svg ref={svg} className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="hw-line" x1="0" x2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.9" />
            <stop offset="1" stopColor="var(--accent-text)" stopOpacity="0.5" />
          </linearGradient>
        </defs>
        {APPS.map((_, i) => (
          <path key={i} ref={(n) => (lines.current[i] = n)} fill="none" stroke="url(#hw-line)" strokeWidth="1.5" strokeLinecap="round" style={{ opacity: 0 }} />
        ))}
        <path ref={row} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" style={{ opacity: 0 }} />
        {APPS.map((_, i) => (
          <circle key={i} ref={(n) => (pulses.current[i] = n)} r="4" fill="var(--accent-text)" style={{ opacity: 0, filter: "drop-shadow(0 0 6px var(--accent))" }} />
        ))}
      </svg>

      {CHORES.map((text, i) => (
        <div key={text} ref={(n) => (chores.current[i] = n)} className="absolute left-0 top-0 flex items-center gap-2 whitespace-nowrap rounded-xl border border-line bg-surface/90 px-3 py-1.5 text-xs font-medium text-ink shadow-md opacity-0 md:text-sm">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-error opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-error" /></span>
          {text}
        </div>
      ))}

      <div ref={cursor} className="absolute left-0 top-0 opacity-0">
        <svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l16 9-7 2-3 7z" fill="var(--ink)" stroke="var(--bg)" strokeWidth="1.5" strokeLinejoin="round" /></svg>
      </div>

      <div ref={hub} className="absolute left-0 top-0 opacity-0">
        <div className="grid h-16 w-16 place-items-center rounded-2xl bg-accent text-2xl font-bold text-on-accent shadow-[0_0_60px_-4px_var(--accent)] md:h-20 md:w-20 md:text-3xl">H</div>
      </div>

      {APPS.map(([id, label], i) => (
        <div key={id} ref={(n) => (apps.current[i] = n)} data-lit="0" className="group absolute left-0 top-0 flex flex-col items-center gap-1.5 opacity-0">
          <span className="rounded-xl ring-0 ring-accent transition-[box-shadow] duration-200 group-data-[lit=1]:shadow-[0_0_0_3px_var(--accent),0_0_28px_-2px_var(--accent)]">
            <AppLogo id={id} label={label} size={48} />
          </span>
          <span className="text-[11px] font-medium text-mute md:text-xs">{label}</span>
        </div>
      ))}
      {APPS.map((_, i) => (
        <span key={i} ref={(n) => (checks.current[i] = n)} className="absolute left-0 top-0 grid h-5 w-5 place-items-center rounded-full bg-success text-[11px] font-bold text-bg opacity-0">✓</span>
      ))}

      <div ref={tick} className="absolute left-0 top-0 opacity-0">
        <svg width="72" height="72" viewBox="0 0 64 64" className="drop-shadow-[0_0_24px_var(--success)]">
          <circle cx="32" cy="32" r="28" fill="none" stroke="var(--success)" strokeWidth="4" strokeDasharray="176" transform="rotate(-90 32 32)" />
          <path d="M19 33l9 9 17-19" fill="none" stroke="var(--success)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="48" />
        </svg>
      </div>
    </div>
  );
}
