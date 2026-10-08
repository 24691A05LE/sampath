App.requireAuth();
AppNav.inject('reports');

const monthSelect = document.getElementById('reportMonth');
const trendDays = document.getElementById('trendDays');
const reportType = document.getElementById('reportType');
const now = new Date();

let categoryChart = null;
let trendChart = null;
let comparisonChart = null;

function buildMonthOptions() {
  let opts = '';
  for (let i = 4; i >= 0; i--) {
    const t = new Date(now.getFullYear(), now.getMonth() - i, 1);
    opts += `<option value="${t.getMonth() + 1}" data-year="${t.getFullYear()}">${t.toLocaleString('en-US', { month: 'long' })} ${t.getFullYear()}</option>`;
  }
  monthSelect.innerHTML = opts;
  monthSelect.value = now.getMonth() + 1;
}

function getYear() {
  const opt = monthSelect.options[monthSelect.selectedIndex];
  return opt ? parseInt(opt.dataset.year) : now.getFullYear();
}

const palette = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#64748b', '#84cc16', '#06b6d4'];

function renderStats(s) {
  const cards = [
    { label: 'Income', value: App.money(s.income), cls: 'income' },
    { label: 'Expenses', value: App.money(s.expense), cls: 'expense' },
    { label: 'Balance', value: App.money(s.balance), cls: s.balance >= 0 ? 'balance' : 'expense' },
    { label: 'Savings rate', value: s.savingsRate + '%', cls: 'savings' },
  ];
  document.getElementById('reportStats').innerHTML = cards
    .map((c) => `<div class="stat-card ${c.cls}"><div><div class="stat-value">${App.esc(c.value)}</div><div class="stat-label">${App.esc(c.label)}</div></div></div>`)
    .join('');
}

function renderCategoryChart(categories) {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  if (categoryChart) categoryChart.destroy();
  if (!categories.length) {
    categoryChart = new Chart(ctx, { type: 'doughnut', data: { labels: ['No data'], datasets: [{ data: [1], backgroundColor: ['#e2e8f0'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } } });
    return;
  }
  categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels: categories.map((c) => c.category), datasets: [{ data: categories.map((c) => c.total), backgroundColor: palette, borderWidth: 2, borderColor: '#fff' }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } },
  });
}

function renderCategoryList(categories) {
  const el = document.getElementById('categoryList');
  if (!categories.length) {
    el.innerHTML = '<p class="empty">No expense data for this month.</p>';
    return;
  }
  const max = Math.max(...categories.map((c) => c.total));
  el.innerHTML = categories.map((c) => `
    <div class="list-item">
      <div class="list-main"><strong>${App.esc(c.category)}</strong><small>${c.percentage}% of spending</small></div>
      <div class="list-side">${App.money(c.total)}</div>
      <div class="progress-wrap"><div class="progress-bar" style="width:${(c.total / max) * 100}%;background:${palette[categories.indexOf(c) % palette.length]}"></div></div>
    </div>`).join('');
}

function renderTrend(trend) {
  const ctx = document.getElementById('trendChart').getContext('2d');
  if (trendChart) trendChart.destroy();
  const labels = trend.map((t) => t.date);
  trendChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Income', data: trend.map((t) => t.income), borderColor: '#10b981', backgroundColor: 'rgba(16,185,129,0.1)', fill: true, tension: 0.3 },
        { label: 'Expense', data: trend.map((t) => t.expense), borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,0.1)', fill: true, tension: 0.3 },
      ],
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } },
  });
}

function renderComparison(points) {
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
    options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } }, plugins: { legend: { position: 'bottom' } } },
  });
}

async function loadAll() {
  const month = monthSelect.value;
  const year = getYear();
  const days = trendDays.value;
  const type = reportType.value;

  const [summary, categories, trend, comparison] = await Promise.all([
    App.api(`/analytics/summary?month=${month}&year=${year}`),
    App.api(`/analytics/categories?month=${month}&year=${year}&type=${type}`),
    App.api(`/analytics/trend?days=${days}&month=${month}&year=${year}`),
    App.api('/analytics/comparison?months=6'),
  ]);

  renderStats(summary);
  renderCategoryChart(categories.categories);
  renderCategoryList(categories.categories);
  renderTrend(trend.trend);
  renderComparison(comparison.points);
}

monthSelect.addEventListener('change', loadAll);
trendDays.addEventListener('change', loadAll);
reportType.addEventListener('change', loadAll);
buildMonthOptions();

document.getElementById('exportBtn').addEventListener('click', async () => {
  try {
    const data = await App.api('/analytics/export');
    const rows = [['Date', 'Type', 'Category', 'Amount', 'Description']];
    data.transactions.forEach((t) => rows.push([t.date, t.type, t.category, t.amount, t.description || '']));
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'finance-report.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    alert(err.message);
  }
});

loadAll().catch((err) => alert(err.message));
