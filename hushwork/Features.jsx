const CASES = [
  { k: 'Invoices', t: 'Get paid without the awkward emails', d: 'Hushwork checks Stripe, spots what’s overdue and nudges clients in your voice — then stops the moment they pay.', span: 'md:col-span-3', art: 'conic-gradient(from 210deg at 70% 30%,#0a0a14,rgb(var(--accent)) 25%,#0a0a14 45%,#7d96ff 60%,#0a0a14 80%)' },
  { k: 'Reports', t: 'Client updates that write themselves', d: 'Pull closed tasks, summarise them in plain language and email a PDF every Friday.', span: 'md:col-span-3', art: 'radial-gradient(60% 80% at 80% 20%,#a9baff,transparent 55%),radial-gradient(50% 60% at 30% 90%,rgb(var(--accent)),transparent 60%),#05060d' },
  { k: 'Inbox', t: 'Triage while you sleep', d: 'Newsletters filed, clients flagged, one digest at 8 am.', span: 'md:col-span-2', art: 'repeating-radial-gradient(circle at 50% 120%,rgb(var(--accent)/.5) 0 2px,transparent 2px 22px),#06070d' },
  { k: 'Leads', t: 'Follow up before they go cold', d: 'A reply that mentions their project, with three open slots.', span: 'md:col-span-2', art: 'linear-gradient(115deg,transparent 40%,rgb(var(--accent)/.7) 50%,transparent 60%),repeating-linear-gradient(90deg,#ffffff0d 0 1px,transparent 1px 28px),#06070d' },
  { k: 'Admin', t: 'Receipts, contracts, calendars', d: 'Everything with a PDF attached ends up in the right folder.', span: 'md:col-span-2', art: 'radial-gradient(circle at 30% 30%,#ffffff22 0 2px,transparent 3px) 0 0/22px 22px,radial-gradient(70% 70% at 70% 80%,rgb(var(--accent)/.6),transparent),#06070d' },
];
function UseCases() {
  return <section id="cases" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
    <Reveal><h2 className="text-3xl font-semibold tracking-tight md:text-4xl">The work you keep putting off.</h2><p className="mt-2 max-w-xl text-mute">Five jobs freelancers hand to Hushwork first.</p></Reveal>
    <div className="mt-10 grid gap-3 md:grid-cols-6">{CASES.map((c, i) => <Reveal key={c.k} delay={i * .06} className={c.span}>
      <article className={`group relative flex overflow-hidden rounded-2xl border border-line text-white ${i < 2 ? 'h-80' : 'h-72'}`}>
        <div className="absolute inset-0 transition duration-700 group-hover:scale-105" style={{ background: c.art }}></div>
        <div className="relative mt-auto w-full bg-black/35 p-5 backdrop-blur-xl [mask-image:linear-gradient(transparent,#000_30%)]"><span className="font-mono text-xs text-white/70">{c.k}</span><h3 className="mt-1 text-lg font-semibold">{c.t}</h3><p className="mt-1.5 max-w-md text-sm text-white/80">{c.d}</p></div></article></Reveal>)}</div>
  </section>;
}
function NodeBox({ x, y, icon, label, w = 44 }) {
  return <g><rect x={x - w / 2} y={y - 22} width={w} height="44" rx="12" fill="rgb(var(--raised))" stroke="rgb(var(--line))" /><foreignObject x={x - 12} y={y - 12} width="24" height="24"><div className="grid h-6 w-6 place-items-center text-ink"><Icon name={icon} size={16} /></div></foreignObject>{label && <text x={x} y={y + 40} textAnchor="middle" fontSize="10" fontFamily="Geist Mono" fill="rgb(var(--mute))">{label}</text>}</g>;
}
function FlowDiagram() {
  const P = 'M70 90 C130 90 130 90 190 90 S250 90 310 90'; 
  return <svg viewBox="0 0 560 190" className="h-full w-full"><path d="M60 90H200M300 90H400" stroke="rgb(var(--line))" strokeWidth="1.5" fill="none" /><path className="flow" d="M60 90H200M300 90H400" stroke="rgb(var(--accent))" strokeWidth="1.5" fill="none" />
    <NodeBox x="50" y="90" icon="Mail" label="new email" /><rect x="200" y="62" width="100" height="56" rx="14" fill="rgb(var(--raised))" stroke="rgb(var(--accent))" /><text x="250" y="86" textAnchor="middle" fontSize="11" fontFamily="Geist Mono" fill="rgb(var(--ink))">hushwork</text><text x="250" y="104" textAnchor="middle" fontSize="10" fontFamily="Geist Mono" fill="rgb(var(--mute))">agent</text>
    <g transform="translate(410 38)"><rect width="110" height="104" rx="12" fill="rgb(var(--raised))" stroke="rgb(var(--line))" /><rect x="12" y="14" width="40" height="5" rx="2" fill="rgb(var(--mute))" opacity=".5" /><rect x="12" y="26" width="86" height="3" rx="1.5" fill="rgb(var(--line))" />{[0, 1, 2, 3, 4].map(i => <rect key={i} x={14 + i * 17} y={92 - [30, 46, 24, 56, 40][i]} width="11" height={[30, 46, 24, 56, 40][i]} rx="2" fill="rgb(var(--accent))" opacity={.35 + i * .13}><animate attributeName="height" values={`${[30, 46, 24, 56, 40][i]};${[40, 30, 50, 36, 56][i]};${[30, 46, 24, 56, 40][i]}`} dur={`${3 + i * .4}s`} repeatCount="indefinite" /><animate attributeName="y" values={`${92 - [30, 46, 24, 56, 40][i]};${92 - [40, 30, 50, 36, 56][i]};${92 - [30, 46, 24, 56, 40][i]}`} dur={`${3 + i * .4}s`} repeatCount="indefinite" /></rect>)}</g>
    <circle r="3.5" fill="rgb(var(--accent))"><animateMotion dur="2.6s" repeatCount="indefinite" path="M60 90H200" /></circle><circle r="3.5" fill="rgb(var(--accent))"><animateMotion dur="2.6s" begin="1.3s" repeatCount="indefinite" path="M300 90H410" /></circle></svg>;
}
function HubDiagram() {
  const ns = [['Table', 'Sheets', 40, 40], ['CreditCard', 'Stripe', 40, 150], ['Calendar', 'Calendar', 300, 40], ['MessageSquare', 'Slack', 300, 150]];
  return <svg viewBox="0 0 340 190" className="h-full w-full">{ns.map(([ic, l, x, y], i) => { const d = `M${x + (x < 170 ? 22 : -22)} ${y}H${x < 170 ? 105 : 235}V95H${x < 170 ? 140 : 200}`; return <g key={l}><path d={d} fill="none" stroke="rgb(var(--line))" strokeWidth="1.5" /><path d={d} className="flow" fill="none" stroke="rgb(var(--accent))" strokeWidth="1.5" opacity=".7" /><NodeBox x={x} y={y} icon={ic} /></g>; })}
    <g><rect x="140" y="68" width="60" height="54" rx="14" fill="rgb(var(--ink))" /><foreignObject x="158" y="83" width="24" height="24"><div className="grid h-6 w-6 place-items-center text-bg"><Icon name="Workflow" size={20} /></div></foreignObject></g>
    <text x="170" y="150" textAnchor="middle" fontSize="10" fontFamily="Geist Mono" fill="rgb(var(--mute))" style={{ animation: 'pulseDot 2s infinite' }}>syncing…</text></svg>;
}
function ChartDiagram() {
  const d = 'M10 150 C40 150 40 120 70 128 S100 150 130 120 S170 110 200 90 S240 95 270 62 S300 40 325 30';
  return <svg viewBox="0 0 340 190" className="h-full w-full"><defs><linearGradient id="gf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--accent))" stopOpacity=".25" /><stop offset="1" stopColor="rgb(var(--accent))" stopOpacity="0" /></linearGradient></defs>
    {[40, 80, 120, 160].map(y => <path key={y} d={`M0 ${y}H340`} stroke="rgb(var(--line))" strokeDasharray="2 6" />)}
    <path d={d + 'V190H10Z'} fill="url(#gf)" /><path d={d} fill="none" stroke="rgb(var(--ink))" strokeWidth="2" strokeDasharray="600" style={{ animation: 'draw 2.4s ease-out both' }} />
    <circle cx="325" cy="30" r="6" fill="rgb(var(--bg))" stroke="rgb(var(--accent))" strokeWidth="3" /><g transform="translate(206 4)"><rect width="104" height="24" rx="7" fill="rgb(var(--ink))" /><text x="52" y="16" textAnchor="middle" fontSize="11" fontFamily="Geist Mono" fill="rgb(var(--bg))">paid in 3 days</text></g></svg>;
}
function FeatureCard({ icon, title, body, children, className = '' }) {
  return <article className={`flex flex-col overflow-hidden rounded-2xl border border-line bg-surface ${className}`}><div className="relative flex-1 p-5" style={{ background: 'radial-gradient(rgb(var(--line)) 1px,transparent 1px) 0 0/18px 18px' }}><div className="mx-auto h-48 max-w-xl">{children}</div></div>
    <div className="border-t border-line p-6"><div className="flex items-center gap-2 text-sm font-medium"><Icon name={icon} className="text-accent" />{title}</div><p className="mt-2 max-w-md text-sm leading-relaxed text-mute">{body}</p></div></article>;
}
function Features() {
  return <section id="features" className="scroll-mt-20 border-y border-line bg-raised/50 py-28"><div className="mx-auto max-w-6xl px-5">
    <Reveal className="text-center"><Eyebrow>Features</Eyebrow><h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-5xl" style={{ textWrap: 'balance' }}>Smart workflows, <span className="text-mute">zero babysitting</span></h2></Reveal>
    <div className="mt-12 grid gap-4 md:grid-cols-2">
      <Reveal className="md:col-span-2"><FeatureCard icon="MessageSquareText" title="Plain-English builder" body="Say what should happen. Hushwork turns it into a workflow you can read, edit and approve — no nodes to wire up, no code to write."><FlowDiagram /></FeatureCard></Reveal>
      <Reveal delay={.08}><FeatureCard icon="Plug" title="Connects the tools you already use" body="Gmail, Stripe, Calendar, Slack, Sheets and more. Connect once; every workflow can use them."><HubDiagram /></FeatureCard></Reveal>
      <Reveal delay={.16}><FeatureCard icon="ShieldCheck" title="Runs you can trust" body="Every run keeps a step-by-step log. Ask for approval before anything is sent, and pause any workflow in one click."><ChartDiagram /></FeatureCard></Reveal>
    </div></div></section>;
}
Object.assign(window, { UseCases, Features });
