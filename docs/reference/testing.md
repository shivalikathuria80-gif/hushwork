# Testing

How Hushwork's automatic checks work: `npm test`, the pretend database and pretend services, the kinds of test, how to run one file, how to add a test, and the usual traps.

Up: [Reference index](README.md)

All commands run inside `hushwork-app`.

## The four checks

| Command | What it does | In CI? |
| --- | --- | --- |
| `npm test` | Runs every `lib/**/*.test.js` file with Node's built-in test runner. About 560 tests when this was written | Yes |
| `npm run lint` | Runs ESLint, which reads the code for mistakes and style problems | Yes |
| `npm run build` | `next build`: builds the whole site the way Vercel does. Catches errors tests cannot, such as a bad import in a page | No (run it before a big push) |
| `npm run check:privacy` | Two-account privacy check against the **real** database (see below) | No, you run it by hand |

`.github/workflows/ci.yml` runs `npm ci`, `npm test` and `npm run lint` on every push to `main` and every pull request, with Node 24. It uses no secrets and touches no real service.

## How `npm test` works

The script in `package.json` is:

```
node --import ./scripts/test-hooks.mjs --test "lib/**/*.test.js"
```

- `node --test` is Node's own test runner. No Jest, no extra package. A test file imports `test` from `node:test` and `assert` from `node:assert/strict`.
- `scripts/test-hooks.mjs` registers `scripts/test-resolve.mjs`, which lets tests load the app's **server code outside Next.js**. It understands the `@/` shortcut (the project folder) and swaps the few Next-only modules (`server-only`, `next/cache`, `next/headers`, `next/navigation`) for harmless stand-ins. `redirect()` becomes a thrown `Error("redirect:/path")` you can assert on.
- Because of this, tests run the **real** server functions such as `lib/run-core.js`, not copies.

## Pretend services

Tests never call a real service. Two helper files make that easy:

- `lib/test-server-support.js`
  - `makeFakeSupabase({ asUser, workflows, emails, rpc, admin })`: a small in-memory database that answers exactly the queries the app makes (`from().select/insert/delete/eq/gte/contains/order/limit`, `rpc()`, `auth.admin.getUserById`). Rows live in `supabase.tables`.
  - `fakeComposio(tools, { groq })`: replaces the global `fetch` for the length of a test. It answers Composio's tool describe and execute calls, and it also plays **Groq**: the `groq` list is the texts the AI answers with, one per call; the entry `"TOOL"` makes the fake AI ask for its first tool, then the next entry is its answer. It records every call in `calls`. Always call `composio.restore()` in a `finally`.
  - `GMAIL_TOOL`, `NOTION_TOOL`: ready-made tool descriptions.
- `lib/ai/test-support.js`: `blockRealFetch()` (any real `fetch` fails the test), `mockFetch(handler)` and `captureConsole()` (proves nothing secret is logged).

## Kinds of test

| Kind | Example files | What it proves |
| --- | --- | --- |
| **Unit** | `lib/schedule.test.js`, `lib/validate.test.js`, `lib/watch-rules.test.js` | One small function behaves, with the time handed in so the clock can be moved by hand |
| **Integration** (`*.integration.test.js`) | `lib/run-core.integration.test.js`, `lib/run-recovery.integration.test.js`, `lib/skills/bundles.integration.test.js`, `lib/google-files.integration.test.js` | The real server code runs end to end with the fake database and fake Composio and Groq |
| **Scan tests** | `lib/secrets.test.js`, `lib/sql-rls.test.js`, `lib/headers.test.js` | They **read the source files as plain text** (or the SQL, or `next.config.mjs`) and check rules |

Scan tests are the guard rails:

- `lib/secrets.test.js`: each secret's name appears only in its one allowed file; those files are `server-only`; nothing is `NEXT_PUBLIC_` that should not be; no real-looking key is written anywhere; the all-access database client has exactly two users; the clock's password is checked before anything runs; a schedule is claimed before it is run. It never opens `.env.local`.
- `lib/sql-rls.test.js`: every per-person table in `supabase/` has row-level security, `revoke all` then narrow grants, no policy that lets everyone in, and no policy that reads its own table (error 42P17).
- `lib/headers.test.js`: the browser safety headers are present and the policy never blocks the app's own scripts.

## Run one test file

`npm test -- file` adds the file to the glob, so it still runs everything. Call Node directly:

```
node --import ./scripts/test-hooks.mjs --test lib/skills/bundles.test.js
```

This runs one file with the same hooks. To run one test by its title, add `--test-name-pattern="part of the title"`.

## Add a test

1. Put it beside the code: `lib/thing.js` gets `lib/thing.test.js`. The name must end in `.test.js` or `npm test` will not find it.
2. Start with `import test from "node:test"; import assert from "node:assert/strict";` and import the code with a relative path ending in `.js`.
3. Give the test a title that says the rule, for example `test("an email always goes to the person themself", () => { ... })`.
4. If it needs a database or Composio, use `makeFakeSupabase` and `fakeComposio`.
5. Run the file, then the whole suite.

## `npm run check:privacy`

`scripts/two-account-check.mjs` proves, against the real database, that person B cannot see, change, delete or write into person A's data and that a signed-out visitor gets nothing. Make two **throwaway** accounts on the sign-up page first. In PowerShell set `CHECK_A_EMAIL`, `CHECK_A_PASSWORD`, `CHECK_B_EMAIL`, `CHECK_B_PASSWORD` for that one command, then run it. Each line says PASS or FAIL; exit code 1 means a FAIL, 2 means a missing setting. A table not set up yet is skipped. It creates a few tiny rows for A and deletes them again.

## Common traps

- **CRLF line endings.** On Windows, files can end lines with `\r\n`. A scan test that matches text across lines must first do `.replace(/\r\n/g, "\n")`, as `lib/sql-rls.test.js` does.
- **Backslashes in strings and template literals.** In a normal string or template literal, `\b` is a backspace character, not a word edge. When you build a pattern with `new RegExp(\`...\`)`, write `\\b` and `\\.`.
- **The `process.env` scan.** `lib/secrets.test.js` scans every source file for secret names. Your test file must not contain a forbidden name in plain text, so tests build it from pieces: `process.env["COMPOSIO" + "_API_KEY"]` or `"GROQ" + "_API_KEY"`. Code that reads a setting by a built-up name (`process.env[name]`) is allowed only in `lib/connectors/oauth-env.js` and `lib/schedule-env.js`; a new reader fails the scan on purpose.
- **Set the key before importing.** Integration tests set a fake key, then `await import("../run-core.js")`.
- **A forgotten `restore()`.** If a test leaves the fake `fetch` in place, later tests misbehave.
- **Count tests.** Some tests pin lists, such as the bundle ids and some titles (see [skills-and-bundles.md](skills-and-bundles.md)).
- **Docs-site tests** read files under `content/docs/`. They fail while a page listed in `lib/docs/pages.js` has no file yet.
- Node prints `MODULE_TYPELESS_PACKAGE_JSON` warnings for `.js` files. They are harmless.

## Where in the code

`package.json`, `scripts/test-hooks.mjs`, `scripts/test-resolve.mjs`, `scripts/two-account-check.mjs`, `lib/test-server-support.js`, `lib/ai/test-support.js`, `lib/secrets.test.js`, `lib/sql-rls.test.js`, `lib/headers.test.js`, `.github/workflows/ci.yml`, `eslint.config.mjs`.
