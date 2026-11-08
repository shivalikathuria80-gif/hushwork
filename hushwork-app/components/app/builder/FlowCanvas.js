"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Icon } from "../../icons";
import AppLogo from "../../AppLogo";
import { usePrefersReducedMotion } from "../../usePrefersReducedMotion";
import { nodesFor } from "@/lib/flow-graph";
import { DRAG_KIND, DRAG_ROW, PALETTE_BLOCKS, parseDragKind } from "@/lib/step-rows";
import { LIMITS } from "@/lib/validate";

// The Builder's canvas: the workflow drawn as cards on a dotted board, top to bottom, joined by lines.
//   - every line has a + in the middle: press it to put a block there, or drop a block (or a card) on it;
//   - an "Ask the AI" card shows what it looks at and the model on its right;
//   - an "Ask me first" card is a fork: YES carries on down, NO stops the run and nothing is sent;
//   - drag the empty board to move around, Ctrl/Cmd + wheel (or the buttons on the right) to zoom.
// It draws and reports; the Builder owns the rows (see Builder.js). Nothing here saves or runs anything.
//
// Props: rows, problemKeys (Set of row keys with something to fix), selected (a row key), busy, flowing (true while a test starts:
// light runs down the lines), onSelect(key), onInsert(index, blockId), onMoveTo(key, index), onMove(key, by), onRemove(key).

const ZOOM = { min: 0.4, max: 1.6, step: 0.15 };
const TONE = {
  start: "bg-accent text-on-accent",
  ai: "bg-accent-subtle text-accent-text",
  fork: "bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] text-warning",
  write: "bg-accent-subtle text-accent-text",
  read: "bg-accent-subtle text-accent-text",
  note: "bg-raised text-mute",
};
const ours = (event) => [...event.dataTransfer.types].some((type) => type === DRAG_ROW || type === DRAG_KIND);

export default function FlowCanvas({ rows, problemKeys, selected, busy, flowing, onSelect, onInsert, onMoveTo, onMove, onRemove }) {
  const reduce = usePrefersReducedMotion();
  const board = useRef(null);
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [menuAt, setMenuAt] = useState(null); // the + whose block menu is open: an insert position, or null
  const [dropAt, setDropAt] = useState(null); // the + a drag is over
  const [dragging, setDragging] = useState(null); // the key of a card being dragged
  const pan = useRef(null);
  const [panning, setPanning] = useState(false);
  const nodes = nodesFor(rows);
  const atMax = rows.length >= LIMITS.planSteps;
  // Cards with something on their right (an AI step's side cards, an approval's NO side) need room: the line moves a little left.
  const roomy = nodes.some((node) => node.sides.length || node.fork); // (on phones the side cards are hidden, so nothing moves there)

  // Wheel: Ctrl/Cmd + wheel (and a trackpad pinch, which the browser reports the same way) zooms around the pointer; a plain wheel moves the board.
  useEffect(() => {
    const el = board.current;
    if (!el) return undefined;
    const onWheel = (event) => {
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        setView((v) => ({ ...v, z: clamp(v.z * (event.deltaY > 0 ? 0.92 : 1.08)) }));
      } else {
        setView((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Escape closes the block menu.
  useEffect(() => {
    if (menuAt === null) return undefined;
    const onKey = (event) => { if (event.key === "Escape") { setMenuAt(null); document.getElementById(plusId(menuAt))?.focus(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuAt]);

  const zoom = (by) => setView((v) => ({ ...v, z: clamp(v.z + by) }));
  const fit = () => setView({ x: 0, y: 0, z: 1 });

  // Dragging the empty board moves it. A press on a card, a button or a menu is left alone.
  function down(event) {
    if (event.button !== 0 || event.target.closest("button, a, input, textarea, select, [data-card], [role=menu]")) return;
    pan.current = { x: event.clientX, y: event.clientY, start: view };
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setPanning(true);
    setMenuAt(null);
  }
  function move(event) {
    if (!pan.current) return;
    const { x, y, start } = pan.current;
    setView({ ...start, x: start.x + event.clientX - x, y: start.y + event.clientY - y });
  }
  const up = () => { pan.current = null; setPanning(false); };

  // Drops on a +: a block from the left panel makes a new step there, a card moves there.
  function over(event, index) {
    if (busy || !ours(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = [...event.dataTransfer.types].includes(DRAG_ROW) ? "move" : "copy";
    if (dropAt !== index) setDropAt(index);
  }
  function drop(event, index) {
    if (busy || !ours(event)) return;
    event.preventDefault();
    setDropAt(null);
    const key = Number(event.dataTransfer.getData(DRAG_ROW));
    if (key) { onMoveTo(key, index); return; }
    const block = parseDragKind(event.dataTransfer.getData(DRAG_KIND));
    if (block) onInsert(index, block);
  }

  const plus = (index, label) => (
    <Plus
      index={index} label={label} open={menuAt === index} hot={dropAt === index} disabled={busy || atMax}
      onToggle={() => setMenuAt((at) => (at === index ? null : index))}
      onOver={(event) => over(event, index)} onLeave={() => setDropAt((at) => (at === index ? null : at))} onDrop={(event) => drop(event, index)}
      menu={menuAt === index && <BlockMenu onPick={(id) => { setMenuAt(null); onInsert(index, id); }} />}
    />
  );

  return (
    <div className="relative h-full min-h-[34rem] overflow-hidden">
      <div
        ref={board}
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        className="absolute inset-0 cursor-grab touch-none select-none active:cursor-grabbing"
        style={{
          backgroundImage: "radial-gradient(color-mix(in oklab, var(--line-strong) 85%, transparent) 1.1px, transparent 1.3px)",
          backgroundSize: `${22 * view.z}px ${22 * view.z}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }}
      >
        <div
          className={`absolute left-1/2 top-8 origin-top pb-40 ${roomy ? "sm:-ml-24" : ""}`}
          style={{ transform: `translate(calc(-50% + ${view.x}px), ${view.y}px) scale(${view.z})`, transition: panning ? "none" : "transform 120ms var(--ease)" }}
        >
          {nodes.length === 0 ? (
            <Empty plus={plus(0, "Add the first step")} />
          ) : (
            <ol aria-label="Your workflow" className="flex flex-col items-center">
              {nodes.map((node, i) => (
                <li key={node.key} className={`relative flex flex-col items-center hover:z-20 focus-within:z-30 ${menuAt === i + 1 ? "z-30" : ""}`}>
                  <Card
                    node={node} number={i + 1} total={nodes.length} reduce={reduce} delay={i * 0.05}
                    selected={selected === node.key} problem={problemKeys.has(node.key)} busy={busy} faded={dragging === node.key}
                    onSelect={() => onSelect(node.key)} onMove={(by) => onMove(node.key, by)} onRemove={() => onRemove(node.key)}
                    onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData(DRAG_ROW, String(node.key)); setDragging(node.key); }}
                    onDragEnd={() => { setDragging(null); setDropAt(null); }}
                  />
                  <Line label={node.fork ? node.fork.yes : null} flowing={flowing} reduce={reduce} delay={i * 0.18} last={i === nodes.length - 1}>
                    {plus(i + 1, i === nodes.length - 1 ? "Add a step at the end" : `Add a step after step ${i + 1}`)}
                  </Line>
                </li>
              ))}
              <li>
                <span className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-line-strong bg-surface/80 text-hint" title="End of the workflow">
                  <Icon name="CircleCheck" size={16} />
                  <span className="sr-only">End of the workflow</span>
                </span>
              </li>
            </ol>
          )}
        </div>
      </div>

      {/* The controls on the right, like any canvas: add at the end, back to the start, zoom. */}
      <div className="absolute right-3 top-3 flex flex-col gap-2">
        <Tool icon="Plus" label="Add a step at the end" onClick={() => setMenuAt(nodes.length)} disabled={busy || atMax} />
        <Tool icon="Fit" label="Back to the start" onClick={fit} />
      </div>
      <div className="absolute bottom-3 right-3 flex flex-col gap-2">
        <Tool icon="ZoomIn" label="Zoom in" onClick={() => zoom(ZOOM.step)} disabled={view.z >= ZOOM.max} />
        <Tool icon="ZoomOut" label="Zoom out" onClick={() => zoom(-ZOOM.step)} disabled={view.z <= ZOOM.min} />
        <span aria-live="polite" className="rounded-lg bg-surface/90 px-1.5 py-0.5 text-center text-xs tabular-nums text-mute">{Math.round(view.z * 100)}%</span>
      </div>
      {atMax && <p className="absolute bottom-3 left-3 max-w-[18rem] rounded-xl border border-line bg-surface/95 px-3 py-2 text-sm text-mute shadow-sm">A workflow can have up to {LIMITS.planSteps} steps. Delete one to add another.</p>}
    </div>
  );
}

const clamp = (z) => Math.min(ZOOM.max, Math.max(ZOOM.min, Math.round(z * 100) / 100));
const plusId = (index) => `flow-plus-${index}`;

function Tool({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button" onClick={onClick} aria-label={label} title={label} aria-disabled={disabled || undefined}
      className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-ink shadow-sm transition-[background-color,transform] duration-120 ease-standard hover:bg-raised active:scale-95 aria-disabled:pointer-events-none aria-disabled:opacity-40"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

// One step as a card. The card itself opens the step in the side panel; ⋮ has move and delete; the card can be dragged onto a +.
function Card({ node, number, total, reduce, delay, selected, problem, busy, faded, onSelect, onMove, onRemove, onDragStart, onDragEnd }) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  useEffect(() => {
    if (!menu) return undefined;
    const away = (event) => { if (!menuRef.current?.contains(event.target)) setMenu(false); };
    const key = (event) => { if (event.key === "Escape") setMenu(false); };
    window.addEventListener("pointerdown", away);
    window.addEventListener("keydown", key);
    return () => { window.removeEventListener("pointerdown", away); window.removeEventListener("keydown", key); };
  }, [menu]);

  return (
    <motion.div
      data-card
      initial={reduce ? false : { opacity: 0, y: 18, scale: 0.96 }} animate={{ opacity: faded ? 0.45 : 1, y: 0, scale: 1 }}
      transition={reduce ? { duration: 0 } : { type: "spring", stiffness: 420, damping: 32, delay }}
      whileHover={reduce ? undefined : { y: -2 }}
      className="relative"
    >
      {node.start && (
        <span aria-hidden="true" className="absolute -left-10 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center text-accent-text">
          <span className="hw-ping absolute inset-0 rounded-full bg-accent/20" />
          <Icon name="Zap" size={20} weight="fill" />
        </span>
      )}
      <div
        draggable={!busy} onDragStart={onDragStart} onDragEnd={onDragEnd}
        className={`group relative w-[min(19.5rem,calc(100vw-7.5rem))] rounded-2xl border bg-surface shadow-[0_1px_2px_rgb(0_0_0/0.04),0_8px_24px_-12px_rgb(0_0_0/0.18)] transition-[border-color,box-shadow] duration-150 ease-standard ${selected ? "border-accent ring-4 ring-accent/15" : problem ? "border-error" : "border-line hover:border-line-strong"}`}
      >
        <button type="button" onClick={onSelect} aria-pressed={selected} className="flex w-full items-center gap-3 rounded-2xl p-3.5 pr-11 text-left outline-offset-2">
          {node.logo ? <AppLogo id={node.logo} size={40} /> : (
            <span aria-hidden="true" className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${TONE[node.tone]}`}><Icon name={node.icon} size={20} weight={node.tone === "ai" ? "fill" : "regular"} /></span>
          )}
          <span className="min-w-0 flex-1">
            <span className="sr-only">Step {number} of {total}: </span>
            <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.01em]">{node.title}</span>
            <span className="mt-0.5 block truncate text-sm text-mute">{node.sub}</span>
            {problem && <span className="mt-1 flex items-center gap-1 text-xs font-medium text-error"><Icon name="CircleAlert" size={12} />Something to fill in</span>}
          </span>
        </button>
        {node.bullets.length > 0 && (
          <ul className="mx-3.5 mb-3.5 space-y-1 border-t border-line pt-3 text-sm">
            {node.bullets.map((line) => <li key={line} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink" /><span className="line-clamp-2">{line}</span></li>)}
          </ul>
        )}
        <div ref={menuRef} className="absolute right-2 top-2.5">
          <button type="button" onClick={() => setMenu((open) => !open)} aria-expanded={menu} aria-haspopup="menu" aria-label={`More for step ${number}`} className="grid h-8 w-8 place-items-center rounded-lg text-mute hover:bg-raised hover:text-ink">
            <Icon name="More" size={18} weight="bold" />
          </button>
          <AnimatePresence>
            {menu && (
              <motion.div
                role="menu" initial={{ opacity: 0, scale: 0.95, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.12 }}
                className="absolute right-0 top-9 z-30 w-44 origin-top-right rounded-xl border border-line bg-surface p-1 text-sm shadow-lg"
              >
                <MenuItem icon="Pencil" onClick={() => { setMenu(false); onSelect(); }}>Edit</MenuItem>
                <MenuItem icon="ArrowUp" disabled={number === 1 || busy} onClick={() => { setMenu(false); onMove(-1); }}>Move up</MenuItem>
                <MenuItem icon="ArrowDown" disabled={number === total || busy} onClick={() => { setMenu(false); onMove(1); }}>Move down</MenuItem>
                <MenuItem icon="Trash" danger disabled={busy} onClick={() => { setMenu(false); onRemove(); }}>Delete</MenuItem>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* An AI step: what it looks at, and the model, as small cards joined to its right side. */}
        {node.sides.length > 0 && (
          <div aria-hidden="true" className="pointer-events-none absolute left-full top-0 hidden h-full sm:block">
            <svg width="72" height={node.sides.length * 76} className="absolute left-0 top-1 overflow-visible">
              {node.sides.map((side, s) => {
                const y0 = 28 + s * 22, y1 = 30 + s * 76;
                return (
                  <g key={side.label}>
                    <motion.path d={`M0 ${y0} H14 C40 ${y0} 34 ${y1} 64 ${y1}`} fill="none" stroke="var(--line-strong)" strokeWidth="1.4" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: delay + 0.2 }} />
                    <path d={`M60 ${y1 - 4} L65 ${y1} L60 ${y1 + 4}`} fill="none" stroke="var(--line-strong)" strokeWidth="1.4" />
                    <text x="22" y={y1 - 6} fontSize="11" fill="var(--hint)">{side.label}</text>
                  </g>
                );
              })}
            </svg>
            {node.sides.map((side, s) => (
              <motion.div
                key={side.label} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: delay + 0.35 + s * 0.08 }}
                className="absolute left-[4.5rem] flex w-max items-center gap-2 rounded-2xl border border-line bg-surface p-2 pr-3 shadow-sm"
                style={{ top: s * 76 }}
              >
                {side.logo ? <AppLogo id={side.logo} size={36} /> : <span className="grid h-9 w-9 place-items-center rounded-xl bg-accent-subtle text-accent-text"><Icon name={side.icon} size={18} weight="fill" /></span>}
                <span className="text-sm font-medium">{side.name}</span>
              </motion.div>
            ))}
          </div>
        )}

        {/* An approval step: the NO side stops the run. */}
        {node.fork && (
          <div aria-hidden="true" className="pointer-events-none absolute left-full top-1/2 hidden -translate-y-1/2 items-center sm:flex">
            <svg width="72" height="20" className="overflow-visible">
              <motion.path d="M0 10 H64" fill="none" stroke="var(--line-strong)" strokeWidth="1.4" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: delay + 0.2 }} />
              <path d="M60 6 L65 10 L60 14" fill="none" stroke="var(--line-strong)" strokeWidth="1.4" />
              <text x="22" y="4" fontSize="11" fill="var(--hint)">{node.fork.no}</text>
            </svg>
            <span className="flex w-max items-center gap-2 rounded-2xl border border-dashed border-line-strong bg-surface/90 px-3 py-2 text-sm text-mute">
              <Icon name="Stop" size={16} className="text-error" />Stop. Nothing is sent
            </span>
          </div>
        )}
      </div>
      {node.fork && <p className="mt-1 text-center text-xs text-hint sm:hidden">No stops the run. Nothing is sent.</p>}
    </motion.div>
  );
}

function MenuItem({ icon, children, onClick, disabled, danger }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} aria-disabled={disabled || undefined} className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-raised aria-disabled:pointer-events-none aria-disabled:opacity-40 ${danger ? "text-error" : ""}`}>
      <Icon name={icon} size={16} />{children}
    </button>
  );
}

// The line under a card, with its + in the middle and an arrow into the next card. When `flowing`, a dot of light runs down it.
function Line({ children, label, flowing, reduce, delay, last }) {
  return (
    <div className="relative flex h-[5.5rem] w-24 flex-col items-center">
      <svg aria-hidden="true" width="2" height="88" className="absolute left-1/2 top-0 -translate-x-1/2 overflow-visible">
        <motion.line x1="1" y1="0" x2="1" y2={last ? 70 : 82} stroke="var(--line-strong)" strokeWidth="1.4" strokeDasharray={last ? "3 4" : undefined} initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.4, delay: delay * 0.4 + 0.15 }} />
        {!last && <path d="M-3 78 L1 84 L5 78" fill="none" stroke="var(--line-strong)" strokeWidth="1.4" />}
        {!reduce && (
          <motion.circle
            cx="1" r={flowing ? 3.5 : 2.2} fill="var(--accent)"
            initial={{ cy: 0, opacity: 0 }}
            animate={{ cy: [0, 82], opacity: [0, flowing ? 1 : 0.55, 0] }}
            transition={{ duration: flowing ? 0.9 : 2.6, repeat: Infinity, delay: flowing ? delay * 0.5 : delay + 1, ease: "easeInOut", repeatDelay: flowing ? 0.1 : 2.4 }}
          />
        )}
      </svg>
      {label && <span className="absolute left-[calc(50%+10px)] top-2 text-xs text-hint">{label}</span>}
      <div className="absolute top-1/2 -translate-y-1/2">{children}</div>
    </div>
  );
}

function Plus({ index, label, open, hot, disabled, onToggle, onOver, onLeave, onDrop, menu }) {
  return (
    <div className="relative" onDragOver={onOver} onDragLeave={onLeave} onDrop={onDrop}>
      <button
        type="button" id={plusId(index)} onClick={onToggle} aria-label={label} title={label} aria-expanded={open} aria-haspopup="menu" aria-disabled={disabled || undefined}
        className={`grid h-6 w-6 place-items-center rounded-full border text-accent-text transition-[transform,background-color,border-color] duration-150 ease-standard hover:scale-125 hover:border-accent hover:bg-accent hover:text-on-accent aria-disabled:pointer-events-none aria-disabled:opacity-40 ${hot || open ? "scale-125 border-accent bg-accent text-on-accent" : "border-line bg-surface"}`}
      >
        <Icon name="Plus" size={12} weight="bold" />
      </button>
      {hot && <span aria-hidden="true" className="hw-ping pointer-events-none absolute inset-0 rounded-full bg-accent/30" />}
      <AnimatePresence>{menu}</AnimatePresence>
    </div>
  );
}

// The blocks a + offers (the same list as the panel on the left).
function BlockMenu({ onPick }) {
  const first = useRef(null);
  useEffect(() => { first.current?.focus(); }, []);
  return (
    <motion.div
      role="menu" aria-label="Add a block" data-card
      initial={{ opacity: 0, scale: 0.94, y: -6 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ type: "spring", stiffness: 500, damping: 34 }}
      className="absolute left-1/2 top-8 z-40 w-72 -translate-x-1/2 rounded-2xl border border-line bg-surface p-1.5 shadow-xl"
    >
      <p className="px-2.5 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wider text-hint">Add a block</p>
      <div className="max-h-80 overflow-y-auto">
        {PALETTE_BLOCKS.map((block, i) => (
          <button key={block.id} ref={i === 0 ? first : undefined} type="button" role="menuitem" onClick={() => onPick(block.id)} className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left hover:bg-raised focus-visible:bg-raised">
            <span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-text"><Icon name={block.icon} size={16} /></span>
            <span className="min-w-0"><span className="block text-sm font-medium">{block.label}</span><span className="block truncate text-xs text-mute">{block.help}</span></span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

function Empty({ plus }) {
  return (
    <div className="flex flex-col items-center">
      <div className="w-[19.5rem] rounded-2xl border border-dashed border-line-strong bg-surface/80 p-6 text-center backdrop-blur-sm">
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-2xl bg-accent-subtle text-accent-text"><Icon name="Workflow" size={22} /></span>
        <p className="mt-3 font-semibold">Nothing here yet</p>
        <p className="mt-1 text-sm text-mute">Tell the copilot what you want done, or press + to add the first block. You can also drag a block from the left.</p>
      </div>
      <div className="mt-4">{plus}</div>
    </div>
  );
}
