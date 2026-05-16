/**
 * Ledger v3.1 — Expense & Income Tracker Backend (Google Apps Script)
 * --------------------------------------------------------------------
 * Paste this into the Apps Script editor of your Google Sheet.
 *
 * Sheet layout (auto-created / auto-migrated on first use):
 *   Sheet "Expenses": Date | Description | Amount | Type
 *     - Type: "expense" or "income"
 *   Sheet "Settings": stores the "Available" amount in cell B2
 *
 * Deploy:  Deploy → Manage deployments → ✏️ → Version: New version → Deploy
 *
 * If you have OLD rows that look wrong (e.g. an income shown as expense),
 * open this script and click Run → fixExistingRows once. It will set the
 * Type column for any rows missing it, defaulting blanks to "expense"
 * unless the description matches a common income keyword.
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

// ---------- POST: add / setAvailable / addIncome ----------
function doPost(e) {
  // LockService prevents two near-simultaneous writes from racing each other
  const lock = LockService.getScriptLock();
  lock.tryLock(10000);

  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action || 'add';

    if (action === 'add') {
      const result = handleAdd(body, 'expense');
      return result;
    }

    if (action === 'addIncome') {
      // Validate first
      const date = body.date;
      const description = String(body.description || '').trim() || 'Income';
      const amount = Number(body.amount);

      if (!date)            return jsonOut({ ok: false, error: 'Missing date' });
      if (!isFinite(amount) || amount <= 0)
        return jsonOut({ ok: false, error: 'Invalid amount' });

      // Append entry with explicit 'income' type
      addEntry(date, description, amount, 'income');

      // Bump available
      const newAvail = getAvailable() + amount;
      setAvailable(newAvail);

      return jsonOut({ ok: true, entries: getEntries(), available: newAvail });
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
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
}

// ---------- shared add handler (expense) ----------
function handleAdd(body, type) {
  const date = body.date;
  const description = String(body.description || '').trim();
  const amount = Number(body.amount);

  if (!date)            return jsonOut({ ok: false, error: 'Missing date' });
  if (!description)     return jsonOut({ ok: false, error: 'Missing description' });
  if (!isFinite(amount) || amount <= 0)
    return jsonOut({ ok: false, error: 'Invalid amount' });

  addEntry(date, description, amount, type || 'expense');
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
    // Migrate old layout: if column D (Type) header missing, add it
    const lastCol = sh.getLastColumn();
    if (lastCol < 4) {
      sh.getRange(1, 4).setValue('Type').setFontWeight('bold');
    }
  }
  return sh;
}

function addEntry(date, description, amount, type) {
  const sh = getSheet(EXPENSES_SHEET, ['Date', 'Description', 'Amount', 'Type']);
  // ALWAYS write a non-empty type — never let it default to blank
  const cleanType = (String(type || '').toLowerCase() === 'income') ? 'income' : 'expense';
  sh.appendRow([date, description, amount, cleanType]);
}

function getEntries() {
  const sh = getSheet(EXPENSES_SHEET, ['Date', 'Description', 'Amount', 'Type']);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const rows = sh.getRange(2, 1, lastRow - 1, 4).getValues();
  return rows
    .filter(r => r[0] !== '' && r[2] !== '')
    .map((r, idx) => {
      const rawType = String(r[3] || '').toLowerCase().trim();
      // Be tolerant: anything that looks like income counts as income
      const isIncome = rawType === 'income' || rawType === 'in' || rawType === '+';
      return {
        rowIndex: idx + 2,   // helpful if you ever want to delete/edit
        date: r[0] instanceof Date ? Utilities.formatDate(r[0], Session.getScriptTimeZone(), 'yyyy-MM-dd') : String(r[0]),
        description: String(r[1] || ''),
        amount: Number(r[2] || 0),
        type: isIncome ? 'income' : 'expense',
      };
    });
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

// ===================================================================
// ONE-TIME REPAIR FUNCTION
// Run this manually if old rows are showing wrong type. From the script
// editor: select fixExistingRows from the function dropdown → click Run.
// ===================================================================
function fixExistingRows() {
  const sh = getSheet(EXPENSES_SHEET, ['Date', 'Description', 'Amount', 'Type']);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) {
    Logger.log('No rows to fix.');
    return;
  }
  const range = sh.getRange(2, 2, lastRow - 1, 3); // B:D — Description, Amount, Type
  const values = range.getValues();
  let changed = 0;

  // Treat these description keywords as income if Type is missing
  const incomeKeywords = ['salary', 'income', 'paycheck', 'wage', 'bonus', 'refund', 'gift', 'freelance', 'transfer in'];

  const updated = values.map(row => {
    const desc = String(row[0] || '').toLowerCase();
    const amount = Number(row[1] || 0);
    const currentType = String(row[2] || '').toLowerCase().trim();

    if (currentType === 'income' || currentType === 'expense') {
      return row; // already valid
    }

    // Heuristic: missing type → assume expense, unless description hints at income
    let newType = 'expense';
    for (const kw of incomeKeywords) {
      if (desc.includes(kw)) { newType = 'income'; break; }
    }
    // Negative amounts in the sheet → also treat as income deposits historically
    if (amount < 0) newType = 'income';

    row[2] = newType;
    changed++;
    return row;
  });

  range.setValues(updated);
  Logger.log('Updated ' + changed + ' rows.');
  SpreadsheetApp.getActive().toast('Fixed ' + changed + ' row(s)', 'Ledger', 5);
}