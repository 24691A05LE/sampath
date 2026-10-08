App.requireAuth();
AppNav.inject('dashboard');

const monthSelect = document.getElementById('monthSelect');
const now = new Date();

function buildMonthOptions() {
  let opts = '';
  for (let i = 4; i >= 0; i--) {
    const t = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts += `<option value="${t.getMonth() + 1}" data-year="${t.getFullYear()}">${t.toLocaleString('en-US', { month: 'long' })} ${t.getFullYear()}</option>`;
  }
  monthSelect.innerHTML = opts;
  monthSelect.value = now.getMonth() + 1;
}

let categoryChart = null;
let comparisonChart = null;

function getYear() {
  const opt = monthSelect.options[monthSelect.selectedIndex];
  return opt ? parseInt(opt.dataset.year) : now.getFullYear();
}

function renderStats(s) {
  const cards = [
    { label: 'Income', value: App.money(s.income), cls: 'income', icon: '&#8593;' },
    { label: 'Expenses', value: App.money(s.expense), cls: 'expense', icon: '&#8595;' },
    { label: 'Balance', value: App.money(s.balance), cls: s.balance >= 0 ? 'balance' : 'expense', icon: '&#8801;' },
    { label: 'Savings rate', value: s.savingsRate + '%', cls: 'savings', icon: '&#128176;' },
  ];
  document.getElementById('statCards').innerHTML = cards
    .map((c) => `<div class="stat-card ${c.cls}"><div class="stat-icon">${c.icon}</div><div><div class="stat-value">${App.esc(c.value)}</div><div class="stat-label">${App.esc(c.label)}</div></div></div>`)
    .join('');
}

function renderCategoryChart(categories) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (categoryChart) categoryChart.destroy();
  const labels = categories.map((c) => c.category);
  const data = categories.map((c) => c.total);
  const palette = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#84cc16', '#06b6d4'];
  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: palette, borderWidth: 2, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
  });
}

function renderComparisonChart(points) {
  const ctx = document.getElementById('comparisonChart').getContext('2d');
  if (comparisonChart) comparisonChart.destroy();
  comparisonChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: points.map((p) => p.month),
      datasets: [
        { label: 'Income', data: points.map((p) => p.income), backgroundColor: '#10b981' },
        { label: 'Expense', data: points.map((p) => p.expense), backgroundColor: '#ef4444' },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: 'bottom' } },
    },
  });
}

function budgetRow(b) {
  const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
  const over = b.spent > b.amount;
  const barColor = over ? '#ef4444' : pct > 80 ? '#f59e0b' : '#10b981';
  return `<div class="list-item">
    <div class="list-main"><strong>${App.esc(b.category)}</strong><small>${App.money(b.spent)} of ${App.money(b.amount)}</small></div>
    <div class="list-side"><span class="tag ${over ? 'tag-danger' : ''}">${pct}%</span></div>
    <div class="progress-wrap"><div class="progress-bar" style="width:${Math.min(pct, 100)}%;background:${barColor}"></div></div>
  </div>`;
}

function txRow(t) {
  const sign = t.type === 'income' ? '+' : '-';
  const cls = t.type === 'income' ? 'text-income' : 'text-expense';
  return `<div class="list-item">
    <div class="list-main"><strong>${App.esc(t.category)}</strong><small>${App.esc(t.description || 'No description')} &middot; ${App.date(t.date)}</small></div>
    <div class="list-side ${cls}">${sign}${App.money(t.amount)}</div>
  </div>`;
}

async function loadAll() {
  const month = monthSelect.value;
  const year = getYear();
  document.getElementById('monthLabel').textContent = `${monthSelect.options[monthSelect.selectedIndex].text}`;

  const [summary, categories, comparison, budgets, transactions] = await Promise.all([
    App.api(`/analytics/summary?month=${month}&year=${year}`),
    App.api(`/analytics/categories?month=${month}&year=${year}`),
    App.api('/analytics/comparison?months=6'),
    App.api(`/budgets?month=${month}&year=${year}`),
    App.api('/transactions?limit=6'),
  ]);

  renderStats(summary);
  renderCategoryChart(categories.categories);
  renderComparisonChart(comparison.points);

  const budgetEl = document.getElementById('budgetList');
  if (budgets.budgets.length) budgetEl.innerHTML = budgets.budgets.map(budgetRow).join('');
  else budgetEl.innerHTML = '<p class="empty">No budgets set for this month. <a href="budgets.html">Create one</a>.</p>';

  const recentEl = document.getElementById('recentList');
  if (transactions.transactions.length) recentEl.innerHTML = transactions.transactions.map(txRow).join('');
  else recentEl.innerHTML = '<p class="empty">No transactions yet. <a href="transactions.html">Add your first one</a>.</p>';
}

monthSelect.addEventListener('change', loadAll);
buildMonthOptions();
loadAll().catch((err) => alert(err.message));
