# Hushwork plugin

Use Hushwork from Claude or another AI chatbot. List, make and run your agents, read what they did, read the Hushwork Agent's notes, and approve or turn down the steps that wait for you.

**The safety rule is the app's own.** Reading, looking things up and AI steps happen by themselves. Anything that sends or creates (an email, a Slack message, a Linear issue, a row in a sheet) waits until you say yes in the chat, and the chatbot must pass back the exact words it showed you. If those words changed since, nothing is sent.

## What's inside

| Part | What it does |
|---|---|
| Connector (`.mcp.json`) | Connects to Hushwork at `https://hushwork.in/api/mcp`. You sign in with a Connect button (OAuth). |
| `make-agent` skill | Turns "every Monday, sum up my calendar" into a Hushwork agent, with a schedule. |
| `morning-briefing` skill | Hushwork Agent notes, Linear deadlines and waiting approvals in one short summary. |
| `follow-up-sweep` skill | Finds email threads still waiting on a reply and drafts follow-ups for you to approve. |
| `weekly-review` skill | What your agents did this week, what failed, and what's waiting. |

Connector tools: `list_agents`, `create_agent`, `run_agent`, `list_runs`, `get_run`, `list_waiting`, `approve_step`, `reject_step`, `agent_notes`.

## Set it up

1. Install the plugin:
   - **Claude Code:** `/plugin marketplace add shivalikathuria80-gif/hushwork`, then `/plugin install hushwork@hushwork`.
   - **Claude desktop (Cowork):** upload [`hushwork.plugin`](https://github.com/shivalikathuria80-gif/hushwork/raw/main/dist/hushwork.plugin) (kept in the repo's `dist/` folder).
   - **claude.ai:** Settings, Connectors, Add custom connector, and paste `https://hushwork.in/api/mcp`.
2. Press **Connect** (in Claude Code: `/mcp`, pick hushwork, Authenticate). Hushwork opens; sign in and press **Allow**.

That's it. To disconnect, open Hushwork **Settings, Chatbot plugin** and press **Disconnect**.

**Other chatbots** that support remote MCP servers can use the same address. Ones with OAuth get the same Connect button. Ones that only take a header can use an API token instead:

1. In Hushwork, open **Settings, Chatbot plugin** and press **Make a token**. Copy it (it starts with `hw_`). It is shown once.
2. Set the header `Authorization: Bearer hw_...` for `https://hushwork.in/api/mcp`.

## Sign-in and tokens

- A connection or token acts as you, and only you. Hushwork keeps only fingerprints (SHA-256 hashes) of tokens, never the tokens.
- A Connect sign-in gives the chatbot a one-hour access token that it renews itself. You can keep up to 5 API tokens.
- Disconnect a chatbot or remove a token on the Settings page to cut it off at once.
- Your usual Hushwork limits on AI steps and on sending apply to everything a chatbot does.

## Rebuild `hushwork.plugin`

From this folder, run: `rm -f ../../dist/hushwork.plugin && zip -r -X ../../dist/hushwork.plugin .claude-plugin .mcp.json skills README.md`. The zip lives outside this folder because the Claude directory only accepts plain text files and the icon inside a plugin.
