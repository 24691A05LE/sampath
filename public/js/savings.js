App.requireAuth();
AppNav.inject('savings');

let goalsCache = [];

function goalCard(g) {
  const achieved = g.status === 'achieved';
  const pct = Math.min(g.progress, 100);
  const ring = achieved ? '#10b981' : g.progress >= 75 ? '#f59e0b' : '#4f46e5';
  const dateTxt = g.targetDate ? App.date(g.targetDate) : 'No deadline';
  return `<div class="goal-card">
    <div class="goal-head">
      <strong>${App.esc(g.name)}</strong>
      <span class="tag ${achieved ? 'tag-income' : ''}">${App.esc(g.status)}</span>
    </div>
    <div class="goal-ring" style="--pct:${pct * 3.6}deg;--ring:${ring}">
      <div class="goal-ring-inner"><span>${g.progress}%</span></div>
    </div>
    <div class="goal-numbers">
      <div>Saved <strong>${App.money(g.savedAmount)}</strong></div>
      <div>Target <strong>${App.money(g.targetAmount)}</strong></div>
      <div>Remaining <strong class="text-expense">${App.money(g.remaining)}</strong></div>
      <div class="muted small">${dateTxt}</div>
    </div>
    ${g.note ? `<p class="muted small">${App.esc(g.note)}</p>` : ''}
    <div class="budget-actions">
      <button class="btn btn-primary btn-sm" data-contrib="${g._id}">+ Contribute</button>
      <button class="btn btn-ghost btn-sm" data-edit="${g._id}">Edit</button>
      <button class="btn btn-danger-outline btn-sm" data-del="${g._id}">Delete</button>
    </div>
  </div>`;
}

async function loadGoals() {
  const data = await App.api('/savings');
  goalsCache = data.goals;
  const list = document.getElementById('goalList');
  if (!data.goals.length) {
    list.innerHTML = '<p class="empty">No savings goals yet. Click "New goal" to create one.</p>';
    return;
  }
  list.innerHTML = data.goals.map(goalCard).join('');
  list.querySelectorAll('[data-contrib]').forEach((b) => b.addEventListener('click', () => openContrib(b.dataset.contrib)));
  list.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openEdit(b.dataset.edit)));
  list.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => del(b.dataset.del)));
}

// Goal modal
const goalModal = document.getElementById('goalModal');
const goalId = document.getElementById('goalId');

function openAdd() {
  document.getElementById('modalTitle').textContent = 'New savings goal';
  goalId.value = '';
  document.getElementById('goalForm').reset();
  goalModal.classList.remove('hidden');
}

function openEdit(id) {
  const g = goalsCache.find((x) => x._id === id);
  if (!g) return;
  document.getElementById('modalTitle').textContent = 'Edit savings goal';
  goalId.value = id;
  document.getElementById('goalName').value = g.name;
  document.getElementById('goalTarget').value = g.targetAmount;
  document.getElementById('goalDate').value = g.targetDate ? g.targetDate.slice(0, 10) : '';
  document.getElementById('goalNote').value = g.note || '';
  goalModal.classList.remove('hidden');
}

function closeGoalModal() { goalModal.classList.add('hidden'); }

document.getElementById('addGoalBtn').addEventListener('click', openAdd);
document.getElementById('modalClose').addEventListener('click', closeGoalModal);
document.getElementById('modalCancel').addEventListener('click', closeGoalModal);
goalModal.addEventListener('click', (e) => { if (e.target === goalModal) closeGoalModal(); });

document.getElementById('goalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = goalId.value;
  const payload = {
    name: document.getElementById('goalName').value,
    targetAmount: document.getElementById('goalTarget').value,
    targetDate: document.getElementById('goalDate').value,
    note: document.getElementById('goalNote').value,
  };
  try {
    if (id) await App.api('/savings/' + id, { method: 'PUT', body: JSON.stringify(payload) });
    else await App.api('/savings', { method: 'POST', body: JSON.stringify(payload) });
    closeGoalModal();
    loadGoals();
  } catch (err) {
    alert(err.message);
  }
});

// Contribution modal
const contribModal = document.getElementById('contribModal');

function openContrib(id) {
  document.getElementById('contribGoalId').value = id;
  document.getElementById('contribAmount').value = '';
  contribModal.classList.remove('hidden');
}

function closeContribModal() { contribModal.classList.add('hidden'); }

document.getElementById('contribClose').addEventListener('click', closeContribModal);
document.getElementById('contribCancel').addEventListener('click', closeContribModal);
contribModal.addEventListener('click', (e) => { if (e.target === contribModal) closeContribModal(); });

document.getElementById('contribSave').addEventListener('click', async () => {
  const id = document.getElementById('contribGoalId').value;
  const amount = document.getElementById('contribAmount').value;
  try {
    await App.api(`/savings/${id}/contribute`, { method: 'POST', body: JSON.stringify({ amount }) });
    closeContribModal();
    loadGoals();
  } catch (err) {
    alert(err.message);
  }
});

async function del(id) {
  if (!confirm('Delete this savings goal?')) return;
  try {
    await App.api('/savings/' + id, { method: 'DELETE' });
    loadGoals();
  } catch (err) {
    alert(err.message);
  }
}

loadGoals().catch((err) => alert(err.message));
