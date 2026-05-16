/**
 * Ledger v3 — Expense & Income Tracker Backend (Google Apps Script)
 * ------------------------------------------------------------------
 * Paste this into the Apps Script editor of your Google Sheet.
 *
 * Sheet layout (auto-created / auto-migrated on first use):
 *   Sheet "Expenses": Date | Description | Amount | Type
 *     - Type: "expense" or "income"  (old rows without Type are treated as "expense")
 *   Sheet "Settings": stores the "Available" amount in cell B2
 *
 * Deploy:  Deploy → Manage deployments → ✏️ → Version: New version → Deploy
 *          (re-deploying keeps the same URL; first time use Deploy → New deployment)
 *          Type: Web app · Execute as: Me · Who has access: Anyone
 */

const EXPENSES_SHEET = 'Expenses';
const SETTINGS_SHEET = 'Settings';

// ---------- GET: list entries + available ----------
function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'list';
    if (action === 'list') {
      return jsonOut({ ok: true, entries: getEntries(), available: getAvailable() });
    }
    return jsonOut({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// ---------- POST: add an entry / set available / add income ----------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'add';

    if (action === 'add') {
      return handleAdd(body, 'expense');
    }

    if (action === 'addIncome') {
      const result = handleAdd(body, 'income');
      // For income, ALSO add to available (wallet grows)
      const parsed = JSON.parse(result.getContent());
      if (parsed.ok) {
        const newAvail = getAvailable() + Number(body.amount);
        setAvailable(newAvail);
        return jsonOut({ ok: true, entries: getEntries(), available: getAvailable() });
      }
      return result;
    }

    if (action === 'setAvailable') {
      const v = Number(body.amount);
      if (!isFinite(v)) return jsonOut({ ok: false, error: 'Invalid amount' });
      setAvailable(v);
      return jsonOut({ ok: true, available: getAvailable(), entries: getEntries() });
    }

    return jsonOut({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
}

// ---------- shared add handler ----------
function handleAdd(body, type) {
  const date = body.date;
  const description = String(body.description || '').trim();
  const amount = Number(body.amount);

  if (!date)            return jsonOut({ ok: false, error: 'Missing date' });
  if (!description)     return jsonOut({ ok: false, error: 'Missing description' });
  if (!isFinite(amount) || amount <= 0)
    return jsonOut({ ok: false, error: 'Invalid amount' });

  addEntry(date, description, amount, type);
  return jsonOut({ ok: true, entries: getEntries(), available: getAvailable() });
}

// ---------- helpers ----------
function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function getSheet(name, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (headers && headers.length) {
      sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  } else if (name === EXPENSES_SHEET) {
    // Migrate old layout: if column D (Type) header is missing, add it
    const lastCol = sh.getLastColumn();
    if (lastCol < 4) {
      sh.getRange(1, 4).setValue('Type').setFontWeight('bold');
    }
  }
  return sh;
}

function addEntry(date, description, amount, type) {
  const sh = getSheet(EXPENSES_SHEET, ['Date', 'Description', 'Amount', 'Type']);
  sh.appendRow([date, description, amount, type || 'expense']);
}

function getEntries() {
  const sh = getSheet(EXPENSES_SHEET, ['Date', 'Description', 'Amount', 'Type']);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const rows = sh.getRange(2, 1, lastRow - 1, 4).getValues();
  return rows
    .filter(r => r[0] !== '' && r[2] !== '')
    .map(r => ({
      date: r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(r[0]),
      description: String(r[1] || ''),
      amount: Number(r[2] || 0),
      type: String(r[3] || 'expense').toLowerCase() === 'income' ? 'income' : 'expense',
    }));
}

function getAvailable() {
  const sh = getSheet(SETTINGS_SHEET, ['Key', 'Value']);
  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, 1, 2).setValues([['Available', 0]]);
  }
  const v = sh.getRange(2, 2).getValue();
  return Number(v || 0);
}

function setAvailable(v) {
  const sh = getSheet(SETTINGS_SHEET, ['Key', 'Value']);
  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, 1, 2).setValues([['Available', v]]);
  } else {
    sh.getRange(2, 2).setValue(v);
  }
}