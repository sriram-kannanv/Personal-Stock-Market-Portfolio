/**
 * StockVault — Portfolio Tracker
 * script.js — Vanilla JS, no frameworks
 *
 * Architecture:
 *  State    → in-memory object mirrored to localStorage
 *  Render   → pure functions that rebuild DOM from state
 *  Events   → all wired in initEvents()
 *  Charts   → Chart.js instances; rebuilt on data changes
 */

'use strict';

/* ============================================================
   STATE & STORAGE
   ============================================================ */

/** @type {{ stocks: Stock[], transactions: Transaction[], theme: string }} */
const State = {
  stocks: [],
  transactions: [],
  theme: 'dark',
};

/** Load persisted data from localStorage */
function loadState() {
  try {
    const raw = localStorage.getItem('stockvault_data');
    if (raw) {
      const parsed = JSON.parse(raw);
      State.stocks       = parsed.stocks       || [];
      State.transactions = parsed.transactions || [];
      State.theme        = parsed.theme        || 'dark';
    }
  } catch (e) {
    console.warn('Failed to load state:', e);
  }
}

/** Persist current state to localStorage */
function saveState() {
  try {
    localStorage.setItem('stockvault_data', JSON.stringify({
      stocks:       State.stocks,
      transactions: State.transactions,
      theme:        State.theme,
    }));
  } catch (e) {
    console.warn('Failed to save state:', e);
  }
}


/* ============================================================
   CALCULATIONS
   ============================================================ */

/**
 * @typedef {Object} Stock
 * @property {string} id
 * @property {string} symbol
 * @property {string} name
 * @property {number} qty
 * @property {number} buyPrice
 * @property {number} currentPrice
 * @property {string} date
 */

/**
 * @typedef {Object} Transaction
 * @property {string} type  'buy' | 'edit' | 'delete'
 * @property {string} symbol
 * @property {string} desc
 * @property {number} timestamp
 */

const fmt = (n, dec = 2) => `₹${Math.abs(n).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;
const fmtPct = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(2)}%`;
const fmtSign = (n) => `${n >= 0 ? '+' : '−'}${fmt(n)}`;

function calcStock(s) {
  const invested = s.qty * s.buyPrice;
  const current  = s.qty * s.currentPrice;
  const pnl      = current - invested;
  const pnlPct   = invested > 0 ? (pnl / invested) * 100 : 0;
  return { invested, current, pnl, pnlPct };
}

function calcPortfolio() {
  let totalInvested = 0, totalCurrent = 0;
  State.stocks.forEach(s => {
    const c = calcStock(s);
    totalInvested += c.invested;
    totalCurrent  += c.current;
  });
  const totalPnL    = totalCurrent - totalInvested;
  const totalPnLPct = totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0;
  return { totalInvested, totalCurrent, totalPnL, totalPnLPct };
}


/* ============================================================
   CHART INSTANCES
   ============================================================ */

const Charts = { alloc: null, pnl: null, alloc2: null, pnl2: null };

const CHART_COLORS = [
  '#4f8eff','#22d49a','#ff5c7c','#ffc947','#9b6dff',
  '#ff8a47','#47d4ff','#ff47b6','#a8ff47','#47ffc8',
];

/** Build or update the allocation pie chart */
function renderAllocationChart(canvasId, emptyId, chartKey) {
  const canvas = document.getElementById(canvasId);
  const empty  = document.getElementById(emptyId);
  if (!canvas) return;

  if (State.stocks.length === 0) {
    empty.classList.add('visible');
    if (Charts[chartKey]) { Charts[chartKey].destroy(); Charts[chartKey] = null; }
    return;
  }
  empty.classList.remove('visible');

  const labels = State.stocks.map(s => s.symbol);
  const data   = State.stocks.map(s => parseFloat((s.qty * s.currentPrice).toFixed(2)));

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const textColor = isDark ? '#8a93a8' : '#4f5668';

  if (Charts[chartKey]) Charts[chartKey].destroy();

  Charts[chartKey] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: CHART_COLORS,
        borderColor: isDark ? '#111520' : '#ffffff',
        borderWidth: 2,
        hoverBorderWidth: 3,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            color: textColor,
            font: { family: "'DM Mono', monospace", size: 11 },
            boxWidth: 12,
            padding: 10,
          },
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ₹${ctx.parsed.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          },
        },
      },
    },
  });
}

/** Build or update the P&L bar chart */
function renderPnLChart(canvasId, emptyId, chartKey) {
  const canvas = document.getElementById(canvasId);
  const empty  = document.getElementById(emptyId);
  if (!canvas) return;

  if (State.stocks.length === 0) {
    empty.classList.add('visible');
    if (Charts[chartKey]) { Charts[chartKey].destroy(); Charts[chartKey] = null; }
    return;
  }
  empty.classList.remove('visible');

  const labels = State.stocks.map(s => s.symbol);
  const data   = State.stocks.map(s => parseFloat(calcStock(s).pnl.toFixed(2)));
  const bgColors = data.map(v => v >= 0 ? 'rgba(34,212,154,0.72)' : 'rgba(255,92,124,0.72)');
  const borderColors = data.map(v => v >= 0 ? '#22d49a' : '#ff5c7c');

  const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
  const textColor = isDark ? '#8a93a8' : '#4f5668';
  const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

  if (Charts[chartKey]) Charts[chartKey].destroy();

  Charts[chartKey] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'P&L (₹)',
        data,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 1.5,
        borderRadius: 4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ` P&L: ${ctx.parsed.y >= 0 ? '+' : ''}₹${ctx.parsed.y.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { family: "'DM Mono', monospace", size: 11 } },
          grid: { color: gridColor },
        },
        y: {
          ticks: {
            color: textColor,
            font: { family: "'DM Mono', monospace", size: 11 },
            callback: v => `₹${v.toLocaleString('en-IN')}`,
          },
          grid: { color: gridColor },
        },
      },
    },
  });
}

function renderAllCharts() {
  renderAllocationChart('allocationChart',  'allocEmpty',  'alloc');
  renderPnLChart('pnlChart',               'pnlEmpty',    'pnl');
  renderAllocationChart('allocationChart2', 'allocEmpty2', 'alloc2');
  renderPnLChart('pnlChart2',              'pnlEmpty2',   'pnl2');
}


/* ============================================================
   RENDER — DASHBOARD CARDS
   ============================================================ */

function renderCards() {
  const { totalInvested, totalCurrent, totalPnL, totalPnLPct } = calcPortfolio();

  document.getElementById('totalInvested').textContent = fmt(totalInvested);
  document.getElementById('currentValue').textContent  = fmt(totalCurrent);

  const pnlEl  = document.getElementById('totalPnL');
  const pctEl  = document.getElementById('pnlPercent');
  pnlEl.textContent = (totalPnL >= 0 ? '+' : '−') + fmt(totalPnL);
  pnlEl.className   = 'card-value ' + (totalPnL >= 0 ? 'positive' : 'negative');
  pctEl.textContent = fmtPct(totalPnLPct);
  pctEl.className   = 'card-sub ' + (totalPnLPct >= 0 ? 'positive' : 'negative');

  document.getElementById('stockCount').textContent = State.stocks.length;
}


/* ============================================================
   RENDER — PORTFOLIO TABLE
   ============================================================ */

function buildPortfolioTable(stocks, parentId) {
  const wrap = document.getElementById(parentId);
  if (!wrap) return;

  if (stocks.length === 0) {
    const empId = parentId === 'portfolioTableWrap' ? 'portfolioEmpty' : null;
    if (empId) {
      wrap.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <p class="empty-title">No stocks in portfolio</p>
          <p class="empty-sub">Add your first holding to get started</p>
          <button class="btn btn-primary" onclick="document.getElementById('openAddModal').click()">＋ Add Stock</button>
        </div>`;
    } else {
      wrap.innerHTML = `<div class="empty-state"><p class="empty-sub">No holdings</p></div>`;
    }
    return;
  }

  const isMain = parentId === 'portfolioTableWrap';

  const rows = stocks.map((s, idx) => {
    const { invested, current, pnl, pnlPct } = calcStock(s);
    const pnlCls  = pnl  >= 0 ? 'positive' : 'negative';
    const badgeCls = pnl >= 0 ? 'badge-green' : 'badge-red';
    const alloc   = calcPortfolio().totalCurrent > 0
      ? ((current / calcPortfolio().totalCurrent) * 100).toFixed(1)
      : '0.0';

    const actionBtns = isMain
      ? `<td>
          <div style="display:flex;gap:6px">
            <button class="btn-icon" onclick="openEditModal(${State.stocks.indexOf(s)})" title="Edit">✎</button>
            <button class="btn-icon danger" onclick="confirmDelete(${State.stocks.indexOf(s)})" title="Delete">⊘</button>
          </div>
        </td>`
      : '';

    return `<tr>
      <td class="td-symbol">${escHtml(s.symbol)}</td>
      <td class="td-company">${escHtml(s.name)}</td>
      <td class="td-mono">${s.qty.toLocaleString('en-IN')}</td>
      <td class="td-mono">${fmt(s.buyPrice)}</td>
      <td class="td-mono">${fmt(s.currentPrice)}</td>
      <td class="td-mono">${fmt(invested)}</td>
      <td class="td-mono">${fmt(current)}</td>
      <td class="td-mono ${pnlCls}">${fmtSign(pnl)}</td>
      <td><span class="badge ${badgeCls}">${fmtPct(pnlPct)}</span></td>
      <td class="td-mono">${alloc}%</td>
      <td class="td-mono">${s.date}</td>
      ${actionBtns}
    </tr>`;
  }).join('');

  const actHeader = isMain ? '<th>Actions</th>' : '';

  wrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Company</th>
          <th>Qty</th>
          <th>Buy Price</th>
          <th>Cur. Price</th>
          <th>Invested</th>
          <th>Cur. Value</th>
          <th>P&L</th>
          <th>Return</th>
          <th>Alloc.</th>
          <th>Date</th>
          ${actHeader}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function renderPortfolioTable(stocks) {
  buildPortfolioTable(stocks || State.stocks, 'portfolioTableWrap');
}


/* ============================================================
   RENDER — TOP HOLDINGS (dashboard)
   ============================================================ */

function renderTopHoldings() {
  const top = [...State.stocks]
    .sort((a, b) => calcStock(b).current - calcStock(a).current)
    .slice(0, 5);

  const wrap = document.getElementById('topHoldingsTable');
  if (!wrap) return;

  if (top.length === 0) {
    wrap.innerHTML = `<div class="empty-state"><p class="empty-sub">Add stocks to see your top holdings</p></div>`;
    return;
  }

  buildPortfolioTable(top, 'topHoldingsTable');
}


/* ============================================================
   RENDER — TRANSACTIONS
   ============================================================ */

function renderTransactions() {
  const wrap = document.getElementById('transactionList');
  if (!wrap) return;

  if (State.transactions.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state" id="txEmpty">
        <div class="empty-icon">🗒️</div>
        <p class="empty-title">No transactions yet</p>
        <p class="empty-sub">Your buy/edit/delete history will appear here</p>
      </div>`;
    return;
  }

  const typeConfig = {
    buy:    { cls: 'tx-dot-buy',    icon: '＋', label: 'Bought'  },
    edit:   { cls: 'tx-dot-edit',   icon: '✎',  label: 'Edited'  },
    delete: { cls: 'tx-dot-delete', icon: '✕',  label: 'Deleted' },
  };

  const items = [...State.transactions].reverse().map(tx => {
    const cfg  = typeConfig[tx.type] || typeConfig.buy;
    const date = new Date(tx.timestamp);
    const timeStr = date.toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });

    return `<div class="tx-item">
      <div class="tx-dot ${cfg.cls}">${cfg.icon}</div>
      <div class="tx-info">
        <div class="tx-title">${cfg.label} · <strong>${escHtml(tx.symbol)}</strong></div>
        <div class="tx-sub">${escHtml(tx.desc)}</div>
      </div>
      <div class="tx-time">${timeStr}</div>
    </div>`;
  }).join('');

  wrap.innerHTML = items;
}


/* ============================================================
   RENDER — ANALYTICS SUMMARY
   ============================================================ */

function renderSummary() {
  const wrap = document.getElementById('summaryStats');
  if (!wrap) return;

  const { totalInvested, totalCurrent, totalPnL, totalPnLPct } = calcPortfolio();

  // Best and worst performers
  let best = null, worst = null;
  State.stocks.forEach(s => {
    const { pnlPct } = calcStock(s);
    if (!best  || pnlPct > calcStock(best).pnlPct)  best  = s;
    if (!worst || pnlPct < calcStock(worst).pnlPct) worst = s;
  });

  const pnlColor = totalPnL >= 0 ? 'var(--green)' : 'var(--red)';

  wrap.innerHTML = `
    <div class="summary-item">
      <div class="summary-label">Total Invested</div>
      <div class="summary-val">${fmt(totalInvested)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Current Value</div>
      <div class="summary-val">${fmt(totalCurrent)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Overall P&L</div>
      <div class="summary-val" style="color:${pnlColor}">${fmtSign(totalPnL)} (${fmtPct(totalPnLPct)})</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Holdings</div>
      <div class="summary-val">${State.stocks.length}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Best Performer</div>
      <div class="summary-val" style="color:var(--green)">${best ? escHtml(best.symbol) + ' ' + fmtPct(calcStock(best).pnlPct) : '—'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">Worst Performer</div>
      <div class="summary-val" style="color:var(--red)">${worst ? escHtml(worst.symbol) + ' ' + fmtPct(calcStock(worst).pnlPct) : '—'}</div>
    </div>`;
}


/* ============================================================
   FULL RE-RENDER
   ============================================================ */

function renderAll(filteredStocks) {
  renderCards();
  renderTopHoldings();
  renderPortfolioTable(filteredStocks);
  renderTransactions();
  renderSummary();
  renderAllCharts();
}


/* ============================================================
   MODAL — ADD / EDIT
   ============================================================ */

function openAddModal() {
  document.getElementById('modalTitle').textContent = 'Add Stock';
  document.getElementById('submitBtn').textContent  = 'Add Stock';
  document.getElementById('editIndex').value = '-1';
  document.getElementById('stockForm').reset();
  document.getElementById('formPreview').textContent = 'Fill in the details to preview your stock entry';
  clearFormErrors();
  openModal('modalOverlay');
}

function openEditModal(idx) {
  const s = State.stocks[idx];
  if (!s) return;

  document.getElementById('modalTitle').textContent = 'Edit Stock';
  document.getElementById('submitBtn').textContent  = 'Save Changes';
  document.getElementById('editIndex').value = idx;

  document.getElementById('fSymbol').value       = s.symbol;
  document.getElementById('fName').value         = s.name;
  document.getElementById('fQty').value          = s.qty;
  document.getElementById('fBuyPrice').value     = s.buyPrice;
  document.getElementById('fCurrentPrice').value = s.currentPrice;
  document.getElementById('fDate').value         = s.date;

  updateFormPreview();
  clearFormErrors();
  openModal('modalOverlay');
}

function openModal(id) {
  document.getElementById(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  document.body.style.overflow = '';
}

function clearFormErrors() {
  document.querySelectorAll('#stockForm input').forEach(i => i.classList.remove('error'));
}


/* ============================================================
   FORM PREVIEW
   ============================================================ */

function updateFormPreview() {
  const sym   = document.getElementById('fSymbol').value.trim().toUpperCase();
  const qty   = parseFloat(document.getElementById('fQty').value)       || 0;
  const buy   = parseFloat(document.getElementById('fBuyPrice').value)  || 0;
  const cur   = parseFloat(document.getElementById('fCurrentPrice').value) || 0;

  if (!sym || qty <= 0 || buy <= 0 || cur <= 0) {
    document.getElementById('formPreview').textContent = 'Fill in the details to preview your stock entry';
    return;
  }

  const invested = qty * buy;
  const current  = qty * cur;
  const pnl      = current - invested;
  const pnlPct   = (pnl / invested) * 100;
  const sign     = pnl >= 0 ? '+' : '−';
  const col      = pnl >= 0 ? 'var(--green)' : 'var(--red)';

  document.getElementById('formPreview').innerHTML =
    `<strong>${sym}</strong> · ${qty} shares · Invested: <strong>${fmt(invested)}</strong> · ` +
    `Current: <strong>${fmt(current)}</strong> · ` +
    `P&L: <strong style="color:${col}">${sign}${fmt(pnl)} (${fmtPct(pnlPct)})</strong>`;
}


/* ============================================================
   FORM SUBMISSION
   ============================================================ */

function handleFormSubmit(e) {
  e.preventDefault();

  const sym  = document.getElementById('fSymbol').value.trim().toUpperCase();
  const name = document.getElementById('fName').value.trim();
  const qty  = parseFloat(document.getElementById('fQty').value);
  const buy  = parseFloat(document.getElementById('fBuyPrice').value);
  const cur  = parseFloat(document.getElementById('fCurrentPrice').value);
  const date = document.getElementById('fDate').value;
  const idx  = parseInt(document.getElementById('editIndex').value);

  // Validation
  let valid = true;
  const validate = (id, cond) => {
    const el = document.getElementById(id);
    if (!cond) { el.classList.add('error'); valid = false; }
    else        el.classList.remove('error');
  };

  validate('fSymbol',       sym.length > 0 && sym.length <= 15);
  validate('fName',         name.length > 0);
  validate('fQty',          !isNaN(qty) && qty > 0);
  validate('fBuyPrice',     !isNaN(buy) && buy > 0);
  validate('fCurrentPrice', !isNaN(cur) && cur > 0);
  validate('fDate',         date !== '');

  if (!valid) { showToast('Please fill all fields correctly', 'error'); return; }

  const stock = { id: idx >= 0 ? State.stocks[idx].id : genId(), symbol: sym, name, qty, buyPrice: buy, currentPrice: cur, date };

  if (idx >= 0) {
    // Edit
    const old = State.stocks[idx];
    State.stocks[idx] = stock;
    addTransaction('edit', sym, `Changed from ${fmt(old.buyPrice)} buy @ ${old.qty} qty to ${fmt(buy)} @ ${qty}`);
    showToast(`${sym} updated successfully`, 'success');
  } else {
    // Add — check duplicate symbol
    if (State.stocks.find(s => s.symbol === sym)) {
      showToast(`${sym} already exists. Edit it instead.`, 'error');
      return;
    }
    State.stocks.push(stock);
    addTransaction('buy', sym, `Bought ${qty} shares @ ${fmt(buy)} on ${date}`);
    showToast(`${sym} added to portfolio`, 'success');
  }

  saveState();
  closeModal('modalOverlay');
  renderAll();
}


/* ============================================================
   DELETE
   ============================================================ */

let _pendingDeleteIdx = -1;

function confirmDelete(idx) {
  const s = State.stocks[idx];
  if (!s) return;
  _pendingDeleteIdx = idx;
  document.getElementById('confirmMsg').textContent =
    `Delete ${s.symbol} (${s.name}) from your portfolio? This cannot be undone.`;
  openModal('confirmOverlay');
}

function doDelete() {
  const idx = _pendingDeleteIdx;
  if (idx < 0) return;

  const s = State.stocks[idx];
  addTransaction('delete', s.symbol, `Deleted ${s.qty} shares (bought @ ${fmt(s.buyPrice)})`);
  State.stocks.splice(idx, 1);
  saveState();
  closeModal('confirmOverlay');
  renderAll();
  showToast(`${s.symbol} removed from portfolio`, 'info');
  _pendingDeleteIdx = -1;
}


/* ============================================================
   TRANSACTIONS
   ============================================================ */

function addTransaction(type, symbol, desc) {
  State.transactions.push({ type, symbol, desc, timestamp: Date.now() });
  // Keep last 100 transactions
  if (State.transactions.length > 100) State.transactions.shift();
}


/* ============================================================
   SEARCH & FILTER
   ============================================================ */

function applySearch(query) {
  if (!query.trim()) {
    renderPortfolioTable(State.stocks);
    return;
  }
  const q = query.toLowerCase();
  const filtered = State.stocks.filter(s =>
    s.symbol.toLowerCase().includes(q) ||
    s.name.toLowerCase().includes(q)
  );
  renderPortfolioTable(filtered);
}


/* ============================================================
   SORT
   ============================================================ */

function applySortAndSearch() {
  const sortVal = document.getElementById('sortSelect').value;
  const query   = document.getElementById('globalSearch').value;

  let stocks = [...State.stocks];

  // Filter first
  if (query.trim()) {
    const q = query.toLowerCase();
    stocks = stocks.filter(s =>
      s.symbol.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
    );
  }

  // Then sort
  if (sortVal) {
    const [key, dir] = sortVal.split('-');
    stocks.sort((a, b) => {
      let va, vb;
      if (key === 'symbol') { va = a.symbol; vb = b.symbol; }
      else if (key === 'value') { va = calcStock(a).current; vb = calcStock(b).current; }
      else if (key === 'pnl')   { va = calcStock(a).pnl;     vb = calcStock(b).pnl;     }

      if (typeof va === 'string') {
        return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return dir === 'asc' ? va - vb : vb - va;
    });
  }

  renderPortfolioTable(stocks);
}


/* ============================================================
   EXPORT CSV
   ============================================================ */

function exportCSV() {
  if (State.stocks.length === 0) { showToast('No stocks to export', 'error'); return; }

  const headers = ['Symbol','Company','Quantity','Buy Price','Current Price','Invested','Current Value','P&L','Return %','Purchase Date'];
  const rows = State.stocks.map(s => {
    const { invested, current, pnl, pnlPct } = calcStock(s);
    return [
      s.symbol, `"${s.name}"`, s.qty, s.buyPrice, s.currentPrice,
      invested.toFixed(2), current.toFixed(2),
      pnl.toFixed(2), pnlPct.toFixed(2) + '%', s.date,
    ].join(',');
  });

  const csv  = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `stockvault_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('CSV exported!', 'success');
}


/* ============================================================
   VIEW NAVIGATION
   ============================================================ */

function switchView(viewName) {
  // Update nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewName);
  });

  // Show view
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  // Update page title
  const titles = { dashboard: 'Dashboard', portfolio: 'Portfolio', transactions: 'Transactions', charts: 'Analytics' };
  document.getElementById('pageTitle').textContent = titles[viewName] || 'StockVault';

  // Re-render charts on analytics view (sizing fix)
  if (viewName === 'charts') {
    setTimeout(renderAllCharts, 60);
  }
}


/* ============================================================
   THEME TOGGLE
   ============================================================ */

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const lbl = document.querySelector('.theme-label');
  if (lbl) lbl.textContent = theme === 'dark' ? 'Dark Mode' : 'Light Mode';
  State.theme = theme;
  // Redraw charts for correct colors
  setTimeout(renderAllCharts, 50);
}

function toggleTheme() {
  const next = State.theme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveState();
}


/* ============================================================
   TOAST
   ============================================================ */

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  const icons = { success: '✓', error: '✕', info: 'ℹ' };
  el.innerHTML = `<span>${icons[type] || 'ℹ'}</span> ${escHtml(msg)}`;
  container.appendChild(el);

  setTimeout(() => {
    el.classList.add('removing');
    setTimeout(() => el.remove(), 280);
  }, 2800);
}


/* ============================================================
   SIDEBAR MOBILE
   ============================================================ */

let sidebarOverlay = null;

function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  if (!sidebarOverlay) {
    sidebarOverlay = document.createElement('div');
    sidebarOverlay.className = 'overlay';
    sidebarOverlay.addEventListener('click', closeSidebar);
    document.body.appendChild(sidebarOverlay);
  }
  sidebarOverlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  if (sidebarOverlay) sidebarOverlay.classList.remove('open');
  document.body.style.overflow = '';
}


/* ============================================================
   UTILITIES
   ============================================================ */

function genId() {
  return Math.random().toString(36).substr(2, 9);
}

/** Escape HTML to prevent XSS */
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}


/* ============================================================
   EVENT WIRING
   ============================================================ */

function initEvents() {
  // Open add modal
  document.getElementById('openAddModal').addEventListener('click', openAddModal);

  // Modal close buttons
  document.getElementById('modalClose').addEventListener('click',  () => closeModal('modalOverlay'));
  document.getElementById('cancelModal').addEventListener('click', () => closeModal('modalOverlay'));

  // Close modal on backdrop click
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('modalOverlay');
  });

  // Form submission
  document.getElementById('stockForm').addEventListener('submit', handleFormSubmit);

  // Live form preview
  ['fSymbol','fName','fQty','fBuyPrice','fCurrentPrice','fDate'].forEach(id => {
    document.getElementById(id).addEventListener('input', updateFormPreview);
  });

  // Confirm dialog
  document.getElementById('confirmCancel').addEventListener('click', () => closeModal('confirmOverlay'));
  document.getElementById('confirmOk').addEventListener('click', doDelete);
  document.getElementById('confirmOverlay').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal('confirmOverlay');
  });

  // Nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
      e.preventDefault();
      const view = item.dataset.view;
      if (view) {
        switchView(view);
        closeSidebar();
      }
    });
  });

  // Section link (dashboard → portfolio)
  document.querySelector('.section-link')?.addEventListener('click', e => {
    e.preventDefault();
    const v = e.target.dataset.view;
    if (v) switchView(v);
  });

  // Search
  document.getElementById('globalSearch').addEventListener('input', e => {
    applySortAndSearch();
    // Auto-switch to portfolio view when typing
    if (e.target.value.trim()) switchView('portfolio');
  });

  // Sort
  document.getElementById('sortSelect').addEventListener('change', applySortAndSearch);

  // Export CSV
  document.getElementById('exportCSV').addEventListener('click', exportCSV);

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Hamburger
  document.getElementById('hamburger').addEventListener('click', openSidebar);
  document.getElementById('sidebarClose').addEventListener('click', closeSidebar);

  // Keyboard: ESC closes modals
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal('modalOverlay');
      closeModal('confirmOverlay');
      closeSidebar();
    }
  });
}


/* ============================================================
   SEED DATA (first visit only)
   ============================================================ */

function seedData() {
  if (State.stocks.length > 0) return; // Already has data

  const today = new Date().toISOString().slice(0, 10);
  const sample = [
    { id: genId(), symbol: 'RELIANCE', name: 'Reliance Industries',       qty: 10, buyPrice: 2400, currentPrice: 2850, date: '2024-01-15' },
    { id: genId(), symbol: 'TCS',      name: 'Tata Consultancy Services', qty: 5,  buyPrice: 3500, currentPrice: 3920, date: '2024-02-20' },
    { id: genId(), symbol: 'INFY',     name: 'Infosys Ltd',               qty: 8,  buyPrice: 1600, currentPrice: 1480, date: '2024-03-10' },
    { id: genId(), symbol: 'HDFCBANK', name: 'HDFC Bank',                 qty: 12, buyPrice: 1450, currentPrice: 1680, date: '2024-04-05' },
    { id: genId(), symbol: 'ITC',      name: 'ITC Limited',               qty: 50, buyPrice: 420,  currentPrice: 465,  date: '2024-05-18' },
  ];

  State.stocks = sample;
  sample.forEach(s => addTransaction('buy', s.symbol, `Bought ${s.qty} shares @ ${fmt(s.buyPrice)} on ${s.date}`));
  saveState();
}


/* ============================================================
   BOOTSTRAP
   ============================================================ */

function init() {
  loadState();
  applyTheme(State.theme);
  seedData();
  initEvents();
  switchView('dashboard');
  renderAll();
}

document.addEventListener('DOMContentLoaded', init);