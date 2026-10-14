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
// Saves the email to the `waitlist` table in Supabase (settings live in config.js; see PLAN.md section 6.1).
// Returns 'ok', 'duplicate', 'error', or 'not-connected' when config.js is still empty.
// Only the public (publishable) key is sent: the database rules let it add rows but never read them.
async function joinWaitlist(email) {
  const { supabaseUrl, supabaseKey } = window.HW_CONFIG || {};
  if (!supabaseUrl || !supabaseKey) return 'not-connected';
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/waitlist`, { method: 'POST', headers: { apikey: supabaseKey, 'Content-Type': 'application/json', Prefer: 'return=minimal' }, body: JSON.stringify({ email }) });
    if (res.ok) return 'ok';
    if (res.status === 409) return 'duplicate';
    return 'error';
  } catch (e) { return 'error'; }
}
function Waitlist() {
  const [email, setEmail] = useState(''); const [status, setStatus] = useState('idle'); const [invalid, setInvalid] = useState(false);
  const inputRef = useRef(); const trap = useRef();
  const submit = async e => {
    e.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setInvalid(true); inputRef.current.focus(); return; }
    setInvalid(false);
    if (trap.current && trap.current.value) { setStatus('ok'); return; } // a hidden field only bots fill in
    setStatus('sending'); setStatus(await joinWaitlist(email.trim()));
  };
  const finished = status === 'ok' || status === 'duplicate';
  const problem = invalid ? 'Enter a valid email address, like you@company.com.'
    : status === 'error' ? 'That did not go through. Check your connection and try again.'
    : status === 'not-connected' ? 'The waitlist is not connected yet, so your email was not saved. Please check back soon.' : '';
  return <section id="wait" className="px-5 pb-12 md:px-12"><div className="on-accent mx-auto max-w-6xl rounded-3xl bg-accent px-6 py-16 text-center text-white md:py-20">
    <h2 className="text-[clamp(2rem,5vw,2.75rem)] font-semibold tracking-tight">Get your week back.</h2>
    <p className="mt-3 text-lg text-white/90">Join the waitlist for early access.</p>
    {finished ? <p role="status" className="mx-auto mt-8 inline-flex max-w-md items-center gap-2 rounded-xl bg-white/15 px-5 py-3 text-left font-semibold"><Icon name="CircleCheck" className="shrink-0" />{status === 'ok' ? 'You’re on the list. We’ll email you when early access opens.' : 'You’re already on the list. Nothing more to do.'}</p>
      : <form onSubmit={submit} noValidate className="relative mx-auto mt-8 max-w-md text-left">
        <label htmlFor="wait-email" className="mb-1.5 block text-sm font-medium">Email address</label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input id="wait-email" ref={inputRef} type="email" inputMode="email" autoComplete="email" value={email} onChange={e => { setEmail(e.target.value); if (invalid) setInvalid(false); }} placeholder="you@company.com" aria-invalid={invalid || undefined} aria-describedby={problem ? 'wait-error wait-privacy' : 'wait-privacy'} className="h-12 min-w-0 flex-1 rounded-xl bg-white px-4 text-[15px] text-zinc-900 outline-none placeholder:text-zinc-500 focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-accent" />
          <Btn type="submit" variant="dark" size="lg" loading={status === 'sending'} className="w-full sm:w-auto">Join the waitlist</Btn>
        </div>
        <input ref={trap} type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        {problem && <p id="wait-error" role="alert" className="mt-3 flex items-start gap-2 text-sm"><Icon name="CircleAlert" className="mt-0.5 shrink-0" />{problem}</p>}
        <p id="wait-privacy" className={`text-sm text-white/90 ${problem ? 'mt-2' : 'mt-3'}`}>We only use your email to tell you when early access opens. <a href="privacy.html" className="text-white underline underline-offset-4">Privacy</a></p>
      </form>}
  </div></section>;
}
Object.assign(window, { HowItWorks, Automations, Waitlist });
