const MODES = [['Search', 'Search', 'Look up details in your connected apps'], ['DeepResearch', 'Telescope', 'Research sources before drafting'], ['Reason', 'Brain', 'Check edge cases before running']];
const SUGGEST = [['Receipt', 'Chase overdue invoices', 'Every morning, check Stripe and email clients whose invoice is more than 7 days overdue.'], ['FileBarChart', 'Weekly client report', 'Every Friday at 4pm, summarise closed Linear tasks and email a PDF to each client.'], ['Inbox', 'Triage my inbox', 'File newsletters to Reading, star client emails and send me one digest at 8am.']];
function planFor(task, modes) {
  const t = task.toLowerCase();
  let s;
  if (/invoice|pay|overdue|stripe/.test(t)) s = [['Clock', 'Run every morning', '8:00 am, weekdays'], ['CreditCard', 'Find overdue invoices', 'Stripe · older than 7 days'], ['PenLine', 'Draft a polite reminder', 'Uses your tone of voice'], ['Send', 'Send from Gmail', 'Stops once the invoice is paid']];
  else if (/report|friday|summar|client/.test(t)) s = [['Clock', 'Run every Friday', '4:00 pm'], ['Table', 'Pull closed tasks', 'Linear · this week'], ['FileText', 'Write a plain summary', 'Grouped by client'], ['Mail', 'Email each client', 'PDF attached']];
  else if (/inbox|email|newsletter|gmail/.test(t)) s = [['Mail', 'When an email arrives', 'Gmail · inbox'], ['Tags', 'Classify it', 'Client, newsletter, receipt'], ['FolderInput', 'File or star it', 'Reading, Expenses, Starred'], ['Bell', 'Send one digest', '8:00 am daily']];
  else s = [['Zap', 'Start when you say so', 'Or on a schedule — you pick'], ['Search', 'Gather what’s needed', 'From your connected apps'], ['Sparkles', 'Do the task', task.length > 48 ? task.slice(0, 48) + '…' : task], ['CircleCheck', 'Report back', 'One short summary']];
  s = [...s];
  if (modes.includes('Search')) s.splice(1, 0, ['Search', 'Look up details', 'In your connected apps']);
  if (modes.includes('DeepResearch')) s.splice(1, 0, ['Telescope', 'Research sources', 'Cross-check before drafting']);
  if (modes.includes('Reason')) s.splice(s.length - 1, 0, ['Brain', 'Check edge cases', 'Skip anything that looks off']);
  return s;
}
function AgentBox() {
  const [text, setText] = useState(''); const [modes, setModes] = useState([]); const [files, setFiles] = useState([]);
  const [phase, setPhase] = useState('idle'); const [plan, setPlan] = useState([]); const [shown, setShown] = useState(0); const [saved, setSaved] = useState(false);
  const fileRef = useRef(); const taRef = useRef();
  const toggle = m => setModes(x => x.includes(m) ? x.filter(i => i !== m) : [...x, m]);
  const run = (v) => { const task = (v ?? text).trim(); if (!task) { taRef.current && taRef.current.focus(); return; } const p = planFor(task, modes); setPlan(p); setShown(0); setSaved(false); setPhase('thinking'); setTimeout(() => setPhase('plan'), 700); };
  useEffect(() => { if (phase !== 'plan') return; if (shown >= plan.length) { const t = setTimeout(() => setPhase('ready'), 400); return () => clearTimeout(t); } const t = setTimeout(() => setShown(s => s + 1), 650); return () => clearTimeout(t); }, [phase, shown, plan]);
  const reset = () => { setPhase('idle'); setPlan([]); setShown(0); setText(''); setFiles([]); };
  const busy = phase === 'thinking' || phase === 'plan';
  return <section id="agent" className="mx-auto max-w-3xl scroll-mt-20 px-5 py-28">
    <Reveal className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full" style={{ background: 'conic-gradient(from 0deg,rgb(var(--accent)),#9db0ff,rgb(var(--accent)))' }}><span className="h-6 w-6 rounded-full bg-bg"></span></span>
      <h2 className="mt-6 text-3xl font-semibold tracking-tight md:text-4xl">What should I take off your plate?</h2><p className="mt-2 text-mute">Describe it like you’d tell an assistant. This is a live preview — it drafts the plan, nothing is sent.</p></Reveal>
    <Reveal delay={.1}><div className="mt-8 rounded-2xl border border-line bg-surface p-4 shadow-[0_20px_50px_-30px_rgb(0_0_0/.3)] focus-within:border-accent/50">
      <label htmlFor="task" className="sr-only">Describe your task</label>
      <textarea id="task" ref={taRef} rows={3} value={text} disabled={busy} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }} placeholder="e.g. Every Monday, remind clients with unpaid invoices…" className="w-full resize-none bg-transparent px-1 text-[15px] outline-none placeholder:text-mute/70 disabled:opacity-60"></textarea>
      {files.length > 0 && <div className="mb-2 flex flex-wrap gap-1.5">{files.map(f => <span key={f} className="inline-flex items-center gap-1.5 rounded-lg bg-raised px-2 py-1 text-xs"><Icon name="Paperclip" size={12} />{f}<button aria-label={`Remove ${f}`} onClick={() => setFiles(x => x.filter(i => i !== f))}><Icon name="X" size={12} /></button></span>)}</div>}
      <div className="flex flex-wrap items-center gap-2">
        {MODES.map(([k, ic, tip]) => { const on = modes.includes(k); return <button key={k} title={tip} aria-pressed={on} onClick={() => toggle(k)} className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-sm transition ${on ? 'border-accent/40 bg-accent/10 text-accent' : 'border-transparent bg-raised text-mute hover:text-ink'}`}><Icon name={ic} size={14} />{k === 'DeepResearch' ? 'Deep research' : k}</button>; })}
        <Btn size="sm" variant="ghost" className="ml-auto" icon="Plus" onClick={() => fileRef.current.click()}>Upload files</Btn>
        <input ref={fileRef} type="file" multiple hidden onChange={e => setFiles(x => [...x, ...[...e.target.files].map(f => f.name)])} />
        <button onClick={() => run()} disabled={busy} aria-label="Build workflow" className="grid h-9 w-9 place-items-center rounded-lg bg-accent text-white transition hover:brightness-110 disabled:opacity-50"><Icon name={busy ? 'Loader2' : 'ArrowUp'} className={busy ? 'animate-[spin_1s_linear_infinite]' : ''} /></button></div></div></Reveal>
    {phase === 'idle' && <div className="mt-3 grid gap-3 sm:grid-cols-3">{SUGGEST.map(([ic, t, p]) => <button key={t} onClick={() => { setText(p); run(p); }} className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-4 text-left text-sm transition hover:-translate-y-0.5 hover:bg-raised"><Icon name={ic} className="text-mute" />{t}</button>)}</div>}
    {phase !== 'idle' && <div className="mt-4 rounded-2xl border border-line bg-surface p-5" aria-live="polite">
      <div className="flex items-center gap-2 text-sm text-mute">{phase === 'thinking' ? <><Icon name="Loader2" className="animate-[spin_1s_linear_infinite]" />Reading your request<span className="caret">▍</span></> : <><Icon name="Workflow" className="text-accent" />{phase === 'ready' ? 'Workflow ready' : 'Building your workflow'}</>}</div>
      <ol className="mt-3 space-y-1">{plan.slice(0, shown).map(([ic, a, b], i) => <li key={a + i} className="flex items-center gap-3 rounded-xl px-2 py-2" style={{ animation: 'fadeUp .4s both' }}><span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-raised"><Icon name={ic} size={15} /></span><div className="text-sm"><b className="font-medium">{i + 1}. {a}</b><p className="text-mute">{b}</p></div><Icon name="Check" size={16} className="ml-auto text-emerald-500" /></li>)}</ol>
      {phase === 'ready' && <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
        {saved ? <p className="text-sm text-mute">Saved to drafts. <a href="#/login">Sign in</a> to turn it on.</p> : <Btn size="sm" icon="Save" onClick={() => setSaved(true)}>Save workflow</Btn>}
        <Btn size="sm" variant="secondary" icon="Pencil" onClick={() => { setPhase('idle'); setPlan([]); }}>Edit request</Btn><Btn size="sm" variant="ghost" icon="RotateCcw" onClick={reset}>Start over</Btn></div>}
    </div>}
  </section>;
}
Object.assign(window, { AgentBox });
