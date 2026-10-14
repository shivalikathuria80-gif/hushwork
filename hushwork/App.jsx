function Nav({ dark, toggle }) {
  const [open, setOpen] = useState(false);
  const links = [['How it works', '#how'], ['Automations', '#auto'], ['Features', '#features'], ['Try it', '#agent']];
  const linkCls = 'rounded-xl px-3 py-2 text-sm text-mute transition-colors hover:bg-raised hover:text-ink hover:opacity-100';
  return <header className="fixed inset-x-0 top-3 z-50 px-3" onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }}>
    {/* Blur is kept on this bar only: page content scrolls underneath it, so the blur has a job. */}
    <nav aria-label="Main" className="mx-auto flex h-14 max-w-5xl items-center gap-2 rounded-2xl border border-line bg-surface/80 px-4 backdrop-blur-xl">
      <Logo />
      <div className="mx-auto hidden items-center gap-1 md:flex">{links.map(([l, h]) => <a key={l} href={h} className={linkCls}>{l}</a>)}</div>
      <div className="ml-auto flex items-center gap-1.5 md:ml-0">
        <button onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} className="grid h-11 w-11 place-items-center rounded-xl text-mute transition-colors hover:bg-raised hover:text-ink md:h-9 md:w-9"><Icon name={dark ? 'Sun' : 'Moon'} /></button>
        <Btn href="#wait" size="sm" className="hidden sm:inline-flex">Join the waitlist</Btn>
        <button className="grid h-11 w-11 place-items-center rounded-xl text-mute hover:bg-raised hover:text-ink md:hidden" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="mobile-menu" onClick={() => setOpen(!open)}><Icon name={open ? 'X' : 'Menu'} /></button>
      </div>
    </nav>
    {open && <div id="mobile-menu" className="mx-auto mt-2 max-w-5xl rounded-2xl border border-line bg-surface p-2 md:hidden">
      {links.map(([l, h]) => <a key={l} href={h} onClick={() => setOpen(false)} className="block rounded-xl px-3 py-3 text-ink hover:bg-raised hover:opacity-100">{l}</a>)}
      <Btn href="#wait" onClick={() => setOpen(false)} className="mt-2 w-full">Join the waitlist</Btn>
    </div>}
  </header>;
}
function Home() {
  return <><Hero /><HowItWorks /><Automations /><Features /><Waitlist /></>;
}
function App() {
  const [dark, toggle] = useTheme();
  return <div id="top">
    <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[60] focus:rounded-xl focus:bg-ink focus:px-4 focus:py-3 focus:text-bg">Skip to content</a>
    <Nav dark={dark} toggle={toggle} />
    <main id="main"><Home /></main>
    <Footer />
  </div>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
