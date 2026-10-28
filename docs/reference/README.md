# Hushwork reference

The technical reference: how Hushwork is built, how its safety rules work, and how to run and change it. Written for the owner and for any engineer who joins later.

Up: [Docs index](../INDEX.md)

These pages describe the code as it is now. Each one ends with a "Where in the code" list of real file paths. If a page and the code ever disagree, the code wins; fix the page.

## How it is built

- [Architecture](architecture.md): the stack, the folder map and how one request flows.
- [Data model](data-model.md): every database table, who can read it, and the caps.
- [Run model](run-model.md): practice and live runs, the append-only records, approval gates and recovery.
- [Connectors](connectors.md): own sign-ins versus Composio, and how to add an app.
- [AI planner](ai-planner.md): how a sentence becomes steps, the safety nets, and what the AI sees.
- [Skills and bundles](skills-and-bundles.md): how ready-made workflows are defined and added.
- [Schedules and watch mode](schedules-and-watch.md): the clock, quiet hours and the speak-up limit.

## Rules and numbers

- [Safety and limits](safety-and-limits.md): every rule and limit, with the file it lives in.
- [Environment variables](env-vars.md): every setting name the app reads (names only, never values).

## Working on it

- [Testing](testing.md): `npm test`, the fakes, the scan tests and common pitfalls.
- [Deployment and domains](deployment-and-domains.md): Vercel, Supabase, the clock, hushwork.in and docs.hushwork.in, and a launch-day checklist.
- [The docs site](docs-site.md): how docs.hushwork.in is built and how to add a page.

## The public user guide

The pages people read on docs.hushwork.in are the markdown files in `hushwork-app/content/docs/` (22 pages: getting started, using Hushwork, connections, safety and privacy, reference). They are mirrored in the Obsidian vault under `hushwork-app/content/docs/`.
