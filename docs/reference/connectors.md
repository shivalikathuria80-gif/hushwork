# Connectors

This file explains how Hushwork talks to other apps: its own sign-in for Linear and Google, Composio for 19 more connectable apps, MCP servers, how tokens are protected, and how to add a new app.

Up: [Reference index](README.md)

Jargon: **OAuth** is the "Allow this app?" screen another website shows, after which it gives Hushwork a **token** (a long secret that lets Hushwork act within the allowed limits). **Composio** is a service that already holds sign-ins for hundreds of apps.

## Two ways to connect

| | Own sign-in | Composio |
|---|---|---|
| Apps | Linear, Google (Calendar, Gmail, Drive, Sheets) | the apps in `composio-apps.js` |
| Who holds the sign-in | Hushwork, in the `connections` table, encrypted | Composio; Hushwork only knows the person's account id |
| List file | `lib/connectors/app-list.js` | `lib/connectors/composio-apps.js` |
| Connect button goes to | `/api/connect/<id>` | `/api/composio/<id>` |

## Own sign-in (Linear, Google)

`app-list.js` has one entry per app: `id`, `name`, `heading`, `envPrefix`, `authorizeUrl`, `tokenUrl`, `revokeUrl`, `scopes`, optional `scopeSeparator` and `extraAuthorize`, plus text for the page. Linear asks for `read` and `issues:create`. Google asks for four permissions: `calendar.readonly`, `spreadsheets`, `gmail.readonly`, `drive.metadata.readonly`.

The flow is in `lib/connections/oauth-flow.js` (the steps themselves in `lib/connectors/oauth-app.js` and `oauth-common.js`):

1. `startConnect` makes a random `state`, keeps it in a short-lived cookie (`hw_<id>_state`, HttpOnly, 10 minutes), and sends the person to the app's Allow screen.
2. The app returns with a one-time `code`. `finishConnect` checks the state matches the cookie, deletes the cookie, swaps the code for tokens on the server, and saves them for the signed-in person.
3. Tokens renew a minute before they expire (`loadAccess` in `lib/connections/store.js`). Disconnect asks the app to revoke the token, then deletes the row.

Readers: `google-calendar.js`, `google-gmail.js` (headers only; `fetchInboxText` is the one opt-in exception), `google-drive.js` (names only), `linear.js`. Writers: `google-sheets.js` (can only append one row, written as plain text so `=...` never runs as a formula) and `linear-create.js` (one fixed `issueCreate` request). `google-errors.js` tells "API switched off" from "permission not given". Failures become short fixed sentences of ours, never the other service's text.

## How tokens are stored

Settings needed (names only): `CONNECTIONS_KEY`, `<PREFIX>_CLIENT_ID`, `<PREFIX>_CLIENT_SECRET` with prefix `LINEAR` or `GOOGLE`, read only in `lib/connectors/oauth-env.js`. `CONNECTIONS_KEY` is 32 random bytes written as base64 (make one with `npm run secret`). `lib/connections/crypto.js` encrypts with AES-256-GCM, a fresh random 12-byte value per secret, stored as `v1.` plus base64url text. If the text was changed or the key differs, decryption fails and the person counts as "not connected". Losing the key means everyone presses Connect again. Accepted risks (D-016): no extra data bound into the encryption, and no PKCE. Tokens are never in a data export. `LINEAR_API_KEY` (a personal key) is used only outside production.

## Composio

`lib/connectors/composio.js` talks to `https://backend.composio.dev/api/v3.1` with the `x-api-key` header (`COMPOSIO_API_KEY`, read only in `composio-env.js`; keys starting `ck_` or `uak_` are refused). The person is identified by their Hushwork account id.

**Read-only lookups.** Each entry in `composio-apps.js` has:

| Field | Meaning |
|---|---|
| `id`, `name` | short id (saved in steps) and display name |
| `toolkit` | Composio's name for the app |
| `tool` | the ONE read-only Composio tool, called with no inputs (`null` if `noLookup`) |
| `what`, `about` | plain words for the pages |
| `lookupOf` | optional: shares another app's sign-in (`slackmessages` of `slack`, `stripeinvoices` of `stripe`); no Connect button |
| `input` | optional `{ label, pattern }`: the lookup needs one typed thing (Slack channel); never offered to the AI planner |
| `noLookup` | optional: no usable read tool (only `gslides`); only used for its create action |
| `unavailable` | optional sentence: cannot be connected (`vercel`, `xero`, `cloudflare`, D-038); shows text instead of Connect |

At the time of writing there are 24 entries: 19 with a Connect button, 2 `lookupOf`, 3 `unavailable`.

**Write actions.** `composio-actions.js` has 11 entries (`slack_message`, `github_issue`, `gmail_send`, `calendar_event`, `notion_page`, `todoist_task`, `gmail_draft`, `sheet_create`, `slides_create`, `doc_create`, `drive_folder_create`). Fields: `id`, `app`, `name`, `tool`, `needsTarget`, `target` (`pattern`, `hint`), `candidates` (names the tool may call each input), `meaning`, `done`, plus optional `labels`, `selfAllowed` (`{myEmail}`), `example`, `noDetails`, `preview` and `then` (a second call, used by `sheet_create`). A step names an action `id`, never a tool.

**Safety.** The sign-in is created limited to the allowed tools (`restrict_to_following_tools`, built by `allowedTools`). Before a write, `runActionTool` asks Composio for the tool's real inputs and `buildArguments` fills only inputs that exist; if anything does not fit, nothing is sent. A two-call action checks the second tool before making anything. Connect is limited to 5 a minute per person. Refusals are cleaned by `cleanSaid` (one line, 160 characters, dropped if it looks secret).

## MCP

`lib/connectors/mcp.js` is a small client for MCP servers (a standard way to offer tools to an AI), used only inside an Ask the AI step set to MCP. At most 8 tools, only read-only ones, no logins. Every request goes through `lib/connectors/http.js` (https only, public addresses only, no redirects, 8 second limit, 64 KB cap).

## How to add a new Composio app

1. In Composio's toolkit page (`docs.composio.dev/toolkits/<toolkit>`) find the toolkit name and ONE tool that only lists or reads and needs no input.
2. Add an entry to `COMPOSIO_APPS` in `lib/connectors/composio-apps.js`. The test requires the tool to start with the toolkit name, contain `_LIST_`, `_GET_`, `_SEARCH_`, `_READ_` or `_FETCH_`, and contain no writing word.
3. Give it a logo in `lib/app-logos.js` (`LOGOS` with a `simple-icons` import, or `ARTWORK`); `lib/app-logos.test.js` fails without one.
4. The Connections page, the Builder's app list and the AI planner pick it up by themselves (`AI_APPS` in `lib/ai/plan.js`). To let the AI name it, also add its short id to the app list inside `SYSTEM_PROMPT` in `lib/ai/plan.js`.
5. If it is `noLookup` or `unavailable`, update the exact lists in `lib/connectors/composio.test.js`.
6. To add a write action: add an entry to `COMPOSIO_ACTIONS`, add a sample to `SAMPLE_TARGETS` in `composio.js`, add the id to `LETTER_ACTIONS` in `lib/run-answer.js` if its details are a letter, extend `lib/connectors/composio-actions.test.js` (its sample-target map and `actionsForApp` lists), and add the id to the `action` choices in `SYSTEM_PROMPT`.
7. Run `npm test`, then `npm run lint`. After deploying, press Connect (people already connected to that toolkit must Disconnect and Connect once more if its allowed tools changed), then "Test all my connections".

## Where in the code

- `hushwork-app/lib/connectors/` (`app-list.js`, `composio-apps.js`, `composio-actions.js`, `composio.js`, `composio-env.js`, `google-*.js`, `linear*.js`, `mcp.js`, `http.js`, `oauth-*.js`)
- `hushwork-app/lib/connections/` (`oauth-flow.js`, `composio-flow.js`, `store.js`, `crypto.js`)
- `hushwork-app/app/api/connect/[provider]/`, `app/api/composio/[app]/route.js`, `app/app/connections/page.js`
- `hushwork-app/lib/app-logos.js`, `supabase/connections.sql`
- Decisions: D-012, D-013, D-014, D-027, D-038, D-047
