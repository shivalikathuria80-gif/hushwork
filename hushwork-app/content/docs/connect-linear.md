# Linear

Connect Linear to let Hushwork read your open tasks, and add one new task after you press Approve.

## Connecting

On the **Connections** page, open the **Linear** box and press **Connect Linear**. You sign in on Linear's own page and press **Allow**. Nobody pastes a key into Hushwork. Hushwork keeps the permission Linear gives it, scrambled (encrypted), until you press **Disconnect**. Linear's permission is short-lived, and Hushwork renews it for you in the background.

## What Hushwork reads

Your open tasks assigned to you, up to 10, newest changes first. Hushwork gets each task's id, title and status. Finished and canceled tasks are left out. The lookup is one fixed question that cannot change anything.

You can use it in two ways:

- The **Linear** block in the Builder is a lookup step. You approve it on the Runs page with **Approve and ask Linear**.
- An **Ask the AI** step can look at **My Linear tasks** before it answers. See [Ask the AI and earlier answers](/docs/ai-writing).

If the AI is switched on, the task list is also sent to Groq, the company that runs the AI, so it can write a clear summary. Your own list is always shown too, exactly as Linear answered.

## What Hushwork can write

One thing: a new task. Use the **Create Linear task** block. It has three boxes:

- **Task title** (up to 100 characters).
- **Details** (optional, up to 150 characters).
- **Team key** (optional, up to 10 characters), the short key of the Linear team, for example ENG. If you leave it empty, Hushwork uses your first team.

You can write `{answer}` in the title or details to use what an Ask the AI step said.

On the Runs page you read the exact title, details and team on the approval card, then press **Approve and create the task**. You can do that once for each step in each run. If the words changed after you opened the page (for example the AI step ran again), nothing is created and you read the new words first.

Hushwork cannot change, close, move or delete a task that already exists.

> **Careful:** A new task is a real task in your Linear. Read the card before you press Approve. You can delete a task in Linear yourself.

## If you connected before task creating was added

Linear asks for a separate permission to add tasks. If you connected Linear earlier, press **Disconnect** and then **Connect Linear** again so Linear asks for it.

## Limits

- Lookups: 5 a minute and 30 a day.
- Created tasks: 3 a minute and 15 a day.

More numbers are on [Limits and numbers](/docs/limits).

## If it does not work

- **Linear is not connected yet. Open Connections and press Connect Linear.** Connect first.
- Press **Test all my connections** on the Connections page. It shows what Linear answered.
- If the Connect button says it needs setup, the person who runs this copy of Hushwork has not made Hushwork's own app inside Linear yet.

## Related pages

- [Connections overview](/docs/connections)
- [Step types](/docs/step-types)
- [How Hushwork keeps you in control](/docs/safety)
