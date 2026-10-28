# Memory

Memory is a short list of facts you write about yourself, which the AI can use as background.

## What it is

Memory holds small facts like "Timezone: India (IST)" or who gets your weekly reports. When Hushwork's AI writes a plan or answers an **Ask the AI** step, it can read these facts first, so you do not have to repeat them.

Each fact has a **Name** (up to 60 characters) and a **Fact** (up to 300 characters). You can keep up to **50 facts**.

## Only facts you wrote reach the AI

Anything the AI reads could carry a hidden instruction, like a web page that says "ignore your rules." Memory is built so it cannot be used that way:

- Only facts **you typed yourself** are ever sent to the AI. Hushwork never saves a fact on its own, and the AI cannot write to Memory.
- Only facts marked **verified** are sent. A fact you add is saved that way, and you cannot choose another setting.
- Facts go to the AI as plain background information. The AI is told to **ignore any instructions** written inside them.
- At most **20 facts**, and about 2000 characters in total, are sent with one request.
- Memory is not given to the AI when it uses a tool server (an MCP server).
- A fact that looks like a secret, such as a card number, key or token, is refused when you save it.

> **Careful:** Do not save passwords, keys or card numbers. Saved facts are sent to Groq, the company that runs the AI, along with your AI requests.

## Add a fact

1. Open **Settings** from the menu and find the **Memory** section.
2. In **Name**, write a short name, like `Timezone`.
3. In **Fact**, write the fact, like `India (IST)`.
4. Press **Remember**.

The fact appears in the list. If nothing is saved yet, the list says "Nothing saved yet."

## Remove a fact

Press **Forget** next to a fact. It is removed from your list and the AI will not see it again.

## What Memory is used for

- When the AI **writes a plan** from your sentence in the Workspace.
- When an **Ask the AI** step runs.

It is not used for the AI summary that sits above an app's exact answer.

## If Memory says it needs setup

If the Memory section says "Memory needs one setup step," the person who runs this copy of Hushwork must add a database table first. Until then the AI simply works without memory. Nothing breaks.

## Your data

Your memory facts are included in **Download my data**, and they are deleted when you delete your account. See [Your account and your data](/docs/account) and [Privacy and what the AI sees](/docs/privacy).

## Try it

1. Add the fact `Timezone` with the value `India (IST)`.
2. Go to the Workspace and type: "Every morning, remind me what is on my calendar."
3. Preview the plan. The AI may use your timezone as background.
4. Go back to Settings and press **Forget** if you want it gone.
