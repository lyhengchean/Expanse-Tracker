# Ledger — Setup Guide

A pure frontend expense tracker that writes directly to your Google Sheet. Host on GitHub Pages, free forever.

## What you get

- `index.html` — the frontend (drop into a GitHub repo)
- `Code.gs` — the Google Apps Script backend

## Step 1 — Create your Google Sheet

1. Go to [sheets.google.com](https://sheets.google.com) and create a **new blank spreadsheet**.
2. Name it something like **"My Expenses"**.
3. You don't need to add any columns — the script will create them.

## Step 2 — Add the Apps Script

1. In your sheet, click **Extensions → Apps Script**.
2. Delete the default `Code.gs` content.
3. Paste the contents of `Code.gs` from this project.
4. Click the **save** icon (💾). Name the project anything, e.g. "Ledger Backend".

## Step 3 — Deploy as a Web App

1. In the Apps Script editor, click **Deploy → New deployment**.
2. Click the gear icon next to "Select type" → choose **Web app**.
3. Fill in:
   - **Description**: Ledger v1
   - **Execute as**: **Me** (your email)
   - **Who has access**: **Anyone**
4. Click **Deploy**.
5. Google will ask for permissions — click **Authorize access**, pick your account, click **Advanced → Go to (project name) (unsafe) → Allow**. (It says "unsafe" because it's your own script, not verified by Google. It is safe; only you wrote it.)
6. Copy the **Web app URL**. It looks like:
   `https://script.google.com/macros/s/AKfycby.../exec`

> ⚠️ Save this URL. You'll paste it into the frontend.

## Step 4 — Test the frontend locally

1. Open `index.html` in your browser (just double-click it).
2. Paste the Web app URL into the input at the top and click **Save URL**.
3. Add a test expense. Open your Google Sheet — a new row should appear in the **Expenses** tab.

## Step 5 — Host on GitHub Pages

1. Create a new public repository on GitHub, e.g. `expense-tracker`.
2. Upload `index.html` to the repo root.
3. Go to **Settings → Pages**.
4. Under "Branch", select `main` and folder `/ (root)`. Click **Save**.
5. Wait ~1 minute. Your site will be live at:
   `https://YOUR_USERNAME.github.io/expense-tracker/`
6. Open it, paste your Apps Script URL, save — done.

## How it works

```
┌──────────────────────┐    fetch()    ┌───────────────────┐
│  GitHub Pages (UI)   │ ────────────▶ │  Apps Script URL  │
│  index.html + JS     │ ◀──────────── │  doGet / doPost   │
└──────────────────────┘    JSON       └─────────┬─────────┘
                                                 │
                                                 ▼
                                       ┌───────────────────┐
                                       │  Google Sheet     │
                                       │  Expenses + Stats │
                                       └───────────────────┘
```

- The Web app URL acts as your **secret endpoint** — anyone who has it can write to your sheet, but it's a long random string.
- No service account, no API key in your frontend code, nothing leaked on GitHub.
- The frontend stores your URL in `localStorage`, so each device just needs it pasted once.

## Updating the script later

If you change `Code.gs`:
- **Deploy → Manage deployments → ✏️ edit → Version: New version → Deploy**.
- The same URL keeps working.

## Optional ideas you can add later

- Categories (Food, Transport, etc.) — add a column in the sheet and a dropdown in the form.
- Monthly summaries — a chart in the sheet itself, or a new view in the UI.
- Multi-currency — add a "Currency" column.
- Edit / delete entries — add `doPost` actions `edit` and `delete` that take a row index.

## Security notes

- The Web app URL is a shared secret. Don't commit it to GitHub or post it publicly.
- Anyone with the URL can add rows. If that ever happens, redeploy to get a new URL (Deploy → New deployment).
- Your sheet stays private to your Google account; the Apps Script runs *as you*, so it has permission to edit *your* sheet without exposing your credentials.
