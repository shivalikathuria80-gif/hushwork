# Hushwork site (Next.js)

The Hushwork landing page. Next.js 16 (App Router), React 19, Tailwind 4, `motion` for animation, Phosphor icons. The earlier no-build prototype lives in `../hushwork/` for reference.

## Run it

Install the packages once (this reads `package.json` and downloads what the project needs):

```bash
npm install
```

Start the development server, then open http://localhost:3100. Edits show up as soon as you save. The port is 3100 on purpose, so port 3000 stays free for your other app:

```bash
npm run dev
```

Other commands:

```bash
npm run lint
```

`lint` checks the code for mistakes without running it.

```bash
npm run build
```

`build` makes the optimized version visitors would get. It fails loudly if something is wrong. `npm run start` then serves that build.

## Settings (environment variables)

An environment variable is a value kept outside the code. Copy `.env.example` to `.env.local` and fill it in. `.env.local` is never committed.

| Name | What it is | Secret? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Address of the Supabase project that stores waitlist emails | No, public |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Key that may only add a waitlist email (database rules, see `../supabase/waitlist.sql`) | No, public by design |
| `NEXT_PUBLIC_SITE_URL` | The site's own address once it has a domain (used for link previews). Optional | No |

`NEXT_PUBLIC_` means the value is sent to the browser. Never put a secret or `service_role` key in one. After changing `.env.local`, restart `npm run dev`.

## Where things are

- `app/layout.js`: fonts (Geist), page metadata, saved light/dark theme, motion settings.
- `app/globals.css`: colour tokens (light and dark), spacing and shape rules, the CSS animations.
- `app/page.js`: the home page, built from the sections in `components/`.
- `app/privacy/page.js`: the privacy page (draft, review before launch).
- `app/opengraph-image.js`: the picture shown when the link is shared.
- `components/`: one file per section (`Hero`, `AgentBox`, `HowItWorks`, `Automations`, `Features`, `Waitlist`, `Footer`), plus shared pieces (`ui.js`, `icons.js`) and helpers (`MotionProvider`, `useTheme`, `usePrefersReducedMotion`).
- `lib/waitlist.js`: saves an email to Supabase.

## How the motion works

- The headline entrance is plain CSS, so it starts without waiting for JavaScript.
- Scroll reveals, the folder-tab indicator, the run log and the footer wordmark use the `motion` library.
- The glow and the workflow band move on their own. They stop when scrolled offscreen, when the visitor presses **Pause motion**, or when their system asks for reduced motion (then movement is removed and only fades remain).
