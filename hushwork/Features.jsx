// Sample data below is illustrative. The samples are real components so visitors can try them.
const SAMPLE_LOG = [['Zap', 'Trigger', 'Invoice 14 days overdue', '0.1s'], ['CreditCard', 'Check Stripe', 'No payment found', '0.8s'], ['PenLine', 'Draft reminder', 'Polite, firm, your tone', '2.1s']];
const SAMPLE_PLAN = [['Clock', 'Run every Friday', '4:00 pm'], ['Table', 'Pull closed tasks', 'Linear · this week'], ['Mail', 'Email each client', 'PDF attached']];
const TOOLS = [['Mail', 'Gmail'], ['CreditCard', 'Stripe'], ['Calendar', 'Calendar'], ['MessageSquare', 'Slack'], ['Table', 'Sheets'], ['ListTodo', 'Linear']];

function ApprovalSample() {
  const [s, setS] = useState('pending');
  return <div className="rounded-xl border border-field bg-surface p-4">
    <p className="text-sm font-medium">Send 3 payment reminders?</p>
    <p className="mt-1 text-sm text-mute">Orbit Labs, Lumen Studio and Fern &amp; Co are overdue by 3 to 14 days.</p>
    {s === 'pending'
      ? <div className="mt-3 flex gap-2"><Btn size="sm" icon="Check" onClick={() => setS('approved')}>Approve</Btn><Btn size="sm" variant="secondary" onClick={() => setS('skipped')}>Skip</Btn></div>
      : <p role="status" className="mt-3 flex items-center gap-2 text-sm"><Icon name={s === 'approved' ? 'CircleCheck' : 'CircleX'} className="shrink-0 text-accent-text" />{s === 'approved' ? 'Approved. They send at 9:00.' : 'Skipped. Nothing was sent.'}<button onClick={() => setS('pending')} className="ml-auto h-8 rounded-lg px-2 text-accent-text underline underline-offset-4 hover:bg-raised">Undo</button></p>}
  </div>;
}
function PauseSample() {
  const [on, setOn] = useState(true);
  return <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
    <div className="text-sm"><b className="font-medium">Invoice chaser</b><p className="text-mute">{on ? 'Running. Next run at 9:00.' : 'Paused. Nothing will run.'}</p></div>
    <button role="switch" aria-checked={on} aria-label="Invoice chaser is running" onClick={() => setOn(!on)} className={`relative h-8 w-14 shrink-0 rounded-full border transition-colors before:absolute before:-inset-x-1 before:-inset-y-2 before:content-[''] ${on ? 'border-accent bg-accent' : 'border-field bg-raised'}`}>
      <span className={`absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform ${on ? 'translate-x-[1.7rem]' : 'translate-x-0.5'}`}></span></button>
  </div>;
}
function FeatureCard({ icon, title, body, children, className = '' }) {
  return <article className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-surface ${className}`}>
    <div className="flex-1 bg-raised/60 p-4 sm:p-5">{children}</div>
    <div className="border-t border-line p-6"><h3 className="flex items-center gap-2 text-base font-semibold"><Icon name={icon} className="text-accent-text" />{title}</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-mute">{body}</p></div>
  </article>;
}
function Features() {
  return <section id="features" className="border-y border-line bg-raised/50 py-24"><div className="mx-auto max-w-6xl px-5">
    <h2 className="max-w-2xl text-3xl font-semibold tracking-tight md:text-5xl">Smart workflows, <span className="text-mute">zero babysitting</span></h2>
    <div className="mt-12 grid gap-4 md:grid-cols-3">
      <FeatureCard icon="MessageSquareText" title="Plain-English builder" body="Say what should happen. Hushwork turns it into a workflow you can read, edit and approve. No nodes to wire up, no code to write.">
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">“Every Friday at 4pm, email each client a summary of what we shipped.”</p>
        <ol className="mt-2 space-y-0.5">{SAMPLE_PLAN.map(([ic, a, b]) => <StepRow key={a} icon={ic} title={a} sub={b} />)}</ol>
      </FeatureCard>
      <FeatureCard icon="ShieldCheck" title="Runs you can trust" body="Every run keeps a step-by-step log. Ask for approval before anything is sent, and pause any workflow in one click." className="md:col-span-2">
        <div className="grid gap-4 md:grid-cols-2">
          <div><p className="mb-1 flex items-center gap-2 px-2 text-sm text-mute"><Icon name="CircleCheck" className="text-accent-text" />Sample run</p>
            <ol className="space-y-0.5">{SAMPLE_LOG.map(([ic, a, b, d]) => <StepRow key={a} icon={ic} title={a} sub={b} right={<span className="font-mono text-xs tabular-nums text-mute">{d}</span>} />)}</ol></div>
          <div className="space-y-3"><ApprovalSample /><PauseSample /></div>
        </div>
      </FeatureCard>
      <article className="grid gap-6 overflow-hidden rounded-2xl border border-line bg-surface p-6 md:col-span-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] md:items-center md:gap-10">
        <div><h3 className="flex items-center gap-2 text-base font-semibold"><Icon name="Plug" className="text-accent-text" />Connects the tools you already use</h3><p className="mt-2 max-w-md text-sm leading-relaxed text-mute">Gmail, Stripe, Calendar, Slack, Sheets and more. Connect once; every workflow can use them.</p></div>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">{TOOLS.map(([ic, n]) => <li key={n} className="flex items-center gap-2.5 rounded-xl border border-line bg-raised/60 px-3.5 py-3 text-sm font-medium"><Icon name={ic} className="text-mute" />{n}</li>)}</ul>
      </article>
    </div></div></section>;
}
Object.assign(window, { Features });
