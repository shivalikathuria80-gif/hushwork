const WORKFLOWS = [
  { id: 'inv', name: 'Invoice chaser', icon: 'Receipt', n: 128, runs: [
    { t: 'Chased Acme Co.', s: 'Invoice #1042 · 14 days overdue', time: '9:00', tags: ['email', 'auto'] },
    { t: 'Marked Northwind paid', s: 'Stripe payment matched', time: '8:12', tags: ['stripe'] },
    { t: 'Chased Lumen Studio', s: 'Invoice #1038 · 3 days overdue', time: 'Mon', tags: ['email'] }],
    steps: [['Zap', 'Trigger', 'Invoice 14 days overdue', '0.1s'], ['CreditCard', 'Check Stripe', 'No payment found', '0.8s'], ['PenLine', 'Draft reminder', 'Polite, firm, your tone', '2.1s'], ['Send', 'Send from Gmail', 'To billing@acme.co', '0.6s']],
    body: 'Hi Acme team — a quick nudge that invoice #1042 for $2,400 was due two weeks ago. Payment link is below if easier.\n\nThanks, Maya' },
  { id: 'rep', name: 'Weekly client report', icon: 'FileBarChart', n: 24, runs: [
    { t: 'Sent report to Orbit Labs', s: 'Week 41 · 12 tasks closed', time: 'Fri', tags: ['pdf', 'auto'] },
    { t: 'Sent report to Fern & Co', s: 'Week 41 · 7 tasks closed', time: 'Fri', tags: ['pdf'] }],
    steps: [['Clock', 'Trigger', 'Friday 4:00 pm', '0.1s'], ['Table', 'Pull tasks', 'Linear · 12 closed', '1.3s'], ['FileText', 'Write summary', 'Plain-language recap', '3.4s'], ['Mail', 'Email client', 'Attached as PDF', '0.7s']],
    body: 'Hi Orbit team — this week we shipped the onboarding flow, fixed 4 bugs and started the pricing page. Full list attached.\n\nBest, Maya' },
  { id: 'inb', name: 'Inbox triage', icon: 'Inbox', n: 342, runs: [
    { t: 'Filed 18 newsletters', s: 'Moved to Reading', time: '7:30', tags: ['gmail'] },
    { t: 'Flagged 2 client emails', s: 'Needs a reply today', time: '7:30', tags: ['gmail', 'urgent'] }],
    steps: [['Mail', 'Trigger', 'New email arrives', '0.1s'], ['Tags', 'Classify', 'Client · urgent', '0.9s'], ['Star', 'Flag', 'Starred + pinned', '0.3s'], ['Bell', 'Notify', 'One digest at 8 am', '0.2s']],
    body: 'Digest: 2 client emails need a reply today. 18 newsletters moved to Reading. 4 receipts filed to Expenses.' },
  { id: 'led', name: 'Lead follow-up', icon: 'UserPlus', n: 56, runs: [
    { t: 'Followed up with Dana', s: 'No reply after 3 days', time: '10:05', tags: ['email'] }],
    steps: [['UserPlus', 'Trigger', 'New form submission', '0.1s'], ['Search', 'Enrich', 'Company, role, site', '1.9s'], ['PenLine', 'Draft reply', 'Mentions their project', '2.4s'], ['CalendarPlus', 'Offer times', 'Three open slots', '0.5s']],
    body: 'Hi Dana — thanks for reaching out about the brand refresh. I have Tue 2pm, Wed 10am or Thu 4pm if you’d like to talk.' },
];
function ProductMock() {
  const [wi, setWi] = useState(0); const [ri, setRi] = useState(0); const [flt, setFlt] = useState('all');
  const w = WORKFLOWS[wi]; const run = w.runs[Math.min(ri, w.runs.length - 1)];
  const runs = flt === 'auto' ? w.runs.filter(r => r.tags.includes('auto')) : w.runs;
  return <div className="mx-auto grid max-w-6xl overflow-hidden rounded-3xl border border-line bg-surface text-left shadow-[0_30px_80px_-30px_rgb(0_0_0/.25)] md:grid-cols-[230px_1fr] lg:grid-cols-[230px_340px_1fr]">
    <aside className="hidden border-r border-line p-3 md:block">
      <div className="mb-3 flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm"><span className="grid h-5 w-5 place-items-center rounded-md bg-accent text-[10px] font-semibold text-white">M</span>Maya Studio<Icon name="ChevronsUpDown" size={14} className="ml-auto text-mute" /></div>
      {WORKFLOWS.map((x, i) => <button key={x.id} onClick={() => { setWi(i); setRi(0); }} className={`mb-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm transition ${i === wi ? 'bg-ink text-bg' : 'text-ink hover:bg-raised'}`}><Icon name={x.icon} />{x.name}<span className={`ml-auto font-mono text-xs ${i === wi ? 'opacity-70' : 'text-mute'}`}>{x.n}</span></button>)}
      <div className="mt-3 border-t border-line pt-3"><button className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-mute" onClick={() => document.getElementById('agent').scrollIntoView && window.scrollTo({ top: document.getElementById('agent').offsetTop - 80, behavior: 'smooth' })}><Icon name="Plus" />New workflow</button></div>
    </aside>
    <section className="border-r border-line">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h3 className="text-xl font-semibold tracking-tight">{w.name}</h3>
        <div className="flex rounded-lg bg-raised p-0.5 text-sm">{[['all', 'All runs'], ['auto', 'Automatic']].map(([k, l]) => <button key={k} onClick={() => { setFlt(k); setRi(0); }} className={`rounded-md px-2.5 py-1 ${flt === k ? 'bg-surface font-medium shadow-sm' : 'text-mute'}`}>{l}</button>)}</div></div>
      <div className="space-y-2 p-3">{runs.length ? runs.map((r, i) => <button key={r.t} onClick={() => setRi(i)} className={`block w-full rounded-xl border p-3.5 text-left transition ${i === ri ? 'border-accent/40 bg-raised' : 'border-line hover:bg-raised'}`}>
        <div className="flex items-center justify-between"><b className="text-[15px] font-semibold">{r.t}</b><span className="font-mono text-xs text-mute">{r.time}</span></div>
        <p className="mt-1 text-sm text-mute">{r.s}</p>
        <div className="mt-2.5 flex gap-1.5">{r.tags.map(t => <span key={t} className="rounded-md bg-raised px-2 py-0.5 font-mono text-[11px] text-mute">{t}</span>)}</div></button>) : <p className="p-6 text-sm text-mute">No automatic runs yet.</p>}</div>
    </section>
    <section className="hidden lg:block">
      <div className="flex items-center gap-1 border-b border-line px-4 py-3 text-mute"><Icon name="CircleCheck" className="text-emerald-500" /><span className="ml-2 text-sm text-ink">Run completed</span><span className="ml-auto font-mono text-xs">{run.time} · 3.6s</span></div>
      <ol className="space-y-0.5 p-4">{w.steps.map(([ic, a, b, d], i) => <li key={a} className="flex items-center gap-3 rounded-lg px-2 py-2" style={{ animation: `fadeUp .5s ${i * .08}s both` }}><span className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-raised"><Icon name={ic} size={15} /></span><div className="min-w-0 flex-1 text-sm"><b className="font-medium">{a}</b><p className="truncate text-mute">{b}</p></div><span className="font-mono text-xs text-mute">{d}</span></li>)}</ol>
      <p className="mx-4 mb-4 whitespace-pre-line rounded-xl bg-raised p-4 text-sm leading-relaxed text-mute">{w.body}</p>
    </section></div>;
}
const BAND = [['New email','Summarise','Send digest','#2A1566'],['New lead','Score with AI','Add to CRM','#1B1240'],['Invoice due','Draft reminder','Send & log','#12301F'],['Form submitted','Extract data','Update sheet','#3B1D8A'],['Every Monday','Pull metrics','Post to Slack','#1A1030']];
const BAND_IMG = BAND.map(([a, b, c, bg]) => { const C = ['#7C3AED', '#C4B5FD', '#34D399']; let g = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 300"><defs><linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + bg + '"/><stop offset="1" stop-color="#0B0A12"/></linearGradient></defs><rect width="480" height="300" fill="url(#a)"/><path d="M130 150H190M290 150H350" stroke="#C4B5FD" stroke-width="2.5" stroke-dasharray="6 6" opacity=".7"/><circle cx="240" cy="150" r="64" fill="#7C3AED" opacity=".18"/>'; [a, b, c].forEach((t, k) => { const x = 20 + k * 160; g += '<rect x="' + x + '" y="110" width="110" height="80" rx="14" fill="#15121F" stroke="' + C[k] + '" stroke-width="2"/><circle cx="' + (x + 55) + '" cy="136" r="9" fill="' + C[k] + '"/><text x="' + (x + 55) + '" y="172" font-family="Inter,Arial" font-size="13" font-weight="600" fill="#F4F2FB" text-anchor="middle">' + t + '</text>'; }); return 'url("data:image/svg+xml,' + encodeURIComponent(g + '</svg>') + '") center/cover'; });
function HeroBand() {
  const refs = useRef([]);
  useEffect(() => {
    const N = 9, pitch = 262, total = N * pitch; let off = 0, last = performance.now(), raf;
    const tick = n => { off += (n - last) * .04; last = n;
      refs.current.forEach((el, i) => { if (!el) return; const x = ((((i * pitch - off) % total) + total) % total) - total / 2, k = Math.max(-1, Math.min(1, x / 640));
        el.style.transform = 'translateX(' + x.toFixed(1) + 'px) rotateY(' + (-k * 62).toFixed(1) + 'deg) scale(' + (1 + Math.abs(k) * .25).toFixed(3) + ')'; el.style.visibility = Math.abs(k) >= 1 ? 'hidden' : 'visible'; });
      raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);
  return <div className="absolute inset-0 [mask-image:linear-gradient(90deg,transparent,#000_14%,#000_86%,transparent)]" style={{ perspective: 900, perspectiveOrigin: '50% 78%' }}>
    {Array.from({ length: 9 }, (_, i) => <div key={i} ref={el => refs.current[i] = el} className="absolute left-1/2 top-[520px] -ml-[120px] h-[150px] w-[240px] rounded-[14px]" style={{ background: BAND_IMG[i % 5] }}></div>)}</div>;
}
function Hero({ authed }) {
  const to = id => () => window.scrollTo({ top: document.getElementById(id).offsetTop - 16, behavior: 'smooth' });
  const rise = d => ({ animation: 'hwRise .9s cubic-bezier(.2,.8,.2,1) ' + d + 's both' });
  return <header id="hero" className="relative h-[760px] overflow-hidden text-center">
    <HeroBand />
    <div className="pointer-events-none absolute left-1/2 top-[60px] h-[360px] w-[620px] rounded-full bg-accent/30 blur-[110px]" style={{ animation: 'hwFloat 9s ease-in-out infinite' }}></div>
    <div className="relative z-10 px-5 pt-32">
      <span className="inline-block rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 text-[13px] text-violet-200 backdrop-blur-xl shadow-[inset_0_1px_0_rgb(255_255_255/.25)]" style={rise(0)}>Now in private beta</span>
      <h1 className="mx-auto mt-5 max-w-3xl text-[clamp(2.6rem,6vw,4rem)] font-semibold leading-[1.05] tracking-[-0.03em]"><span className="block" style={rise(.12)}>Describe the task.</span><span className="block bg-[linear-gradient(90deg,#fff,#C4B5FD,#fff)] bg-[length:200%_auto] bg-clip-text text-transparent" style={{ animation: 'hwRise .9s cubic-bezier(.2,.8,.2,1) .26s both,hwShine 5s linear 1s infinite' }}>Hushwork handles it.</span></h1>
      <p className="mx-auto mt-5 max-w-lg text-lg leading-normal text-mute" style={rise(.42)}>Tell Hushwork in plain English what you do every week. It builds the workflow, connects your tools and runs it for you.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3" style={rise(.54)}><Btn size="lg" iconRight="ArrowRight" onClick={to('wait')}>Join the waitlist</Btn><Btn size="lg" variant="secondary" icon="Play" onClick={to('how')}>See how it works</Btn></div>
    </div></header>;
}
Object.assign(window, { Hero, ProductMock });
