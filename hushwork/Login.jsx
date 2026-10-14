function Login({ onAuth }) {
  const [email, setEmail] = useState(''); const [pw, setPw] = useState(''); const [show, setShow] = useState(false);
  const [err, setErr] = useState({}); const [loading, setLoading] = useState(false); const [fail, setFail] = useState('');
  const submit = e => { e.preventDefault(); const er = {}; if (!/^\S+@\S+\.\S+$/.test(email)) er.email = 'Enter a valid email address.'; if (pw.length < 8) er.pw = 'Password must be at least 8 characters.'; setErr(er); setFail(''); if (Object.keys(er).length) return;
    setLoading(true); setTimeout(() => { setLoading(false); onAuth(email); location.hash = '#/'; }, 1100); };
  const icons = [['Mail', 0, 150], ['Calendar', 60, 210], ['FileText', 120, 150], ['MessageSquare', 180, 210], ['CreditCard', 240, 150], ['Table', 300, 210]];
  const field = (id, label, type, val, set, error, extra) => <div><label htmlFor={id} className="mb-1.5 block text-sm font-medium">{label} <span className="text-red-500" aria-hidden="true">*</span></label>
    <div className="relative"><input id={id} type={type} value={val} onChange={e => set(e.target.value)} aria-invalid={!!error} aria-describedby={error ? id + '-e' : undefined} placeholder={`Enter your ${label.toLowerCase()}`} className={`h-12 w-full rounded-xl border bg-surface px-4 text-[15px] outline-none transition placeholder:text-mute/60 focus:border-accent ${error ? 'border-red-500' : 'border-line'}`} />{extra}</div>
    {error && <p id={id + '-e'} className="mt-1.5 flex items-center gap-1.5 text-sm text-red-500"><Icon name="CircleAlert" size={14} />{error}</p>}</div>;
  return <main className="grid min-h-screen lg:grid-cols-2">
    <div className="relative hidden overflow-hidden bg-[#0b0d14] text-white lg:block">
      <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 50% at 50% 50%,rgb(104 137 255/.18),transparent 70%)' }}></div>
      {[120, 190, 260, 330, 400].map(r => <div key={r} className="absolute left-1/2 top-1/2 rounded-full border border-white/[.07]" style={{ width: r * 2, height: r * 2, margin: -r }}></div>)}
      {icons.map(([ic, a, r], i) => <div key={ic} className="orbit absolute left-1/2 top-1/2 h-0 w-0" style={{ '--d': `${50 + i * 8}s`, transform: `rotate(${a}deg)`, animationDirection: i % 2 ? 'reverse' : 'normal' }}><span className="absolute grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/[.06] backdrop-blur" style={{ left: r + (i % 2 ? 80 : 0) - 24, top: -24 }}><Icon name={ic} size={20} /></span></div>)}
      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 px-12 text-center"><h2 className="text-6xl font-semibold tracking-tight [background:linear-gradient(#fff,#ffffff66)] [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]">Quiet work,<br />done.</h2></div>
      <Logo className="absolute left-8 top-8 !text-white" /></div>
    <div className="flex flex-col justify-center px-6 py-12 sm:px-16 lg:px-24">
      <a href="#/" className="mb-10 inline-flex items-center gap-1.5 text-sm text-mute lg:hidden"><Icon name="ArrowLeft" size={14} />Back</a>
      <div className="mx-auto w-full max-w-sm"><h1 className="text-4xl font-semibold tracking-tight">Welcome back</h1><p className="mt-2 text-mute">Sign in to your account</p>
        <Btn variant="secondary" size="lg" className="mt-8 w-full" onClick={() => { setLoading(true); setTimeout(() => { setLoading(false); onAuth('you@gmail.com'); location.hash = '#/'; }, 900); }}><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" /><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.5 5.8c4.4-4 7-10 7-17.5z" /><path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 010-9.4l-7.9-6.1a24 24 0 000 21.6l7.9-6.1z" /><path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" /></svg>Continue with Google</Btn>
        <div className="my-6 flex items-center gap-4 text-sm text-mute"><span className="h-px flex-1 border-t border-dashed border-line"></span>or<span className="h-px flex-1 border-t border-dashed border-line"></span></div>
        <form onSubmit={submit} noValidate className="space-y-5">
          {field('email', 'Email', 'email', email, setEmail, err.email)}
          {field('pw', 'Password', show ? 'text' : 'password', pw, setPw, err.pw, <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-mute hover:text-ink"><Icon name={show ? 'Eye' : 'EyeOff'} /></button>)}
          <Btn type="submit" variant="dark" size="lg" className="w-full" loading={loading} iconRight="ArrowRight">Sign in</Btn>
          <p className="text-sm"><a href="#/login" onClick={e => { e.preventDefault(); setFail('Password reset isn’t available in this preview.'); }}>Forgot password?</a></p>
          {fail && <p role="alert" className="text-sm text-mute">{fail}</p>}</form></div></div></main>;
}
Object.assign(window, { Login });
