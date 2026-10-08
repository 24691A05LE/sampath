App.requireAuth();
AppNav.inject('transactions');

let categories = [];
let currentPage = 1;
const perPage = 15;

const filterType = document.getElementById('filterType');
const filterCategory = document.getElementById('filterCategory');
const filterFrom = document.getElementById('filterFrom');
const filterTo = document.getElementById('filterTo');

async function loadCategories() {
  const data = await App.api('/transactions/categories');
  categories = data.categories;
  filterCategory.innerHTML = '<option value="">All categories</option>' + categories.map((c) => `<option value="${App.esc(c)}">${App.esc(c)}</option>`).join('');
  document.getElementById('txCategory').innerHTML = categories.map((c) => `<option value="${App.esc(c)}">${App.esc(c)}</option>`).join('');
}

function query(page) {
  const params = new URLSearchParams({ page, limit: perPage });
  if (filterType.value) params.set('type', filterType.value);
  if (filterCategory.value) params.set('category', filterCategory.value);
  if (filterFrom.value) params.set('from', filterFrom.value);
  if (filterTo.value) params.set('to', filterTo.value);
  return params.toString();
}

function txRow(t) {
  const sign = t.type === 'income' ? '+' : '-';
  const cls = t.type === 'income' ? 'text-income' : 'text-expense';
  return `<tr>
    <td>${App.date(t.date)}</td>
    <td><span class="tag ${t.type === 'income' ? 'tag-income' : 'tag-expense'}">${t.type}</span></td>
    <td>${App.esc(t.category)}</td>
    <td>${App.esc(t.description || '-')}</td>
    <td class="${cls}">${sign}${App.money(t.amount)}</td>
    <td class="row-actions">
      <button class="btn btn-ghost btn-sm" data-edit="${t._id}">Edit</button>
      <button class="btn btn-danger-outline btn-sm" data-del="${t._id}">Delete</button>
    </td>
  </tr>`;
}

async function loadTransactions(page = 1) {
  currentPage = page;
  const data = await App.api('/transactions?' + query(page));
  const wrap = document.getElementById('txTableWrap');
  if (!data.transactions.length) {
    wrap.innerHTML = '<p class="empty">No transactions found. Add one to get started.</p>';
    document.getElementById('pagination').innerHTML = '';
    document.getElementById('txCount').textContent = '0 records';
    return;
  }
  wrap.innerHTML = `<table class="table">
    <thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th>Amount</th><th>Actions</th></tr></thead>
    <tbody>${data.transactions.map(txRow).join('')}</tbody>
  </table>`;
  document.getElementById('txCount').textContent = `${data.total} records`;

  const pages = Math.max(data.pages, 1);
  let pag = '';
  if (currentPage > 1) pag += `<button class="btn btn-outline btn-sm" data-page="${currentPage - 1}">&larr; Prev</button>`;
  pag += `<span class="page-info">Page ${currentPage} of ${pages}</span>`;
  if (currentPage < pages) pag += `<button class="btn btn-outline btn-sm" data-page="${currentPage + 1}">Next &rarr;</button>`;
  document.getElementById('pagination').innerHTML = pag;

  wrap.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEdit(b.dataset.edit)));
  wrap.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => del(b.dataset.del)));
  document.querySelectorAll('#pagination [data-page]').forEach((b) => b.addEventListener('click', () => loadTransactions(parseInt(b.dataset.page))));
}

// Modal
const modal = document.getElementById('txModal');
const modalTitle = document.getElementById('modalTitle');
const txId = document.getElementById('txId');

function openAdd() {
  modalTitle.textContent = 'Add transaction';
  txId.value = '';
  document.getElementById('txForm').reset();
  document.getElementById('txDate').value = new Date().toISOString().slice(0, 10);
  modal.classList.remove('hidden');
}

function openEdit(id) {
  App.api('/transactions/' + id).then(({ transaction }) => {
    modalTitle.textContent = 'Edit transaction';
    txId.value = transaction._id;
    document.getElementById('txType').value = transaction.type;
    document.getElementById('txAmount').value = transaction.amount;
    document.getElementById('txCategory').value = transaction.category;
    document.getElementById('txDate').value = transaction.date.slice(0, 10);
    document.getElementById('txDescription').value = transaction.description || '';
    modal.classList.remove('hidden');
  });
}

async function del(id) {
  if (!confirm('Delete this transaction?')) return;
  try {
    await App.api('/transactions/' + id, { method: 'DELETE' });
    loadTransactions(currentPage);
  } catch (err) {
    alert(err.message);
  }
}

function closeModal() {
  modal.classList.add('hidden');
}

document.getElementById('addTxBtn').addEventListener('click', openAdd);
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

document.getElementById('txForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = txId.value;
  const payload = {
    type: document.getElementById('txType').value,
    amount: document.getElementById('txAmount').value,
    category: document.getElementById('txCategory').value,
    description: document.getElementById('txDescription').value,
    date: document.getElementById('txDate').value,
  };
  try {
    if (id) await App.api('/transactions/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    else await App.api('/transactions', { method: 'POST', body: JSON.stringify(payload) });
    closeModal();
    loadTransactions(currentPage);
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('filterBtn').addEventListener('click', () => loadTransactions(1));
document.getElementById('clearBtn').addEventListener('click', () => {
  filterType.value = '';
  filterCategory.value = '';
  filterFrom.value = '';
  filterTo.value = '';
  loadTransactions(1);
});

loadCategories().then(() => loadTransactions(1)).catch((err) => alert(err.message));
