// Draws the word as a field of dots on a canvas. The colour comes from the --mute token
// and is redrawn when the theme changes, so it works in both light and dark.
function DotWord({ word = 'hushwork' }) {
  const ref = useRef(); const wrap = useRef();
  useEffect(() => {
    const draw = () => {
      const w = wrap.current && wrap.current.clientWidth; if (!w) return;
      const c = ref.current, dpr = Math.min(devicePixelRatio || 1, 2);
      const fs = w / (word.length * .56), h = Math.round(fs * .62), cell = Math.max(6, Math.round(w / 150));
      c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
      const o = document.createElement('canvas'); o.width = w; o.height = h + fs * .35; const x = o.getContext('2d');
      x.font = `600 ${fs}px Geist, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff'; x.fillText(word, w / 2, fs * .95);
      const d = x.getImageData(0, 0, o.width, o.height).data, g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
      g.fillStyle = 'rgb(' + getComputedStyle(document.documentElement).getPropertyValue('--mute').trim().split(/\s+/).join(',') + ')';
      const y0 = fs * .32;
      for (let py = 0; py < h; py += cell) for (let px = 0; px < w; px += cell) { let s = 0, n = 0; for (let j = 0; j < cell; j += 2) for (let i = 0; i < cell; i += 2) { const yy = Math.floor(py + y0 + j); if (yy >= o.height) continue; s += d[(yy * o.width + Math.floor(px + i)) * 4 + 3]; n++; } const a = n ? s / n / 255 : 0; if (a > .04) { g.beginPath(); g.arc(px + cell / 2, py + cell / 2, Math.max(.6, a * cell * .5), 0, 7); g.fill(); } }
    };
    document.fonts.load('600 64px Geist').then(draw, draw);
    const ro = new ResizeObserver(draw); ro.observe(wrap.current);
    const mo = new MutationObserver(draw); mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, [word]);
  return <div ref={wrap} className="w-full overflow-hidden" role="img" aria-label={word}><canvas ref={ref} className="block" aria-hidden="true"></canvas></div>;
}
function Footer() {
  const cols = [['Product', [['How it works', '#how'], ['Automations', '#auto'], ['Features', '#features'], ['Try it', '#agent'], ['Waitlist', '#wait']]], ['Company', [['Privacy', 'privacy.html']]], ['Contact', [['hello@hushwork.co', 'mailto:hello@hushwork.co']]]];
  return <footer className="border-t border-line bg-bg px-5 pt-14 text-sm md:px-10">
    <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
      <div><Logo /><p className="mt-3 max-w-xs text-mute">Describe the task. Hushwork handles it.</p></div>
      {cols.map(([h, ls]) => <div key={h}><p className="font-medium">{h}</p><ul className="mt-1">{ls.map(([l, href]) => <li key={l}><a href={href} className="inline-flex min-h-11 items-center text-mute transition-colors hover:text-ink hover:opacity-100">{l}</a></li>)}</ul></div>)}</div>
    <div className="mx-auto mt-12 flex max-w-6xl items-center justify-between border-t border-line pt-4 text-mute"><span>© 2026 Hushwork</span>
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex h-11 items-center gap-2 rounded-xl px-2 transition-colors hover:text-ink">Back to top<Icon name="ArrowUp" size={14} /></button></div>
    <div className="mx-auto mt-10 max-w-[1500px] md:mt-16"><DotWord /></div></footer>;
}
Object.assign(window, { Footer });
