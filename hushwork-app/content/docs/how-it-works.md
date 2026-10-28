# How Hushwork works

Every workflow follows one loop: a start, some steps, a practice run, your approval, and a record on the Runs page.

## The big picture

```
You describe a chore
        |
        v
A plan (a short list of steps)  -->  saved as a draft / workflow
        |
        v
Press Run  =  a PRACTICE run
  (lists what each step would do, sends nothing)
        |
        v
Runs page: each step that does something waits
        |
        v
You read the exact words, then press Approve
        |
        v
The step really happens, and its result is saved
```

## The parts

### The start

Every workflow begins with a **Start** step. It says what starts the workflow: **When I ask**, **On a schedule**, or **Keep watching**. See [Schedules](/docs/schedules) and [Watch mode](/docs/watch-mode).

### The steps

After the start come the steps. Each is one small job: look at an app, ask the AI, send an email, create a task. A plan holds up to 12 steps. See [The Builder and its blocks](/docs/builder) and [Step types](/docs/step-types).

### Practice versus real

When you press **Run**, Hushwork does a **practice run**. It walks through your steps and writes down what each would do. Nothing leaves Hushwork.

A step becomes **real** only when it is approved. That is true for steps that write (send, create, add). In the default Manual mode it is also true for steps that only read, like asking the AI or looking in Gmail.

### Approval

Each real step shows a card on the **Runs** page with the exact words. You press **Approve** to do that one step. A step that writes can be approved only once per run. See [Runs and Approve](/docs/runs-and-approvals).

### The runs log

Every run is saved on the **Runs** page. It shows each step, what happened, and a one-line summary at the top. Runs are never edited after they are saved. New small records are added under a step instead.

## Where the AI fits in

The AI does two jobs:

1. **Writes the plan** from your sentence (the "Write with AI" switch). See [The workspace](/docs/workspace).
2. **Runs "Ask the AI" steps**, where it reads what an app returned and writes words.

The AI can only read and write words. It cannot press Approve for you and cannot change anything in your apps. See [Ask the AI and earlier answers](/docs/ai-writing) and [Privacy and what the AI sees](/docs/privacy).

## Two choices that skip the click

- **Auto mode** does every step of a run without asking.
- **Let it write by itself** lets a scheduled run send and create things while you are away.

Both are off until you choose them. Read more in [How Hushwork keeps you in control](/docs/safety).

## Try it

1. Open **Templates** and press **Open in the Builder** on any template.
2. Press **Save**, then go to **Workflows** and press **Run**.
3. On **Runs**, read the cards. Do not press Approve yet. Notice that nothing has happened.
4. Press Approve on the first card, and watch its result appear under the step.
