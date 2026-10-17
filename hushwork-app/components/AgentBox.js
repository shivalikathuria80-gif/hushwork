"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Btn, EASE, StepRow } from "./ui";
import { Icon } from "./icons";

const MODES = [["Search", "Search", "Look up details in your connected apps"], ["DeepResearch", "Telescope", "Research sources before drafting"], ["Reason", "Brain", "Check edge cases before running"]];
const SUGGEST = [
  ["Receipt", "Chase overdue invoices", "Every morning, check Stripe and email clients whose invoice is more than 7 days overdue."],
  ["FileBarChart", "Weekly client report", "Every Friday at 4pm, summarise closed Linear tasks and email a PDF to each client."],
  ["Inbox", "Triage my inbox", "File newsletters to Reading, star client emails and send me one digest at 8am."],
];

// Preview only: this matches keywords and returns canned steps. No AI model is called yet.
// The order matters: the first pattern that matches wins, so the narrow ones (lead, admin) come first and the
// broad "client" pattern (report) comes late. Exported so the workspace composer can use the same planner.
export function planFor(task, modes) {
  const t = task.toLowerCase();
  const approve = ["ShieldCheck", "Ask you to approve", "Nothing is sent until you say yes"];
  let s;
  if (/lead|enquir|prospect/.test(t)) s = [["UserPlus", "When a new lead arrives", "Contact form or email"], ["PenLine", "Draft a friendly reply", "Uses your tone of voice"], approve, ["Bell", "Remind you in 3 days", "If they have not replied"]];
  else if (/receipt|contract|calendar|admin|expense/.test(t)) s = [["Clock", "Run on the 1st of each month", "9:00 am"], ["Receipt", "Collect receipts and contracts", "From your inbox"], ["FolderInput", "File them by client", "One folder each"], ["Calendar", "Add deadlines to your calendar", "Only dates found in contracts"]];
  else if (/invoice|pay|overdue|stripe/.test(t)) s = [["Clock", "Run every morning", "8:00 am, weekdays"], ["CreditCard", "Find overdue invoices", "Stripe · older than 7 days"], ["PenLine", "Draft a polite reminder", "Uses your tone of voice"], approve, ["Send", "Send from Gmail", "Stops once the invoice is paid"]];
  else if (/inbox|newsletter|gmail/.test(t)) s = [["Mail", "When an email arrives", "Gmail · inbox"], ["Tags", "Classify it", "Client, newsletter, receipt"], ["FolderInput", "File or star it", "Reading, Expenses, Starred"], ["Bell", "Send one digest", "8:00 am daily"]];
  else if (/report|friday|summar|client/.test(t)) s = [["Clock", "Run every Friday", "4:00 pm"], ["Table", "Pull closed tasks", "Linear · this week"], ["FileText", "Write a plain summary", "Grouped by client"], approve, ["Mail", "Email each client", "PDF attached"]];
  else s = [["Zap", "Start when you say so", "Or on a schedule, you pick"], ["Search", "Gather what’s needed", "From your connected apps"], ["Sparkles", "Do the task", task.length > 48 ? task.slice(0, 48) + "…" : task], ["CircleCheck", "Report back", "One short summary"]];
  s = [...s];
  if (modes.includes("Search")) s.splice(1, 0, ["Search", "Look up details", "In your connected apps"]);
  if (modes.includes("DeepResearch")) s.splice(1, 0, ["Telescope", "Research sources", "Cross-check before drafting"]);
  if (modes.includes("Reason")) s.splice(s.length - 1, 0, ["Brain", "Check edge cases", "Skip anything that looks off"]);
  return s;
}

export default function AgentBox() {
  const [text, setText] = useState("");
  const [modes, setModes] = useState([]);
  const [files, setFiles] = useState([]);
  const [phase, setPhase] = useState("idle"); // idle -> thinking -> plan (steps appear one by one) -> ready
  const [plan, setPlan] = useState([]);
  const [shown, setShown] = useState(0);
  const fileRef = useRef(null);
  const taRef = useRef(null);
  const thinkTimer = useRef(null);

  const toggle = (m) => setModes((x) => (x.includes(m) ? x.filter((i) => i !== m) : [...x, m]));
  const run = (value) => {
    const task = (value ?? text).trim();
    if (!task) { taRef.current && taRef.current.focus(); return; }
    setPlan(planFor(task, modes));
    setShown(0);
    setPhase("thinking");
    thinkTimer.current = setTimeout(() => setPhase("plan"), 700);
  };

  // Reveals the plan one step at a time, then marks it ready.
  useEffect(() => {
    if (phase !== "plan") return;
    if (shown >= plan.length) {
      const t = setTimeout(() => setPhase("ready"), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown((s) => s + 1), 650);
    return () => clearTimeout(t);
  }, [phase, shown, plan]);
  useEffect(() => () => clearTimeout(thinkTimer.current), []);

  const reset = () => { setPhase("idle"); setPlan([]); setShown(0); setText(""); setFiles([]); };
  const busy = phase === "thinking" || phase === "plan";

  return (
    <div id="agent">
      <div className="field-focus rounded-3xl border border-field bg-surface p-4 shadow-sm">
        <label htmlFor="task" className="mb-2 block text-sm font-medium">What should Hushwork take off your plate?</label>
        <textarea
          id="task" ref={taRef} rows={3} value={text} disabled={busy}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); run(); } }}
          placeholder="e.g. Every Monday, remind clients with unpaid invoices"
          className="w-full resize-none bg-transparent text-[15px] leading-relaxed outline-hidden placeholder:text-hint disabled:opacity-60"
        />
        {files.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {files.map((f) => (
              <span key={f} className="inline-flex items-center gap-2 rounded-md bg-raised px-2 py-1 text-xs">
                <Icon name="Paperclip" size={12} />{f}
                <button aria-label={`Remove ${f}`} onClick={() => setFiles((x) => x.filter((i) => i !== f))} className="grid h-5 w-5 place-items-center rounded-md hover:bg-line"><Icon name="X" size={12} /></button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-1 flex flex-wrap items-center gap-2">
          {MODES.map(([k, ic, tip]) => {
            const on = modes.includes(k);
            return (
              <button key={k} title={tip} aria-pressed={on} onClick={() => toggle(k)}
                className={`inline-flex h-11 items-center gap-2 rounded-xl border px-3 text-sm transition-colors duration-120 ease-standard md:h-8 ${on ? "border-accent bg-accent-subtle text-accent-text" : "border-transparent bg-raised text-mute hover:text-ink"}`}>
                <Icon name={ic} size={14} />{k === "DeepResearch" ? "Deep research" : k}
              </button>
            );
          })}
          <Btn size="sm" variant="ghost" className="ml-auto" icon="Paperclip" onClick={() => fileRef.current.click()}>Attach files</Btn>
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => setFiles((x) => [...x, ...[...e.target.files].map((f) => f.name)])} />
          <button
            onClick={() => run()} disabled={busy} aria-label="Build workflow"
            className="grid h-11 w-11 place-items-center rounded-full bg-accent text-on-accent transition-colors duration-120 ease-standard hover:bg-accent-hover active:bg-accent-active disabled:opacity-50 md:h-9 md:w-9"
          >
            <Icon name={busy ? "Loader2" : "ArrowUp"} className={busy ? "hw-spin" : ""} />
          </button>
        </div>
      </div>
      <p className="mt-2 px-1 text-sm text-mute">This is a preview. It drafts a plan and sends nothing.</p>

      {phase === "idle" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-sm text-mute">Try one:</span>
          {SUGGEST.map(([ic, t, p]) => (
            <button key={t} onClick={() => { setText(p); run(p); }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-sm transition-colors duration-120 ease-standard hover:bg-raised active:bg-line md:h-9">
              <Icon name={ic} size={14} className="text-mute" />{t}
            </button>
          ))}
        </div>
      )}

      {phase !== "idle" && (
        <motion.div
          className="mt-4 rounded-2xl border border-line bg-surface p-4 shadow-sm" aria-live="polite"
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, ease: EASE }}
        >
          <div className="flex items-center gap-2 px-2 text-sm text-mute">
            {phase === "thinking" ? (
              <><Icon name="Loader2" className="hw-spin" />Reading your request<span className="hw-caret ml-1 inline-block h-4 w-0.5 translate-y-0.5 bg-current" aria-hidden="true"></span></>
            ) : (
              <><Icon name="Workflow" className="text-accent-text" />{phase === "ready" ? "Workflow ready" : "Building your workflow"}</>
            )}
          </div>
          <ol className="mt-2 space-y-1">
            {plan.slice(0, shown).map(([ic, a, b], i) => (
              <StepRow key={a + i} delay={0} icon={ic} title={`${i + 1}. ${a}`} sub={b}
                right={<motion.span className="shrink-0 text-accent-text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: EASE, delay: 0.1 }}><Icon name="Check" size={16} /></motion.span>} />
            ))}
          </ol>
          {phase === "ready" && (
            <motion.div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line px-2 pt-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
              <Btn href="#wait" size="sm" iconRight="ArrowRight">Join the waitlist</Btn>
              <Btn size="sm" variant="secondary" icon="Pencil" onClick={() => { setPhase("idle"); setPlan([]); }}>Edit request</Btn>
              <Btn size="sm" variant="ghost" icon="RotateCcw" onClick={reset}>Start over</Btn>
              <p className="w-full text-sm text-mute">Nothing is saved yet. Join the waitlist to be first to run it.</p>
            </motion.div>
          )}
        </motion.div>
      )}
    </div>
  );
}
