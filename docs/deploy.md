# Putting Hushwork online (checklist)

Hushwork runs only on your computer today (port 3100). This is the list of things to do **before** it goes online, so nothing surprising happens. Nothing here has been done yet.

## 1. Before you start

- Run `npm test`, `npm run lint` and `npm run build` inside `hushwork-app`. All three must pass.
- Pick a host. Vercel works well with Next.js. Netlify and Hostinger also work.
- Decide the website address (for example `https://hushwork.example.com`). It is used in steps 3 and 4.

## 2. Settings (environment variables) to add on the host

Type them in the host's "Environment variables" page. Never put them in the code and never use `NEXT_PUBLIC_` in front of a secret.

| Name | Secret? | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | no | your Supabase project address |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | no | the Supabase publishable key |
| `NEXT_PUBLIC_SITE_URL` | no | your website address |
| `GROQ_API_KEY` | **yes** | lets the AI write plans and answer steps |
| `CONNECTIONS_KEY` | **yes** | locks every saved connection. Use the **same** one you use on your computer only if you want to keep the connections you already made; otherwise make a new one with `npm run secret` and everyone reconnects |
| `LINEAR_CLIENT_ID`, `LINEAR_CLIENT_SECRET` | secret is **yes** | Hushwork's own app in Linear |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | secret is **yes** | Hushwork's own app in Google Cloud |

Do **not** add `LINEAR_API_KEY` online. It is your personal key for your own computer, and Hushwork ignores it on a real server on purpose.

## 3. Tell the other websites about the new address

- **Linear** (Settings, API, OAuth applications): add `https://<your address>/api/connect/linear/callback` as a callback address.
- **Google Cloud** (Credentials, your OAuth client): add `https://<your address>/api/connect/google/callback` under Authorized redirect URIs.
- **Supabase** (Authentication, URL Configuration): set the Site URL to your address and add `https://<your address>/**` to the redirect list, so sign-in links come back to the right place.

## 4. Google "not verified" warning

While the Google app is in **Testing**, only the test users you listed can connect, and Google asks them to connect again every 7 days. To let anybody connect, the app must go through Google's verification, and the Gmail and Drive permissions are "sensitive/restricted", so that review is real work (a privacy page, a demo video, sometimes a security review). Do this only when you are ready to open Hushwork to other people.

## 5. Known limits to fix before many people use it

- **Usage limits live in the server's memory.** Online, each server copy counts on its own and a restart forgets everything, so a person could get more than the limit. Move the counters into the database first (`lib/ai/limits.js` and `limiters` in `lib/actions/runs.js`).
- **Nothing runs by itself.** There is no scheduler yet: every action happens only after a person presses Approve. A schedule needs a timer on the host plus a rule for what may run without a person watching.
- **Backups and email.** Check Supabase backups and the email provider limits (Supabase's own mail sender is very limited).

## 6. After it is online, test these

1. Sign up and sign in with a fresh email.
2. Connections: Connect Linear, Connect Google, and Disconnect each.
3. A practice run, then one Approve of each kind you use.
4. The `/privacy` page still matches what the app really does.
