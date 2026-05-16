# Ledger v3.1 — Bug-Fix Update

This release fixes the bug where **income entries showed up as red expenses** in the activity list (visible especially on mobile).

## Why it happened

When you added income, the Apps Script was supposed to write `"income"` into a `Type` column on the row. But if that column didn't exist yet when the row was added (or if it was written before the script properly migrated the sheet), the row ended up with a blank `Type` — and the frontend defaulted blanks to `"expense"`. So the Income row got rendered red on every refresh.

## What's fixed in v3.1

### Backend (`Code.gs`)
- **Always writes `Type` explicitly** on every new row, including the column header before the first write.
- **Uses `LockService`** so two near-simultaneous writes can't race each other.
- New **`fixExistingRows()`** function — run it once from the Apps Script editor to repair any old rows where Type is blank or garbled.

### Frontend (`script.js`)
- **Defensive type classifier**: if the sheet returns a row with a missing/garbled Type, the UI now scans the description for keywords (Salary, Income, Bonus, Refund, Gift, Freelance, Wage, Paycheck) AND treats negative amounts as income. So even if a bad row slipped through, the UI will display it correctly.
- All amount math uses `Math.abs()` so a negative number in the sheet can't break stats.

### Styles (`styles.css`)
- Fixed mobile layout: action buttons (`Add income` + `Update wallet`) now sit full-width on their own row below the balance, instead of overlapping or pushing into the wallet card.
- Tightened padding on small screens.
- Sticky day headers now use a solid background variable that matches the theme, so they don't show through when scrolling on mobile.

---

## How to apply the fix

### Step 1 — Replace the Apps Script

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Delete everything in `Code.gs`.
3. Paste in the new `Code.gs` from this release.
4. **Save (💾)**.
5. Important: **Deploy → Manage deployments → ✏️ (pencil) → Version: New version → Deploy**.
   - The URL stays the same; no need to update the frontend.

### Step 2 — Repair existing rows (do this once)

1. In the Apps Script editor, click the function dropdown at the top (next to the Run button) and pick **`fixExistingRows`**.
2. Click **▶ Run**.
3. You'll see a toast in your sheet like "Fixed N row(s)".

What it does:
- Any row with a valid Type (`income` / `expense`) is left alone.
- Any row with a blank/invalid Type is set to `expense` by default, UNLESS the description contains a keyword like Salary, Income, Bonus, Refund, Gift, Freelance, etc. — in which case it's set to `income`.
- Rows with negative amounts are also set to `income`.

After this runs, refresh your Ledger page — the Income row should now appear blue with an upward arrow.

If the heuristic guessed wrong on any row, just open the sheet directly and edit the Type cell (column D) to either `expense` or `income`. The script will respect it.

### Step 3 — Replace the three frontend files

Upload these to your GitHub repo (replacing the old ones):
- `index.html`
- `styles.css`
- `script.js`

The HTML doesn't need to change (it's the same as v3), but you can re-upload to be safe.

GitHub Pages picks up the changes in ~30 seconds. **Hard-refresh** your browser tab (Ctrl+Shift+R / Cmd+Shift+R) to bypass the cache.

---

## Files in this release

| File | Status |
|---|---|
| `Code.gs` | Updated — replace and redeploy |
| `script.js` | Updated — replace |
| `styles.css` | Updated — replace |
| `index.html` | Same as v3 (re-upload anyway to be safe) |
| `README.md` | This file |

---

## How to verify the fix worked

After replacing all files and running `fixExistingRows`:

1. Reload the page (hard refresh).
2. The Activity list should show your Income row in **blue** with an **upward ↑ arrow** and a **+$X.XX** amount.
3. The "net" line should now read `−$6.25` instead of `−$7.25` (because the $1 income is netted in correctly).
4. Add a new test income (e.g. $1, source "Test") — it should appear in blue immediately.
5. Open the Google Sheet — every row in the Expenses tab should now have either `income` or `expense` in column D.

If the Income still shows as expense even after `fixExistingRows`:
- Open the sheet directly.
- Find the Income row in the Expenses tab.
- In column D (Type), type `income` (lowercase).
- Refresh the page.

---

## Wallet math, explained

Sometimes the math looks confusing. Here's the rule:

```
Available Balance  =  Wallet  −  Σ all expenses
```

Income does **not** subtract from the balance. Income **increases** the Wallet directly when you click Add Income. So:

- Wallet $105.25 + $1 income → Wallet becomes $106.25
- Then $7.25 expenses → Available = 106.25 − 7.25 = **$99.00** ✓

If your numbers look off, double-check by opening the Settings tab in your Google Sheet — cell B2 holds the Wallet value. Any direct edit there will instantly affect the Available Balance.