# ACSEF 2027 Project Tracker

A single-page tracker for a Hitachi ACSEF 2027 middle school project (**Home Heat-Loss Detector**).
It has a deadline countdown, progress by phase, all tasks, key dates, the AI Use Log, the Experiment Log and a parts checklist.

**Live site:** https://rshivarkar.github.io/acsef-2027-tracker/

You can also download `index.html` and double-click it. It works offline with no install.

## Team names

Click **Add names** (under the dashboard) and type the Captain, Teammate and both parents' first names. Tasks, filters, logs and the Sheet's readable tabs then show names instead of roles.

- Owners are *Captain*, *Teammate*, *Both*, *Captain's parent*, *Teammate's parent*, or *Either parent*.
- The seeded parent tasks start as *Either parent*. Reassign each one in the task editor.
- Names are stored as tracker data, on each device and in the team Sheet when Sync is on. They are never in this public repo or the website code, so the live site shows roles until the names are entered (or synced) on that device.

## How data is saved

| Where | What | When |
|---|---|---|
| This device (browser storage) | Everything, including filters and open/closed phases | Instantly, on every change |
| Team Google Sheet (optional) | Tasks, logs, parts, phases, key dates | About 1 second after a change, if **Sync** is on |
| Backup file | Everything | When you click **Export** |

- **Offline:** changes stay on the device and are sent when the connection comes back (the Sync button shows *Offline*).
- **Two people editing at once:** the page merges changes task by task and row by row. If two people edit the *same* task at the same moment, the later save wins.
- **Import** and **Start over** replace the team copy for everyone (the page asks first).
- Each browser keeps its own copy. The live site and a downloaded `index.html` count as different browsers, so connect each one to Sync once.

## Team sync setup

A parent does this once, in about 5 minutes. It needs a Google account and no other services.

1. **Create the Sheet.** In Google Drive, create a new blank Google Sheet, for example *ACSEF Tracker Data*.
2. **Add the script.** In the Sheet, open **Extensions → Apps Script**. Delete the sample code and paste in everything from [`apps-script/Code.gs`](apps-script/Code.gs).
3. **Set the passcode.** Change `const PASSCODE = 'CHANGE-ME';` to a team passcode, then click **Save**. Share the passcode only with the team.
4. **Deploy.** Click **Deploy → New deployment**, click the gear, and choose **Web app**. Set:
   - *Execute as:* **Me**
   - *Who has access:* **Anyone**

   Click **Deploy** and allow access. Google shows *"Google hasn't verified this app"* because it is your own new script: click **Advanced → Go to … (unsafe)**. The script only asks for access to this one spreadsheet.
5. **Copy the Web app URL.** It ends in `/exec`.
6. **Connect each device.** On the tracker, click **Sync off** (top right). Paste the URL, type the passcode, pick who uses the device, and click **Connect**.
   - The first device uploads its data.
   - Every other device asks before loading the team copy.

The Sheet also gets readable **Tasks**, **AI Use Log**, **Experiment Log** and **Parts** tabs, so teachers or parents can look without opening the tracker. These tabs are rewritten on every save, so edits made there are not read back. The raw data is in a hidden `_tracker_state` tab; don't edit it.

**Optional:** put the Web app URL in `DEFAULT_SYNC_URL` near the top of the script in `index.html`. Then each device only needs the passcode. The URL is not secret by itself, because every request needs the passcode.

**Changing the script later:** open **Deploy → Manage deployments**, click the pencil, and choose **Version: New version**. This keeps the same URL.

**Undoing a mistake:** in the Sheet, use **File → Version history** to restore an earlier version, or **Import** an exported backup file.

**Security notes:**
- Anyone with both the URL and the passcode can read and change the tracker. Treat the passcode like a password.
- Change the passcode in `Code.gs` and deploy a new version if it leaks.
- Don't put private information (addresses, phone numbers) in notes.

## Fair rules the tracker reminds you of

- Low voltage only. Nothing wired to the furnace, AC or household power.
- No testing on people. No heaters, motors, chemicals or lasers.
- Say "detect", never "diagnose".
- Students write the Research Plan, abstract, poster and notebook in their own words.
- Log and cite all AI use.
- No Research Plan changes on or after Feb 1, 2027.

## Development

- `index.html`: the whole app (HTML, CSS and vanilla JavaScript; no build step).
- `apps-script/Code.gs`: the Google Sheet sync backend.
- `dev/mock-sync-server.mjs`: a local stand-in for the backend. Run `node dev/mock-sync-server.mjs`, then connect to `http://127.0.0.1:8787/` with passcode `local-test`.
- **Preview a date:** add `?today=2027-01-15` to the address to see what the page will look like on that day.
- `.github/workflows/deploy.yml`: on every push to `main`, it checks both scripts for syntax errors and publishes `index.html` to GitHub Pages.
