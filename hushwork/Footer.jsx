function DotWord({ word = 'hushwork' }) {
  const ref = useRef(); const wrap = useRef();
  useEffect(() => {
    const draw = () => {
      const w = wrap.current.clientWidth, c = ref.current, dpr = Math.min(devicePixelRatio || 1, 2);
      const fs = w / (word.length * .56), h = Math.round(fs * .62), cell = Math.max(6, Math.round(w / 150));
      c.width = w * dpr; c.height = h * dpr; c.style.width = w + 'px'; c.style.height = h + 'px';
      const o = document.createElement('canvas'); o.width = w; o.height = h + fs * .35; const x = o.getContext('2d');
      x.font = `700 ${fs}px Inter, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; x.fillStyle = '#fff'; x.fillText(word, w / 2, fs * .95);
      const d = x.getImageData(0, 0, o.width, o.height).data, g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h); g.fillStyle = '#ebe8dc';
      const y0 = fs * .32;
      for (let py = 0; py < h; py += cell) for (let px = 0; px < w; px += cell) { let s = 0, n = 0; for (let j = 0; j < cell; j += 2) for (let i = 0; i < cell; i += 2) { const yy = Math.floor(py + y0 + j); if (yy >= o.height) continue; s += d[(yy * o.width + Math.floor(px + i)) * 4 + 3]; n++; } const a = n ? s / n / 255 : 0; if (a > .04) { g.beginPath(); g.arc(px + cell / 2, py + cell / 2, Math.max(.6, a * cell * .5), 0, 7); g.fill(); } }
    };
    document.fonts.ready.then(draw); const ro = new ResizeObserver(draw); ro.observe(wrap.current); return () => ro.disconnect();
  }, [word]);
  return <div ref={wrap} className="w-full overflow-hidden" role="img" aria-label={word}><canvas ref={ref} className="block" aria-hidden="true"></canvas></div>;
}
function Footer() {
  const cols = [['Product', [['How it works', '#how'], ['Automations', '#auto'], ['Features', '#features'], ['Agent', '#agent'], ['Waitlist', '#wait']]], ['Company', [['About', '#top'], ['Privacy', '#top'], ['Terms', '#top']]], ['Contact', [['hello@hushwork.co', 'mailto:hello@hushwork.co']]]];
  return <footer className="border-t border-line bg-bg px-6 pt-12 font-mono text-sm uppercase tracking-[.14em] text-[#bdbab0] md:px-10">
    <div className="mx-auto grid max-w-7xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
      <div><p className="text-[#ebe8dc]">Hushwork</p><p className="mt-2 text-[#6f6d66]">© 2026 · Remote / Worldwide</p></div>
      {cols.map(([h, ls]) => <div key={h}><p className="text-[#6f6d66]">{h}</p><ul className="mt-2 space-y-2 normal-case tracking-[.06em]">{ls.map(([l, href]) => <li key={l}><a href={href} className="!text-[#bdbab0] transition hover:!text-white hover:opacity-100">{l}</a></li>)}</ul></div>)}</div>
    <div className="mx-auto mt-10 flex max-w-7xl items-center justify-between border-t border-white/10 pt-5"><span className="text-[#6f6d66]">Privacy · Terms</span>
      <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="inline-flex items-center gap-2 transition hover:text-white">Back to top<Icon name="ArrowUp" size={14} /></button></div>
    <div className="mx-auto mt-16 max-w-[1500px] md:mt-24"><DotWord /></div></footer>;
}
Object.assign(window, { Footer });
