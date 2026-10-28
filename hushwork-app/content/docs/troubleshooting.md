# Troubleshooting and FAQ

Short answers to the problems people hit most, using the same words Hushwork shows on screen.

## First thing to try

Open **Connections** and press **Test now** under **Test all my connections**. It really checks Google, Linear and every app you connected, and tells you what each one answered. A red line says what is wrong. See [Connections overview](/docs/connections).

Then open the **Runs** page. A step that stopped shows **It stopped here.** and the reason, including what the app said.

## Connecting

### Connect says it needs setup

The message is "The Connect button needs its one-time setup first." It means the person who runs this copy of Hushwork has not finished the one-time setup for that app (for example making Hushwork's own app inside Google or Linear, or switching on Composio). You cannot fix this from your side. Ask the owner. The Connections page lists the steps under "One-time setup".

### Google says "Google hasn't verified this app"

Hushwork's Google permission includes Gmail read access, which Google treats as restricted. Until Google has reviewed Hushwork, only test users the owner added can connect, and Google shows this warning. If you are a test user, press **Advanced**, then **Go to Hushwork**. Google also asks you to connect again every 7 days in this stage. See [Google](/docs/connect-google).

### The step says "Gmail (send) is not connected, so this step cannot run yet"

The step needs an app you have not connected. In the step's card press **Connect Gmail (send) (new tab)**, finish the sign-in, come back and press **I connected it: check again**. You can also pick a different way, or remove the step.

### Google says it refused, or Gmail or Drive stops working

Press **Disconnect** under Google, then **Connect Google** again, and tick every box on Google's screen. This is needed if you connected before Gmail or Drive was added.

### Stripe invoices, or something new, is missing

An app's sign-in only allows what it was made for. Press **Disconnect** and then **Connect** for that app once, so the newer ability is allowed.

### I see "Not available yet" on Vercel, Xero or Cloudflare

They cannot be connected yet. See [More apps through Composio](/docs/connect-other-apps) for the reason for each.

## Running

### The run stopped part way

Open the run on the **Runs** page. The step that stopped says why. Fix that, then press **Continue from where it stopped**. Steps already done are skipped, so nothing is sent twice. It is safe to press twice.

### A step says "Not sure if this happened"

Hushwork started the step but never saw how it ended, for example because the connection dropped. The action may already have happened, so Hushwork did not send it again. Look in the app (is the email in your Sent folder?). If it was not done, press **It was not done, try again**.

### "This step already ran in this run, so it was not done a second time"

A writing step can be approved once per run. Run the workflow again to do it again.

### "What this step will send changed after you opened this page"

The words of the step are different from the card you read, for example because an Ask the AI step ran again. Nothing was sent. Reload the page, read the new words and press Approve again.

### "This step uses what the Ask the AI steps before it found. Approve those first"

A step uses `{answer}` or `{answers}`, but no Ask the AI step has been approved yet in this run. Approve the Ask the AI step first, then come back. See [Ask the AI and earlier answers](/docs/ai-writing).

### A step says "This is still the example value from the template"

Templates use made-up values, such as a Notion page id of all zeros or `your-name/your-repo`. Open the step in the Builder and put in your own.

### Notion says it cannot find the page, or is not allowed

Check the page id (the long code at the end of the page's address). The page also has to be shared with the connection: open the page, press the three dots, then **Connections**.

### A step is marked "Plan only"

It only describes what would happen and never does anything. Use **Do something in another app** to really send or create.

### My schedule ran, but nothing was sent

A schedule skips every step that writes unless you ticked **Let it write by itself** for that schedule. See [Schedules](/docs/schedules).

## Limits and switches

### "AI is switched off"

The person who runs this copy of Hushwork has not turned on the AI. Plans then use a simple keyword preview, and Ask the AI steps cannot be asked.

### "You have reached today's limit for AI steps. It resets at midnight UTC."

You used your 15 AI steps for the day (or 20 AI plans). Wait until midnight UTC. "You did that a moment ago. Try again in a minute." means the per-minute limit. See [Limits and numbers](/docs/limits).

### "Hushwork is paused right now as a safety step"

The owner flipped the pause switch. Nothing was sent and the AI was not asked, and nothing is lost. Try again later.

### "The free allowance at Composio is used up for now"

The owner's Composio plan has no uses left for now. Try again later.

### A web address was refused

"That address points to a private or internal place, so it was not contacted." Only https addresses of public websites work. Never put a password or key in an address.

## Related pages

- [How Hushwork keeps you in control](/docs/safety)
- [Runs and approvals](/docs/runs-and-approvals)
- [Glossary](/docs/glossary)
