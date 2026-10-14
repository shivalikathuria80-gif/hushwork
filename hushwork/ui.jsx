const { useState, useEffect, useRef, useMemo } = React;
function Icon({ name, size = 16, className = '', stroke = 1.75 }) {
  const n = window.lucide && window.lucide.icons[name];
  if (!n) return null;
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{(n[0] === 'svg' ? n[2] : n).map(([t, a], i) => React.createElement(t, { ...a, key: i }))}</svg>;
}
// Buttons are solid. Shape rule: controls use rounded-xl (12px), cards rounded-2xl (16px), big panels rounded-3xl (24px).
// Pass `href` to get a real link that looks like a button (a button inside a link is invalid HTML).
function Btn({ variant = 'primary', size = 'md', loading, icon, iconRight, type = 'button', href, className = '', children, ...p }) {
  const v = {
    primary: 'border border-accent bg-accent text-white hover:bg-accent/90',
    secondary: 'border border-field bg-surface text-ink hover:bg-raised',
    ghost: 'border border-transparent text-mute hover:bg-raised hover:text-ink',
    dark: 'border border-ink bg-ink text-bg hover:bg-ink/90',
  }[variant];
  const s = { sm: 'h-11 px-3.5 text-sm md:h-9', md: 'h-11 px-5 text-[15px]', lg: 'h-12 px-6 text-base' }[size];
  const cls = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl font-semibold transition-colors duration-150 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 ${v} ${s} ${className}`;
  const inner = <>{loading ? <Icon name="Loader2" className="animate-[spin_1s_linear_infinite]" /> : icon && <Icon name={icon} />}{children}{iconRight && !loading && <Icon name={iconRight} />}</>;
  if (href) return <a {...p} href={href} className={cls + ' hover:opacity-100'}>{inner}</a>;
  return <button {...p} type={type} aria-busy={loading || undefined} disabled={p.disabled || loading} className={cls}>{inner}</button>;
}
function Logo({ className = '' }) {
  return <a href="#top" className={`inline-flex min-h-11 items-center gap-2 font-semibold tracking-tight text-ink hover:opacity-100 ${className}`}>
    <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent text-[15px] font-bold text-white">H</span>Hushwork</a>;
}
function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'));
  const toggle = () => { const d = !dark; setDark(d); document.documentElement.classList.toggle('dark', d); try { localStorage.setItem('hw-theme', d ? 'dark' : 'light'); } catch (e) {} };
  return [dark, toggle];
}
function Reveal({ children, className = '', delay = 0 }) {
  const ref = useRef(); const [on, setOn] = useState(false);
  useEffect(() => { const o = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); o.disconnect(); } }, { threshold: .12 }); o.observe(ref.current); return () => o.disconnect(); }, []);
  return <div ref={ref} className={className} style={{ opacity: on ? 1 : 0, transform: on ? 'none' : 'translateY(16px)', transition: `opacity .6s ${delay}s, transform .6s ${delay}s cubic-bezier(.16,1,.3,1)` }}>{children}</div>;
}
// One row of a workflow plan. Used by the live agent box and by the feature samples,
// so the page shows the same real component in both places.
function StepRow({ icon, title, sub, right, delay = -1 }) {
  return <li className="flex items-center gap-3 rounded-xl px-2 py-2" style={delay >= 0 ? { animation: `fadeUp .4s ${delay}s both` } : undefined}>
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line bg-raised text-ink"><Icon name={icon} size={16} /></span>
    <div className="min-w-0 flex-1 text-sm"><b className="font-medium">{title}</b><p className="text-mute">{sub}</p></div>{right}</li>;
}
Object.assign(window, { Icon, Btn, Logo, useTheme, Reveal, StepRow });
