# Design: manual step editor (workflow-builder phase A)
Stage 2 of the ship-it pipeline, 2026-10-17. Local only (http://localhost:3100). Figma not used. Owner decision: build phase A, a manual step editor that **still runs nothing**. Phases B and later are out of scope.
**Read:** `arjun-ai-design-system.md`, `design-next.md` (0 to 3, 5 to 7), `design.md` 3.7, `plan-groq.md` 6, `PRODUCT.md`, `globals.css`, and the real `Composer.js`, `Workspace.js`, `DraftCard.js`, `DraftList.js`, `Drafts.js`, `ui.js`, `icons.js`, `lib/ai/icon-names.js`, `lib/validate.js`, `lib/actions/drafts.js`, `supabase/workflows.sql`. The code is newer than `design-next.md` (it says "Write with AI" and Groq, not Claude and Anthropic): **this file follows the code.**
**Checked:** every ratio comes from `contrast.py` (WCAG formula) in the scratchpad `...\scratchpad\design-editor\`. Not run in a browser: the builder looks at both themes and at 320px once (section 5). Tokens only: no new colour, radius or shadow.

## 0. Scope and what the server must give the UI
Phase A: edit the title, detail and icon of a step, add, delete, and move up or down, on a fresh preview and on a saved draft. Saved drafts are updated **in place**. Nothing runs; every "Nothing will run" and "It will not run" sentence stays true. Needs from the architect (UI cannot work without them):
1. `saveDraft` returns `{ ok: true, id }` (so the card can update, not duplicate, after a save).
2. `updateDraftPlan({ id, plan })` returns `{ ok: true }` or `{ error }`, with "That draft no longer exists." when 0 rows change. It writes only `plan` (the column grant exists; the trigger moves `updated_at`).
3. `cleanPlan` rejects an empty title after trim (today it accepts `""`). No new column: we do not store an "edited" flag (D4).

## 1. Where the editor lives and the flow
### 1.1 One editor, one place
One component, `StepEditor`, rendered only by `Composer.js`, inside the plan card, **in place of the read-only `<ol>`**. A fresh preview and an opened draft use the same editor. It is not inline in the draft row because: (1) the page then has exactly one editor, one unsaved-changes guard and one announcer; (2) the plan card already has the width, the heading focus target, the status lines and the request text in view; (3) `DraftCard` is a compact row with three modes and a collapse animation, and a third 44px icon button leaves under 64px for the name at 320px; (4) **Open** already sends a draft to the composer. **Open and Edit steps are one path:** Open shows the draft as a read-only "Saved plan" (it now remembers `id` and `name`), and that card has **Edit steps**. The draft row gets no new button (D2).

### 1.2 In the composer (fresh preview)
- Plan card actions: **Save as draft** (primary), **Edit steps** (secondary, icon `ListChecks`, `title` "Change the steps of this plan by hand"), **Edit request** (`title` "Change the words in the box and make a new plan"), **Start over**. Edit steps changes the plan and keeps the request; Edit request throws the plan away and returns to the box. Edit steps is disabled while a save is in flight.
- **Edit steps** swaps the read-only list for the editor inside the same card. The card's buttons become **Done** (primary) and **Cancel** (ghost). Focus goes to the first step's Title. The editor edits a **working copy**; the plan on screen changes only on **Done**. Nothing is sent to the server.
- **Done** closes the editor and applies the copy (trimmed). If the steps now differ from the plan as generated, the card is labelled "Plan edited by you" (3.1); if they are the same again, the old label returns: **the label always follows the content.** Then the usual **Save as draft** appears, with "Not saved yet." Two clicks (Done, Save as draft) on purpose: the read-only list is the preview of the result, and the person sees it before saving.
- **Save as draft** saves the steps on screen and the box text (as today). The card remembers the returned `id` (`draftId`). From then on **Edit steps** saves in place (1.3): a second save never makes a duplicate row.
- While there is unsaved work the request box is `readOnly` (like while the AI writes; focus is kept) and one line is added to the note under the box: "Your step edits are not saved yet. To change the request, choose Edit request." Typing is therefore never silently lost. The arrow and Enter go through the guard (1.4).

### 1.3 On a saved draft
- **Open** (name button in the draft row) shows the plan in the composer as today ("Saved plan. Nothing will run.", no Save button), plus **Edit steps**. Same for a card that was just saved (1.2).
- **Edit steps** opens the same editor. Card buttons: **Save changes** (primary, disabled until something changed) and **Cancel** (ghost). **Save changes** calls `updateDraftPlan`; on success the editor closes, the read-only list shows the new steps, focus returns to **Edit steps**, and the draft moves to the top of Your drafts (it is sorted by `updated_at`).
- **Rename** stays in the row and never appears inside the editor. Rename sends only `name`, Save changes sends only `plan`, so neither overwrites the other. The editor shows "Draft: {name}" taken when the draft was opened; a rename afterwards does not change it until the draft is opened again.
- **Edit request** on an opened draft detaches it (as today): the next Save as draft makes a new draft, the old row is untouched.

### 1.4 The unsaved-changes guard (both places)
- **Unsaved work** = the editor is open and its copy differs from where it started, **or** there is no draft row yet and the plan was edited. A fresh, unedited preview is not guarded (as today).
- Everything that would replace the plan goes through one function, `guard(action)`: the arrow and Enter, Try AI again, Edit request, Start over, Cancel (when changed), a starter card, a recipe, **Open** on a draft, and the sidebar's New workflow. `Workspace.fill` asks the composer first.
- If there is unsaved work the action does **not** run. A bar appears at the top of the plan card (`rounded-xl bg-raised`, `Info` icon in `text-info`): "You have unsaved changes to the steps. If you continue, they are lost." with **Discard changes** (`Btn` dark, like Delete draft) and **Keep editing** (secondary). Focus goes to Keep editing (`aria-describedby` the sentence); the card scrolls into view (`block: "center"`). Escape = Keep editing, and focus returns to what was focused before (a tile, an Open button). Discard runs the saved action and announces "Changes discarded."
- Leaving the page: `beforeunload` while unsaved. In-app links: a capture-phase click listener on same-origin `a[href]` (not hash-only) calls `guard(() => router.push(href))`. If that proves fiddly, ship `beforeunload` only and list the sidebar gap in QA.
- Escape inside the editor does nothing except close an open icon panel. It never discards.

## 2. The editor itself
### 2.1 Layout (mobile first; one layout, no breakpoint reordering, so DOM order is visual order)
```
PHONE (320, plan card padding 16)             DESKTOP (max-w-3xl column; fields side by side from 768px)
+------------------------------+  +--------------------------------------------------------------+
| Edit the steps. Nothing will |  | (list) Edit the steps. Nothing will run.        5 of 12 steps |
| run.               5 of 12   |  | Draft: Chase unpaid invoices. Changes are saved only when you |
| Draft: Chase unpaid...       |  | choose Save changes.                                          |
|------------------------------|  |--------------------------------------------------------------|
| [1] [clock v]   [^] [v] [x]  |  | [1] [ (clock) Schedule v ]               [ ^ ]  [ v ]  [bin] |
| Title                        |  |     Title                    Detail (optional)                |
| [__________________________] |  |     [Run every weekday 9am]  [Checks Stripe for late inv   ]  |
| Detail (optional)            |  |     26 of 200 (only from 160)                                 |
| [__________________________] |  |--------------------------------------------------------------|
| [__________________________] |  | [2] ...                                                       |
|------------------------------|  | Step 3 deleted.  [Undo]                                       |
| [2] [receipt v] [^] [v] [x]  |  | [+ Add step]                                                  |
| [+ Add step]                 |  |--------------------------------------------------------------|
| (i) You have unsaved changes.|  | (i) You have unsaved changes.          [Save changes] [Cancel]|
| [ Save changes             ] |  +--------------------------------------------------------------+
| [ Cancel                   ] |
+------------------------------+   Open icon panel: 3 columns x 11 rows on phones, 8 x 4 from 640px.
```
The editing card is plain `rounded-2xl border border-line bg-surface shadow-sm` with **no AI wash** (the wash stays the unedited AI card only). Steps are flat rows separated by `border-t border-line py-4` (no nested cards). Phone header line: badge 28 + icon button 44 + three 44px buttons = 204px plus small gaps, which fits the roughly 246px inner width at 320. The Save and Cancel buttons are full width and stacked on phones (`w-full sm:w-auto`), and there is no sticky bar (it fights the on-screen keyboard).

### 2.2 A step row, fields, limits, validation
| Part | Spec |
|---|---|
| Item | `<li>` of an `<ol>`; `role="group"` named by its badge: sr text "Step " + the number. Working-copy item: `{ key, icon, title, detail }`, `key` from a counter, removed when applied |
| Header line | number badge (28px `rounded-md bg-raised text-sm font-medium`), icon button (2.3), spacer, **Move up**, **Move down**, **Delete**: `grid h-11 w-11 place-items-center rounded-xl text-mute hover:bg-raised hover:text-ink active:bg-line` (the `DraftCard` icon-button style). Icons `ArrowUp`, `ArrowDown`, `Trash`; each has a `title` as well as its label |
| Title | visible label "Title" (+ sr " of step 3"), `input` h-11, `border-field`, placeholder "e.g. Ask you to approve", required |
| Detail | visible label "Detail (optional)" (+ sr " of step 3"), 2-row `textarea` in a `.field-focus rounded-xl border border-field` wrapper (like the composer), placeholder "e.g. Nothing is sent until you say yes". Enter does nothing (a step is one paragraph); pasted line breaks become spaces |
| Limits | 200 characters each (`LIMITS.stepText`), 1 to 12 steps (`LIMITS.planSteps`). **No `maxLength`**: a paste is never cut silently |
| Counter | from 160 characters, right under the field, `text-sm text-mute`: "172 of 200". At 200: "200 of 200. Limit reached." Part of the field's `aria-describedby`; not live |
| Over the limit | field `border-error` + `aria-invalid`, `CircleAlert` in `text-error` + "Use 200 characters or fewer. Shorten it by 27." (shown at once) |
| Empty title | after blur or after a failed commit only: "Give this step a title." Spaces only count as empty. Trim title and detail when applied |
| Per-field errors | `<p id>` under the field, in `aria-describedby`; the colour is on the icon and border, the text stays `--ink` |

### 2.3 Icon picker (an inline disclosure with native radios, no popover)
- Chosen over a native `<select>` (no icons in options) and a floating popover (needs positioning, clipping, outside-click and a focus trap). An inline panel under the header line is plain HTML with free keyboard behaviour.
- Trigger: a 44px `rounded-xl border border-field bg-surface` button showing the icon (20px), from 640px also its **name** and `ChevronDown`; on phones icon and chevron only. `aria-label` "Icon for step 3: Schedule", `aria-expanded`, `aria-controls`. Enter or Space opens it; only one panel is open at a time.
- Panel (`id` per step): `role="radiogroup"` named "Icon for step 3", `rounded-xl bg-sunken p-2`, grid `grid-cols-3 max-h-72 overflow-y-auto sm:grid-cols-8 sm:max-h-none`. A tile is a `<label>` around a visually hidden native `<input type="radio">`: icon 20px, name 13px, `min-h-14`, `rounded-xl border border-line`. **Selected**: `border-accent bg-accent-subtle font-medium` plus a `Check` (14px, `text-accent-text`) in the corner, so it is not colour alone. Focus: `has-[:focus-visible]` draws the global outline and halo.
- Keys: on open, focus moves to the selected tile (or the first, if the step's icon is not in the list). **Arrow keys** (all four) move and select, and the icon on the trigger updates at once. Tab leaves the group. **Escape** or Enter (a keydown handler on the group), the trigger again, or a mouse or touch click (`event.detail > 0`; arrow-key clicks have 0) close it, and focus returns to the trigger. No Home and End (native radios do not have them).
- A step with an icon name we do not have shows `Workflow` and the name "Other icon", nothing is checked, and the stored value stays until a tile is picked. The 32 names live in `ICON_LABELS` (next to `ICON_NAMES`): Search "Search", Telescope "Research", Brain "Think", Receipt "Invoice", FileBarChart "Report", Inbox "Inbox", Clock "Schedule", CreditCard "Payment", PenLine "Write", Send "Send", Table "Table", FileText "Document", Mail "Email", Tags "Labels", FolderInput "File away", Bell "Remind", Zap "Quick action", Sparkles "Sparkle", CircleCheck "Check", Pencil "Edit", MessageSquareText "Message", ListChecks "Checklist", Folder "Folder", FolderOpen "Open folder", Calendar "Calendar", MessageSquare "Chat", ListTodo "To-do", ShieldCheck "Approve", Plug "Plug", UserPlus "New person", Workflow "Flow", History "History".

### 2.4 Add, delete, move, and where focus goes
| Action | Behaviour | Focus | Announced (the one live region) |
|---|---|---|---|
| Add step | `Btn` secondary sm, icon `Plus`, under the list. Appends `{ icon: "Workflow", title: "", detail: "" }` at the end (D7) | the new step's Title | "Step 6 added. 6 of 12 steps." |
| Add at 12 | button `aria-disabled`, the cap line (3.2) is visible; pressing it only announces | stays | "A plan can have up to 12 steps. Delete one to add another." |
| Delete | no confirmation: it changes the working copy only, and Cancel restores everything (D5). An inline line above Add step: "Step 3 deleted." + ghost **Undo** (one level; cleared by the next add, move, edit or Cancel) | the Title of the step now at that position; else the previous step's Title; else Add step | "Step 3 deleted. 4 steps left. Undo is below the list." |
| Undo | puts the step back at its old position | its Title | "Step 3 restored." |
| Move up, Move down | swap with the neighbour; numbers update at once. Labels "Move step 3 up", "Move step 3 down". At the ends the button is `aria-disabled` (not `disabled`, so focus is never lost) and pressing announces | **the same button keeps focus**; an effect re-focuses it by id because React may move the DOM node. If it just became `aria-disabled`, focus stays there | "Step 3 moved to position 2 of 5." / "Step 1 is already first." / "Step 5 is already last." |
| Edit steps (open) | see 1.2, 1.3 | first Title | "Editing steps. 5 steps." |
| Done, Cancel, Save changes | editor closes | back to **Edit steps** | see 3.2 |
Reordering is **buttons only**. Drag and drop may be added later as an extra, never as the only way.

### 2.5 Preview while editing
The existing `StepRow` list is the read-only result. It is what the card shows after Done or Save changes and before the editor opens. There is no second live copy beside the editor: each editor row already shows the icon, title and detail, and a duplicate list would double the length and the screen-reader noise.

## 3. States and exact copy
### 3.1 Headings and source labels (they must stay true)
| Situation | `h2` | Sub line |
|---|---|---|
| AI plan, unchanged | Plan written by AI. Nothing will run. | AI can get things wrong. Read each step before you save. (+ today's Groq footer) |
| Keyword plan, unchanged | Keyword preview. Nothing will run. | today's lines |
| **Preview, edited by you** | **Plan edited by you. Nothing will run.** | From AI: "It started as a plan written by AI, and you changed it. Read each step before you save." From keywords: "It started as a keyword preview, and you changed it." Footer, AI origin only: "Some steps may still be written by an AI model run by Groq. Read each step before you rely on it." |
| Opened from Your drafts | Saved plan. Nothing will run. | none. We store neither the source nor an edited flag, so we claim neither. An opened draft that began as an AI or keyword plan looks exactly like any other |
| Editing a preview | Edit the steps. Nothing will run. | Changes stay on this page until you choose Save as draft. |
| Editing a saved draft | Edit the steps. Nothing will run. | Draft: {name}. Changes are saved only when you choose Save changes. |
The step counter "5 of 12 steps" sits right of the heading (`text-sm text-mute`; wraps below on phones). An edited preview that is then saved keeps its "edited by you" heading for that session; reopened later it reads "Saved plan".

### 3.2 States
| State | What shows | Exact copy | Announced |
|---|---|---|---|
| Idle | plan card with Edit steps in the action row | no new text | none |
| Editing, clean | footer line (not live) | "No changes yet." Save changes disabled (draft path); Done enabled | on open (2.4) |
| Editing, changed | footer line with `Info` icon in `text-info` | "You have unsaved changes." | none (a visible line, not live) |
| Nothing changed | Done closes without relabelling; Cancel closes silently | | Done: "No changes made." |
| Saving (draft path) | Save changes `loading`, label "Saving...", fields `readOnly`, Cancel disabled, editor `aria-busy` | | "Saving your changes." |
| Saved (draft path) | editor closes; the card's status line | "Draft updated. It will not run." + link "See your drafts" | "Draft updated. It will not run." |
| Done (preview path) | editor closes; status line | "Not saved yet." | "Steps updated. Not saved yet." |
| Error, generic | `role="alert"` under the buttons, `CircleAlert` in `text-error`; edits kept; Save changes becomes "Try again" | "Could not save your changes. Check your connection and try again." | alert |
| Error, offline (`navigator.onLine === false`, nothing sent) | same slot | "You are offline. Your changes are still here. Reconnect and try again." | alert |
| Error, draft gone | same slot; primary becomes **Save as new draft** (runs `saveDraft` with the box text and the copy, then follows the new `id`) | "That draft no longer exists. It may have been deleted in another tab or window. You can save these steps as a new draft." | alert |
| Error, server rejected the plan | same slot | the server's sentence + " Check each step and try again." | alert |
| Error, our own checks on commit | alert, field errors shown, focus on the first bad field | "Fix 1 problem before you continue." / "Fix {n} problems before you continue." | alert |
| Empty plan (last step deleted) | in the list area, then Add step | "This plan has no steps." "Add a step to build it." On commit: "A plan needs at least 1 step. Add a step to continue." (alert, focus Add step) | alert on commit |
| 12-step cap | counter "12 of 12 steps"; `Info` icon line above Add step | "A plan can have up to 12 steps. Delete one to add another." | on pressing Add |
| Two tabs | **last save wins and we do not warn**: one person, usually one tab, a plan to read, and a version check would need a new column. If the other tab deleted the draft, the "draft gone" row above applies | | |
| Session ended | the server redirects to `/login`; the working copy is lost. Accepted for phase A | | |
Loading: the editor opens at once from data already on the page, so its only wait is Saving. Empty: the empty-plan row. The Your drafts list keeps its own loading, empty and error states unchanged.

### 3.3 `DraftCard`
Meta line: "Updated 17 Oct, 3:20 pm . 5 steps" (was "Saved"), with the same `<time>` and the "Draft" chip. `updated_at` moves on rename and on step edits, so "Saved" would be false after an edit; for a never-edited draft "Updated" equals the save time and is still true. The row's accessible name stays "Open draft: {name}".

## 4. Motion (Arjun: 120 / 200 / 340ms, `cubic-bezier(.4,0,.2,1)`, no spring, no bounce, nothing moves on its own)
- Read-only list to editor and back: 120ms opacity only; the card height changes at once (no height animation).
- Add: the row fades in 200ms with an 8px rise (same as `StepRow`). Delete: fades and collapses its height over 200ms (`AnimatePresence`, as `DraftList`). Move: the swapped rows glide 200ms (`layout`). Icon panel and guard bar: 120ms fade. Selected tile colour: 120ms.
- Reduced motion (`MotionConfig reducedMotion="user"` already drops transform and layout): add is a fade; move is an instant swap; delete is a 120ms fade and then removed (set the exit height only when `usePrefersReducedMotion()` is false). Spinners stay. `globals.css` already turns smooth scrolling off.

## 5. Accessibility
- [ ] **Names and roles:** editor `role="group"` named by its `h2`; steps `role="group"` ("Step N"); `<ol>`; every field has a visible `<label>`; picker is a `radiogroup` of native radios; Move and Delete labels carry the step number; the trigger has `aria-expanded` and `aria-controls`. The guard sentence is `aria-describedby` of Keep editing.
- [ ] **Keyboard (no mouse needed):** Tab order per step is icon trigger, Move up, Move down, Delete, (panel tiles when open), Title, Detail; then Add step, Undo (if shown), the card buttons. Enter or Space opens the picker; arrows move and select; Escape closes the picker only. Enter in Title or Detail does nothing (it is not a form, so nothing submits by accident). No drag and drop anywhere.
- [ ] **One announcer:** the Composer's existing sr-only `role="status"` takes every editor message through `announce(text)`; the editor adds no live region. Failures use the existing `role="alert"` slots. Counters and the "unsaved" line are not live.
- [ ] **Focus:** every move in 2.4 and 1.4 as written; the focus line is the global 2px `--focus` outline plus halo, on tiles too (`has-[:focus-visible]`). After Cancel, Done or Save changes focus returns to Edit steps.
- [ ] **Targets:** icon buttons, inputs, the trigger, `Btn` sm (44px on phones) all 44px; tiles at least 56px; the badge is not interactive.
- [ ] **Not colour alone:** selected tile = border + fill + check + weight; invalid = border + icon + message; unsaved = icon + text; the error text stays `--ink`.
- [ ] **Reflow and zoom:** no horizontal scroll at 320px or at 200% zoom; no fixed heights except `h-11` inputs and tile `min-h`.
- [ ] **Reduced motion** as in section 4. No glass is used, so reduced transparency does not apply.
- [ ] Builder check once: keyboard-only pass of Edit steps, add, move, delete, undo, icon change, Done, Save; then a screen-reader pass of the announcements; both themes; 320px.

**Contrast of the new pairings** (all other pairs are the ones in `design-next.md` 1.4). Text needs 4.5, UI parts 3.0. Computed by `contrast.py`; all pass.
| Pairing | Need | Light | Dark |
|---|---|---|---|
| Selected tile name: `--ink` on `--accent-subtle` | 4.5 | 15.45 | 13.77 |
| Icon and check in a tile: `--accent-text` on `--accent-subtle` / on `--surface` | 4.5 | 6.36 / 7.10 | 7.16 / 8.34 |
| Number badge, guard bar, Undo line: `--ink` on `--raised` | 4.5 | 14.73 | 12.93 |
| Counter, "Detail (optional)", placeholder: `--mute` or `--hint` on `--surface` | 4.5 | 6.21 | 7.07 |
| Hovered icon button glyph: `--mute` on `--raised` | 4.5 | 5.30 | 5.70 |
| Discard changes (`Btn` dark): `--bg` on `--ink` | 4.5 | 16.03 | 17.52 |
| Field and trigger border: `--field` on `--surface` | 3.0 | 3.85 | 3.54 |
| Error border and icon on `--surface` / icon on `--raised` | 3.0 | 6.47 / 5.52 | 6.24 / 5.03 |
| Info icon on `--surface` / on `--raised` | 3.0 | 6.70 / 5.72 | 6.79 / 5.48 |
| Selected tile border: `--accent` on `--surface` | 3.0 | 5.70 | **3.03** (passes by 0.03; the check, fill and weight carry the state too) |
| Focus outline on `--accent-subtle` / on `--raised` | 3.0 | 5.10 / 4.86 | 4.67 / 4.38 |
| Move and Delete glyph: `--mute` on `--surface` | 3.0 | 6.21 | 7.07 |
Never put the accent fill on `--raised` in dark (2.44, already banned): the selected tile uses `--accent-subtle` on `--surface`, not `--raised`.

## 6. Component inventory
- **Reuse unchanged:** `Btn` (primary Done and Save changes; secondary Edit steps, Add step, Keep editing; ghost Cancel and Undo; dark Discard changes), `StepRow` (the read-only result), `Icon`, `EASE`, `usePrefersReducedMotion`, `MotionProvider`, `.field-focus`, `Drafts.js` and `DraftList.js` (`toDraft` already passes icon, title and detail). `Switch` is not used.
- **Small change:**
  - `components/app/Composer.js`: state for `editing`, `working`, `generated` (the plan as made), `draftId`; Edit steps, Done, Cancel, Save changes, Save as new draft; headings per 3.1; the guard bar and `guard()`; `readOnly` box and its hint line; `beforeunload` and link listener; calls `announce`; `updateDraftPlan`.
  - `components/app/Workspace.js`: `fill(text, plan, meta)` carries `{ id, name }` in the seed and goes through the composer's `guard` first.
  - `components/app/DraftCard.js`: pass `{ id: draft.id, name: draft.name }` to `fill`; "Saved" becomes "Updated".
  - `lib/ai/icon-names.js`: add `ICON_LABELS` (plain object, so Node tests can check it has all 32 names). `components/icons.js`: add `ChevronDown: CaretDown`.
  - Architect: `lib/actions/drafts.js`, `lib/validate.js` (section 0).
- **New:** `components/app/StepEditor.js`, default export `StepEditor({ steps, onChange, announce, showErrors, busy })`, with the icon picker inside the same file (not exported).
  - `steps`: the working copy, `[{ key, icon, title, detail }]`. `onChange(next)`: called with the whole new array on every edit. `announce(text)`: the Composer's single live region. `showErrors`: true after a failed commit, so untouched empty titles show their error. `busy`: true while saving (fields `readOnly`, buttons `aria-disabled`).
  - Named helpers from the same file: `toWorking(plan)`, `toPlan(working)` (trims, drops `key`), `checkSteps(working)` (returns the problem count and the first bad field), `sameSteps(a, b)` (compares icon, title and detail after trim, so moving a step away and back is "no change").

## 7. How it could grow (nothing here is designed now)
- **Typed steps (B):** add a `kind` to the item and show its named fields between Title and Detail; the header line, Move, Delete, guard and counters stay.
- **AI help on a step:** one more ghost icon button in the header line that calls `onChange` with a changed step; AI plans keep feeding the same working copy.
- **Connectors and running:** a "Not connected" chip in the header line, then a connect button; "Run test" joins the card's action row. The item is `{ key, icon, title, detail, ... }`, so it only adds fields. The truth rules in 3.1 and every "Nothing will run" sentence must change in the same commit as anything that runs.

## 8. Open questions and decisions
**Blocking questions: none.** The three server needs in section 0 are dependencies for the architect, not questions.
Decisions where the brief was silent (each cheap to change):
- **D1** The editor lives in the composer card, not in the draft row (1.1).
- **D2** No third icon button on the draft row (320px). If wanted later: a text button "Edit steps" on the row's second line, calling `fill` and then opening the editor.
- **D3** Preview path is two steps (Done, then Save as draft) so the read-only result is seen before saving. A one-step "Save as draft" inside the editor is a small change if the owner prefers it.
- **D4** No stored "edited" or "source" flag. Adding one boolean column needs a migration on the hosted project, which the owner approves first.
- **D5** Delete has no confirmation, only an inline Undo; the working copy and Cancel make it safe, and a confirm per step would be slower than the risk it removes.
- **D6** No `maxLength` on step fields, so a paste is never cut silently (the composer box still uses it).
- **D7** Add step appends at the end; Move up and Move down place it. **D8** No "restore original plan" button: Cancel restores what was there when the editor opened.
- **D9** The request box is read-only while step edits are unsaved. **D10** Edge Move buttons use `aria-disabled`, not `disabled`. **D11** Last save wins, no two-tab warning. **D12** Escape never discards.
