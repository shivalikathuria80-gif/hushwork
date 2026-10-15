# Hushwork (prototype)

**Superseded by `../hushwork-app/` (Next.js).** This folder is kept for reference only.

Standalone landing site. React 18 + Tailwind (CDN) + Lucide, no build step, no dependency on the design system.

## Run it

Browsers such as Chrome and Edge typically block this setup when you double-click `index.html`, because the JSX files are fetched over the web protocol. Use the tiny preview server instead. From the project folder (the one that contains `hushwork/`):

```bash
python .claude/serve.py
```

Then open http://localhost:5174. The server tells the browser not to cache, so every edit shows on reload. Stop it with Ctrl+C.

## Files

- `index.html`: page head (fonts, colour tokens, metadata) and script loading order.
- `config.js`: public Supabase URL and publishable key for the waitlist. Nothing secret goes here.
- `ui.jsx`: Icon, Btn, Logo, Reveal, StepRow, theme hook.
- `App.jsx`: top navigation, skip link, page assembly.
- `Hero.jsx`, `AgentBox.jsx`: the hero and the interactive agent box (a preview that matches keywords; no AI model yet).
- `Sections.jsx`: how it works (timeline), automations (folder tabs), waitlist form.
- `Features.jsx`: feature samples (run log, approval card, pause switch, tools).
- `Footer.jsx`: footer and the dot wordmark.
- `privacy.html`: privacy page (draft, review before launch).
- `Login.jsx`: not loaded. Kept for the real product (Phase 3 in `../PLAN.md`).
