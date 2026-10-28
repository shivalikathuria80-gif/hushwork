# The docs site (docs.hushwork.in)

How the public documentation site is built, how the subdomain works, and how to add or change a page.

Up: [Reference index](README.md)

## What it is

A set of pages that explain Hushwork to people who use it. It lives **inside the same Next.js app** as the main site. There is no second project and no second deploy.

- The pages are written as plain markdown files in `hushwork-app/content/docs/`.
- The same pages are reachable at `/docs` on any host (for example `hushwork.in/docs`) and at the root of any host that starts with `docs.` (for example `docs.hushwork.in`).
- The pages are open to everyone. Nothing on them reads a sign-in. They are meant to be found by search engines (the app pages are not).

## How the subdomain works

A **subdomain** is the part before the main name: in `docs.hushwork.in`, `docs` is the subdomain. Vercel can serve many names from one project.

1. In `next.config.mjs`, `rewrites()` has two rules that only apply when the request's host matches the pattern `docs\..*` (a host that starts with `docs.`).
2. `/` on that host is quietly rewritten to `/docs`, and `/something` is rewritten to `/docs/something`. The address in the browser does not change.
3. Files the pages need (`/_next/...`, `/api`, the icon and the link-preview images) and `/docs` itself are left alone.

So the only things needed to go live are on the hosting side:

1. In Vercel, open the Hushwork project, Settings, Domains, and add `docs.hushwork.in`.
2. At the place where the domain's DNS is managed, add the record Vercel shows (usually a CNAME named `docs` pointing at `cname.vercel-dns.com`).
3. Wait until Vercel says the domain is valid. It issues the https certificate by itself.

To test on your own computer: run `npm run dev`, then open `http://docs.localhost:3100` (browsers send `*.localhost` to your own machine).

## The pieces

| Piece | File | Job |
| --- | --- | --- |
| Page list | `lib/docs/pages.js` | The groups and pages, in menu order. Slug = file name. |
| Content | `content/docs/<slug>.md` | One markdown file per page. |
| Reader | `lib/docs/markdown.js` | Turns markdown into plain data. Never makes HTML. |
| Loader | `lib/docs/load.js` | Reads one file. Only slugs from the page list can reach the disk. |
| Drawing | `components/docs/Markdown.js` | Draws that data as React elements. |
| Side menu | `components/docs/DocsNav.js` | The grouped menu (a "Menu" button on phones). |
| Pages | `app/docs/layout.js`, `page.js`, `[slug]/page.js` | Frame, home, and one page per slug. |
| Main-site link | `lib/docs/site.js` | The full address for "Open Hushwork" (uses `NEXT_PUBLIC_SITE_URL`). |
| Tests | `lib/docs/*.test.js` | The reader, the page list against the files, every link, the rewrite rule. |

## What markdown is allowed

Only what the reader understands: `#`, `##`, `###` headings, paragraphs, `-` bullets, `1.` numbers, `>` quotes, fenced code, pipe tables, `---`, and inside a line `code`, `**bold**`, `*italic*`, `[text](link)`. A link must start with `https://`, `/` or `#`. Raw HTML and images are not supported on purpose (a test fails if they appear).

## Add or change a page

1. Add a line to `DOC_GROUPS` in `lib/docs/pages.js` (slug and title).
2. Create `content/docs/<slug>.md`. The first line is `# ` plus exactly the title from the list. The first paragraph is one plain sentence (20 to 200 characters): it is used under the title on the home page and as the search-engine description.
3. Link to other pages as `[words](/docs/other-slug)`.
4. Run `npm test`. It checks that every listed page has a file, every file is listed, every link and `#anchor` exists, and that no secret-looking text slipped in.
5. Copy the file into the Obsidian vault mirror (`hushwork obsidian/hushwork-app/content/docs/`) so the notes stay the same.

## Known limits

- No search box yet (the side menu and the home page are the way around).
- Internal links use `/docs/<slug>`, so on `docs.hushwork.in` the address bar shows `/docs/welcome`. It works; it is just not the shortest form.
- On the docs host, `/privacy` shows the docs page called Privacy, not the legal Privacy page of the main site. The legal pages stay on the main domain.

## Where in the code

`next.config.mjs`, `app/docs/`, `components/docs/`, `lib/docs/`, `content/docs/`.
