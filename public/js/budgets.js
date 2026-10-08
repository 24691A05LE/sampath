App.requireAuth();
AppNav.inject('budgets');

const monthSelect = document.getElementById('budgetMonth');
const now = new Date();
let categories = [];
let existingCategories = [];

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

function budgetCard(b) {
  const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
  const over = b.spent > b.amount;
  const barColor = over ? '#ef4444' : pct > 80 ? '#f59e0b' : '#10b981';
  const status = over ? 'Over budget' : `${pct}% used`;
  return `<div class="budget-card">
    <div class="budget-card-head">
      <strong>${App.esc(b.category)}</strong>
      <span class="tag ${over ? 'tag-danger' : ''}">${status}</span>
    </div>
    <div class="budget-numbers">
      <span>Spent <strong class="${over ? 'text-expense' : ''}">${App.money(b.spent)}</strong></span>
      <span>Limit <strong>${App.money(b.amount)}</strong></span>
      <span class="${over ? 'text-expense' : 'text-income'}">${over ? '-' : ''}${App.money(Math.max(b.amount - b.spent, 0))} left</span>
    </div>
    <div class="progress-wrap"><div class="progress-bar" style="width:${Math.min(pct, 100)}%;background:${barColor}"></div></div>
    ${b.note ? `<p class="muted small">${App.esc(b.note)}</p>` : ''}
    <div class="budget-actions">
      <button class="btn btn-ghost btn-sm" data-edit="${b._id}">Edit</button>
      <button class="btn btn-danger-outline btn-sm" data-del="${b._id}">Delete</button>
    </div>
  </div>`;
}

let budgetsCache = [];

async function loadBudgets() {
  const month = monthSelect.value;
  const year = getYear();
  const data = await App.api(`/budgets?month=${month}&year=${year}`);
  budgetsCache = data.budgets;
  existingCategories = data.budgets.map((b) => b.category);

  const total = data.budgets.reduce((s, b) => s + b.amount, 0);
  const spent = data.budgets.reduce((s, b) => s + Math.min(b.spent, b.amount), 0);
  document.getElementById('budgetSummary').textContent = data.budgets.length
    ? ` - ${data.budgets.length} budgets, ${App.money(spent)} spent of ${App.money(total)} total`
    : ' - no budgets set';

  const list = document.getElementById('budgetList');
  if (!data.budgets.length) {
    list.innerHTML = '<p class="empty">No budgets for this month yet. Click "New budget" to create one.</p>';
    return;
  }
  list.innerHTML = data.budgets.map(budgetCard).join('');
  list.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEdit(b.dataset.edit)));
  list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => del(b.dataset.del)));
}

// Modal
const modal = document.getElementById('budgetModal');
const budgetId = document.getElementById('budgetId');

function syncCategoryOptions() {
  const available = categories.filter((c) => !existingCategories.includes(c));
  document.getElementById('budgetCategory').innerHTML = available
    .map((c) => `<option value="${App.esc(c)}">${App.esc(c)}</option>`)
    .join('');
}

function openAdd() {
  document.getElementById('modalTitle').textContent = 'Add budget';
  budgetId.value = '';
  document.getElementById('budgetForm').reset();
  syncCategoryOptions();
  modal.classList.remove('hidden');
}

function openEdit(id) {
  const b = budgetsCache.find((x) => x._id === id);
  if (!b) return;
  document.getElementById('modalTitle').textContent = 'Edit budget';
  budgetId.value = id;
  document.getElementById('budgetCategory').innerHTML = `<option value="${App.esc(b.category)}">${App.esc(b.category)}</option>`;
  document.getElementById('budgetAmount').value = b.amount;
  document.getElementById('budgetNote').value = b.note || '';
  modal.classList.remove('hidden');
}

async function del(id) {
  if (!confirm('Delete this budget?')) return;
  try {
    await App.api('/budgets/' + id, { method: 'DELETE' });
    loadBudgets();
  } catch (err) {
    alert(err.message);
  }
}

function closeModal() { modal.classList.add('hidden'); }

document.getElementById('addBudgetBtn').addEventListener('click', openAdd);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

document.getElementById('budgetForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = budgetId.value;
  const payload = {
    month: parseInt(monthSelect.value),
    year: getYear(),
    category: document.getElementById('budgetCategory').value,
    amount: document.getElementById('budgetAmount').value,
    note: document.getElementById('budgetNote').value,
  };
  try {
    if (id) await App.api('/budgets/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    else await App.api('/budgets', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    loadBudgets();
  } catch (err) {
    alert(err.message);
  }
});

monthSelect.addEventListener('change', loadBudgets);
(async () => {
  const data = await App.api('/transactions/categories');
  categories = data.categories;
  buildMonthOptions();
  await loadBudgets();
})();
