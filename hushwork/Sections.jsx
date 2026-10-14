
const STEPS = [['01', 'Describe it', '“Every Monday, summarise new leads and email me the top five.”', 'MessageSquareText'], ['02', 'Review the plan', 'Hushwork shows each step and the tools it will touch. You approve or edit.', 'ListChecks'], ['03', 'Let it run', 'It runs on schedule, flags anything unusual and keeps a log of every action.', 'Play']];
function HowItWorks() {
  const [on, setOn] = useState(-1);
  return <section id="how" className="mx-auto max-w-6xl px-5 py-24"><Reveal><h2 className="mb-12 text-4xl font-semibold tracking-tight">Three steps. No code.</h2></Reveal>
    <div className="grid gap-5 md:grid-cols-3">{STEPS.map(([n, t, b, ic], i) => <Reveal key={n} delay={i * .08}><button onClick={() => setOn(on === i ? -1 : i)} className={'block h-full w-full rounded-[20px] border p-7 text-left transition-all duration-200 ' + (on === i ? '-translate-y-1 border-accent bg-raised' : 'border-line bg-surface hover:-translate-y-0.5')}>
      <div className="flex items-center justify-between"><span className="text-[13px] font-semibold text-violet-400">{n}</span><Icon name={ic} className="text-violet-400" /></div><h3 className="mb-2 mt-3 text-[22px] font-semibold">{t}</h3><p className="leading-normal text-mute">{b}</p></button></Reveal>)}</div></section>;
}
const FOLDERS = [['Sales', 'linear-gradient(135deg,#C2433F,#2A1E2A)', [['Score new leads', 'Hourly'], ['Top-5 digest', 'Mondays'], ['Follow-up nudges', 'Daily']]], ['Support', 'linear-gradient(135deg,#3E2850,#8F6C9C)', [['Triage inbox', 'Live'], ['Draft replies', 'On email'], ['Weekly themes', 'Fridays']]], ['Finance', 'linear-gradient(135deg,#173024,#A7843A)', [['Chase invoices', 'Weekly'], ['File receipts', 'On email'], ['Monthly summary', '1st']]]];
function Folder({ name, art, files, open, onPick }) {
  return <div onClick={onPick} className="relative h-[250px] cursor-pointer rounded-3xl" style={{ background: art }}>
    {files.map(([n, m], j) => <div key={n} className="absolute inset-x-6 top-[70px] flex h-[130px] justify-between rounded-xl bg-white px-3.5 py-3 text-[13px] font-semibold text-zinc-900 shadow-[0_10px_24px_rgb(0_0_0/.3)]" style={{ transform: open ? 'translateY(' + (-70 - j * 34) + 'px) rotate(' + ((j - 1) * 3) + 'deg)' : 'translateY(' + (-j * 6) + 'px)', transition: 'all .5s cubic-bezier(.34,1.36,.5,1)' }}><span>{n}</span><span className="font-normal text-zinc-500">{m}</span></div>)}
    <div className="absolute inset-x-0 bottom-0 h-[150px] rounded-b-3xl border-t border-white/40 bg-[rgb(40_30_60/.55)] p-6 text-white backdrop-blur-[18px]" style={{ transformOrigin: '50% 100%', transform: open ? 'perspective(600px) rotateX(-24deg)' : 'none', transition: 'transform .5s cubic-bezier(.34,1.36,.5,1)' }}><div className="text-[19px] font-semibold">{name}</div><div className="mt-1 text-[13px] opacity-75">{files.length} workflows</div></div></div>;
}
function Automations() {
  const [o, setO] = useState(-1);
  return <section id="auto" className="mx-auto max-w-6xl px-5 pb-24 pt-8"><Reveal><h2 className="mb-3 text-4xl font-semibold tracking-tight">What it automates</h2><p className="mb-12 text-[17px] text-mute">Click a folder to see the workflows inside.</p></Reveal>
    <div className="grid gap-7 pt-20 md:grid-cols-3">{FOLDERS.map(([n, a, f], i) => <Folder key={n} name={n} art={a} files={f} open={o === i} onPick={() => setO(o === i ? -1 : i)} />)}</div></section>;
}
function Waitlist() {
  const [email, setEmail] = useState(''); const [done, setDone] = useState(false); const ok = /\S+@\S+\.\S+/.test(email);
  return <section id="wait" className="mx-5 mb-12 rounded-[28px] bg-accent px-8 py-[72px] text-center text-white md:mx-12"><h2 className="text-[clamp(2rem,5vw,2.75rem)] font-semibold tracking-tight">Get your week back.</h2><p className="mb-7 mt-3.5 text-lg text-violet-100">Join the waitlist for early access.</p>
    {done ? <div className="inline-block rounded-2xl bg-white/20 px-6 py-3.5 font-semibold">You’re on the list. We’ll be in touch.</div>
      : <form onSubmit={e => { e.preventDefault(); ok && setDone(true); }} className="inline-flex max-w-full flex-wrap gap-2 rounded-2xl bg-white p-1.5"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@company.com" aria-label="Email" className="min-w-[220px] bg-transparent px-4 py-3 text-[15px] text-zinc-900 outline-none" /><button className={'rounded-xl bg-[#0B0A12] px-5 py-3 text-[15px] font-semibold text-white transition ' + (ok ? '' : 'opacity-55')}>Join waitlist</button></form>}</section>;
}
Object.assign(window, { HowItWorks, Automations, Waitlist });
