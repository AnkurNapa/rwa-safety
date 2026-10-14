# Resident Safety

A residents' initiative to get safety problems fixed at Godrej Park Retreat. It is not an official app of the society, its committee or Godrej Properties. The app says so on the home screen, in the privacy notice and on the poster.

Residents report safety problems (lifts, fire, gas, wiring, structure, security, danger to children) from their phone with no login. It works in 11 languages: English, Hindi, Kannada, Bangla, Odia, Punjabi, Tamil, Telugu, Malayalam, Marathi and Gujarati. Reports can carry photos or a voice note of up to 2 minutes. Reports land in Google Sheets under napaankur@gmail.com. Monitors see counts and tickets but never who sent them.

Urgent categories (lift stuck, fire or smoke, gas, electrical danger, flooding near wiring) show the 112, 101 and 108 call buttons and the safety WhatsApp group at once. The optional questions fold away and MyGate is optional. A voice note or a photo is enough without typing. You get an email the moment an urgent report lands.

The app opens on a home screen with the 112, 101 and 108 call buttons. It also has a one-tap call card for the Johnson Lifts breakdown line (080 2320 1400 to 1403, set in `LIFT_HELPLINE`). A report takes four short steps: what, where, details, send. After sending, the resident can tap one button to open WhatsApp with the report typed in. They choose the safety group and press send. WhatsApp does not let a website post into a group by itself, so this last tap stays with the resident. Their name and number show in the group. The form tells them so.

`preview.html` is a local copy for looking at the screens. Its Send button saves nothing.

## What gets created

| Item | Who can open it |
|---|---|
| `Complaints PRIVATE (data contact only)` sheet | You only. Holds optional contact details |
| `Complaints for monitors` sheet, tabs `Triage` and `Dashboard` | Monitors as editors. They can change Status and Action note only |
| `Photos` folder | Monitors as viewers |

Google shares whole files, not single tabs. That is why contact details sit in a separate sheet that you never share.

## Set up (about 20 minutes)

1. Sign in to Google as napaankur@gmail.com and open https://script.google.com. Click **New project** and name it `RWA complaint portal`.
2. Replace the contents of `Code.gs` with this folder's `Code.gs`.
3. Click **+** next to Files, choose **HTML** and name it `Index`. Paste this folder's `Index.html`. Add a second HTML file named `I18n` and paste `I18n.html` (the translations).
4. Check the `CONFIG` block at the top of `Code.gs`. Check the initiative name and the towers. If you change a category, change `EN_CAT` in `I18n.html` the same way and add its translations.
5. Choose `selfTest` in the function menu and click **Run**. Approve the permissions prompt. The log should say `selfTest passed`.
6. Choose `setup` and click **Run**. Approve the extra permission to send email (used only for urgent alerts). The log prints the links to both sheets and the photos folder.
7. Click **Deploy > New deployment > Web app**. Set **Execute as: Me** and **Who has access: Anyone**. Copy the web app URL.
8. Share `Complaints for monitors` with each monitor as Editor. Share the `Photos` folder as Viewer. Never share the private sheet or the parent folder.
9. Open the URL on your phone without logging in and send two test tickets with a photo. Check both sheets and the Dashboard. Then set the test rows to Closed with the note "test".
10. Make a QR code of the URL and put it in the lifts and on the notice board.

After any later edit to the code, use **Deploy > Manage deployments > Edit > New version** so the same URL keeps working.

## Running it

- **Monitors** work from `Triage`. They set Status (New, Under review, Action taken, Closed) and write an Action note. The Last updated column stamps itself.
- **Dashboard** shows totals, open tickets, tickets open over 7 days, urgent tickets still open, MyGate tickets that were never fixed and counts by category, tower, status, MyGate outcome and month.
- **Voice notes** sit in the Photos folder next to the photos, named like `TKT-0007-voice.webm`. A voice can identify the reporter, so monitors must not share or forward them.
- **Retention.** Every night at 3 am the script erases the description, photos, exact spot and contact details of tickets closed more than 180 days ago. Category, tower and dates stay for the counts.
- **Erasure request.** Open the script, put the ticket number into `deleteOnRequest`, run it and reply to the resident within 7 days.
- **Reply to a reporter.** Only you can see contact details in the private sheet. Reply from napaankur@gmail.com and never forward the address to a monitor.
- **Breach.** If a sheet is shared by mistake or leaks, remove access straight away. Then tell the affected residents and report it to the Data Protection Board of India. Keep a dated note of what happened.

## Before launch

- [ ] You understand that, as coordinator, you are personally the Data Fiduciary under the DPDP Act. The society is not. Keep the retention, erasure and breach steps above.
- [ ] Each monitor has signed the note below
- [ ] Test tickets checked on two phones, one Android and one iPhone

## Note for monitors (print, sign and keep a copy)

> I will handle reports from the resident complaint portal in confidence. I will use them only to follow up safety problems for this residents' initiative. I will not try to find out who sent a report. I will not download, screenshot, forward or post reports or photos in any WhatsApp group or elsewhere. I will blur faces and flat numbers before any photo is shared with the committee or a vendor. I will tell the data contact straight away if I think data has been exposed. When I stop being a monitor I will delete anything I hold and give up my access.
>
> Name: ______________ Flat: ______ Signature: ______________ Date: __________

## Limits

- The spam limit is one shared cap of 60 reports an hour, because Apps Script cannot see who is sending. Raise it if a real surge ever gets blocked.
- Your email address shows in the privacy notice. A separate address such as a dedicated Gmail for the initiative would keep your personal inbox out of it. Change `CONTACT_EMAIL` and redeploy.

## The phone app on GitHub Pages

The same screens also run at https://ankurnapa.github.io/rwa-safety/ as an installable phone app with its own icon. Residents open the link and choose **Add to Home Screen**. The page sends each report to the Apps Script web app, which writes it to your sheets as before.

Until it is connected, the site shows a red DEMO MODE banner and saves nothing. To connect it:

1. Finish the Apps Script setup above and copy the web app URL (it ends in `/exec`).
2. Paste that URL into `backend-url.txt` on its own line.
3. Run `node tools/build_site.js`. It rebuilds `docs/` and the banner goes away.
4. Commit and push. GitHub Pages updates within a minute or two.
5. Run `python3 make_poster.py "https://ankurnapa.github.io/rwa-safety/"` for the lift poster.

After any change to `Code.gs`, `Index.html` or `I18n.html`, update the Apps Script project, then run step 3 and push again.
