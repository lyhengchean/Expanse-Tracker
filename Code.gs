/**
 * Ledger — Expense Tracker Backend (Google Apps Script)
 * ------------------------------------------------------
 * Paste this into the Apps Script editor of your Google Sheet.
 *
 * Sheet layout (auto-created on first use):
 *   Sheet "Expenses": Date | Description | Amount
 *   Sheet "Settings": stores the "Available" amount in cell B1
 *
 * Deploy:  Deploy → New deployment → Type: Web app
 *          Execute as: Me · Who has access: Anyone
 *          Copy the /exec URL and paste it into the frontend.
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

// ---------- POST: add an entry / set available ----------
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'add';

    if (action === 'add') {
      const date = body.date;
      const description = String(body.description || '').trim();
      const amount = Number(body.amount);

      if (!date)            return jsonOut({ ok: false, error: 'Missing date' });
      if (!description)     return jsonOut({ ok: false, error: 'Missing description' });
      if (!isFinite(amount) || amount <= 0)
        return jsonOut({ ok: false, error: 'Invalid amount' });

      addEntry(date, description, amount);

      // Optional: update available amount
      if (body.setAvailable !== undefined && body.setAvailable !== null && isFinite(body.setAvailable)) {
        setAvailable(Number(body.setAvailable));
      }

      return jsonOut({ ok: true, entries: getEntries(), available: getAvailable() });
    }

    if (action === 'setAvailable') {
      const v = Number(body.amount);
      if (!isFinite(v)) return jsonOut({ ok: false, error: 'Invalid amount' });
      setAvailable(v);
      return jsonOut({ ok: true, available: getAvailable() });
    }

    return jsonOut({ ok: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) });
  }
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
  }
  return sh;
}

function addEntry(date, description, amount) {
  const sh = getSheet(EXPENSES_SHEET, ['Date', 'Description', 'Amount']);
  sh.appendRow([date, description, amount]);
}

function getEntries() {
  const sh = getSheet(EXPENSES_SHEET, ['Date', 'Description', 'Amount']);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const rows = sh.getRange(2, 1, lastRow - 1, 3).getValues();
  return rows
    .filter(r => r[0] !== '' && r[2] !== '')
    .map(r => ({
      date: r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(r[0]),
      description: String(r[1] || ''),
      amount: Number(r[2] || 0),
    }));
}

function getAvailable() {
  const sh = getSheet(SETTINGS_SHEET, ['Key', 'Value']);
  // Ensure row exists
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
