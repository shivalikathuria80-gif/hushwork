# Your account and your data

You sign in with an email and a password, and on the Settings page you can download a copy of your data or delete your account.

## Sign up and sign in

Open the sign-in page. It has two choices: **Sign in** and **Create account**.

- **Create account:** type your email address and a password, then press **Create account**.
- **Sign in:** type the same two things and press **Sign in**.
- The eye button (**Show password**) lets you check what you typed.

If you see "Check your email," your copy of Hushwork asks you to confirm your address first. Open the message, confirm, then sign in.

To leave, press **Sign out** at the bottom of the menu.

### Password rules

- At least **10 characters**, and no more than **64**.
- Spaces are allowed. A short sentence you will remember works well.
- Emoji and some non-Latin letters use more space than normal letters. A password that is too long in that way is refused with a message.
- Hushwork checks new passwords against a list of leaked passwords. Only the first 5 characters of the password's fingerprint leave Hushwork, never the password itself. If that check is down, sign-up still works.

### Too many tries

If you try too often you see "Too many attempts. Wait a few minutes and try again." This slows down anyone guessing a password.

## The Settings page

Open **Settings** from the menu. It has four sections:

1. **Account:** shows the email you are signed in with, plus **Download my data** and **Delete my account**.
2. **Appearance:** switch between **Light mode** and **Dark mode**. The choice stays in this browser.
3. **AI planning:** says whether AI planning is on, and that you get up to 20 AI plans a day.
4. **Memory:** short facts the AI can use. See [Memory](/docs/memory).

## Download my data

Press **Download my data** to save one JSON file (a plain text file that other programs can read). It holds:

- your workflows,
- your 500 newest runs,
- your schedules,
- the facts saved in Memory.

Saved app connections are **never** in it, because they hold sign-in tokens that never leave the server.

## Delete my account

> **Careful:** Deleting your account cannot be undone.

1. Press **Delete my account**.
2. Read the warning. It says your account, workflows, runs, schedules and saved connections are deleted, and apps connected through Composio are disconnected.
3. Type `delete my account` in the box.
4. Press **Delete everything**. Or press **Keep my account** to go back.

The button stays off until you type the words exactly. If the server is not set up to delete accounts, Hushwork says so and tells you to open an issue on the project's GitHub page.

## Your data stays yours

You only ever see your own workflows and runs. The database itself enforces this, in addition to Hushwork's own checks. For what is sent to the AI, read [Privacy and what the AI sees](/docs/privacy).

## Try it

1. Open **Settings**.
2. Press **Download my data** and open the file in a text editor.
3. Switch the theme to **Dark mode** and back.
4. Do **not** press Delete unless you really want to leave.
