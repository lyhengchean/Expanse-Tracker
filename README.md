# Ledger v3 — Setup Guide

A pure frontend expense + income tracker that writes directly to your Google Sheet. Host on GitHub Pages, free forever.

## What's new in v3

- **Income tracking** — got paid? click **Add income** to bump your wallet up. Logged as an entry with type `income`, color-coded blue (↑).
- **Update wallet** is now strictly for **overwriting** the total (a fresh start). Income is the additive action.
- **Activity grouped by day** with sticky day headers (Today, Yesterday, etc.) and per-day net totals (+$50 / −$12.50).
- **Year + Month filters** so old data stays browsable. Pick "All months" to see a whole year.
- **Jump-to-Today button** snaps the filter back to the current month instantly.
- On every **page refresh**, the filter auto-resets to the current month (and the date input defaults to today).
- **Split into 3 files**: `index.html`, `styles.css`, `script.js` for clean editing.

## Files

| File | What's in it |
|---|---|
| `index.html` | Page structure only — links to CSS and JS |
| `styles.css` | All styling (dark + light theme, animations) |
| `script.js` | All app logic (state, API calls, filters, render) |
| `Code.gs` | Apps Script backend — paste into Google Apps Script |
| `README.md` | This file |

## Step 1 — Update your Apps Script

1. Open your Google Sheet → **Extensions → Apps Script**.
2. **Replace** the existing `Code.gs` with the new one from this project.
3. Click save (💾).
4. **Deploy → Manage deployments → ✏️ edit (pencil) → Version: New version → Deploy**.
5. Same URL keeps working. No need to re-paste in the frontend.

The new script auto-adds a `Type` column to your existing Expenses sheet. Old rows without a type are treated as expenses, so nothing breaks.

## Step 2 — Upload the three frontend files to GitHub

If your repo is already set up:

1. Upload `index.html`, `styles.css`, and `script.js` to the **root** of your repo (replace any older ones).
2. Commit. GitHub Pages updates automatically in ~30 seconds.

If starting fresh, follow the v1 README steps but upload all three files instead of just one.

⚠️ Important: all three files must sit in the **same folder**, because `index.html` references them by relative path:
```html
<link rel="stylesheet" href="styles.css">
<script src="script.js"></script>
```

## Step 3 — Test it

1. Open your GitHub Pages URL.
2. The page should load with this month already filtered, today's date pre-filled in the form, and your existing entries grouped by day.
3. Try **Add income** with $100 — wallet should grow by $100, and a blue ↑ entry should appear under today.
4. Try **Update wallet** with $500 — wallet should become exactly $500 (overwrites, doesn't add).
5. Change the **Year** or **Month** filter to view past data.
6. Click **Today** in the filter bar to snap back.

## Activity grouping logic

- Filter by **Year + Month** (or pick "All months" for a full year).
- Within the view, entries are grouped by **day**, newest day first.
- Each day shows: weekday + date, relative label (Today / Yesterday), and the **net for that day** (positive = green income, negative = red expense).
- Within a day: income shown first (↑ blue), then expenses (↓ red).

## Income vs Update wallet — quick mental model

| Action | What it does | Logged as entry? |
|---|---|---|
| **Add income** | wallet `+=` amount | ✅ Yes (type: income) |
| **Update wallet** | wallet `=` amount | ❌ No (just resets the number) |
| **Record expense** | spending logged | ✅ Yes (type: expense) |

The hero **Available balance** is calculated as:
```
available = wallet − sum(all expenses)
```
Income adds to wallet directly, so it shows up in your available balance immediately.

## Optional ideas for later

- Categories (Food, Transport, Bills) — add a column to the sheet + dropdown to the form.
- Delete / edit entries — add `delete` and `edit` actions to the Apps Script.
- Export to CSV — already built in via the Google Sheet itself (File → Download → CSV).
- Multi-currency — add a currency column and a converter.

## Security reminder

The Apps Script Web App URL is a shared secret. Don't commit it to a public repo unless you're okay with anyone who finds it being able to write rows. If that ever happens, redeploy under a new version (Deploy → New deployment) for a fresh URL.

Your sheet stays private to your Google account.