if (!App.requireAdmin()) throw new Error('redirecting');
AppNav.inject('admin');

let currentPage = 1;
const perPage = 15;

async function loadStats() {
  const s = await App.api('/admin/stats');
  const cards = [
    { label: 'Total users', value: s.totalUsers, cls: 'balance' },
    { label: 'Transactions', value: s.totalTransactions, cls: 'income' },
    { label: 'Budgets', value: s.totalBudgets, cls: 'savings' },
    { label: 'Savings goals', value: s.totalGoals, cls: 'balance' },
    { label: 'New users today', value: s.newUsersToday, cls: 'income' },
    { label: 'Activity today', value: s.activeToday, cls: 'savings' },
  ];
  document.getElementById('adminStats').innerHTML = cards
    .map((c) => `<div class="stat-card ${c.cls}"><div><div class="stat-value">${c.value}</div><div class="stat-label">${App.esc(c.label)}</div></div></div>`)
    .join('');
}

function userRow(u) {
  const mine = u._id === App.state.user._id;
  return `<tr>
    <td><strong>${App.esc(u.name)}</strong>${mine ? ' <span class="tag tag-income">you</span>' : ''}</td>
    <td>${App.esc(u.email)}</td>
    <td><span class="tag ${u.role === 'admin' ? 'tag-admin' : ''}">${u.role}</span></td>
    <td>${App.date(u.createdAt)}</td>
    <td>${u.transactionCount}</td>
    <td>${App.money(u.transactionTotal)}</td>
    <td class="row-actions">
      <button class="btn btn-ghost btn-sm" data-view="${u._id}">View</button>
      <button class="btn btn-ghost btn-sm" data-edit="${u._id}">Edit</button>
      ${mine ? '' : `<button class="btn btn-danger-outline btn-sm" data-del="${u._id}">Delete</button>`}
    </td>
  </tr>`;
}

async function loadUsers(page = 1) {
  currentPage = page;
  const search = document.getElementById('userSearch').value.trim();
  const params = new URLSearchParams({ page, limit: perPage });
  if (search) params.set('search', search);
  const data = await App.api('/admin/users?' + params.toString());
  const wrap = document.getElementById('userListWrap');
  if (!data.users.length) {
    wrap.innerHTML = '<p class="empty">No users found.</p>';
    document.getElementById('userPagination').innerHTML = '';
    return;
  }
  wrap.innerHTML = `<table class="table">
    <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Joined</th><th># Tx</th><th>Total</th><th>Actions</th></tr></thead>
    <tbody>${data.users.map(userRow).join('')}</tbody>
  </table>`;
  const pages = Math.max(data.pages, 1);
  let pag = '';
  if (currentPage > 1) pag += `<button class="btn btn-outline btn-sm" data-page="${currentPage - 1}">&larr; Prev</button>`;
  pag += `<span class="page-info">Page ${currentPage} of ${pages} (${data.total} users)</span>`;
  if (currentPage < pages) pag += `<button class="btn btn-outline btn-sm" data-page="${currentPage + 1}">Next &rarr;</button>`;
  document.getElementById('userPagination').innerHTML = pag;

  wrap.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => viewUser(b.dataset.view)));
  wrap.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEdit(b.dataset.edit)));
  wrap.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => del(b.dataset.del)));
  document.querySelectorAll('#userPagination [data-page]').forEach((b) => b.addEventListener('click', () => loadUsers(parseInt(b.dataset.page))));
}

// View user detail
async function viewUser(id) {
  try {
    const data = await App.api('/admin/users/' + id);
    const u = data.user;
    const txRows = data.transactions.slice(0, 10)
      .map((t) => `<li>${App.date(t.date)} - <strong>${App.esc(t.category)}</strong> - <span class="${t.type === 'income' ? 'text-income' : 'text-expense'}">${t.type === 'income' ? '+' : '-'}${App.money(t.amount)}</span></li>`)
      .join('');
    const budgetRows = data.budgets.length
      ? data.budgets.map((b) => `<li>${App.esc(b.category)}: <strong>${App.money(b.spent)}</strong> / ${App.money(b.amount)}</li>`).join('')
      : '<li>None this month</li>';
    const goalRows = data.goals.length
      ? data.goals.map((g) => `<li>${App.esc(g.name)}: ${g.progress}% (<span class="${g.status === 'achieved' ? 'text-income' : ''}">${g.status}</span>)</li>`).join('')
      : '<li>None</li>';

    document.getElementById('userModalTitle').textContent = u.name;
    document.getElementById('userDetailBody').innerHTML = `
      <div class="detail-summary">
        <div><span class="muted">Email</span><br><strong>${App.esc(u.email)}</strong></div>
        <div><span class="muted">Role</span><br><span class="tag ${u.role === 'admin' ? 'tag-admin' : ''}">${u.role}</span></div>
        <div><span class="muted">Joined</span><br><strong>${App.date(u.createdAt)}</strong></div>
        <div><span class="muted">Total income</span><br><strong class="text-income">${App.money(data.summary.totalIncome)}</strong></div>
        <div><span class="muted">Total expense</span><br><strong class="text-expense">${App.money(data.summary.totalExpense)}</strong></div>
        <div><span class="muted">Spent this month</span><br><strong>${App.money(data.summary.monthSpent)}</strong></div>
      </div>
      <h4>Recent transactions</h4><ul class="detail-list">${txRows || '<li>None</li>'}</ul>
      <h4>Budgets (this month)</h4><ul class="detail-list">${budgetRows}</ul>
      <h4>Savings goals</h4><ul class="detail-list">${goalRows}</ul>`;
    document.getElementById('userModalActions').innerHTML = `
      <button class="btn btn-outline" id="userModalClose2">Close</button>
      <button class="btn btn-primary" id="viewEditBtn">Edit user</button>`;
    document.getElementById('userModal').classList.remove('hidden');
    document.getElementById('userModalClose').addEventListener('click', closeUserModal);
    document.getElementById('userModalClose2').addEventListener('click', closeUserModal);
    document.getElementById('viewEditBtn').addEventListener('click', () => { closeUserModal(); openEdit(id); });
  } catch (err) {
    alert(err.message);
  }
}

function closeUserModal() { document.getElementById('userModal').classList.add('hidden'); }

// Edit user
const editUserModal = document.getElementById('editUserModal');

function openEdit(id) {
  App.api('/admin/users/' + id).then((data) => {
    const u = data.user;
    document.getElementById('editUserId').value = u._id;
    document.getElementById('editName').value = u.name;
    document.getElementById('editEmail').value = u.email;
    document.getElementById('editRole').value = u.role;
    document.getElementById('editCurrency').value = u.currency || 'USD';
    document.getElementById('editPassword').value = '';
    editUserModal.classList.remove('hidden');
  }).catch((err) => alert(err.message));
}

function closeEditModal() { editUserModal.classList.add('hidden'); }

document.getElementById('editUserClose').addEventListener('click', closeEditModal);
document.getElementById('editUserCancel').addEventListener('click', closeEditModal);
editUserModal.addEventListener('click', (e) => { if (e.target === editUserModal) closeEditModal(); });

document.getElementById('editUserForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editUserId').value;
  const payload = {
    name: document.getElementById('editName').value,
    email: document.getElementById('editEmail').value,
    role: document.getElementById('editRole').value,
    currency: document.getElementById('editCurrency').value,
    password: document.getElementById('editPassword').value || undefined,
  };
  try {
    await App.api('/admin/users/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    closeEditModal();
    if (id === App.state.user._id) await App.refreshUser();
    loadUsers(currentPage);
  } catch (err) {
    alert(err.message);
  }
});

async function del(id) {
  if (!confirm('Delete this user and ALL their data? This cannot be undone.')) return;
  try {
    await App.api('/admin/users/' + id, { method: 'DELETE' });
    loadStats();
    loadUsers(currentPage);
  } catch (err) {
    alert(err.message);
  }
}

document.getElementById('searchBtn').addEventListener('click', () => loadUsers(1));
document.getElementById('userSearch').addEventListener('keydown', (e) => { if (e.key === 'Enter') loadUsers(1); });

loadStats();
loadUsers(1);
