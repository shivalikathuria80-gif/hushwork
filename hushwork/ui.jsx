const { useState, useEffect, useRef, useMemo } = React;
function Icon({ name, size = 16, className = '', stroke = 1.75 }) {
  const n = window.lucide && window.lucide.icons[name];
  if (!n) return null;
  return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{(n[0] === 'svg' ? n[2] : n).map(([t, a], i) => React.createElement(t, { ...a, key: i }))}</svg>;
}
function Btn({ variant = 'primary', size = 'md', loading, icon, iconRight, className = '', children, ...p }) {
  const v = { primary: 'border border-white/30 bg-gradient-to-b from-violet-400/80 to-violet-700/80 text-white backdrop-blur-xl shadow-[inset_0_1px_0_rgb(255_255_255/.55),inset_0_-8px_16px_rgb(76_29_149/.5),0_10px_30px_-8px_rgb(124_58_237/.8)] hover:-translate-y-0.5', secondary: 'border border-white/20 bg-white/10 text-ink backdrop-blur-xl shadow-[inset_0_1px_0_rgb(255_255_255/.35),0_8px_24px_-10px_rgb(0_0_0/.6)] hover:bg-white/20 hover:-translate-y-0.5', ghost: 'text-mute hover:text-ink hover:bg-raised', dark: 'border border-white/25 bg-accent/60 text-white backdrop-blur-xl shadow-[inset_0_1px_0_rgb(255_255_255/.4)] hover:bg-accent/80 hover:-translate-y-0.5' }[variant];
  const s = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-5 text-[15px]', lg: 'h-12 px-6 text-base' }[size];
  return <button {...p} disabled={p.disabled || loading} className={`inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-300 active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none ${v} ${s} ${className}`}>
    {loading ? <Icon name="Loader2" className="animate-[spin_1s_linear_infinite]" /> : icon && <Icon name={icon} />}{children}{iconRight && !loading && <Icon name={iconRight} />}</button>;
}
function Logo({ className = '' }) {
  return <a href="#/" className={`inline-flex items-center gap-2 font-semibold tracking-tight text-ink hover:opacity-100 ${className}`}>
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
  return <div ref={ref} className={className} style={{ opacity: on ? 1 : 0, transform: on ? 'none' : 'translateY(18px)', transition: `opacity .7s ${delay}s, transform .7s ${delay}s cubic-bezier(.2,.7,.2,1)` }}>{children}</div>;
}
function Eyebrow({ children }) { return <span className="inline-flex items-center rounded-full border border-line bg-surface px-3 py-1 font-mono text-xs text-mute">{children}</span>; }
Object.assign(window, { Icon, Btn, Logo, useTheme, Reveal, Eyebrow });
