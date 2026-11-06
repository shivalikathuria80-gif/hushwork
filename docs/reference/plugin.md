# Chatbot plugin

The Hushwork plugin lets a person use Hushwork from Claude, or from any chatbot that can reach a remote MCP server: list, make and run agents, read runs and the Hushwork Agent's notes, and approve or turn down waiting steps.

Up: [Reference](README.md)

## The pieces

- **The endpoint** `POST /api/mcp`: a small, stateless MCP server (Streamable HTTP, JSON answers, no sessions, no streams). GET and DELETE answer 405.
- **API tokens**: made on Settings, under Chatbot plugin. A token is `hw_` plus 43 random characters (32 bytes), shown once. Only its SHA-256 hash is saved (`api_tokens`). Each person can keep up to 5, and removing one cuts it off at once.
- **The plugin package** `plugins/hushwork/`: the manifest, `.mcp.json` (the endpoint address plus `Authorization: Bearer <token>` from the plugin's settings), four skills, and `hushwork.plugin` (the same folder zipped, for uploading to the Claude desktop app). The repository root has `.claude-plugin/marketplace.json`, so Claude Code can add the repository as a marketplace.

## How a request is handled

1. Any request with an `Origin` header that is not Hushwork's own gets 403, so a web page can't drive the endpoint.
2. The Bearer token is read, hashed, and looked up with the all-access client. If it is unknown, the answer is 401.
3. In-memory limits stop runaway loops: 60 calls a minute and 2000 a day per person.
4. Every tool runs as that one person, through `createTokenClient(userId)`. That is the all-access client, marked with the person's id, the same way scheduled runs work. Every query names the person. Rows the tools write say whose they are, and `take_usage_for` counts the AI and sending limits for that person.

## The tools

| Tool | What it does | Writes outside Hushwork? |
|---|---|---|
| `list_agents` | Agents and workflows, their schedules, and how many steps wait | no |
| `create_agent` | One sentence becomes an agent (`lib/agents/create.js`) and runs once with `allowWrites: false` | no |
| `run_agent` | Runs one with `allowWrites: false`: reads and AI steps happen, writes wait | reads only |
| `list_runs`, `get_run` | Runs with their outcome; each waiting step carries `will_do`, the exact words of the Runs page's approval card | no |
| `list_waiting` | Every waiting step across each agent's latest run | no |
| `approve_step` | Does one step through `approveStep` in `lib/run-core.js`, which uses the same action as the Approve button. It requires `seen` = the `will_do` text the person read | **yes, the only one** |
| `reject_step` | Saves a "turned down" record under the step, and nothing is sent | no |
| `agent_notes` | The Hushwork Agent's notes that were not dismissed | no |

## The safety rule

- Nothing a chatbot starts can write by itself. `run_agent` and `create_agent` always pass `allowWrites: false`, and a new schedule starts with writing off. Only the person can turn that on, in the app.
- `approve_step` goes through the same write gates as the Approve button: the pause switch, the record saved before sending, a step done is never done twice, and an unknown step is never sent again by itself.
- It also passes `seen`. If the words the step would send now differ from what the person was shown, nothing is sent and the tool returns the new words (`will_do_now`).
- The tool is marked `destructiveHint` so chatbots ask before calling it, and the server's instructions and every skill tell the chatbot to show `will_do` and wait for a clear yes.
- A turned-down step is a "failed" record, so it stops counting as waiting. Like any stopped step, the person can still approve it later in the app, and "Continue from where it stopped" would try it again.

## Where in the code

- `hushwork-app/app/api/mcp/route.js`: the endpoint: Origin check, token check, limits, and the real dependencies
- `hushwork-app/lib/plugin/mcp.js`: the JSON-RPC and MCP messages
- `hushwork-app/lib/plugin/tools.js`: the nine tools
- `hushwork-app/lib/plugin/tokens.js`: making, hashing and looking up tokens
- `hushwork-app/lib/actions/tokens.js`, `hushwork-app/components/app/PluginTokens.js`: Settings, Chatbot plugin
- `hushwork-app/lib/run-core.js`: `approveStep`, `rejectStep`
- `hushwork-app/lib/supabase/admin.js`: `createTokenClient`
- `hushwork-app/lib/db-limits.js`: `take_usage_for` for token clients
- `supabase/api-tokens.sql`, `supabase/usage-tokens.sql`
- `plugins/hushwork/`, `.claude-plugin/marketplace.json`
- Tests: `hushwork-app/lib/plugin/plugin.test.js`, plus the scan tests in `lib/secrets.test.js` and `lib/sql-rls.test.js`
