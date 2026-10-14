const STEPS = [
  ['Describe it', '“Every Monday, summarise new leads and email me the top five.”', 'MessageSquareText'],
  ['Review the plan', 'Hushwork shows each step and the tools it will touch. You approve or edit.', 'ListChecks'],
  ['Let it run', 'It runs on schedule, flags anything unusual and keeps a log of every action.', 'Play'],
];
// A timeline reads top to bottom, so the order of the steps is shown by the rail instead of by numbers.
function HowItWorks() {
  return <section id="how" className="mx-auto max-w-6xl px-5 py-24">
    <div className="grid gap-10 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:gap-16">
      <h2 className="text-3xl font-semibold tracking-tight md:sticky md:top-28 md:self-start md:text-4xl">Three steps. No code.</h2>
      <ol>{STEPS.map(([title, body, icon], i) => <li key={title} className="relative pb-12 pl-16 last:pb-0">
        {i < STEPS.length - 1 && <span className="absolute bottom-0 left-5 top-12 w-px bg-line" aria-hidden="true"></span>}
        <span className="absolute left-0 top-0 grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-accent-text"><Icon name={icon} /></span>
        <Reveal delay={i * .1}><h3 className="text-xl font-semibold leading-10">{title}</h3><p className="mt-1 max-w-md leading-relaxed text-mute">{body}</p></Reveal>
      </li>)}</ol>
    </div>
  </section>;
}
const FOLDERS = [
  ['Sales', [['Score new leads', 'Hourly'], ['Top-5 digest', 'Mondays'], ['Follow-up nudges', 'Daily']]],
  ['Support', [['Triage inbox', 'Live'], ['Draft replies', 'On email'], ['Weekly themes', 'Fridays']]],
  ['Finance', [['Chase invoices', 'Weekly'], ['File receipts', 'On email'], ['Monthly summary', '1st']]],
];
// Folder tabs: a real tablist, so each folder is a button and the arrow keys move between them.
function Automations() {
  const [sel, setSel] = useState(0); const tabs = useRef([]);
  const onKey = e => {
    const last = FOLDERS.length - 1; let n = sel;
    if (e.key === 'ArrowRight') n = sel === last ? 0 : sel + 1; else if (e.key === 'ArrowLeft') n = sel === 0 ? last : sel - 1; else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = last; else return;
    e.preventDefault(); setSel(n); tabs.current[n] && tabs.current[n].focus();
  };
  const [, files] = FOLDERS[sel];
  return <section id="auto" className="mx-auto max-w-6xl px-5 pb-24 pt-8">
    <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">What it automates</h2>
    <p className="mt-3 max-w-xl text-[17px] text-mute">Pick a folder to see the workflows inside.</p>
    <div className="mt-10">
      <div role="tablist" aria-label="Workflow folders" onKeyDown={onKey} className="flex gap-1">
        {FOLDERS.map(([name, f], i) => <button key={name} ref={el => tabs.current[i] = el} role="tab" id={`folder-tab-${i}`} aria-selected={sel === i} aria-controls="folder-panel" tabIndex={sel === i ? 0 : -1} onClick={() => setSel(i)}
          className={`relative -mb-px inline-flex h-11 items-center gap-2 rounded-t-xl border px-4 text-sm font-medium transition-colors ${sel === i ? 'border-line border-b-surface bg-surface text-ink' : 'border-transparent bg-raised/70 text-mute hover:text-ink'}`}>
          <Icon name={sel === i ? 'FolderOpen' : 'Folder'} size={16} />{name}<span className="font-normal text-mute">{f.length}</span></button>)}
      </div>
      <div role="tabpanel" id="folder-panel" aria-labelledby={`folder-tab-${sel}`} tabIndex={0} className="rounded-b-2xl rounded-tr-2xl border border-line bg-surface p-3 sm:p-4">
        <ul key={sel} className="space-y-2">{files.map(([n, m], j) => <li key={n} className="flex items-center gap-3 rounded-xl border border-line bg-bg px-4 py-3.5" style={{ animation: `fadeUp .35s ${j * .06}s both` }}>
          <Icon name="FileText" className="shrink-0 text-mute" /><span className="font-medium">{n}</span><span className="ml-auto text-sm text-mute">{m}</span></li>)}</ul>
      </div>
    </div>
  </section>;
}
function Waitlist() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(false); const ok = /\S+@\S+\.\S+/.test(email);
  return <section id="wait" className="mx-5 mb-12 rounded-[28px] bg-accent px-8 py-[72px] text-center text-white md:mx-12"><h2 className="text-[clamp(2rem,5vw,2.75rem)] font-semibold tracking-tight">Get your week back.</h2><p className="mb-7 mt-3.5 text-lg text-violet-100">Join the waitlist for early access.</p>
    {done ? <div className="inline-block rounded-2xl bg-white/20 px-6 py-3.5 font-semibold">You’re on the list. We’ll be in touch.</div>
      : <form onSubmit={e => { e.preventDefault(); ok && setDone(true); }} className="inline-flex max-w-full flex-wrap gap-2 rounded-2xl bg-white p-1.5"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" aria-label="Email" className="min-w-[220px] bg-transparent px-4 py-3 text-[15px] text-zinc-900 outline-none" /><button className={'rounded-xl bg-[#0B0A12] px-5 py-3 text-[15px] font-semibold text-white transition ' + (ok ? '' : 'opacity-55')}>Join waitlist</button></form>}</section>;
}
Object.assign(window, { HowItWorks, Automations, Waitlist });
