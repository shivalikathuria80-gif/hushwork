"use client";

import { useEffect, useRef, useState } from "react";
import { unstable_rethrow } from "next/navigation";
import { AnimatePresence, LayoutGroup, motion } from "motion/react";
import { Btn } from "../../ui";
import { Icon } from "../../icons";
import { usePrefersReducedMotion } from "../../usePrefersReducedMotion";
import { pulse } from "../AppScene";
import { copilotTurn } from "@/lib/actions/copilot";
import { keywordPlan } from "@/lib/ai/keyword-plan";
import { stepsToPlan } from "@/lib/steps";
import { planLines } from "@/lib/flow-graph";
import { toWorking } from "@/lib/step-rows";
import { PALETTE_BLOCKS, DRAG_KIND, MAX_EMAIL_LIST } from "@/lib/step-rows";
import { SKILLS, accessOf } from "@/lib/skills/bundles";
import { requirementOf } from "@/lib/studio/capabilities";
import { LIMITS } from "@/lib/validate";

// The left side of the Builder. Two tabs:
//   Copilot  a chat: say what you want in a sentence, Hushwork plans it (with the AI when it is on, else the quick keyword plan, which
//            never leaves the browser), and "Apply to canvas" puts the plan on the board. Nothing runs and nothing is saved here.
//   Blocks   the blocks and ready-made skills, to press (adds at the end) or drag onto a + on the canvas, and "Email several people".
//
// Props: ai ({ enabled }), rowsCount, busy, onApply(rows, prompt), onAddBlock(id, label), onAddSkill(skill), onAddEmails(text) -> error or "".

const IDEAS = ["Why does a step wait for my approval?", "Every Monday at 9am, sum up my calendar week", "Tell me which emails need a reply today", "Chase unpaid invoices and email me a list"];
const HELLO = "Hi, I am Hushwork AI. Tell me what you want done and I will build the workflow, or ask me to change the one on the canvas. Anything that sends or creates waits for your OK.";

export default function Copilot({ ai, rowsCount, currentRows, busy, connections, onApply, onAddBlock, onAddSkill, onAddEmails }) {
  const reduce = usePrefersReducedMotion();
  const [tab, setTab] = useState("copilot");
  const [open, setOpen] = useState(true); // phones: the panel folds away so the canvas has room
  const [text, setText] = useState("");
  const [chat, setChat] = useState([]); // [{ id, from: "me" | "ai", text, lines?, rows?, applied?, note? }]
  const [thinking, setThinking] = useState(false);
  const list = useRef(null);
  const nextId = useRef(0);

  useEffect(() => { list.current?.scrollTo({ top: list.current.scrollHeight, behavior: reduce ? "auto" : "smooth" }); }, [chat, thinking, reduce]);

  async function ask(words) {
    const task = (words ?? text).trim();
    if (!task || thinking) return;
    if (task.length > LIMITS.promptMax) { say({ from: "ai", text: `That is a bit long. Use ${LIMITS.promptMax} characters or fewer.` }); return; }
    setText("");
    const history = chat.filter((one) => one.from === "me" || one.from === "ai").map((one) => ({ from: one.from, text: one.text }));
    say({ from: "me", text: task });
    setThinking(true);
    pulse("think");

    // AI on: Hushwork AI (Groq) answers, and builds or changes the workflow when that is what was asked.
    // AI off, offline or failing: the quick keyword plan, made right here in the browser, with a sentence saying why.
    let reply = null;
    let plan = null;
    let note = null;
    let request = task;
    if (ai?.enabled && navigator.onLine !== false) {
      try {
        const result = await copilotTurn({ message: task, history, lines: planLines(currentRows ?? []) });
        if (result?.error) {
          note = result.error;
          if (result.why === "empty" || result.why === "too_long" || result.why === "sensitive") { setThinking(false); say({ from: "ai", text: result.error }); pulse("bad"); return; }
        } else {
          reply = result.reply;
          if (Array.isArray(result.steps) && result.steps.length) plan = stepsToPlan(result.steps);
          else if (result.request) { request = result.request; note = result.notice ?? null; plan = keywordPlan(request); }
          else { setThinking(false); say({ from: "ai", text: reply }); pulse("good"); return; } // a question: just the answer
        }
      } catch (problem) {
        unstable_rethrow(problem);
        note = "Hushwork AI could not be reached, so this is the quick plan.";
      }
    } else if (!ai?.enabled) {
      note = "Hushwork AI is off on this server, so this is the quick plan.";
    }
    if (!plan) plan = keywordPlan(request);
    setThinking(false);
    const rows = toWorking(plan);
    if (!rows.length) { say({ from: "ai", text: "I could not make a plan from that. Try saying what should happen, and when." }); pulse("bad"); return; }
    pulse("good");
    say({ from: "ai", text: reply ?? "Here is a workflow with these steps:", lines: planLines(rows), rows, prompt: request, note, applied: false });
  }

  function say(message) {
    nextId.current += 1;
    const id = nextId.current;
    setChat((all) => [...all, { id, ...message }]);
  }

  function apply(message) {
    onApply(message.rows, message.prompt);
    setChat((all) => all.map((one) => (one.id === message.id ? { ...one, applied: true } : one)));
  }

  return (
    <aside aria-label="Hushwork AI and blocks" className="flex min-h-0 flex-col rounded-3xl border border-line bg-surface/95 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-24px_rgb(0_0_0/0.25)] backdrop-blur-md lg:h-full">
      <div className="flex items-start gap-3 border-b border-line p-4">
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.01em]"><Icon name="Sparkles" size={18} weight="fill" className="text-accent-text" />Hushwork AI</h2>
          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-hint">
            <span aria-hidden="true" className={`h-1.5 w-1.5 rounded-full ${ai?.enabled ? "hw-pulse-dot bg-success" : "bg-line-strong"}`} />Powered by Groq{ai?.enabled ? "" : " · off"}
          </p>
          <p className="mt-2 text-sm text-mute">Ask a question, or say what to build or change.</p>
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="copilot-body" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-mute hover:bg-raised hover:text-ink lg:hidden" aria-label={open ? "Fold Hushwork AI away" : "Open Hushwork AI"}>
          <Icon name="ChevronDown" size={18} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>

      <div id="copilot-body" className={`${open ? "flex" : "hidden"} min-h-0 flex-1 flex-col lg:flex`}>
        <LayoutGroup id="copilot-tabs">
          <div role="tablist" aria-label="Hushwork AI panel" className="mx-4 mt-3 flex rounded-xl bg-raised p-1 text-sm">
            {[["copilot", "Chat"], ["blocks", "Blocks"]].map(([id, label]) => (
              <button key={id} type="button" role="tab" id={`cp-tab-${id}`} aria-selected={tab === id} aria-controls={`cp-panel-${id}`} onClick={() => setTab(id)} className="relative flex-1 rounded-lg px-3 py-1.5 font-medium text-mute aria-selected:text-ink">
                {tab === id && <motion.span layoutId="cp-tab" className="absolute inset-0 rounded-lg bg-surface shadow-sm" transition={{ type: "spring", stiffness: 500, damping: 38 }} />}
                <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>

        {tab === "copilot" ? (
          <div id="cp-panel-copilot" role="tabpanel" aria-labelledby="cp-tab-copilot" className="flex min-h-0 flex-1 flex-col">
            <div ref={list} aria-live="polite" className="min-h-48 flex-1 space-y-3 overflow-y-auto p-4 lg:min-h-0">
              <Bubble from="ai" reduce={reduce}>{HELLO}</Bubble>
              {chat.length === 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {IDEAS.map((idea) => (
                    <button key={idea} type="button" onClick={() => ask(idea)} disabled={busy} className="rounded-full border border-line bg-surface px-3 py-1.5 text-left text-sm text-ink transition-colors hover:border-accent hover:text-accent-text">{idea}</button>
                  ))}
                </div>
              )}
              <AnimatePresence initial={false}>
                {chat.map((message) => (
                  <Bubble key={message.id} from={message.from} reduce={reduce}>
                    <p>{message.text}</p>
                    {message.lines && (
                      <ul className="mt-2 space-y-1">
                        {message.lines.map((line, i) => <li key={i} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink" />{line}</li>)}
                      </ul>
                    )}
                    {message.note && <p className="mt-2 text-sm text-mute">{message.note}</p>}
                    {message.rows && (
                      <>
                        <p className="mt-2 text-sm text-mute">{rowsCount > 0 && !message.applied ? `This replaces the ${rowsCount} ${rowsCount === 1 ? "step" : "steps"} on the canvas. Undo brings them back.` : "You can change each step on the canvas."}</p>
                        <Btn size="sm" icon={message.applied ? "Check" : "Workflow"} onClick={() => apply(message)} disabled={message.applied || busy} className="mt-3">
                          {message.applied ? "Applied to canvas" : "Apply to canvas"}
                        </Btn>
                      </>
                    )}
                  </Bubble>
                ))}
                {thinking && (
                  <Bubble key="thinking" from="ai" reduce={reduce}>
                    <span className="sr-only">Planning</span>
                    <span aria-hidden="true" className="flex gap-1 py-1">
                      {[0, 1, 2].map((d) => <motion.span key={d} className="h-2 w-2 rounded-full bg-accent" animate={reduce ? undefined : { y: [0, -4, 0], opacity: [0.4, 1, 0.4] }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />)}
                    </span>
                  </Bubble>
                )}
              </AnimatePresence>
            </div>

            <form onSubmit={(event) => { event.preventDefault(); ask(); }} className="m-3 mt-0 rounded-2xl border border-field bg-surface p-3 focus-within:border-accent">
              <label htmlFor="copilot-input" className="sr-only">Message Hushwork AI</label>
              <textarea
                id="copilot-input" value={text} onChange={(event) => setText(event.target.value)} rows={2} readOnly={busy}
                onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); ask(); } }}
                placeholder="Ask Hushwork AI, or say: every Friday, sum up my Linear tasks and email them to me"
                className="w-full resize-none bg-transparent text-[15px] placeholder:text-hint focus:outline-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-raised px-2 py-1 text-xs font-medium" title={ai?.enabled ? "Answers come from Groq" : "AI is off: a quick plan is made in your browser"}>
                  <Icon name="Sparkles" size={13} className="text-accent-text" />{ai?.enabled ? "Groq" : "Quick plan"}
                </span>
                <span className="flex-1" />
                <button type="submit" aria-label="Send" disabled={!text.trim() || thinking || busy} className="grid h-9 w-9 place-items-center rounded-full bg-accent text-on-accent transition-[transform,opacity] hover:bg-accent-hover active:scale-95 disabled:opacity-40">
                  <Icon name="ArrowUp" size={18} weight="bold" />
                </button>
              </div>
            </form>
          </div>
        ) : (
          <Blocks busy={busy} connections={connections} onAddBlock={onAddBlock} onAddSkill={onAddSkill} onAddEmails={onAddEmails} />
        )}
      </div>
    </aside>
  );
}

function Bubble({ from, children, reduce }) {
  const mine = from === "me";
  return (
    <motion.div
      layout={reduce ? false : "position"}
      initial={reduce ? false : { opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 420, damping: 34 }}
      className={`max-w-[92%] rounded-2xl px-4 py-3 text-[15px] leading-relaxed ${mine ? "ml-auto border border-line bg-surface" : "bg-raised"}`}
    >
      {children}
    </motion.div>
  );
}

const blockButton = "flex min-h-11 w-full items-center gap-3 rounded-xl border border-line bg-surface p-2 text-left transition-[background-color,border-color,transform] duration-120 ease-standard hover:border-line-strong hover:bg-raised active:scale-[0.99] aria-disabled:opacity-50";

function Blocks({ busy, connections, onAddBlock, onAddSkill, onAddEmails }) {
  const [emails, setEmails] = useState("");
  const [problem, setProblem] = useState("");
  return (
    <div id="cp-panel-blocks" role="tabpanel" aria-labelledby="cp-tab-blocks" className="min-h-0 flex-1 overflow-y-auto p-4">
      <p className="text-sm text-mute">Drag a block onto a + on the canvas, or press it to add it at the end.</p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
        {PALETTE_BLOCKS.map((item) => (
          <li key={item.id} draggable={!busy} onDragStart={(event) => { event.dataTransfer.effectAllowed = "copy"; event.dataTransfer.setData(DRAG_KIND, item.id); }} className="cursor-grab active:cursor-grabbing">
            <button type="button" onClick={() => onAddBlock(item.id, item.label)} aria-disabled={busy || undefined} className={blockButton}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-text"><Icon name={item.icon} size={18} /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium"><span className="sr-only">Add </span>{item.label}</span>
                <span className="block text-sm text-mute">{item.help}</span>
              </span>
              <Icon name="Plus" size={16} className="shrink-0 text-mute" />
            </button>
          </li>
        ))}
      </ul>

      <h3 id="skills-heading" className="mt-6 text-sm font-medium">Skills</h3>
      <p className="mt-1 text-sm text-mute">Ready-made steps. A skill that writes brings an “Ask me first” step with it.</p>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1" aria-labelledby="skills-heading">
        {SKILLS.filter((one) => one.step.kind !== "approve").map((one) => {
          const need = requirementOf(one.step, connections);
          const bad = need.status === "missing_connection" || need.status === "unavailable";
          const note = need.status === "missing_connection" ? `Needs ${need.missing.map((m) => m.name).join(", ")}` : need.status === "unavailable" ? "Cannot be connected yet" : accessOf(one) === "write" ? "Writes: needs Approve" : accessOf(one) === "think" ? "AI writes text" : "Reads only";
          return (
            <li key={one.id}>
              <button type="button" onClick={() => onAddSkill(one)} aria-disabled={busy || undefined} className={blockButton}>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-subtle text-accent-text"><Icon name={one.icon} size={18} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium"><span className="sr-only">Add skill </span>{one.name}</span>
                  <span className={`block text-sm ${bad ? "text-error" : "text-mute"}`}>{note}</span>
                </span>
                <Icon name="Plus" size={16} className="shrink-0 text-mute" />
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="mt-6 text-sm font-medium">Email several people</h3>
      <p className="mt-1 text-sm text-mute">One separate email for each address, and you approve each one. Up to {MAX_EMAIL_LIST}.</p>
      <label htmlFor="email-list" className="sr-only">Email addresses, separated by commas or new lines</label>
      <textarea
        id="email-list" value={emails} onChange={(event) => setEmails(event.target.value)} rows={3} readOnly={busy} placeholder="ana@example.com, bo@example.com"
        aria-describedby={problem ? "email-problem" : undefined} aria-invalid={problem ? true : undefined}
        className="mt-2 w-full rounded-xl border border-field bg-surface px-3 py-2 text-sm placeholder:text-hint"
      />
      <Btn type="button" size="sm" variant="secondary" icon="Plus" disabled={busy || !emails.trim()} className="mt-2" onClick={() => { const error = onAddEmails(emails); setProblem(error); if (!error) setEmails(""); }}>Add an email step for each</Btn>
      {problem && <p id="email-problem" role="alert" className="mt-2 text-sm text-error">{problem}</p>}
    </div>
  );
}
