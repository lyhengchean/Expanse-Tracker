// ============ CONFIG ============
// Apps Script Web App URL — baked in.
const API_URL = 'https://script.google.com/macros/s/AKfycbzPUs1wqxA3FY3kZ3N5z98OBvnXpj5H0vXfVXwMEsewtwh3RNyYou1coDfgT3YyYy3vfQ/exec';

// ============ STATE ============
let entries = [];          // all entries (expenses + income), unified
let availableAmount = 0;
let currentFilter = { year: null, month: null }; // null month = "All"

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

// ============ ELEMENTS ============
const dateInput   = document.getElementById('dateInput');
const descInput   = document.getElementById('descInput');
const amountInput = document.getElementById('amountInput');
const submitBtn   = document.getElementById('submitBtn');
const refreshBtn  = document.getElementById('refreshBtn');
const statusEl    = document.getElementById('status');
const ledgerEl    = document.getElementById('ledger');
const entriesSub  = document.getElementById('entriesSub');
const todayLabel  = document.getElementById('todayLabel');

const heroAmount = document.getElementById('heroAmount');
const heroInt    = document.getElementById('heroInt');
const heroFrac   = document.getElementById('heroFrac');
const heroTotal  = document.getElementById('heroTotal');
const heroCount  = document.getElementById('heroCount');
const heroStatus = document.getElementById('heroStatus');

const statBudget = document.getElementById('statBudget');
const statToday  = document.getElementById('statToday');
const statMonth  = document.getElementById('statMonth');
const statTodayFoot = document.getElementById('statTodayFoot');
const statMonthFoot = document.getElementById('statMonthFoot');

// Wallet modal
const walletBtn    = document.getElementById('walletBtn');
const walletModal  = document.getElementById('walletModal');
const walletInput  = document.getElementById('walletInput');
const walletSave   = document.getElementById('walletSave');
const walletStatus = document.getElementById('walletStatus');
const walletCurrent= document.getElementById('walletCurrent');

// Income modal
const incomeBtn    = document.getElementById('incomeBtn');
const incomeModal  = document.getElementById('incomeModal');
const incomeAmount = document.getElementById('incomeAmount');
const incomeSource = document.getElementById('incomeSource');
const incomeSave   = document.getElementById('incomeSave');
const incomeStatus = document.getElementById('incomeStatus');
const incomeCurrent= document.getElementById('incomeCurrent');

// Filters
const filtersEl    = document.getElementById('filters');
const yearFilter   = document.getElementById('yearFilter');
const monthFilter  = document.getElementById('monthFilter');
const jumpTodayBtn = document.getElementById('jumpToday');

// ============ THEME ============
const THEME_KEY = 'ledger_theme_v1';
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeColor = theme === 'light' ? '#f6f7f4' : '#0a0b10';
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', themeColor));
}
function getInitialTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === 'light' || saved === 'dark') return saved;
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}
applyTheme(getInitialTheme());

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(THEME_KEY, next);
}

// ============ INIT ============
function init() {
  const now = new Date();
  todayLabel.textContent = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  dateInput.value = localDateString(now);

  // Default filter to current year + month
  currentFilter.year = now.getFullYear();
  currentFilter.month = now.getMonth(); // 0-indexed

  refreshBtn.addEventListener('click', () => loadEntries(true));
  submitBtn.addEventListener('click', submitEntry);
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Wallet modal
  walletBtn.addEventListener('click', openWalletModal);
  walletSave.addEventListener('click', saveWallet);
  walletInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveWallet(); });

  // Income modal
  incomeBtn.addEventListener('click', openIncomeModal);
  incomeSave.addEventListener('click', saveIncome);
  [incomeAmount, incomeSource].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') saveIncome(); });
  });

  // Modal close buttons (both modals via data-close)
  document.querySelectorAll('.modal-close').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.close));
  });
  [walletModal, incomeModal].forEach(m => {
    m.addEventListener('click', (e) => { if (e.target === m) closeModal(m.id); });
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (walletModal.classList.contains('open')) closeModal('walletModal');
      if (incomeModal.classList.contains('open')) closeModal('incomeModal');
    }
  });

  // Wallet preset buttons (SET behavior)
  document.querySelectorAll('.preset-btn[data-set]').forEach(btn => {
    btn.addEventListener('click', () => {
      walletInput.value = parseFloat(btn.dataset.set).toFixed(2);
      walletInput.focus();
    });
  });

  // Income preset buttons (ADD behavior — fills with the preset amount)
  document.querySelectorAll('.preset-btn[data-income]').forEach(btn => {
    btn.addEventListener('click', () => {
      const add = parseFloat(btn.dataset.income) || 0;
      const current = parseFloat(incomeAmount.value) || 0;
      incomeAmount.value = (current + add).toFixed(2);
      incomeAmount.focus();
    });
  });

  // Filter events
  yearFilter.addEventListener('change', () => {
    currentFilter.year = parseInt(yearFilter.value, 10);
    rebuildMonthFilter();
    render();
  });
  monthFilter.addEventListener('change', () => {
    const v = monthFilter.value;
    currentFilter.month = v === 'all' ? null : parseInt(v, 10);
    render();
  });
  jumpTodayBtn.addEventListener('click', jumpToToday);

  // Form submission via Enter
  [descInput, amountInput].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') submitEntry(); });
  });

  // Restore last-used filter from session if any (resets per session — page refresh defaults to today)
  loadEntries();
}

function jumpToToday() {
  const now = new Date();
  currentFilter.year = now.getFullYear();
  currentFilter.month = now.getMonth();
  rebuildFilters();
  render();
  // Scroll ledger to top
  ledgerEl.scrollTop = 0;
}

function setStatus(msg, kind) {
  statusEl.textContent = msg;
  statusEl.className = 'status ' + (kind || '');
  if (kind === 'ok') {
    setTimeout(() => {
      if (statusEl.textContent === msg) { statusEl.textContent = ''; statusEl.className = 'status'; }
    }, 3000);
  }
}

function setSyncStatus(state) {
  if (state === 'syncing') {
    heroStatus.innerHTML = '<span style="color:var(--warn)">●</span> Syncing...';
  } else if (state === 'error') {
    heroStatus.innerHTML = '<span style="color:var(--danger)">●</span> Offline';
  } else {
    heroStatus.innerHTML = '<span style="color:var(--accent)">●</span> Synced';
  }
}

// ============ MODAL CONTROLS ============
function openWalletModal() {
  walletCurrent.textContent = availableAmount.toFixed(2);
  walletInput.value = '';
  walletInput.placeholder = availableAmount.toFixed(2);
  walletStatus.textContent = '';
  walletStatus.className = 'status';
  walletModal.classList.add('open');
  setTimeout(() => walletInput.focus(), 100);
}

function openIncomeModal() {
  incomeCurrent.textContent = availableAmount.toFixed(2);
  incomeAmount.value = '';
  incomeSource.value = '';
  incomeStatus.textContent = '';
  incomeStatus.className = 'status';
  incomeModal.classList.add('open');
  setTimeout(() => incomeAmount.focus(), 100);
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// ============ WALLET (SET total) ============
async function saveWallet() {
  const val = parseFloat(walletInput.value);
  if (isNaN(val) || val < 0) {
    walletStatus.textContent = 'Enter a valid amount';
    walletStatus.className = 'status err';
    return;
  }

  walletSave.disabled = true;
  walletSave.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 0.8s linear infinite"><path d="M21 12a9 9 0 1 1-6.2-8.5"/></svg> Saving...';
  setSyncStatus('syncing');

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action: 'setAvailable', amount: val }),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Save failed');

    availableAmount = Number(data.available || val);
    walletStatus.textContent = 'Saved ✓';
    walletStatus.className = 'status ok';
    setSyncStatus('synced');
    render();
    setTimeout(() => closeModal('walletModal'), 600);
  } catch (e) {
    walletStatus.textContent = 'Save failed: ' + e.message;
    walletStatus.className = 'status err';
    setSyncStatus('error');
  } finally {
    walletSave.disabled = false;
    walletSave.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg> Save wallet';
  }
}

// ============ INCOME (ADD to wallet, log entry) ============
async function saveIncome() {
  const val = parseFloat(incomeAmount.value);
  const source = incomeSource.value.trim() || 'Income';
  if (isNaN(val) || val <= 0) {
    incomeStatus.textContent = 'Enter a valid amount';
    incomeStatus.className = 'status err';
    return;
  }

  incomeSave.disabled = true;
  incomeSave.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 0.8s linear infinite"><path d="M21 12a9 9 0 1 1-6.2-8.5"/></svg> Adding...';
  setSyncStatus('syncing');

  try {
    const payload = {
      action: 'addIncome',
      date: localDateString(new Date()),
      description: source,
      amount: val,
    };
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Save failed');

    entries = data.entries || entries;
    availableAmount = Number(data.available || availableAmount);
    incomeStatus.textContent = 'Added ✓';
    incomeStatus.className = 'status ok';
    setSyncStatus('synced');
    render();
    setTimeout(() => closeModal('incomeModal'), 600);
  } catch (e) {
    incomeStatus.textContent = 'Failed: ' + e.message;
    incomeStatus.className = 'status err';
    setSyncStatus('error');
  } finally {
    incomeSave.disabled = false;
    incomeSave.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 13l4 4L19 7"/></svg> Add to wallet';
  }
}

// ============ NETWORK ============
async function loadEntries(manual) {
  setSyncStatus('syncing');
  if (manual) refreshBtn.classList.add('spinning');
  try {
    const res = await fetch(API_URL + '?action=list', { method: 'GET' });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Load failed');
    entries = data.entries || [];
    availableAmount = Number(data.available || 0);
    setSyncStatus('synced');
    // Reset filter to current month on every load (page refresh -> today)
    if (manual) {
      const now = new Date();
      currentFilter.year = now.getFullYear();
      currentFilter.month = now.getMonth();
    }
    render();
  } catch (e) {
    setSyncStatus('error');
    setStatus('Could not connect: ' + e.message, 'err');
    ledgerEl.innerHTML = `
      <div class="ledger-empty">
        <span class="big">Connection failed</span>
        Check that your Apps Script is deployed and accessible.
      </div>`;
  } finally {
    if (manual) setTimeout(() => refreshBtn.classList.remove('spinning'), 400);
  }
}

async function submitEntry() {
  const date   = dateInput.value;
  const desc   = descInput.value.trim();
  const amount = parseFloat(amountInput.value);

  if (!date)            return setStatus('Pick a date', 'err');
  if (!desc)            return setStatus('Describe what you spent on', 'err');
  if (isNaN(amount) || amount <= 0) return setStatus('Enter a valid amount', 'err');

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="animation:spin 0.8s linear infinite"><path d="M21 12a9 9 0 1 1-6.2-8.5"/></svg> Saving...';
  setSyncStatus('syncing');

  try {
    const payload = { action: 'add', date, description: desc, amount };

    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Save failed');

    descInput.value = '';
    amountInput.value = '';
    setStatus('Saved ✓', 'ok');

    entries = data.entries || entries;
    availableAmount = Number(data.available || availableAmount);
    setSyncStatus('synced');

    // Snap filter to the date that was just added (likely current month)
    const d = new Date(date);
    if (!isNaN(d)) {
      currentFilter.year = d.getFullYear();
      currentFilter.month = d.getMonth();
    }
    render();
  } catch (e) {
    setSyncStatus('error');
    setStatus('Save failed: ' + e.message, 'err');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> Record expense';
  }
}

// ============ FILTER REBUILD ============
function rebuildFilters() {
  // Years present in data + current year
  const yearsSet = new Set();
  const now = new Date();
  yearsSet.add(now.getFullYear());
  entries.forEach(e => {
    const d = new Date(e.date);
    if (!isNaN(d)) yearsSet.add(d.getFullYear());
  });
  const years = [...yearsSet].sort((a, b) => b - a);

  // Ensure currentFilter.year is in the list
  if (!years.includes(currentFilter.year)) {
    currentFilter.year = years[0];
  }

  yearFilter.innerHTML = years.map(y =>
    `<option value="${y}" ${y === currentFilter.year ? 'selected' : ''}>${y}</option>`
  ).join('');

  rebuildMonthFilter();

  // Show filters once we have data
  filtersEl.style.display = entries.length ? 'flex' : 'none';
}

function rebuildMonthFilter() {
  // Months in the selected year that have entries + the current month (if same year)
  const monthsSet = new Set();
  const now = new Date();
  if (now.getFullYear() === currentFilter.year) monthsSet.add(now.getMonth());

  entries.forEach(e => {
    const d = new Date(e.date);
    if (!isNaN(d) && d.getFullYear() === currentFilter.year) monthsSet.add(d.getMonth());
  });

  const months = [...monthsSet].sort((a, b) => b - a); // newest first

  // Ensure currentFilter.month is valid for this year (or fall back to most recent)
  if (currentFilter.month !== null && !months.includes(currentFilter.month)) {
    currentFilter.month = months[0] ?? new Date().getMonth();
  }

  let opts = '<option value="all">All months</option>';
  opts += months.map(m =>
    `<option value="${m}" ${m === currentFilter.month ? 'selected' : ''}>${MONTH_NAMES[m]}</option>`
  ).join('');
  monthFilter.innerHTML = opts;
}

// ============ RENDER ============
function render() {
  // Total spent (expenses only) — ALL TIME, used for stats hero
  const allExpenses = entries.filter(e => e.type !== 'income');
  const totalSpent = allExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const remaining = availableAmount - totalSpent;

  // Hero
  const [intPart, fracPart] = Math.abs(remaining).toFixed(2).split('.');
  heroInt.textContent = (remaining < 0 ? '−' : '') + Number(intPart).toLocaleString();
  heroFrac.textContent = fracPart;
  heroAmount.className = 'hero-amount ' + (remaining < 0 ? 'negative' : 'positive');

  heroTotal.textContent = '$' + totalSpent.toFixed(2);
  heroCount.textContent = entries.length;
  statBudget.textContent = availableAmount.toFixed(2);

  // Today stat
  const todayStr = localDateString(new Date());
  const todayExpenses = allExpenses.filter(e => normalizeDate(e.date) === todayStr);
  const todaySum = todayExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  statToday.textContent = todaySum.toFixed(2);
  statTodayFoot.textContent = todayExpenses.length
    ? `${todayExpenses.length} transaction${todayExpenses.length === 1 ? '' : 's'}`
    : 'No spending yet';

  // This month stat (current real-world month, regardless of filter)
  const now = new Date();
  const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const monthExpenses = allExpenses.filter(e => normalizeDate(e.date).startsWith(ym));
  const monthSum = monthExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  statMonth.textContent = monthSum.toFixed(2);
  statMonthFoot.textContent = now.toLocaleDateString(undefined, { month: 'long' });

  // Empty state
  if (!entries.length) {
    filtersEl.style.display = 'none';
    ledgerEl.innerHTML = `
      <div class="ledger-empty">
        <span class="big">No entries yet.</span>
        Add your first expense to get started.
      </div>`;
    entriesSub.textContent = 'Your timeline will appear here';
    return;
  }

  // Build filter dropdowns
  rebuildFilters();

  // Filter entries by year + (optional) month
  const filtered = entries.filter(e => {
    const d = new Date(e.date);
    if (isNaN(d)) return false;
    if (d.getFullYear() !== currentFilter.year) return false;
    if (currentFilter.month !== null && d.getMonth() !== currentFilter.month) return false;
    return true;
  });

  // Group by day (YYYY-MM-DD)
  const byDay = {};
  filtered.forEach(e => {
    const key = normalizeDate(e.date);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(e);
  });

  const dayKeys = Object.keys(byDay).sort((a, b) => b.localeCompare(a)); // newest first

  // Subtitle
  const filterLabel = currentFilter.month !== null
    ? `${MONTH_NAMES[currentFilter.month]} ${currentFilter.year}`
    : `${currentFilter.year}`;
  const totalInView = filtered.reduce((s, e) => {
    const v = Number(e.amount || 0);
    return s + (e.type === 'income' ? v : -v);
  }, 0);
  entriesSub.textContent = `${filterLabel} · ${filtered.length} entr${filtered.length === 1 ? 'y' : 'ies'} · net ${totalInView >= 0 ? '+' : '−'}$${Math.abs(totalInView).toFixed(2)}`;

  if (!dayKeys.length) {
    ledgerEl.innerHTML = `
      <div class="ledger-empty">
        <span class="big">Nothing here.</span>
        No entries in ${filterLabel}.
      </div>`;
    return;
  }

  // Build day-grouped HTML
  const html = dayKeys.map(dayKey => {
    const dayEntries = byDay[dayKey].sort((a, b) => {
      // Sort within day: income first, then expenses (or by amount desc)
      if (a.type !== b.type) return a.type === 'income' ? -1 : 1;
      return Number(b.amount || 0) - Number(a.amount || 0);
    });

    const d = new Date(dayKey + 'T00:00:00');
    const dayLabel = d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
    const rel = relativeDay(dayKey);
    const dayNet = dayEntries.reduce((s, e) => {
      const v = Number(e.amount || 0);
      return s + (e.type === 'income' ? v : -v);
    }, 0);

    const relHtml = rel
      ? `<span class="day-header-relative ${rel === 'Today' ? 'today' : ''}">${rel}</span>`
      : '';

    const dayNetHtml = dayNet === 0
      ? '<span class="neg">$0.00</span>'
      : dayNet > 0
        ? `<span class="pos">+$${dayNet.toFixed(2)}</span>`
        : `<span class="neg">−$${Math.abs(dayNet).toFixed(2)}</span>`;

    const entriesHtml = dayEntries.map(e => {
      const isIncome = e.type === 'income';
      const cls = isIncome ? 'income' : 'expense';
      const sign = isIncome ? '+' : '−';
      const tagSvg = isIncome
        ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 19V5M5 12l7-7 7 7"/></svg>'
        : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M19 12l-7 7-7-7"/></svg>';

      return `
        <div class="entry">
          <div class="entry-desc">
            <span class="entry-tag ${cls}">${tagSvg}</span>
            ${escapeHtml(e.description || '')}
          </div>
          <div class="entry-amt ${cls}">${sign}$${Number(e.amount || 0).toFixed(2)}</div>
        </div>`;
    }).join('');

    return `
      <div class="day-group">
        <div class="day-header">
          <div class="day-header-left">
            <span class="day-header-date">${dayLabel}</span>
            ${relHtml}
          </div>
          <div class="day-header-total">${dayNetHtml}</div>
        </div>
        ${entriesHtml}
      </div>`;
  }).join('');

  ledgerEl.innerHTML = html;
}

// ============ HELPERS ============
function relativeDay(yyyyMmDd) {
  const today = new Date();
  const todayStr = localDateString(today);
  if (yyyyMmDd === todayStr) return 'Today';

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (yyyyMmDd === localDateString(yesterday)) return 'Yesterday';

  return null;
}

// Returns yyyy-MM-dd in LOCAL time, not UTC
function localDateString(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function normalizeDate(d) {
  if (!d) return '';
  if (typeof d === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
    const dt = new Date(d);
    return isNaN(dt) ? '' : localDateString(dt);
  }
  const dt = new Date(d);
  return isNaN(dt) ? '' : localDateString(dt);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[c]));
}

init();