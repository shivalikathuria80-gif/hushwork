# Google (Gmail, Calendar, Drive, Sheets)

Press Connect Google once to let Hushwork read your calendar, inbox headers and Drive file names, and add rows to a sheet you name.

## What happens when you connect

On the **Connections** page, find the box called **Google (Calendar, Sheets, Gmail and Drive)** and press **Connect Google**. Google shows you four permissions. You press **Allow**. Hushwork then keeps the permission Google gives it, scrambled (encrypted), until you press **Disconnect**.

## Exactly what is read

- **Calendar:** the next events in the coming 7 days, up to 10. Hushwork gets the start time and title. It cannot add, change or delete events.
- **Gmail inbox:** the latest 10 messages. For each one Hushwork reads only who sent it, the subject and the time. It does not read the text of an email. The permission cannot send, change or delete mail.
- **Drive:** the name, kind (Doc, Sheet, PDF and so on) and time of the 10 files you changed most recently. It never opens a file. It cannot change or delete files.
- **Sheets:** nothing is read. See the next part.

## What it can write

Only one thing: an **Add a row** step puts one new row at the bottom of a Google Sheet whose web address you wrote in the step. Hushwork's code sends one request, "add a row", and nothing else. You read the exact boxes on the approval card and press **Approve and add the row**. Each box is written as plain text, so something like `=1+1` is never run as a formula. A row can have up to 20 boxes of up to 100 characters each.

> **Note:** Google's own permission screen says "spreadsheets". That is the narrowest permission Google offers for writing into an existing sheet, and it is wider than what Hushwork does. Hushwork's code only ever sends "add a row".

## The Gmail text opt-in

By default the AI sees only senders, subjects and times. In an **Ask the AI** step you can pick **My Gmail inbox, with the text of each email**. Then Hushwork also reads the opening of your 5 newest emails, about the first 450 characters of each. Quoted old messages, signatures and links are cut out first. That text is sent to Groq, the company that runs the AI, together with your request. The email text is not kept. Only the AI's answer is saved in your runs.

Nothing reads email text unless a step you wrote asks for it. In Manual mode you also press Approve on that step first.

## What it can never do

- Send, change or delete an email.
- Read the text of an email in a normal inbox lookup.
- Open, change or delete a Drive file.
- Add, change or delete a calendar event. (Adding events goes through a different connection. See [Google Workspace through Composio](/docs/connect-google-workspace).)
- Read or change other cells in your sheets.

## Google's review and the warning screen

Google treats the Gmail read permission as a restricted one. Until Google has reviewed Hushwork, only people the owner added as test users can connect Google. Google may also show "Google hasn't verified this app". If you are a test user, press **Advanced**, then **Go to Hushwork**. While the app is in Testing, Google asks you to connect again every 7 days.

If you want to use Hushwork without that, you can skip Connect Google and use only the apps that go through Composio. Gmail sending is separate and does not need Connect Google.

## If you connected before Gmail or Drive was added

Press **Disconnect** under Google, then **Connect Google** again and tick every box on Google's screen. Google then asks for the newer permissions.

## Related pages

- [Connections overview](/docs/connections)
- [Privacy and what the AI sees](/docs/privacy)
- [Troubleshooting and FAQ](/docs/troubleshooting)
