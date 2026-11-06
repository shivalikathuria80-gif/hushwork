# Hushwork plugin

Use Hushwork from Claude or another AI chatbot. List, make and run your agents, read what they did, read the Hushwork Agent's notes, and approve or turn down the steps that wait for you.

**The safety rule is the app's own.** Reading, looking things up and AI steps happen by themselves. Anything that sends or creates (an email, a Slack message, a Linear issue, a row in a sheet) waits until you say yes in the chat, and the chatbot must pass back the exact words it showed you. If those words changed since, nothing is sent.

## What's inside

| Part | What it does |
|---|---|
| Connector (`.mcp.json`) | Connects to your Hushwork at `<your Hushwork>/api/mcp` with your own API token. |
| `make-agent` skill | Turns "every Monday, sum up my calendar" into a Hushwork agent, with a schedule. |
| `morning-briefing` skill | Hushwork Agent notes, Linear deadlines and waiting approvals in one short summary. |
| `follow-up-sweep` skill | Finds email threads still waiting on a reply and drafts follow-ups for you to approve. |
| `weekly-review` skill | What your agents did this week, what failed, and what's waiting. |

Connector tools: `list_agents`, `create_agent`, `run_agent`, `list_runs`, `get_run`, `list_waiting`, `approve_step`, `reject_step`, `agent_notes`.

## Set it up

1. In Hushwork, open **Settings, Chatbot plugin** and press **Make a token**. Copy the token (it starts with `hw_`). It is shown once.
2. Install the plugin:
   - **Claude Code:** `/plugin marketplace add shivalikathuria80-gif/hushwork`, then `/plugin install hushwork@hushwork`.
   - **Claude desktop (Cowork):** upload `hushwork.plugin` from this folder.
3. When it asks, paste the token. Leave the address as `https://hushwork.in` unless you host your own Hushwork.

**Other chatbots** that support remote MCP servers with a custom header can use the connector directly:

- URL: `https://hushwork.in/api/mcp`
- Header: `Authorization: Bearer hw_...`

## Tokens

- Each token acts as you, and only you. Hushwork keeps only a fingerprint (SHA-256 hash) of it, so it can never be shown again.
- You can keep up to 5 tokens. Remove one on the Settings page to cut that chatbot off at once.
- Your usual Hushwork limits on AI steps and on sending apply to everything a chatbot does.

## Rebuild `hushwork.plugin`

From this folder, run: `rm -f hushwork.plugin && zip -r -X hushwork.plugin .claude-plugin .mcp.json skills README.md`
