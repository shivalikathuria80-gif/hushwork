# QA report: sign-in, drafts and sculpture login (first app slice)

Stage 5, 2026-10-15. Local only, http://localhost:3100. Reviewer changed no app file, made no commit, installed nothing, ran no DDL, did not touch the dev server, port 3000 or `.env.local`, and did not sign up, sign in or submit the waitlist. Real sign-in is NOT TESTABLE for the reviewer, so everything behind it is judged by reading code (marked "code").

**Verdict: FIX FIRST (small).** 0 BLOCKER, 1 MAJOR (auth cookie flags, safe locally, must be fixed before any deployment), 10 MINOR, 15 NIT. The fix batch is about 40 lines. No security problem was found in the request path: every draft action checks the user first, input is validated on the server, the database rules match the plan exactly, and no secret is in the code.

## What was run
- `npm run lint` clean. `tsc --noEmit` exit 0. `node --test lib/validate.test.js` 9/9 pass. `npm audit signatures`: 372 verified, `npm audit --omit=dev`: 0 vulnerabilities. Lockfile diff is additions only (10 packages, both Supabase packages pinned exact). `next build` NOT run (told not to; the builder's passing build in a throwaway copy is unverified by me).
- `curl` (headers) on 25 URLs, headless Edge (CDP) at 1440/1024/768/390/320 x dark/light, axe-core 4.10.2 injected into my own scratch profile, 60+ hostile inputs fed to `lib/validate.js`, a real-schema review with read-only Supabase calls. Scratch files: `...\scratchpad\qa3\`.
- Supabase (read-only): region `ap-south-1` (Mumbai). `workflows` now exists, RLS on (not forced), 4 policies (all `authenticated`, all `(select auth.uid()) = user_id`, update has USING and WITH CHECK), table grants for `authenticated` = SELECT, DELETE only, column grants INSERT/UPDATE = name, prompt, plan only, nothing for `anon`, all 5 constraints and the cascade FK present, trigger `workflows_set_updated_at` (security invoker, `search_path=""`), 0 users. This is identical to `supabase/workflows.sql`. Security advisor: no findings. Performance advisor: one INFO `unused_index` on `workflows_user_id_updated_at_idx` (expected: empty table, no queries yet; it also backs the foreign key, keep it). Anonymous sign-ins: 0 anonymous users exist, but the dashboard toggle itself is NOT TESTABLE.

## Acceptance criteria 1 to 10
| # | Result | Evidence |
|---|---|---|
| 1 | PASS | `/login` dark and light at 1440: sculpture shows; contrast scan 0 failures at all 5 widths x 2 themes (14 text items at 1440, min 5.18 light / 5.70 dark). The scan skips the aria-hidden panel text ("Quiet work, done.", hint); I checked those in screenshots (large ink on flat panel colour). |
| 2 | PASS | Pixel diff of the panel: rest vs flowing 8.8; 1.5 s after the mouse leaves 1.9; 7.5 s after 0.25 (back to rest). Idle with no mouse: 0.01 (nothing moves by itself). |
| 3 | PASS | Emulated `prefers-reduced-motion: reduce`: no Pause button, no hint, mouse sweep changes 0 pixels, form works, console clean. Note: still image is a WebGL canvas drawn once (see N9), not an `<img>`. Real Windows setting not toggled. |
| 4 | PASS | Click Pause: `hw-motion=paused`, label "Play motion", sweep diff 0. Reload: still paused, sweep diff 0. Play again restores motion. |
| 5 | PASS | Edge with `--disable-gpu --disable-3d-apis` (webgl2 unavailable): fallback image visible, no blank box, console clean, dark and light. See m6 (copy still says "Move your cursor over it"). |
| 6 | PARTIAL | NOT TESTABLE: wrong and right password. PASS: signed-out `/app`, `/app/runs`, `/app/nonexistent` all 307 to `/login` (also `/APP` variants 404, `/%61pp` 404, encoded and `.rsc` forms 307, `x-middleware-subrequest` header ignored). Code: bad credentials map to one sentence, success calls `redirect("/app")`. |
| 7 | NOT TESTABLE | Needs sign-in. Code + real schema: `planFor` gives each of the 5 recipes its own plan (node run); Composer saves only `{prompt, plan}`; insert/update/delete/select match the real grants and policies (checked above). Refresh persistence and the two-account RLS test are the owner's. |
| 8 | PASS (code + builder screenshots) | Not rendered live by me (needs sign-in). `RunsViewer.js`: "Nothing has run yet.", one item labelled Sample, banner "Nothing here happened", placeholders only (Client A/B/C), switch and approval labelled "(sample)". Builder screenshots in `qa2\scratch\runs-*.png` agree. |
| 9 | PARTIAL | `/login` PASS: tab order Skip, Logo, theme, mode radios (arrow keys switch mode), email, password, show password, submit, Privacy, credit, Pause; every stop has a 2px outline. `/app` and `/app/runs`: all controls are native button/a/input and the global `:focus-visible` rule applies (code); live keyboard run needs sign-in. |
| 10 | PARTIAL | lint PASS, tsc PASS, `/` PASS (200, no cookie, 104 text items min 4.83 contrast, axe 0 violations, console clean, all 3 examples build plans). `/login` at 320/390/768: `scrollWidth - innerWidth` = 0. Build NOT RUN. Waitlist save NOT SUBMITTED; `Waitlist.js` is untouched in git and its form markup is unchanged (email + hidden `company` field + "Join the waitlist"). |

## Signed-out behaviour (curl, dev server)
`/` 200, `/privacy` 200, `/login` 200 (+ `?x=1`), `/app` 307, `/app/runs` 307, `/app/nonexistent` 307 (briefed expectation was 404; 307 is better: the proxy answers before routing, so signed-out visitors learn nothing about which `/app` paths exist; signed-in 404 not testable), `/demo` 404, `/scratch-preview` 404, `/application` 404, `//evil.com` 308 to `/evil.com` (same host, not an open redirect). No `Set-Cookie` on any URL. Redirect `Location` is always `/login` or `/app` (fixed targets, no `next=`), a forged Host or X-Forwarded-Host header is ignored. Server Action with a foreign `Origin` header: "Invalid Server Actions request." (origin check on). POST to `/app` signed out: 307. The browser only ever contacted `localhost:3100` (never Supabase).
Form checks (no valid credentials were ever submitted, so no Supabase call was possible): empty, bad email, empty password, 9-char and 65-char create-mode password, bad email in create mode, 257-char sign-in password all show the right sentence under the right field with `aria-invalid` + `aria-describedby`, and focus moves to that field. Switching mode keeps the email and clears errors. Show-password toggles `type` and `aria-pressed`.

## Security checklist
| Check | Result |
|---|---|
| Proxy matcher `["/app/:path*", "/login"]`; `/`, `/privacy` untouched; no redirect loop in normal use; no open redirect | PASS (curl). Edge case N14. |
| `getClaims()` only; `getSession()` never called; fail closed if Supabase unreachable | PASS (grep, `lib/supabase/proxy.js:31-36`, `lib/auth.js:12-18`) |
| Cookie handling matches `@supabase/ssr` 0.12.7 docs (nothing between client and `getClaims`, same response object returned, cache headers copied) | PASS (read against `types.d.ts` and `cookies.js`) |
| Cookie flags | FAIL, see M1 |
| Every draft action: `requireUser()` first, then validation | PASS (`lib/actions/drafts.js:26,41,60`). Sign actions intentionally open. |
| Input validation (non-strings, 5 MB strings, 2 MB nesting bomb, 1M-element array, `__proto__` keys, extra keys, 13 steps, long text, bad UUID) | PASS: all refused in under 250 ms, nothing polluted, extra keys dropped. Gaps: m1, N4, N5, N6. |
| No raw DB or Auth errors to the browser; only `error.code` logged; no `error.message` | PASS |
| `user_id` never sent from the browser; insert writes name, prompt, plan only; drafts query returns 5 named columns rebuilt as plain strings | PASS |
| `revalidatePath("/app")` after every write; rename/delete use `.select("id")` and treat 0 rows as gone | PASS |
| `redirect()` never inside try/catch; `unstable_rethrow` used in the 4 client catch blocks | PASS |
| No secrets: grep for `service_role`, `sb_secret_`, `eyJ...` finds only warning comments; `.env.local` ignored by `.gitignore` (`.env*`), only `.env.example` tracked | PASS |
| No browser Supabase client; waitlist keeps its raw `fetch` | PASS |
| No `dangerouslySetInnerHTML` with user text (only the constant theme script in `app/layout.js:39`); names, prompts, steps, email render as React text; `aria-label`/`title` escaped; no user text in any `href` | PASS |
| External link has `rel="noopener"` | PASS (`SculpturePanel.js:67`) |
| Password never logged, never returned in action state (state is `{kind, error, field}` or `{kind:"confirm", email}`) | PASS |
| Enumeration | PASS for sign-in (one sentence). Sign-up reveals an existing address once Confirm email is off (accepted in plan section 7); see m10. |
| Server Action origin check not disabled (`next.config.mjs` has no `allowedOrigins`) | PASS (tested) |
| `robots: noindex` on `/login`, `/app`, `/app/runs` (`/privacy` stays indexable) | PASS (HTML meta on `/login`; layout metadata for `/app`) |
| `supabase/workflows.sql` vs plan vs the live table | PASS, identical; app columns, limits and write shapes fit it. Worst legitimate plan (12 steps, 200 CJK chars each) is 14,952 bytes against the 20,000 limit. JSON plan is sent as an object array, not a string. |

## Findings
Severity order. "Fix" is exact.

### MAJOR
**M1. Auth cookie is readable by page scripts and never gets `Secure`.** `lib/supabase/server.js:22-28` and `lib/supabase/proxy.js:22-28` pass the library's options through unchanged. `@supabase/ssr` defaults are `httpOnly: false`, and it never adds `Secure` (verified in `node_modules/@supabase/ssr/dist/main/utils/constants.js:4-11`; no `secure` anywhere in the package). `docs/plan.md:321` says Secure "is added on HTTPS": that is wrong. The cookie holds a refresh token (valid 400 days). Harmless on localhost, but any XSS or plain-HTTP hop on a real host would expose it, and the app has no browser Supabase client, so it does not need script access. Fix: in both `setAll` functions use `{ ...options, httpOnly: true, secure: process.env.NODE_ENV === "production" }` (proxy: in the `supabaseResponse.cookies.set` line), correct plan.md:321, then sign in once to confirm it still works.

### MINOR
**m1. A hand-made plan can crash the page on "Open".** `lib/validate.js:81` allows any alphanumeric `icon`; `components/icons.js:23-24` looks it up on a plain object. Run with `react-dom/server`: `"constructor"` throws "Objects are not valid as a React child", `"valueOf"` and `"hasOwnProperty"` throw TypeError, `"toString"` prints "[object Undefined]". Reach it by calling the public `saveDraft` action with a crafted plan, then clicking Open: the "Something went wrong" screen. Own account only (RLS), delete still works (the list does not render icons). Fix: `if (!Object.hasOwn(ICONS, name)) return null;` in `icons.js:24` (one line); optionally also allow-list names in `cleanPlan`.
**m2. Links inside sentences are not underlined (WCAG 1.4.1, axe "serious").** `app/globals.css:68` (`a { color: ... }` only). Hit: "Privacy" in `LoginForm.js:161`, the two mailto links `privacy/page.js:58,63`; also "See your drafts" in `Composer.js:166` (code). Fix: add `text-decoration: underline;` to the rule at `globals.css:68` (or `underline` on those links).
**m3. "Draft deleted." is never announced after deleting the last draft.** `DraftList.js:47` renders the `role="status"` line only in the list branch; with 0 drafts the empty-state branch (35-43) replaces it. Fix: move that `<p role="status">` above the three branches so it always exists.
**m4. Saved time can show the server's time zone once deployed (latent).** `DraftCard.js:72-74,112`: `Intl.DateTimeFormat` runs on server and browser; `suppressHydrationWarning` hides the warning but React keeps the server text. Same machine locally, so invisible today. Fix: format after mount (e.g. `useSyncExternalStore` or an effect), or fix `timeZone` and say so.
**m5. Landing planner output changed (owner decision).** `components/AgentBox.js:18-27`: plan T7 said "one word, landing behaviour identical"; spec says `/` stays as is. The builder followed `design.md` 3.6 instead: new branch order, new lead and admin plans, and an extra "Ask you to approve" step in the landing invoice and report plans (now 5 steps). I ran all 3 landing examples: all build plans, and "Triage my inbox" now gets the inbox plan (before, "client" sent it to the Friday report: a real old bug). Recommend keep, but the owner should say yes. To revert: restore the old `planFor` body from git and keep only `export`.
**m6. Without WebGL the sculpture still says "Move your cursor over it".** `SculpturePanel.js:51` (hint) and `:70-71` (Pause stays): nothing reacts in the fallback, so the hint is untrue. Fix: in the wrapper test `document.createElement("canvas").getContext("webgl2")` once and pass `hint=""` when it is null.
**m7. Two small copy errors.** `Workspace.js:24` says "In the plan: Linear, Gmail" but the report plan never names Gmail (it says "Email each client"); use "In the plan: Linear". `Workspace.js:16` card "When a client emails me, " previews the Friday report plan (keyword "client"). Keyword false positives exist too ("leader" gives the lead plan; "Pay my contractors... receipt" gives the admin plan); acceptable for a labelled preview, but the card text could avoid the word "client".
**m8. README has no owner setup.** `README.md` never says to apply `supabase/workflows.sql` or to set Site URL, Redirect URL and Confirm email off (those steps exist only in `docs/plan.md` section 4). Without them a beginner sees "Could not load your drafts" or a stuck sign-up. Fix: add a short "Supabase setup" section with those 3 dashboard steps and the SQL step. The dashboard settings are still unconfirmed.
**m9. Privacy page.** `app/privacy/page.js:37`: "They process it for us and do not use it for anything else" is a claim about Supabase carried over from the old page and now also covers sign-in data; I could not verify it (the audit-log wording at line 23 is backed by Supabase's audit-log docs). Soften to "They store it for us under their terms" or have the owner confirm. Line 41 ("the database itself enforces this") is now true (policies verified live). All other sentences match behaviour: no "secure/encrypted" claim, Mumbai region confirmed, no AI, no analytics (grep), cookie removed on sign out, removal by email, waitlist and accounts separate. The `/login` link works.
**m10. Add to the "before deployment" list.** (a) Server-side sign-in calls reach Supabase from the server's IP, so Supabase's per-IP rate limit would be shared by all users: enable IP forwarding or add own throttling. (b) No security headers in `next.config.mjs` (clickjacking on `/login`). (c) No per-user draft cap. (d) Sign-up reveals existing emails while Confirm email is off. (e) `getClaims()` does not see a revoked session until the pass expires (up to 1 hour). (f) Replace placeholder sculpture images.

### NIT
N1 Dead code: `typedEmail` (`lib/actions/auth.js:22-25`) is never used; `getUser` is exported but only used inside `lib/auth.js`.
N2 `AgentBox.js:27` has `s =[[` (missing space).
N3 `lib/supabase/proxy.js:53` `path.startsWith("/app")` would also match `/application` if the matcher ever widened; use `path === "/app" || path.startsWith("/app/")`.
N4 A password over 72 bytes (about 24 CJK characters or 18 emoji) passes `checkPassword` (`validate.js:36`, limit counts characters) and Supabase refuses it: the user sees the generic "Something went wrong". Fix: also reject `new TextEncoder().encode(value).length > 72` with a plain sentence.
N5 A plan stuffed with control characters passes the app but exceeds the DB 20,000-byte rule (29,304 bytes measured) and shows "Check your connection". Only a hand-made request can do it.
N6 `signIn`/`signUp` call `formData.get` unguarded (`auth.js:50,70`): a malformed direct call returns a 500 (seen: "formData.get is not a function"), no state change. Add `if (!(formData instanceof FormData)) return { kind: "other", error: MESSAGE.other };`.
N7 After a preview, editing the box and pressing Save saves the earlier previewed text (`Composer.js:104`), which matches the plan on screen but not the box. Disable the textarea or clear the plan on edit.
N8 `AppNav.js:55` Escape closes the phone menu but focus is lost; return focus to the menu button.
N9 Reduced motion and Pause still load the sculpture chunk and draw one WebGL frame (canvas present), while plan section 6 said "still image only, do not load it". Acceptable (nothing moves); owner choice. At 1024 to 1279 px two images load (~415 KB); 1280+ loads one (228 KB). 390/768/320: exactly one image and no canvas (fresh-profile runs, cold and reload).
N10 Builder item (i) confirmed: a faint lighter rectangle around the dark still image at 768 (and a faint halo in the no-WebGL fallback). Placeholder images; gone when an owned image replaces them.
N11 The "try the action, rethrow redirects, else plain sentence" block is written 4 times (`LoginForm`, `Composer`, `AppNav`, `DraftCard.call`), and `SAVE_FAILED` appears in `Composer.js:12` and `drafts.js:19`. Fine for now.
N12 axe "region" (moderate): Logo, theme toggle (`login/page.js:23-24`) and the footer row (`SculpturePanel.js:66`) sit outside any landmark. Wrap in `<header>` / `<footer>`.
N13 Titles differ ("Privacy | Hushwork" vs "Sign in - Hushwork"); the drafts list silently stops at 50 (`Drafts.js:50`).
N14 If the proxy and `requireUser()` ever disagree (for example a one-off network failure in the second check), `/app` and `/login` redirect to each other until the browser gives up. Rare; no fix needed now.
N15 Performance advisor INFO `unused_index` on the new empty table (see above); ignore.

## Builder deviations (a to i)
| Item | Verdict |
|---|---|
| (a) No "session ended" message; redirects | Acceptable. The proxy renews the pass on each request, so it only happens if the session was revoked. A typed prompt is lost on redirect; message is a later nicety. |
| (b) No h1 focus after sign-in | Acceptable (full page load; one h1 per page verified on `/login`, code for `/app` and `/app/runs`). |
| (c) Pause has no `aria-pressed`, label changes | Acceptable (label-swap is a valid pattern; adding both would double-announce). |
| (d) Password over 72 bytes shows generic error | Acceptable for now; see N4 for a 3-line fix. |
| (e) Name limit 80 in UI vs 120 in DB | Acceptable: UI is stricter, DB is the backstop (both verified). |
| (f) Composer saves by direct action call with `useTransition` | Acceptable; double click is blocked (button disabled while saving). |
| (g) `getUser()` uses React `cache()` | Acceptable: cache lives for one request only, nothing is shared between users. |
| (h) Sign-in mode also shows the "We store your email..." line | Acceptable: `plan.md` T4 asks for it in both modes; design.md differs, plan wins. |
| (i) Faint patch at 768 px | Acceptable (N10). |

## Needs the owner to test
Write these down as you go. Use only `http://localhost:3100` (not `127.0.0.1`: the cookie belongs to one exact address).
**Before testing (dashboard, not done by anyone yet):** open Supabase > Authentication > URL Configuration: set Site URL to `http://localhost:3100`, add `http://localhost:3100/**` under Redirect URLs, and under Providers > Email switch Confirm email OFF (steps and links are in `docs/plan.md` section 4; note the old values first). Also confirm Authentication > Sign In / Providers shows "Allow anonymous sign-ins" OFF.
1. **Create an account.** `/login`, click Create account, use an address you own (for example `you+hw-a@gmail.com`) and a 10+ character password. Expect: you land on `/app` and the left bar shows that email. Supabase > Authentication > Users lists it.
2. **Stay signed in.** Reload `/app`: still signed in. Open a private window on `/app`: you are sent to `/login`. In browser dev tools > Application > Cookies you see `sb-mgvaqoishxsqecpjfnuo-auth-token`.
3. **Wrong password.** Sign out, then sign in with a wrong password: one plain sentence, the email stays. Then the right password: `/app`.
4. **Save a draft.** Type a task, press the arrow: "Preview plan. Nothing will run." Click Save as draft: "Saved to your drafts. It will not run." It appears under Your drafts. Reload: still there. In Table Editor > workflows the row's `user_id` equals the id shown under Authentication > Users.
5. **Open, rename, delete.** Open a draft (box and steps come back). Rename it (it moves to the top). Delete it ("Yes"): "Draft deleted." is spoken or shown; with the last draft gone, check that the message still appears (m3).
6. **Sign out.** Click Sign out: you land on `/login` and the `sb-...` cookie is gone. Press the browser Back button: the page must NOT show your drafts (not tested by anyone; the browser may keep a copy of the old page).
7. **Two-account RLS test (the important one).** Make a second account in a private window (`you+hw-b@gmail.com`). As A save a draft called "A-secret". As B: `/app` must not list it. Optional database proof with a scratch Node script as in `plan.md` section 8E (B cannot select, update or delete A's row; inserting with A's `user_id` is refused).
8. **Confirm-email paths (only if you turn Confirm email on later):** sign-up should show "Check your email" and no session; the link in the email lands on a page this build does not have, so leave it off for now.
9. **Waitlist regression.** On `/` join with `you+waitlist-check@gmail.com`: "You're on the list". Delete that row afterwards in Table Editor > waitlist.
10. **Keyboard on `/app` and `/app/runs`:** Tab through everything (cards, tiles, drafts, rename, delete confirm, Escape); every stop shows a purple outline.
11. **Cleanup.** Delete your test users in Authentication > Users (their drafts go with them), clear `localhost:3100` cookies.
12. Re-run Supabase's security and performance advisors once an account and a draft exist (the `unused_index` INFO should disappear).
13. **Build.** Stop `npm run dev` (Ctrl+C), run `npm run build` (makes the optimized version; it fails loudly on mistakes), then `npm run dev` again. I did not run it.
