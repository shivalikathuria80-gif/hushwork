"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Btn, EASE, Reveal, StepRow, Switch, rowVariants } from "./ui";
import { Icon } from "./icons";

// Sample data below is illustrative. The samples are real components so visitors can try them.
const SAMPLE_LOG = [["Zap", "Trigger", "Invoice 14 days overdue", "0.1s"], ["CreditCard", "Check Stripe", "No payment found", "0.8s"], ["PenLine", "Draft reminder", "Polite, firm, your tone", "2.1s"]];
const SAMPLE_PLAN = [["Clock", "Run every Friday", "4:00 pm"], ["Table", "Pull closed tasks", "Linear · this week"], ["Mail", "Email each client", "PDF attached"]];
const TOOLS = [["Mail", "Gmail"], ["CreditCard", "Stripe"], ["Calendar", "Calendar"], ["MessageSquare", "Slack"], ["Table", "Sheets"], ["ListTodo", "Linear"]];

const popVariants = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.2, ease: EASE } } };

// A run that completes step by step when it scrolls into view, so the log reads as something that happened in order.
function RunLogSample() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  return (
    <div ref={ref}>
      <p className="mb-1 flex items-center gap-2 px-2 text-sm text-mute"><Icon name="CircleCheck" className="text-accent-text" />Sample run</p>
      <motion.ol className="space-y-1" initial="hidden" animate={inView ? "show" : "hidden"} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.5, delayChildren: 0.2 } } }}>
        {SAMPLE_LOG.map(([ic, a, b, d]) => (
          <StepRow key={a} icon={ic} title={a} sub={b} variants={rowVariants}
            right={<span className="flex items-center gap-2"><motion.span variants={popVariants} className="text-success"><Icon name="Check" size={14} /></motion.span><span className="font-mono text-xs tabular-nums text-mute">{d}</span></span>} />
        ))}
      </motion.ol>
    </div>
  );
}

// The defaults are the landing page's wording. The runs page passes its own, clearly labelled, sample wording.
export function ApprovalSample({
  heading = "Send 3 payment reminders?",
  body = "Orbit Labs, Lumen Studio and Fern & Co are overdue by 3 to 14 days.",
  approvedText = "Approved. They send at 9:00.",
  skippedText = "Skipped. Nothing was sent.",
}) {
  const [state, setState] = useState("pending");
  return (
    <div className="rounded-xl border border-line-strong bg-surface p-4">
      <p className="text-sm font-medium">{heading}</p>
      <p className="mt-1 text-sm text-mute">{body}</p>
      <AnimatePresence mode="wait" initial={false}>
        {state === "pending" ? (
          <motion.div key="actions" className="mt-3 flex gap-2" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.12 }}>
            <Btn size="sm" icon="Check" onClick={() => setState("approved")}>Approve</Btn>
            <Btn size="sm" variant="secondary" onClick={() => setState("skipped")}>Skip</Btn>
          </motion.div>
        ) : (
          <motion.p key="done" role="status" className="mt-3 flex items-center gap-2 text-sm" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE }}>
            <span className="shrink-0 text-accent-text">
              <Icon name={state === "approved" ? "CircleCheck" : "CircleX"} />
            </span>
            {state === "approved" ? approvedText : skippedText}
            <button onClick={() => setState("pending")} className="ml-auto h-8 rounded-md px-2 text-accent-text underline underline-offset-4 hover:bg-raised">Undo</button>
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

export function PauseSample({
  name = "Invoice chaser",
  label = "Invoice chaser is running",
  runningText = "Running. Next run at 9:00.",
  pausedText = "Paused. Nothing will run.",
}) {
  const [on, setOn] = useState(true);
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3">
      <div className="text-sm"><b className="font-medium">{name}</b><p className="text-mute">{on ? runningText : pausedText}</p></div>
      <Switch checked={on} onChange={setOn} label={label} />
    </div>
  );
}

function FeatureCard({ icon, title, body, children, className = "" }) {
  return (
    <article className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm ${className}`}>
      <div className="flex-1 bg-raised/60 p-4 sm:p-5">{children}</div>
      <div className="border-t border-line p-6">
        <h3 className="flex items-center gap-2 text-base font-semibold"><Icon name={icon} className="text-accent-text" />{title}</h3>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-mute">{body}</p>
      </div>
    </article>
  );
}

const toolList = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const toolItem = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.2, ease: EASE } } };

export default function Features() {
  return (
    <section id="features" className="border-y border-line bg-raised/50 py-24">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal><h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">Workflows that ask first, <span className="text-mute">and show their work</span></h2></Reveal>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <Reveal className="[&>article]:h-full">
            <FeatureCard icon="MessageSquareText" title="Plain-English builder" body="Say what should happen. Hushwork turns it into a workflow you can read, edit and approve. No nodes to wire up, no code to write.">
              <p className="mb-1 px-2 text-sm text-mute">Sample request</p>
              <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">“Every Friday at 4pm, email each client a summary of what we shipped.”</p>
              <ol className="mt-2 space-y-1">{SAMPLE_PLAN.map(([ic, a, b]) => <StepRow key={a} icon={ic} title={a} sub={b} />)}</ol>
            </FeatureCard>
          </Reveal>
          <Reveal className="md:col-span-2 [&>article]:h-full" delay={0.08}>
            <FeatureCard icon="ShieldCheck" title="Runs you can trust" body="Every run keeps a step-by-step log. Ask for approval before anything is sent, and pause any workflow in one click.">
              <div className="grid gap-4 md:grid-cols-2">
                <RunLogSample />
                <div>
                  <p className="mb-1 px-2 text-sm text-mute">Sample approval, try it</p>
                  <div className="space-y-3"><ApprovalSample /><PauseSample /></div>
                </div>
              </div>
            </FeatureCard>
          </Reveal>
          <Reveal className="md:col-span-3" delay={0.05}>
            <article className="grid gap-6 overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center md:gap-10">
              <div>
                <h3 className="flex items-center gap-2 text-base font-semibold"><Icon name="Plug" className="text-accent-text" />Connects the tools you already use</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-mute">Gmail, Stripe, Calendar, Slack, Sheets and more. Connect once; every workflow can use them.</p>
              </div>
              <motion.ul className="grid grid-cols-2 gap-2 sm:grid-cols-3" variants={toolList} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }}>
                {TOOLS.map(([ic, name]) => (
                  <motion.li key={name} variants={toolItem} className="flex items-center gap-3 rounded-xl border border-line bg-raised/60 px-4 py-3 text-sm font-medium">
                    <Icon name={ic} className="text-mute" />{name}
                  </motion.li>
                ))}
              </motion.ul>
            </article>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
