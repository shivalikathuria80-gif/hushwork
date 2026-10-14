function Nav({ dark, toggle, user, onOut, col }) {
  const [open, setOpen] = useState(false);
  const links = [['How it works', '#how'], ['Automations', '#auto'], ['Features', '#features'], ['Agent', '#agent']];
  return <nav className={'fixed inset-x-0 top-3 z-50 px-3 transition-[left] duration-300 ' + (col ? 'md:left-[68px]' : 'md:left-60')}><div className="mx-auto flex h-14 max-w-5xl items-center gap-2 rounded-2xl border border-line bg-surface/70 px-4 shadow-sm backdrop-blur-xl">
    <span className="md:hidden"><Logo /></span>
    <div className="mx-auto hidden">{links.map(([l, h]) => <a key={l} href={h} className="rounded-lg px-3 py-1.5 text-sm !text-mute transition hover:bg-raised hover:!text-ink hover:opacity-100">{l}</a>)}</div>
    <div className="ml-auto flex items-center gap-1.5">
      <button onClick={toggle} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} className="grid h-9 w-9 place-items-center rounded-lg text-mute transition hover:bg-raised hover:text-ink"><Icon name={dark ? 'Sun' : 'Moon'} /></button>
      {user ? <><span className="hidden items-center gap-2 text-sm text-mute sm:flex"><span className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-semibold uppercase text-white">{user[0]}</span></span><Btn size="sm" variant="secondary" onClick={onOut}>Sign out</Btn></>
        : <><a href="#/login" className="hidden sm:block"><Btn size="sm" variant="ghost">Log in</Btn></a><a href="#/login"><Btn size="sm" variant="dark">Sign up</Btn></a></>}
      <button className="grid h-9 w-9 place-items-center rounded-lg text-mute hover:bg-raised md:hidden" aria-label="Menu" onClick={() => setOpen(!open)}><Icon name={open ? 'X' : 'Menu'} /></button></div></div>
    {open && <div className="mx-auto mt-2 max-w-5xl rounded-2xl border border-line bg-surface p-2 md:hidden">{links.map(([l, h]) => <a key={l} href={h} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 !text-ink hover:bg-raised">{l}</a>)}</div>}</nav>;
}
function SideBar({ dark, toggle, user, col, setCol }) {
  const items = [['Overview', 'hero', 'LayoutDashboard'], ['How it works', 'how', 'ListChecks'], ['Automations', 'auto', 'FolderOpen'], ['Features', 'features', 'Sparkles'], ['Agent', 'agent', 'Bot'], ['Waitlist', 'wait', 'Mail']];
  const [act, setAct] = useState('hero');
  useEffect(() => { const f = () => { const y = innerHeight * .4; let cur = items[0][1]; items.forEach(([, id]) => { const el = document.getElementById(id); if (el && el.getBoundingClientRect().top <= y) cur = id; }); if (scrollY + innerHeight >= document.documentElement.scrollHeight - 4) cur = items[items.length - 1][1]; setAct(cur); }; f(); addEventListener('scroll', f, { passive: true }); addEventListener('resize', f); return () => { removeEventListener('scroll', f); removeEventListener('resize', f); }; }, []);
  const go = id => e => { e.preventDefault(); const el = document.getElementById(id); window.scrollTo({ top: id === 'hero' ? 0 : el.offsetTop - 20, behavior: 'smooth' }); };
  const row = 'flex items-center gap-2.5 whitespace-nowrap rounded-xl border border-transparent px-3 py-2.5 text-sm transition ' + (col ? 'justify-center' : '');
  return <aside className={'fixed inset-y-0 left-0 z-40 hidden flex-col overflow-y-auto overflow-x-hidden noscroll border-r border-line bg-surface/80 p-3 backdrop-blur-xl transition-[width] duration-300 md:flex ' + (col ? 'w-[68px]' : 'w-60')}>
    <div className={'flex items-center pb-5 pt-1 ' + (col ? 'flex-col gap-3' : 'justify-between pl-2')}>
      {col ? <a href="#/" className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-[15px] font-bold text-white">H</a> : <Logo />}
      <button onClick={() => setCol(!col)} aria-label={col ? 'Expand sidebar' : 'Collapse sidebar'} title={col ? 'Expand sidebar' : 'Collapse sidebar'} className="grid h-8 w-8 place-items-center rounded-lg text-mute transition hover:bg-raised hover:text-ink"><Icon name={col ? 'PanelLeftOpen' : 'PanelLeftClose'} /></button></div>
    {!col && <p className="px-3 pb-2 font-mono text-[11px] uppercase tracking-wider text-mute">Explore</p>}
    <nav className="flex flex-col gap-1">{items.map(([l, id, ic]) => <a key={id} href={'#' + id} onClick={go(id)} title={l} className={row + ' !no-underline ' + (act === id ? 'border-accent/40 bg-accent/20 !text-ink' : '!text-ink hover:bg-raised hover:opacity-100')}><Icon name={ic} />{!col && l}{!col && act === id && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent"></span>}</a>)}</nav>
    <div className="mt-auto flex flex-col gap-2 border-t border-line pt-4">
      <button onClick={toggle} title="Toggle theme" className={row + ' text-mute hover:bg-raised hover:text-ink'}><Icon name={dark ? 'Sun' : 'Moon'} />{!col && (dark ? 'Light mode' : 'Dark mode')}</button>
      {user ? <div className={'flex items-center gap-2 text-sm text-mute ' + (col ? 'justify-center' : 'px-3')}><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold uppercase text-white">{user[0]}</span>{!col && user}</div>
        : <a href="#/login" title="Join waitlist"><Btn size="sm" variant="dark" className="w-full">{col ? <Icon name="UserPlus" /> : 'Join waitlist'}</Btn></a>}
    </div></aside>;
}
function Home({ authed }) {
  return <><Hero authed={authed} /><HowItWorks /><Automations /><Features /><AgentBox /><Waitlist /></>;
}
function App() {
  const [col, setCol] = useState(() => { try { return localStorage.getItem('hw-side') === '1'; } catch (e) { return false; } });
  useEffect(() => { try { localStorage.setItem('hw-side', col ? '1' : '0'); } catch (e) {} }, [col]);
  const [route, setRoute] = useState(location.hash || '#/'); const [dark, toggle] = useTheme();
  const [user, setUser] = useState(() => { try { return localStorage.getItem('hw-user'); } catch (e) { return null; } });
  useEffect(() => { const f = () => { setRoute(location.hash || '#/'); if (/^#\/(login)?$/.test(location.hash || '#/')) window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  const auth = e => { setUser(e); try { localStorage.setItem('hw-user', e); } catch (x) {} };
  const out = () => { setUser(null); try { localStorage.removeItem('hw-user'); } catch (x) {} };
  if (route === '#/login') return <><button onClick={toggle} aria-label="Toggle theme" className="fixed right-4 top-4 z-50 grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-mute hover:text-ink"><Icon name={dark ? 'Sun' : 'Moon'} /></button><Login onAuth={auth} /></>;
  return <><SideBar dark={dark} toggle={toggle} user={user} col={col} setCol={setCol} /><div id="top" className={'transition-[padding] duration-300 ' + (col ? 'md:pl-[68px]' : 'md:pl-60')}><Nav dark={dark} toggle={toggle} user={user} onOut={out} col={col} /><Home authed={!!user} /><Footer /></div></>;
}
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
