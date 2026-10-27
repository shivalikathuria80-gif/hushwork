# Hushwork docs

Every design, plan and QA note for Hushwork, grouped by the build slice it belongs to. Each slice went spec → plan → design → QA. Start from the [main README](../README.md) for the overview.

## Use and run it

- [Try everything Hushwork can do](try-it.md): a plain-words walkthrough of every feature, online or on your own computer.
- [Putting Hushwork online](deploy.md): the deploy checklist (Vercel, Supabase, the schedule clock, limits, custom domain, troubleshooting). Always current.
- [Launch checklist for hushwork.in](launch.md): the gates before real users, the owner-only tasks, the pilot scorecard.
- [PROJECT.md](../PROJECT.md) and [DECISIONS.md](../DECISIONS.md): where things stand now, and every decision with its reason. Always current.

## Slice 1: sign-in, drafts and the sculpture login (2026-10-15)

- [Spec: the real Hushwork app, first slice](spec.md): what the first real app pages had to do.
- [Plan: sign-in, saved drafts and the sculpture login](plan.md): structure, safety and build order; wins on file names.
- [Design: sign-in, workspace and runs](design.md): looks, spacing, colours and copy; wins on visuals.
- [QA report round 1](qa.md): what was tested and the fix list for slice 1.

## Slice 2: Arjun AI restyle and the AI "Preview plan" (2026-10-16 to 17)

- [Arjun AI Design System: reference copy](arjun-ai-design-system.md): the colour, type and spacing tokens Hushwork uses.
- [Design: Arjun AI restyle, AI plan preview, owned sculpture](design-next.md): how the restyle looks.
- [Plan: Arjun AI restyle and a real "Preview plan"](plan-next.md): the original plan (written for Claude as the AI).
- [Plan amendment: Groq instead of Anthropic](plan-groq.md): read with plan-next; this file wins on the AI provider.
- [Sculpture hero: where the pieces came from](sculpture-assets.md): licence and origin of the login sculpture.
- [QA report round 2](qa-2.md): restyle and Groq Preview plan check.

## Slice 3: manual step editor (2026-10-17 to 18)

- [Plan: manual step editor](plan-editor.md): how the editor was built, including what changed from the first plan.
- [Design: manual step editor](design-editor.md): editor layout and interaction decisions (D1 to D12).
- [QA report round 3](qa-3.md): editor testing and manual checks.

## Slice 4: connections, real actions, schedules and safety (2026-10-18 to 24)

This work was recorded in `DECISIONS.md` (D-009 to D-038) and `hushwork-app/README.md` rather than in separate plan and QA files:

- Connections: own sign-in for Linear and Google, Composio for 17 more apps (D-012, D-013, D-038).
- Real actions with Approve: email, Slack, GitHub, Todoist, Calendar, Notion, Linear, Sheets (D-027, D-028, D-029).
- Scheduling: the Start step, the Supabase clock, failure emails (D-018, D-030, D-031, D-034).
- Safety and data: limits in the database, leaked-password check, Delete my account, Download my data, Terms (D-021, D-032, D-033, D-037).
- Template packs and the tests that run the real server code (D-035, D-036).

Up: [README](../README.md)
