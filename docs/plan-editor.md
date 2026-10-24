# Plan: manual step editor (workflow-builder phase A). It still runs NOTHING.

> **Historical document.** Written for an earlier slice of the project and not kept up to date. For how Hushwork works today read [`PROJECT.md`](../PROJECT.md) and [`DECISIONS.md`](../DECISIONS.md).

## What shipped (differs from the plan below)
The plan below is the architect's first design. The build follows the owner's decisions and QA round 3 (`docs/qa-3.md`), so these things differ:
- **Where the editor lives:** one `StepEditor`, inside the Composer's plan card only, for a fresh preview and an opened draft. `DraftCard` has no editor: Open sends the draft (id, name, version) to the composer, and the card only says "Updated <time>".
- **The update:** filtered by `id` AND `user_id`, never by `updated_at`. The server reads the row first and compares its `updated_at` with the version the browser sent AS EXACT TEXT, in code. Only the `plan` column is written.
- **Answers:** `{ ok: true, version }`, or `{ error: <sentence>, why: "invalid" | "changed" | "gone" | "failed" }`; a `changed` answer also carries `latest` (the saved name, steps and version) so "Load latest" needs no second call. `saveDraft` returns `{ ok, id, name, version }` so a saved preview becomes a draft that is edited in place.
- **Looks:** the icon picker is the designer's radio panel (not a native `<select>`); steps can be deleted down to 0 (the editor shows an empty state, Done and Save refuse with "A plan needs at least 1 step."); a retired icon shows as Sparkles when the editor opens; the labels and copy are the design's.
- **Discard guard:** one inline bar (no `window.confirm`); `beforeunload` while step edits are unsaved. Sidebar links and Back are NOT intercepted (edits are lost there; the editor says "Unsaved changes are lost if you leave this page.").
- **After QA round 3:** a save answer that arrives after the person moved on is dropped (M1); a conflict where only the draft's name moved (a rename in the list) is retried once silently with the newer version (m2); every Unicode format character is stripped from step text, plus U+3164 and U+2800, so an invisible-only title counts as empty (n1); `/privacy` names the three save buttons (n5).
- **Left open on purpose:** the few milliseconds between the server's read and its write. It can be closed later by also filtering the update on the version just read (and treating 0 rows as "changed"); that needs the live table to prove, so it waits for the owner's live checks.

Stage 3, 2026-10-17. Local only, http://localhost:3100 (never 3000). Owner decision: people edit the steps of a plan by hand (title, detail, icon, add, delete, move up/down) in two places: (1) on the fresh preview in the composer before "Save as draft", (2) on a saved draft ("Edit steps"), saved IN PLACE. Out of scope: typed steps, AI-assisted editing, connectors, running, drag and drop, a `runs` table. Paths below are inside `hushwork-app/` unless they start with `docs/` or `supabase/`. For looks, `docs/design-editor.md` wins; for files, safety and behaviour, this plan wins.

**Verdict in four lines:** (a) no database change (confirmed live, read-only, section 2); (b) one new Server Action, `updateDraft`, that can change only the `plan` column; (c) one new client component, `StepEditor`, used twice; (d) a small tightening of `cleanPlan` so the browser and the server apply the SAME rules (it also closes QA-1 N5, the control-character plan that the database refused).

## 1. Words used (one plain line each)

| Word | Meaning |
|---|---|
| Server Action | A function that runs on the server but that a button on the page can call directly. It is a public door: it must check who is calling and check its input every time. |
| Optimistic vs confirmed save | Optimistic: the screen shows "saved" at once and undoes it if the server says no. Confirmed: the screen waits for the server's "ok" first. Draft saves here are confirmed (button says "Saving...", the editor stays open until "ok"). |
| Concurrency, "last save wins" | Two tabs change the same draft. If the server just accepts whichever arrives last, the earlier person's work vanishes without a word. |
| Version check | Each draft row has an `updated_at` time that the database refreshes on every change. We send the time we saw; the server only saves if it is still that time, so an unseen change is never overwritten. |
| Controlled input | A text box whose text lives in React state, so the code always knows (and can validate) what is in it. |
| Live region | A hidden `role="status"` paragraph that screen readers read out when its text changes ("Step moved up"). It must already be on the page before the text changes. |
| Pure core | A function with no Next.js or Supabase imports that receives the database client as an argument, so a test can hand it a pretend client. |
| `beforeunload` | The browser event fired when you close or reload a tab. A page can use it to make the browser ask "Leave site?". |

## 2. Architecture in 10 lines

1. **Editor state lives in one client component, `components/app/StepEditor.js`.** It owns the rows being edited (each row has a private `key` so React keeps the right text box with the right step when rows move) and tells its parent only two things: `onSubmit(cleanSteps)` after validation passes, or `onCancel()`. Nothing half-valid ever reaches the parent or the server. Edits are applied in one go on "Done" or "Save steps".
2. **Composer** keeps its `plan` (arrays `[icon,title,detail]`; no change to `planFor`). New state: `editing` and `edited`. "Done" runs `setPlan(...)` and sets `edited`. Save as draft is unchanged (`saveDraft` inserts). It is hidden while `editing`, so what is saved is always what was last shown.
3. **DraftCard** gets a fourth mode, `edit` (view, rename, delete, edit). On "Edit steps" it freezes `baseVersion = draft.updatedAt` (never read later, see section 3) and mounts `StepEditor` with `draft.plan`.
4. **What is sent:** `updateDraft({ id, updatedAt: baseVersion, plan: JSON.stringify(steps) })`. Plain JSON text, the same transport as `saveDraft`, so `cleanPlan` is reused unchanged. The browser never sends a user id, name, prompt or timestamp to set.
5. **Server order** (`lib/actions/drafts.js`, then the pure core `lib/update-plan.js`): `requireUser()`, then `checkId`, then `checkVersion`, then `cleanPlan` (rebuilds every step from scratch; the client is never trusted), and only then the database. Nothing runs before `requireUser()`. `createClient()` runs just after it, before the checks, but only reads cookies (no network).
6. **The one write:** `from("workflows").update({ plan: steps }).eq("id", id).eq("user_id", user.id).eq("updated_at", version).select("id")`. The update object has exactly one key. `name` and `prompt` are never touched (rename has its own action; editing the prompt would make plan and words disagree). `user_id` in `.eq` is the app-level ownership check on top of RLS; it is a filter, never a value we write.
7. **Gone, not yours, or changed:** RLS hides other people's rows, so 0 rows back means "no such row for you" OR "version moved". The core then asks one more question, `select("id").eq("id", id).eq("user_id", user.id)`: a row exists, so it was changed (`why: "changed"`); none, so it is gone (`why: "gone"`, same sentence for "not yours", as `renameDraft` does).
8. **Returns:** `{ ok: true }` or `{ error: "plain sentence", why: "invalid" | "changed" | "gone" | "failed" }`. Never a row, never an id, never database text. After ok: `revalidatePath("/app")` (the list re-renders in the same round trip; the card shows the new "Saved <time>").
9. **Sentences:** invalid: the step-numbered sentence from `checkSteps` ("Step 3 needs a title.") or "That plan could not be read."; changed: "This draft was changed somewhere else, so your edits were not saved. They are still on screen."; gone: "That draft no longer exists."; failed: "Could not save your changes. Check your connection and try again."
10. **Logging:** `console.error("updateDraft failed:", error.code)` only (a short Postgres code). Never the id, the plan text, the message or the user.

**Hand-edited flag? No stored flag, no schema change.** The row cannot say "edited by hand" and does not need to. The UI stays honest by never claiming an origin it cannot know: a saved draft already says "Saved plan", the card says "Draft", and the time is the last change (`updated_at`). Only the live preview, which still knows its source in memory, says more (section 6, T7): after any edit it stops saying "written by AI" and says "Edited plan. Started as an AI plan." (or "keyword preview").

**Database change needed? NONE.** Read-only checks on 2026-10-17 against `mgvaqoishxsqecpjfnuo` (no writes made; the one existing row was not read):
- RLS on (not forced). 4 policies, all `TO authenticated`, all `(select auth.uid()) = user_id`; the UPDATE policy has both USING and WITH CHECK.
- Grants: `authenticated` has table-level SELECT and DELETE, and column-level INSERT and UPDATE on exactly `name, prompt, plan`. `anon` has nothing. So an update can never touch `user_id`, `id`, `created_at` or `updated_at`.
- Trigger `workflows_set_updated_at` BEFORE UPDATE FOR EACH ROW runs `set_updated_at()` (security invoker, `search_path=''`): `updated_at` is bumped by the database and cannot be forged. Column type is timestamptz with 6 decimal digits.
- Constraints `workflows_plan_is_array` and `workflows_plan_size` (`octet_length(plan::text) <= 20000`) exist and match `supabase/workflows.sql`.
- Filtering by `updated_at` needs SELECT on that column: the table-level SELECT covers it. Advisors: security shows only the known "leaked password protection" warning (a Pro-plan feature); performance shows nothing.

## 3. Concurrency and data-loss rules

| Situation | Rule | What the person sees |
|---|---|---|
| Two tabs edit the same draft | **Version check, not last-save-wins.** About 10 extra lines, no schema change. `baseVersion` is the exact `updated_at` text received when "Edit steps" was pressed (the string is passed through untouched, NEVER via `Date`, which would cut it to milliseconds and cause false conflicts). | The second saver gets the "changed" sentence, keeps their typing, and can press "Load latest" (discards their edits, calls `router.refresh()`). No "save anyway" button (default; add later by re-sending the newer version). |
| Draft deleted in another tab | `why: "gone"` | "That draft no longer exists." and "Load latest" (the card then disappears). |
| Page refreshes under an open editor (another card's action) | The editor keeps its own rows and its frozen `baseVersion`, so a newer prop can never smuggle a stale plan past the check. | Nothing changes on screen. |
| Rename in one tab, edit steps in another | Rename also bumps `updated_at`, so this is a false conflict. Safe (nothing lost). | The "changed" sentence; Load latest. |
| Response lost after the server did save | The retry carries the old version and reports "changed" against the person's own write. Safe; Load latest shows their steps. Accepted (risk R2). | The "changed" sentence. |
| Composer: arrow pressed again on an edited, unsaved plan | A new preview would replace the edits (and an AI preview costs one of 20 daily plans). Ask first with `window.confirm("Your edited steps are not saved. Replace them?")`. The same question guards "Edit request", "Start over", the sidebar "New workflow" event, and opening a recipe or draft (Workspace `fill`, through a ref `holdsEdits`). | A browser question; "Cancel" keeps everything. |
| Composer: typing in the request box with edits present | Typing today clears the plan (QA-1 N7). That would silently erase edits, so the box is `readOnly` while `editing` or while edits are unsaved. | A line under the box: "Your steps have changes that are not saved. To change the words, press Edit request. That discards the changes." |
| Composer: Save as draft after the plan is saved | Already hides the button. "Edit steps" is hidden once saved (otherwise a second Save would insert a duplicate). Edit it later on its card. | Nothing to click; the card has "Edit steps". |
| Cancel or Escape with changes in the editor | `window.confirm("Throw away your changes to these steps?")` when the rows differ from where they started; no question when nothing changed. Escape in the card is handled by `StepEditor` (the card's own Escape handler skips mode `edit`). | A browser question. |
| Closing, reloading or leaving the tab | **`beforeunload` guard: YES**, active only while the editor has unsaved changes or the Composer holds edited unsaved steps; removed at once otherwise (`components/useWarnBeforeLeaving.js`, about 8 lines). Reason: one accidental reload throws away typing, and the cost is one listener. Limit, stated honestly: clicking a sidebar link inside the app (client-side navigation) does not fire it, so those edits are lost (R5). | The browser's own "Leave site?" box (its wording cannot be changed). |
| Double click on Save steps | The button is `loading`/disabled while the request is pending. | "Saving..." |
| Slow AI preview running | Server Actions run one at a time in Next, so a Save can wait behind an AI call (up to 15 s). Already documented (README, QA-2 m5). | "Saving..." a little longer. |

## 4. Folders and files (all `.js`; no new dependency; the app's own `ICON_NAMES` list is reused)

```text
hushwork-app/
├── lib/
│   ├── validate.js              CHANGED  + tidyText, checkSteps, checkVersion; cleanPlan now = parse JSON, then checkSteps
│   ├── validate.test.js         CHANGED  + new cases (existing cases stay untouched and must still pass)
│   ├── update-plan.js           NEW      pure core: updatePlan(supabase, { userId, id, updatedAt, plan })
│   ├── update-plan.test.js      NEW      fake-client tests + source-text order checks for drafts.js
│   ├── actions/drafts.js        CHANGED  + updateDraft (about 8 lines)
│   └── ai/
│       ├── plan.js              CHANGED  `tidy` reuses tidyText (the 200-character cut stays here, for AI answers only)
│       └── icon-names.js        CHANGED  comment only: "also the step editor's list"
├── components/
│   ├── useWarnBeforeLeaving.js  NEW      the beforeunload hook (same folder as useTheme.js)
│   └── app/
│       ├── StepEditor.js        NEW      the editor (client)
│       ├── Composer.js          CHANGED  Edit steps button, editing/edited state, labels, discard questions, readOnly box
│       ├── Workspace.js         CHANGED  `holdsEdits` ref; `fill` asks before replacing edited steps
│       └── DraftCard.js         CHANGED  mode "edit", baseVersion, Save steps, conflict message and Load latest
├── app/scratch-editor/page.js   TEMPORARY  never committed, deleted in T9 (fake data, stub submit; outside /app so the proxy lets it through)
├── README.md                    CHANGED  "Where things are", test line, a short "Editing steps" note
docs/plan-editor.md              THIS FILE
```
**Not changed:** `supabase/*.sql`, `app/privacy/page.js` (section 7), `Drafts.js`, `DraftList.js`, `components/icons.js` (ArrowUp, ArrowDown, Plus, Trash, Check, X, ListChecks, Info and CircleAlert already exist; "Edit steps" uses `ListChecks` because `Pencil` already means Rename), `ui.js`, `package.json`, `.env*`, `proxy.js`.
**Existing tests:** none should need an edit (checked by reading: `cleanPlan`'s existing cases still hold, the AI tests that feed `"x y"` or a 201-character title still get refused, and none expects an unknown icon name to pass through). If one fails, report it; do not weaken it.

## 5. Validation rules (browser and server run the SAME function, `checkSteps`, with the SAME `LIMITS`)

`checkSteps(list)` takes an array of objects and returns `{ value: [{icon,title,detail}] }` or `{ error, index, field }`. `cleanPlan(jsonText)` = safe `JSON.parse`, then `checkSteps`. The editor calls `checkSteps` on "Done"/"Save steps" and sends the cleaned result, so the server's second run is a no-op; a test pins that `checkSteps(checkSteps(x).value)` returns the same steps. Both limits come from `LIMITS.planSteps` (12) and `LIMITS.stepText` (200); no new constants.

| Field | Rule |
|---|---|
| Steps | 1 to 12. "Add step" is disabled at 12 ("12 of 12 steps"); "Delete" is disabled at 1. |
| Title | `tidyText`, then 1 to 200 characters (JS string length, as today). Empty, spaces-only or zero-width-only: "Step 3 needs a title." Over 200: "Step 3: use 200 characters or fewer in the title." Today's `cleanPlan` accepted an empty title; it no longer does (AI and keyword plans always have one, and `cleanAiSteps` already drops title-less steps). |
| Detail | `tidyText`, then 0 to 200. **Empty is allowed** (today's rule; the AI and keyword plans produce empty details). |
| Icon | The editor offers only the 32 `ICON_NAMES` in a native `<select>` (names made readable by splitting at capitals; the chosen icon is drawn beside it). Server: not a string, longer than `LIMITS.iconMax`, or not letters and digits is refused (as today); a well-formed name that is not in the list (a very old draft, or `constructor`) becomes **Sparkles**, the same fallback `cleanAiSteps` uses. The editor applies that fallback when it opens, so a legacy step shows a valid choice. |
| Characters | `tidyText` removes bidi controls U+202A to U+202E and U+2066 to U+2069 and zero-width U+200B to U+200D and U+FEFF; turns control characters (U+0000 to U+001F, U+007F to U+009F) and any run of whitespace (tab, newline, U+2028) into one space; replaces lone surrogates (`toWellFormed()`, skipped if a browser lacks it); trims. It never cuts: too long is an error sentence, never silent shortening (the editor has no `maxLength`; a counter shows from 180 characters). |
| Extra keys | Ignored: every step is rebuilt as exactly `{icon,title,detail}`. `__proto__`, `user_id` and the like go nowhere. |
| Total size | The database allows 20,000 bytes of `plan::text`. No runtime byte check is needed: with control characters gone, the limits cap a plan near 15,300 bytes (12 steps x (2 x 200 characters x 3 bytes + about 70 bytes of JSON)). Before this plan the only way past 20,000 was control characters (29,304 bytes measured in QA-1, shown as "check your connection"). A test pins the arithmetic (worst case CJK, worst case emoji, a `\u0000` plan). |
| Version text | `checkVersion`: a string of at most 40 characters shaped like `2026-10-17T10:15:30.123456+00:00` (1 to 6 decimal digits, `Z` or an offset). Anything else is refused before the database sees it. |

## 6. Ordered build tasks (10)

Order and parallelism: **T1 first. Then T2 || T4. T3 after T2. T5 || T6 (T5 needs T4; T6 needs T3 and T4). Then T7 || T8. Then T9, T10.** Follow CLAUDE.md: explain each concept in one plain line, smallest change, run the check, report Done / How it works / Test it. Commit only when the owner asks, as ONE commit.

- [x] **T1. Shared rules.** `lib/validate.js`: import `ICON_NAMES` from `./ai/icon-names.js` (a plain list with no imports, safe in the browser and in tests); add `tidyText`, `checkSteps`, `checkVersion`; make `cleanPlan` use `checkSteps`. `lib/ai/plan.js`: `tidy = (v) => typeof v === "string" ? tidyText(v).slice(0, LIMITS.stepText) : ""` (AI behaviour unchanged except it now also drops zero-width characters). New tests: tidyText cases (each character class, lone surrogate, idempotent, never cuts); step count 0/1/12/13; title empty/spaces/zero-width/200/201; detail empty/200/201; icon unknown and `constructor` give Sparkles, `<script>`, number and 41 characters refused; extra keys dropped; error carries `index` and `field`; `cleanPlan(JSON.stringify(x))` equals `checkSteps(x)` on 200 generated inputs (editor and server agree); the byte arithmetic; `checkVersion` accepts real PostgREST-style strings and refuses `""`, `"x"`, `", or(id.eq.1)"`, a number and a 41-character string. **Check:** `npm test` all green, old tests included. **Risk:** `saveDraft` and the AI path get the stricter rules (empty title refused, unknown icon to Sparkles, control characters become spaces); the tests prove the AI path still passes.
- [x] **T2. The pure core.** `lib/update-plan.js` and `lib/update-plan.test.js` with a pretend client (a small chain object that records `.update/.select/.eq` calls and returns scripted answers). Tests: success returns `{ ok: true }`, the update object's keys are exactly `["plan"]`, filters are exactly id, user_id and updated_at; 0 rows plus an existing row gives `changed`; 0 rows plus none gives `gone`; a database error gives `failed`, logs only the code (`console.error` is mocked and checked), and the pretend error text never appears in the result; a failing second query gives `failed`; bad id, version or plan returns BEFORE the pretend client is touched (it throws if touched). **Check:** `node --test lib/update-plan.test.js`. **Risk:** low.
- [x] **T3. The Server Action.** `updateDraft` in `lib/actions/drafts.js`: `const user = await requireUser(); const supabase = await createClient(); const result = await updatePlan(supabase, { userId: user.id, ...input fields }); if (result.ok) revalidatePath("/app"); return result;` plus the "use server" comment block. Source-text tests (same style as `secrets.test.js`): "use server" first, `requireUser(` before `updatePlan(`, `revalidatePath` only on ok, the file exports only async functions, no `user_id` written. **Check:** `npm test`; `npm run lint`. **Risk:** low.
- [x] **T4. `StepEditor` + `useWarnBeforeLeaving` + the scratch page.** Rows with private keys; per row: icon select with icon beside it, title input, detail input, Move up, Move down, Delete, each with a name that includes the step number ("Title for step 2", "Move step 2 up"); Add step; one `role="status"` live region ("Step moved up. It is now step 2 of 5.", "Step 3 deleted. 4 steps left.", "Step added. 6 steps."); a failed Done shows the sentences, sets `aria-invalid` plus `aria-describedby`, and focuses the first bad field; after Move, focus follows the moved step's button (if it became disabled, focus goes to the other arrow); after Delete, focus goes to the next step's title (or Add step); after Add, to the new title; focus on mount goes to the first title. Escape and Cancel use the discard question. 44 px touch targets on phones like `Btn`. No `dangerouslySetInnerHTML`, no animation inside the list. Footer hint: "Steps are saved as text. Do not put passwords or card numbers in them." The scratch page renders it with fake data and a stub `onSubmit`. **Check:** open `/scratch-editor`: add 13th step is refused, delete last step is refused, reorder with the keyboard only, empty title shows the sentence. **Risk:** React lint rules (no `setState` in effects, no writing refs while rendering): use event handlers, and effects only for focus.
- [x] **T5. Wire into Composer and Workspace** (needs T4). "Edit steps" button beside Save as draft (only when ready, not saved, not editing); while editing the plan list is replaced by `StepEditor` and the footer is hidden; Done sets `plan`, sets `edited` only if the steps differ, announces "Steps updated. Not saved yet.", moves focus to the plan heading. `reset`, `showPlan` and seeds clear `editing` and `edited`. The request box is `readOnly` while `editing` or unsaved edits exist, with the line under it. `window.confirm` guards on arrow, Edit request, Start over, `hw:new-workflow`; Workspace `fill` asks when `holdsEdits.current` (written in an effect, not during render). `useWarnBeforeLeaving(editing || (edited && saveState.status !== "saved"))`. **Check:** scratch page: edit a keyword preview, Done, Edit request asks, Cancel keeps the steps; with `window.confirm` stubbed to false then true. **Risk:** Composer is the most complex file; change only what is listed.
- [x] **T6. Wire into DraftCard** (needs T3 and T4). An "Edit steps" icon button (`ListChecks`, 44 px) next to rename and delete; mode `edit` shows `StepEditor` with Save steps / Cancel; submit calls `updateDraft` through the existing `call()` helper (so a signed-out redirect is rethrown and an offline failure becomes the "failed" sentence); on ok `back("edit")` and a status line "Steps saved."; on `changed` or `gone` show the sentence in a `role="alert"` plus a "Load latest" button (`router.refresh()`, then back to view). Add an edit ref to `focusAfter`. The card's Escape handler ignores mode `edit`. **Check:** scratch page renders the card and the editor open (clicking Save steps there would call the real action, which only redirects a signed-out visitor to /login; do not click it). **Risk:** the conflict UI cannot be rendered without the real action; it is covered by T2 tests, code reading and the owner script. **Built differently (owner decision):** no editor in the card. Open sends the draft (id, name, version) to the composer, where Edit steps lives; the card only says "Updated".
- [x] **T7. Copy and labels, honest.** Heading and subheading by source and edit state: **AI, unedited:** unchanged ("Plan written by AI. Nothing will run."). **Keyword, unedited:** unchanged. **Edited (either source):** "Edited plan. Nothing will run." with "Started as an AI plan, then changed by you. Read each step before you save." or "Started as a keyword preview, then changed by you."; the Groq footer line ("Written by an AI model run by Groq...") and the purple wash show only while an AI plan is unedited. **Saved (opened draft):** unchanged, "Saved plan. Nothing will run." (no origin, no "edited"). **Card:** the "Draft" chip and "Saved <time>" stay; no "Edited" badge exists because nothing is stored. Check every sentence against the code. **Check:** read the final strings with the code beside them. **Risk:** claiming an origin the code cannot know.
- [x] **T8. Docs** (parallel with T7). README: "Where things are" (`StepEditor`, `useWarnBeforeLeaving`, `update-plan.js`), the `npm test` line, and 5 lines "Editing steps": what it does, that nothing runs, that saving replaces the old steps (no history is kept), what the conflict message means, and that sidebar links do not warn about unsaved edits. Tell the owner explicitly that `/privacy` needs no change (section 7). **Check:** every command and file name in the README exists.
- **T9. Polish (one bounded pass):** build fully, inspect once, fix in one batch, confirm once, stop. Both themes x 320/375/768/1024/1440; 12 long steps on a phone; reduced motion; focus rings; then **delete `app/scratch-editor/`**. **Check:** `curl` on `/scratch-editor` gives 404; `git status` shows no scratch file.
- **T10. Verification and wrap-up.** Everything in the left column below; hand the owner the script in section 8B.

| The assistant can run | Only the owner can run |
|---|---|
| `npm run lint`; `npx tsc --noEmit`; `npm test` (expect the earlier 66 plus about 30 new, all green; a "module type not specified" warning is harmless) | Signed-in editing of a REAL saved draft, and "still there after reload" |
| Production build in a throwaway copy: the robocopy recipe of `docs/plan-next.md` section 9B (excludes `node_modules`, `.next` and `.env.local`; dummy `NEXT_PUBLIC_SUPABASE_*` values; then search `.next/static` for `GROQ`, `gsk_`, `sb_secret`; delete the copy). Never `next build` in the live folder | The update against the live table: whether `updated_at=eq.<the exact text>` really matches (the one thing no pretend client can prove) |
| Rendered checks of the editor on `/scratch-editor` (headless Edge, fake data, stub submit; `window.confirm` stubbed): both themes, five widths, no sideways scroll, contrast, axe, a keyboard-only run, focus after move/delete/add, live-region text read from the page, reduced motion | The two-tab conflict, the delete-elsewhere case, the `beforeunload` question in the owner's browser |
| `curl`: `/scratch-editor` 200 then 404 after deletion; `/app` still 307 to `/login`; `/` 200 with no cookie | The two-account test: B cannot edit A's draft |
| Read-only schema and advisor checks again at the end | Editing an AI plan (needs a Groq key); optional screen reader pass |

The assistant must not sign in, create an account, write any row, open `.env.local`, or start, stop or restart a server (it uses the owner's dev server on 3100 if it is running, otherwise it asks).

## 7. Security and privacy checklist

- [ ] **Ownership, three layers:** `requireUser()` first; `.eq("user_id", user.id)` in the app; RLS UPDATE policy (USING and WITH CHECK). The two-account test proves it (8B-9).
- [ ] **Only `plan` is writable here:** the update object is `{ plan }`; the column grant allows `name, prompt, plan` only, so `user_id`, `id`, `created_at`, `updated_at` cannot be set even by a hand-made request (a test checks the object's keys).
- [ ] **Never trust the browser:** id, version and plan are re-checked on the server; steps are rebuilt; extra keys dropped; a 1 MB request cap already exists in Next (`serverActions.bodySizeLimit`, default).
- [ ] **XSS:** step text, names and prompts are only ever React text or input values. No `dangerouslySetInnerHTML` (the only one in the app is the constant theme script), no `href` or `src` built from step text, no step text in a URL or a log.
- [ ] **Errors:** only the four sentences above reach the browser; the log line holds a code only.
- [ ] **Prompt injection:** not relevant to this feature. No AI call is made while editing and no step text is ever sent anywhere except our own server on Save (and then to Supabase). The existing `previewPlan` path is untouched.
- [ ] **Nothing runs:** no step text is interpreted, fetched or executed; icons come from a fixed list.
- [ ] **No secrets or new settings:** no new environment variable, no key, no package.
- [ ] **Privacy page: NO change needed.** Checked sentence by sentence (`app/privacy/page.js`): "For each draft you save we store its name, the task text you typed, the preview steps, and the times it was saved and changed" stays true (edited steps are still steps; a change is a "changed" time). "It reaches our server only if you press Save as draft" stays true for the request text (edited steps also reach the server only when you press a Save button). "A draft is only a saved plan to read. It is never run, sent or shared" and "Hushwork does not run workflows yet" stay true. No new third party, no new data kind, no retention change. One honest note for the README only: saving replaces the old steps and we keep no history of earlier versions. "Last updated 17 October 2026" stays.

## 8. Test plan, rollback, risks, open questions

**A. Automatic (the assistant):** section 6, left column. Unit tests cover the shared rules, the editor-equals-server property, the byte arithmetic, and `updatePlan` against a pretend client; source-text tests pin the order of checks in `drafts.js`.

**B. Owner script** (only `http://localhost:3100`, never 3000 or 127.0.0.1; write down what you see):
1. Sign in. Type a recipe, press the arrow, press **Edit steps**. Change a title, pick another icon, add a step, move it up, delete one, press **Done**. The heading says "Edited plan" and the line says "Not saved yet."
2. Press the arrow again: a question appears; choose Cancel and your steps remain. Then **Save as draft**, reload, open the draft from the list: your edited steps are there.
3. On the draft's card press **Edit steps**, change a step, **Save steps**: "Steps saved." and the "Saved <time>" moves. Reload: still there. Open it and see the new steps.
4. Make a title empty and press Done: a sentence, the cursor jumps to that box. Press Cancel after typing: it asks. Press Escape: same. Reload with unsaved typing: the browser asks.
5. **Two tabs:** open `/app` in two tabs, press Edit steps on the same draft in both. Save in tab 1, then Save in tab 2: tab 2 must show "changed somewhere else" and keep your typing; Load latest shows tab 1's steps.
6. Delete the draft in tab 1, press Save steps in tab 2: "That draft no longer exists."
7. Check twice in a row on one card (Edit, Save, Edit, Save) without reloading: the second save must work. If it says "changed" every time, the timestamp filter is not matching: tell the assistant (R1).
8. In Supabase > Table Editor > workflows: the row's `plan` has only `icon`, `title`, `detail` per step; `updated_at` moved; `name` and `prompt` unchanged.
9. **Two accounts:** as account B (private window) the draft of A is not listed. Optional proof with a scratch Node script as in `docs/plan.md` section 8E: B's update of A's id changes 0 rows, and setting `user_id` is refused (no grant).
10. Keyboard only, and a phone-width window (the editor must not scroll sideways). Re-run Supabase's advisors. Delete test drafts and accounts.

**Rollback:** `git revert` of the one commit. No database rollback: nothing was applied, and drafts saved or edited meanwhile keep the same shape (`[{icon,title,detail}]`), so the older code reads them fine.

| Risk | Mitigation |
|---|---|
| R1. The `updated_at` filter fails to match on the live table (timestamp text format), so every save looks like a conflict | Safe failure (nothing is overwritten) and caught by owner step 7. Fix would be one line (trim to the same text PostgREST returns); `.eq()` already URL-encodes the `+` in `+00:00` (checked in `postgrest-js`). |
| R2. False conflicts: rename elsewhere, lost response, a stale prop right after rename | Safe; the message says "may have been changed"; Load latest. Accepted. |
| R3. `window.confirm` is ugly and may be blocked in embedded browsers | One line each; swap for the inline confirm pattern of the draft-delete card if `design-editor.md` asks. Rules stay the same. |
| R4. Stricter `cleanPlan` also affects `saveDraft` and AI plans | Tests T1; only the cases "empty title" and "control characters" change, and both were bugs. |
| R5. Edits lost when clicking a sidebar link | Stated in README and in the hint. A later fix: a click guard on links while dirty. |
| R6. A reopened Composer "Saved plan" can show old steps after the card was edited | Cosmetic; it has no Save button, so it cannot overwrite. Reopen the draft. |
| R7. Focus and screen-reader behaviour of move/delete is easy to get wrong | T4 focus rules, live region, owner keyboard pass. |
| R8. Legacy draft with an empty title or unknown icon | The editor flags the title on open; an unknown icon becomes Sparkles on save. |

**Open questions: none blocking.** Defaults chosen (cheap to change): no "save anyway" on conflict; no editing inside the Composer's opened saved view (edit on the card); `window.confirm` for discard questions; native `<select>` for icons; edits apply on Done/Save steps, not per keystroke.

Related: [Design: step editor](design-editor.md), [QA round 3](qa-3.md)
