"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useInView } from "motion/react";
import { Icon } from "@/components/icons";
import AnimatedFolder from "@/components/AnimatedFolder";
import { useMotionPause } from "@/components/MotionProvider";
import { usePrefersReducedMotion } from "@/components/usePrefersReducedMotion";

// The public /agents page's categories as a row of folders. Pick a folder to see its agents below it.
// - The chosen folder stays open; hovering or focusing another one peeks inside it.
// - The first time the row comes into view, each folder opens in turn once, then the chosen one stays open.
//   That wave is skipped with "reduce motion" on or the page's Pause pressed.
// - Every agent link is in the page's HTML (the other categories are only hidden), so search engines still see them all.
// - #finance (or another category id) in the address opens that folder.
// Only on the public page: the signed-in Agents page (/app/agents) keeps its own list.
const COLORS = {
  everyday: "var(--accent)",
  finance: "var(--success)",
  marketing: "var(--warning)",
  coding: "var(--info)",
  design: "color-mix(in oklab, var(--error) 55%, var(--accent))",
};
const colorOf = (id) => COLORS[id] ?? "var(--accent)";
const when = (agent) => (agent.schedule ? agent.schedule.replace(/^Every week on /, "").replace(/^Every day/, "Daily") : "When you run it");

export default function AgentFolders({ groups }) {
  const row = useRef(null);
  const inView = useInView(row, { amount: 0.5, once: true });
  const { paused } = useMotionPause();
  const reduce = usePrefersReducedMotion();
  const [chosen, setChosen] = useState(groups[0]?.id);
  const [peek, setPeek] = useState(null); // a folder the visitor hovers or focuses
  const [wave, setWave] = useState(null); // the folder the opening wave has open
  const touched = useRef(false);

  // Open the folder named in the address, if any.
  useEffect(() => {
    const read = () => {
      const id = window.location.hash.slice(1);
      if (groups.some((g) => g.id === id)) { touched.current = true; setWave(null); setChosen(id); }
    };
    const frame = requestAnimationFrame(read);
    window.addEventListener("hashchange", read);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("hashchange", read); };
  }, [groups]);

  // The opening wave: each folder in turn, once.
  useEffect(() => {
    if (!inView || paused || reduce || touched.current) return;
    let i = 0;
    setWave(groups[0].id);
    const id = setInterval(() => {
      i += 1;
      if (i >= groups.length || touched.current) { clearInterval(id); setWave(null); return; }
      setWave(groups[i].id);
    }, 650);
    return () => { clearInterval(id); setWave(null); };
  }, [inView, paused, reduce, groups]);

  const stopWave = () => { touched.current = true; setWave(null); };
  const choose = (id) => {
    stopWave();
    setChosen(id);
    try { window.history.replaceState(null, "", `#${id}`); } catch {}
  };
  const openId = wave ?? peek ?? chosen;
  const current = groups.find((g) => g.id === chosen) ?? groups[0];

  return (
    <div className="mt-12">
      <h2 className="text-xl font-semibold tracking-tight">Pick a folder</h2>
      <div ref={row} role="group" aria-label="Agent categories" className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 sm:grid-cols-3 lg:grid-cols-5">
        {groups.map((group) => (
          <AnimatedFolder
            key={group.id} compact unit={group.agents.length === 1 ? "agent" : "agents"}
            name={group.label} color={colorOf(group.id)} icon={group.icon}
            papers={group.agents.map((agent) => [agent.title, when(agent)])} count={group.agents.length}
            open={reduce ? group.id === chosen : openId === group.id} selected={group.id === chosen}
            aria-pressed={group.id === chosen} aria-controls="agent-folder-list"
            aria-label={`${group.label}: ${group.agents.length} agents. ${group.blurb}`}
            onMouseEnter={() => { stopWave(); setPeek(group.id); }} onMouseLeave={() => setPeek(null)}
            onFocus={() => { stopWave(); setPeek(group.id); }} onBlur={() => setPeek(null)}
            onClick={() => choose(group.id)}
          />
        ))}
      </div>

      <div id="agent-folder-list" aria-live="polite" className="mt-8">
        {groups.map((group) => (
          <section key={group.id} id={`pack-${group.id}`} aria-labelledby={`pack-${group.id}-title`} hidden={group.id !== current.id}>
            {group.id === current.id ? (
              <motion.div initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
                <GroupList group={group} reduce={reduce} />
              </motion.div>
            ) : (
              <GroupList group={group} reduce />
            )}
          </section>
        ))}
      </div>
    </div>
  );
}

function GroupList({ group, reduce }) {
  const color = colorOf(group.id);
  return (
    <>
      <h3 id={`pack-${group.id}-title`} className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `color-mix(in oklab, ${color} 18%, var(--surface))`, color }}><Icon name="FolderOpen" size={18} /></span>
        {group.label}
        <span className="text-base font-normal text-mute">· {group.agents.length}</span>
      </h3>
      <p className="mt-1 text-[15px] text-mute">{group.blurb}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {group.agents.map((agent, i) => (
          <motion.li
            key={agent.id}
            initial={reduce ? false : { opacity: 0, y: 18, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 24, delay: Math.min(i, 8) * 0.04 }}
          >
            <Link href={`/agents/${agent.id}`} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-4 shadow-sm transition-[background-color,border-color,transform] duration-120 ease-standard hover:-translate-y-0.5 hover:border-line-strong active:bg-raised">
              <span className="flex items-center gap-2 font-medium text-ink"><span className="shrink-0" style={{ color }}><Icon name={agent.icon} size={18} fallback="Bot" /></span>{agent.title}</span>
              <span className="mt-2 line-clamp-3 text-sm text-mute">{agent.body}</span>
              <span className="mt-auto pt-3 text-xs text-mute">{agent.needsText}{agent.schedule ? ` · ${agent.schedule.replace(/^Every /, "every ")}` : ""}</span>
            </Link>
          </motion.li>
        ))}
      </ul>
    </>
  );
}
