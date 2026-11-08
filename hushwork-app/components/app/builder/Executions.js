"use client";

import Link from "next/link";
import { motion } from "motion/react";
import { Btn } from "../../ui";
import { Icon } from "../../icons";
import RunTime from "../RunTime";
import { usePrefersReducedMotion } from "../../usePrefersReducedMotion";

// The Builder's Executions tab: this workflow's last runs (lib/builder-runs.js), newest first, each a link to the Runs page.
// `runs` comes from the server when the page opens; `saved` says whether there is a saved workflow to run at all.
const PILL = {
  good: ["bg-[color-mix(in_oklab,var(--success)_14%,transparent)] text-success", "CircleCheck"],
  you: ["bg-accent-subtle text-accent-text", "ShieldCheck"],
  bad: ["bg-[color-mix(in_oklab,var(--error)_12%,transparent)] text-error", "CircleAlert"],
  preview: ["bg-raised text-mute", "Eye"],
  quiet: ["bg-raised text-mute", "Clock"],
};

export default function Executions({ runs, saved, onTest, testing }) {
  const reduce = usePrefersReducedMotion();
  if (!runs.length) {
    return (
      <div className="grid h-full min-h-[24rem] place-items-center p-6">
        <div className="max-w-sm text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent-subtle text-accent-text"><Icon name="History" size={22} /></span>
          <p className="mt-4 text-lg font-semibold">No runs yet</p>
          <p className="mt-1 text-[15px] text-mute">{saved ? "Press Test to try it once. Reading steps happen by themselves; anything that sends waits for your OK." : "Publish the workflow first, then press Test to try it once."}</p>
          <Btn icon="Play" onClick={onTest} loading={testing} className="mt-5">Test it now</Btn>
        </div>
      </div>
    );
  }
  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6">
      <div className="mx-auto max-w-3xl">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-hint">{runs.length} {runs.length === 1 ? "run" : "runs"} of this workflow</p>
        <ol className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
          {runs.map((run, i) => {
            const [pill, icon] = PILL[run.tone] ?? PILL.preview;
            return (
              <motion.li key={run.id} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.04 }} className="border-t border-line first:border-t-0">
                <Link href={`/app/runs?run=${run.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-raised">
                  <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${pill}`}><Icon name={icon} size={13} />{run.label}</span>
                  <span className="min-w-0 flex-1 truncate text-sm">{run.live ? `Done for real: ${run.title || "one step"}` : `Practice run · ${run.steps} ${run.steps === 1 ? "step" : "steps"}`}</span>
                  <span className="shrink-0 text-sm tabular-nums text-mute"><RunTime iso={new Date(run.at).toISOString()} /></span>
                  <Icon name="ArrowRight" size={16} className="shrink-0 text-mute" />
                </Link>
              </motion.li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
