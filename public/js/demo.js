// Browser demo mode: a localStorage-backed mock of the FinanceTracker API.
// Active automatically on GitHub Pages (*.github.io) and when opened from disk (file:).
// When served by the real Express server (Render / localhost) this file is a no-op.
(function () {
  const isDemo =
    location.protocol === 'file:' ||
    (location.hostname && location.hostname.endsWith('github.io'));

  if (!isDemo) return;

  const P = 'ft_demo_';
  const CATEGORIES = [
    'Food', 'Transport', 'Housing', 'Utilities', 'Entertainment',
    'Shopping', 'Health', 'Education', 'Salary', 'Business',
    'Investment', 'Other',
  ];

  function read(key, fb) {
    try {
      const raw = localStorage.getItem(P + key);
      return raw ? JSON.parse(raw) : fb;
    } catch (e) {
      return fb;
    }
  }
  function write(key, val) { localStorage.setItem(P + key, JSON.stringify(val)); }
  function uid() { return 'id_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function iso() { return new Date().toISOString(); }
  function pct(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }

  let users = read('users', []);
  if (!users.some((u) => u.email === 'admin@demo.com')) {
    users.push({
      _id: uid(),
      name: 'Demo Admin',
      email: 'admin@demo.com',
      password: 'admin123',
      role: 'admin',
      currency: 'USD',
      createdAt: iso(),
    });
    write('users', users);
  }

  function getUsers() { users = read('users', []); return users; }
  function saveUsers() { write('users', users); }
  function txns(userId) { return read('transactions_' + userId, []); }
  function budgetsOf(userId) { return read('budgets_' + userId, []); }
  function goalsOf(userId) { return read('goals_' + userId, []); }

  function seed(userId) {
    if (localStorage.getItem(P + 'seeded_' + userId)) return;
    const now = new Date();
    const mk = (type, amount, category, description, daysAgo) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      const t = d.toISOString();
      return { _id: uid(), user: userId, type, amount, category, description, date: t, createdAt: t, updatedAt: t };
    };
    write('transactions_' + userId, [
      mk('income', 3200, 'Salary', 'Monthly salary', 2),
      mk('expense', 120, 'Food', 'Groceries', 1),
      mk('expense', 900, 'Housing', 'Rent', 4),
      mk('expense', 80, 'Utilities', 'Electricity bill', 6),
      mk('expense', 45, 'Transport', 'Fuel', 3),
      mk('expense', 150, 'Shopping', 'Clothes', 8),
      mk('expense', 60, 'Health', 'Pharmacy', 10),
      mk('expense', 35, 'Entertainment', 'Movie night', 5),
    ]);
    write('budgets_' + userId, [
      { _id: uid(), user: userId, month: now.getMonth() + 1, year: now.getFullYear(), category: 'Food', amount: 400, note: 'Groceries & dining out' },
      { _id: uid(), user: userId, month: now.getMonth() + 1, year: now.getFullYear(), category: 'Housing', amount: 1000, note: '' },
      { _id: uid(), user: userId, month: now.getMonth() + 1, year: now.getFullYear(), category: 'Transport', amount: 150, note: '' },
    ]);
    write('goals_' + userId, [
      { _id: uid(), user: userId, name: 'Emergency fund', targetAmount: 5000, savedAmount: 1200, targetDate: new Date(now.getFullYear() + 1, now.getMonth(), 1).toISOString(), status: 'active', note: '', createdAt: iso(), updatedAt: iso() },
      { _id: uid(), user: userId, name: 'Vacation trip', targetAmount: 2000, savedAmount: 500, targetDate: null, status: 'active', note: '', createdAt: iso(), updatedAt: iso() },
    ]);
    localStorage.setItem(P + 'seeded_' + userId, '1');
  }

  function publicUser(u) {
    return { _id: u._id, name: u.name, email: u.email, role: u.role, currency: u.currency, createdAt: u.createdAt };
  }

  function currentUser() {
    const stored = JSON.parse(localStorage.getItem('ft_user') || 'null');
    if (!stored) return null;
    return getUsers().find((u) => u._id === stored._id) || null;
  }

  function requireUser() {
    const u = currentUser();
    if (!u) { const e = new Error('Not authenticated'); e.status = 401; throw e; }
    return u;
  }
  function requireAdmin() {
    const u = requireUser();
    if (u.role !== 'admin') { const e = new Error('Admin access required'); e.status = 403; throw e; }
    return u;
  }
  function fail(status, message) {
    const e = new Error(message);
    e.status = status;
    throw e;
  }

  function toPublicTx(t) {
    return { _id: t._id, type: t.type, amount: t.amount, category: t.category, description: t.description, date: t.date, createdAt: t.createdAt };
  }
  function toPublicBudget(b, spent) {
    return { _id: b._id, month: b.month, year: b.year, category: b.category, amount: b.amount, note: b.note, spent: spent || 0 };
  }
  function toPublicGoal(g) {
    return {
      _id: g._id,
      name: g.name,
      targetAmount: g.targetAmount,
      savedAmount: g.savedAmount,
      remaining: Math.max(g.targetAmount - g.savedAmount, 0),
      targetDate: g.targetDate,
      status: g.status,
      note: g.note,
      progress: pct(g.savedAmount, g.targetAmount),
    };
  }

  function monthRange(month, year) {
    return {
      start: new Date(Date.UTC(year, month - 1, 1)).toISOString(),
      end: new Date(Date.UTC(year, month, 1)).toISOString(),
    };
  }
  function inMonth(t, month, year) {
    const { start, end } = monthRange(month, year);
    return t.date >= start && t.date < end;
  }
  function spentByCategory(userId, month, year) {
    const map = {};
    txns(userId).forEach((t) => {
      if (t.type === 'expense' && inMonth(t, month, year)) map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }

  function routeAuth(method, segs, body) {
    const sub = segs[1];
    if (method === 'POST' && sub === 'login') {
      const email = String(body.email || '').toLowerCase().trim();
      const user = getUsers().find((u) => u.email === email);
      if (!user || user.password !== body.password) fail(401, 'Invalid email or password');
      seed(user._id);
      return { token: 'demo.' + user._id, user: publicUser(user) };
    }
    if (method === 'POST' && sub === 'register') {
      const name = String(body.name || '').trim();
      const email = String(body.email || '').toLowerCase().trim();
      const password = String(body.password || '');
      if (!name || !email || !password) fail(400, 'Name, email and password are required');
      if (password.length < 6) fail(400, 'Password must be at least 6 characters');
      const list = getUsers();
      if (list.some((u) => u.email === email)) fail(400, 'An account with this email already exists');
      const user = { _id: uid(), name, email, password, role: 'user', currency: 'USD', createdAt: iso() };
      list.push(user);
      saveUsers();
      seed(user._id);
      return { __status: 201, token: 'demo.' + user._id, user: publicUser(user) };
    }
    if (method === 'GET' && sub === 'me') {
      return { user: publicUser(requireUser()) };
    }
    fail(404, 'Not found');
  }

  function routeTx(method, segs, body, qs) {
    if (segs[1] === 'categories') return { categories: CATEGORIES };
    const u = requireUser();
    let list = txns(u._id);

    if (method === 'GET' && segs.length === 1) {
      let filtered = list.slice();
      const type = qs.get('type');
      const category = qs.get('category');
      const from = qs.get('from');
      const to = qs.get('to');
      if (type) filtered = filtered.filter((t) => t.type === type);
      if (category) filtered = filtered.filter((t) => t.category === category);
      if (from) filtered = filtered.filter((t) => t.date >= new Date(from).toISOString());
      if (to) filtered = filtered.filter((t) => t.date <= new Date(to + 'T23:59:59.999Z').toISOString());
      filtered.sort((a, b) => (a.date < b.date ? 1 : -1));
      const page = Math.max(parseInt(qs.get('page')) || 1, 1);
      const limit = Math.min(Math.max(parseInt(qs.get('limit')) || 50, 1), 200);
      const total = filtered.length;
      return {
        transactions: filtered.slice((page - 1) * limit, page * limit).map(toPublicTx),
        total,
        page,
        pages: Math.ceil(total / limit),
      };
    }

    const id = segs[1];
    if (method === 'POST' && segs.length === 1) {
      const { type, amount, category, description, date } = body;
      if (!type || !amount || !category) fail(400, 'type, amount and category are required');
      if (type !== 'income' && type !== 'expense') fail(400, 'type must be income or expense');
      const now = iso();
      const tx = {
        _id: uid(),
        user: u._id,
        type,
        amount: Number(amount),
        category,
        description: description || '',
        date: date ? new Date(date).toISOString() : now,
        createdAt: now,
        updatedAt: now,
      };
      list.push(tx);
      write('transactions_' + u._id, list);
      return { __status: 201, transaction: toPublicTx(tx) };
    }
    if (method === 'GET' && id) {
      const tx = list.find((t) => t._id === id);
      if (!tx) fail(404, 'Transaction not found');
      return { transaction: toPublicTx(tx) };
    }
    if (method === 'PUT' && id) {
      const tx = list.find((t) => t._id === id);
      if (!tx) fail(404, 'Transaction not found');
      const { type, amount, category, description, date } = body;
      if (type) tx.type = type;
      if (amount) tx.amount = Number(amount);
      if (category) tx.category = category;
      if (description !== undefined) tx.description = description;
      if (date) tx.date = new Date(date).toISOString();
      tx.updatedAt = iso();
      write('transactions_' + u._id, list);
      return { transaction: toPublicTx(tx) };
    }
    if (method === 'DELETE' && id) {
      const idx = list.findIndex((t) => t._id === id);
      if (idx === -1) fail(404, 'Transaction not found');
      list.splice(idx, 1);
      write('transactions_' + u._id, list);
      return { message: 'Transaction deleted' };
    }
    fail(404, 'Not found');
  }

  function routeBudgets(method, segs, body, qs) {
    const u = requireUser();
    let list = budgetsOf(u._id);
    const month = parseInt(qs.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(qs.get('year')) || new Date().getFullYear();

    if (method === 'GET' && segs.length === 1) {
      const spent = spentByCategory(u._id, month, year);
      const budgets = list
        .filter((b) => b.month === month && b.year === year)
        .sort((a, b) => (a.category < b.category ? -1 : 1))
        .map((b) => toPublicBudget(b, spent[b.category] || 0));
      return { budgets };
    }
    if (method === 'POST' && segs.length === 1) {
      const m = parseInt(body.month) || new Date().getMonth() + 1;
      const y = parseInt(body.year) || new Date().getFullYear();
      const { category, amount, note } = body;
      if (!category || !amount) fail(400, 'category and amount are required');
      if (m < 1 || m > 12) fail(400, 'Invalid month');
      if (list.some((b) => b.month === m && b.year === y && b.category === category)) {
        fail(400, 'A budget for ' + category + ' already exists for this month');
      }
      const b = { _id: uid(), user: u._id, month: m, year: y, category, amount: Number(amount), note: note || '' };
      list.push(b);
      write('budgets_' + u._id, list);
      return { __status: 201, budget: toPublicBudget(b, 0) };
    }

    const id = segs[1];
    const b = list.find((x) => x._id === id);
    if (!b) fail(404, 'Budget not found');
    if (method === 'PUT') {
      const { amount, note } = body;
      if (amount) b.amount = Number(amount);
      if (note !== undefined) b.note = note;
      write('budgets_' + u._id, list);
      const spent = spentByCategory(u._id, b.month, b.year);
      return { budget: toPublicBudget(b, spent[b.category] || 0) };
    }
    if (method === 'DELETE') {
      const idx = list.findIndex((x) => x._id === id);
      list.splice(idx, 1);
      write('budgets_' + u._id, list);
      return { message: 'Budget deleted' };
    }
    fail(404, 'Not found');
  }

  function routeSavings(method, segs, body) {
    const u = requireUser();
    let list = goalsOf(u._id);

    if (method === 'GET' && segs.length === 1) {
      return { goals: list.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map(toPublicGoal) };
    }
    if (method === 'POST' && segs.length === 1) {
      const { name, targetAmount, targetDate, note } = body;
      if (!name || !targetAmount) fail(400, 'name and targetAmount are required');
      const now = iso();
      const g = {
        _id: uid(),
        user: u._id,
        name,
        targetAmount: Number(targetAmount),
        savedAmount: 0,
        targetDate: targetDate ? new Date(targetDate).toISOString() : null,
        status: 'active',
        note: note || '',
        createdAt: now,
        updatedAt: now,
      };
      list.push(g);
      write('goals_' + u._id, list);
      return { __status: 201, goal: toPublicGoal(g) };
    }

    const id = segs[1];
    const g = list.find((x) => x._id === id);
    if (!g) fail(404, 'Goal not found');

    if (method === 'POST' && segs[2] === 'contribute') {
      const amount = Number(body.amount);
      if (!amount || amount <= 0) fail(400, 'A positive amount is required');
      g.savedAmount += amount;
      if (g.savedAmount >= g.targetAmount) g.status = 'achieved';
      g.updatedAt = iso();
      write('goals_' + u._id, list);
      return { goal: toPublicGoal(g) };
    }
    if (method === 'PUT') {
      const { name, targetAmount, savedAmount, targetDate, status, note } = body;
      if (name) g.name = name;
      if (targetAmount) g.targetAmount = Number(targetAmount);
      if (savedAmount !== undefined) g.savedAmount = Math.max(Number(savedAmount), 0);
      if (targetDate !== undefined) g.targetDate = targetDate ? new Date(targetDate).toISOString() : null;
      if (status) g.status = status;
      if (note !== undefined) g.note = note;
      if (g.savedAmount >= g.targetAmount) g.status = 'achieved';
      else if (g.status === 'achieved') g.status = 'active';
      g.updatedAt = iso();
      write('goals_' + u._id, list);
      return { goal: toPublicGoal(g) };
    }
    if (method === 'DELETE') {
      const idx = list.findIndex((x) => x._id === id);
      list.splice(idx, 1);
      write('goals_' + u._id, list);
      return { message: 'Goal deleted' };
    }
    fail(404, 'Not found');
  }

  function routeAnalytics(method, segs, qs) {
    const u = requireUser();
    const sub = segs[1];
    const month = parseInt(qs.get('month')) || new Date().getMonth() + 1;
    const year = parseInt(qs.get('year')) || new Date().getFullYear();
    const list = txns(u._id);

    if (sub === 'summary') {
      const income = list.filter((t) => t.type === 'income' && inMonth(t, month, year)).reduce((s, t) => s + t.amount, 0);
      const expense = list.filter((t) => t.type === 'expense' && inMonth(t, month, year)).reduce((s, t) => s + t.amount, 0);
      const totalIncome = list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const totalExpense = list.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      return {
        month,
        year,
        income,
        expense,
        balance: income - expense,
        savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
        totalIncome,
        totalExpense,
      };
    }
    if (sub === 'categories') {
      const type = qs.get('type');
      const rows = list.filter((t) => {
        if (!inMonth(t, month, year)) return false;
        if (type === 'income') return t.type === 'income';
        if (type === 'all') return true;
        return t.type === 'expense';
      });
      const byCat = {};
      rows.forEach((r) => (byCat[r.category] = (byCat[r.category] || 0) + r.amount));
      const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((s, [, v]) => s + v, 0);
      return {
        categories: entries.map(([category, t]) => ({ category, total: t, percentage: total > 0 ? Math.round((t / total) * 100) : 0 })),
        total,
      };
    }
    if (sub === 'trend') {
      const days = parseInt(qs.get('days')) || 30;
      const { start, end } = monthRange(month, year);
      const effectiveStart = qs.get('days') ? new Date(new Date(end).getTime() - (days - 1) * 86400000).toISOString() : start;
      const rows = list.filter((t) => t.date >= effectiveStart && t.date < end);
      const byDay = {};
      rows.forEach((r) => {
        const day = r.date.slice(0, 10);
        if (!byDay[day]) byDay[day] = { date: day, income: 0, expense: 0 };
        byDay[day][r.type] = (byDay[day][r.type] || 0) + r.amount;
      });
      return { trend: Object.values(byDay).sort((a, b) => (a.date < b.date ? -1 : 1)) };
    }
    if (sub === 'comparison') {
      const months = parseInt(qs.get('months')) || 6;
      const now = new Date();
      const thisYear = now.getFullYear();
      const thisMonth = now.getMonth() + 1;
      const points = [];
      for (let i = months - 1; i >= 0; i--) {
        let m = thisMonth - i;
        let y = thisYear;
        while (m <= 0) { m += 12; y--; }
        const income = list.filter((t) => t.type === 'income' && inMonth(t, m, y)).reduce((s, t) => s + t.amount, 0);
        const expense = list.filter((t) => t.type === 'expense' && inMonth(t, m, y)).reduce((s, t) => s + t.amount, 0);
        points.push({
          month: new Date(Date.UTC(2000, m - 1, 1)).toLocaleString('en-US', { month: 'short' }) + ' ' + y,
          income,
          expense,
        });
      }
      return { points };
    }
    if (sub === 'export') {
      const from = qs.get('from');
      const to = qs.get('to');
      let filtered = list.slice();
      if (from) filtered = filtered.filter((t) => t.date >= new Date(from).toISOString());
      if (to) filtered = filtered.filter((t) => t.date <= new Date(to + 'T23:59:59.999Z').toISOString());
      filtered.sort((a, b) => (a.date < b.date ? -1 : 1));
      return { transactions: filtered.map((t) => ({ date: t.date.slice(0, 10), type: t.type, category: t.category, amount: t.amount, description: t.description })) };
    }
    fail(404, 'Not found');
  }

  function routeAdmin(method, segs, body, qs) {
    requireAdmin();
    const all = getUsers();

    if (segs[1] === 'stats') {
      const today = new Date().toISOString().slice(0, 10);
      let totalTransactions = 0;
      let totalBudgets = 0;
      let totalGoals = 0;
      let activeToday = 0;
      all.forEach((u) => {
        const t = txns(u._id);
        totalTransactions += t.length;
        totalBudgets += budgetsOf(u._id).length;
        totalGoals += goalsOf(u._id).length;
        activeToday += t.filter((x) => x.updatedAt && x.updatedAt.slice(0, 10) === today).length;
      });
      return {
        totalUsers: all.length,
        totalTransactions,
        totalBudgets,
        totalGoals,
        adminCount: all.filter((u) => u.role === 'admin').length,
        newUsersToday: all.filter((u) => u.createdAt.slice(0, 10) === today).length,
        activeToday,
      };
    }

    if (segs[1] === 'users') {
      if (method === 'GET' && segs.length === 2) {
        const page = Math.max(parseInt(qs.get('page')) || 1, 1);
        const limit = Math.min(Math.max(parseInt(qs.get('limit')) || 20, 1), 100);
        const search = (qs.get('search') || '').trim().toLowerCase();
        let list = all.slice().sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        if (search) list = list.filter((u) => u.name.toLowerCase().includes(search) || u.email.toLowerCase().includes(search));
        const total = list.length;
        const users = list.slice((page - 1) * limit, page * limit).map((u) => {
          const t = txns(u._id);
          return {
            _id: u._id,
            name: u.name,
            email: u.email,
            role: u.role,
            currency: u.currency,
            createdAt: u.createdAt,
            transactionCount: t.length,
            transactionTotal: t.reduce((s, x) => s + x.amount, 0),
          };
        });
        return { users, total, page, pages: Math.ceil(total / limit) };
      }

      const id = segs[2];
      const user = all.find((u) => u._id === id);
      if (!user) fail(404, 'User not found');

      if (method === 'GET') {
        const now = new Date();
        const month = now.getMonth() + 1;
        const year = now.getFullYear();
        const spent = spentByCategory(user._id, month, year);
        const transactions = txns(user._id).slice().sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 50)
          .map((t) => ({ _id: t._id, type: t.type, amount: t.amount, category: t.category, description: t.description, date: t.date }));
        const budgets = budgetsOf(user._id).filter((b) => b.month === month && b.year === year)
          .map((b) => ({ _id: b._id, category: b.category, amount: b.amount, spent: spent[b.category] || 0 }));
        const goals = goalsOf(user._id).map((g) => ({ _id: g._id, name: g.name, targetAmount: g.targetAmount, savedAmount: g.savedAmount, status: g.status, progress: pct(g.savedAmount, g.targetAmount) }));
        const allTx = txns(user._id);
        const totalIncome = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const totalExpense = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        return {
          user: { _id: user._id, name: user.name, email: user.email, role: user.role, currency: user.currency, createdAt: user.createdAt },
          summary: { totalIncome, totalExpense, monthSpent: Object.values(spent).reduce((a, b) => a + b, 0) },
          transactions,
          budgets,
          goals,
        };
      }
      if (method === 'PUT') {
        const { name, email, role, currency, password } = body;
        if (name) user.name = name;
        if (email) {
          const normalized = email.toLowerCase().trim();
          if (all.some((u) => u.email === normalized && u._id !== id)) fail(400, 'Email already in use');
          user.email = normalized;
        }
        if (role && (role === 'user' || role === 'admin')) user.role = role;
        if (currency) user.currency = currency;
        if (password) {
          if (password.length < 6) fail(400, 'Password must be at least 6 characters');
          user.password = password;
        }
        saveUsers();
        return { message: 'User updated', user: { _id: user._id, name: user.name, email: user.email, role: user.role, currency: user.currency } };
      }
      if (method === 'DELETE') {
        const admin = currentUser();
        if (admin && admin._id === id) fail(400, 'You cannot delete your own account');
        const idx = all.findIndex((u) => u._id === id);
        if (idx === -1) fail(404, 'User not found');
        all.splice(idx, 1);
        saveUsers();
        localStorage.removeItem(P + 'transactions_' + id);
        localStorage.removeItem(P + 'budgets_' + id);
        localStorage.removeItem(P + 'goals_' + id);
        localStorage.removeItem(P + 'seeded_' + id);
        return { message: 'User and all related data deleted' };
      }
      fail(404, 'Not found');
    }
    fail(404, 'Not found');
  }

  function route(method, segs, body, qs) {
    const head = segs[0];
    switch (head) {
      case 'auth': return routeAuth(method, segs, body);
      case 'transactions': return routeTx(method, segs, body, qs);
      case 'budgets': return routeBudgets(method, segs, body, qs);
      case 'savings': return routeSavings(method, segs, body);
      case 'analytics': return routeAnalytics(method, segs, qs);
      case 'admin': return routeAdmin(method, segs, body, qs);
      default: fail(404, 'Not found');
    }
  }

  function mockApi(path, options) {
    const method = ((options && options.method) || 'GET').toUpperCase();
    const body = options && options.body ? JSON.parse(options.body) : {};
    const url = new URL(path, location.href);
    let segs = url.pathname.split('/').filter(Boolean);
    const apiIdx = segs.indexOf('api');
    if (apiIdx !== -1) segs = segs.slice(apiIdx + 1);
    const qs = url.searchParams;

    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          resolve(route(method, segs, body, qs));
        } catch (err) {
          const e = err instanceof Error ? err : new Error('Request failed');
          if (!e.status) e.status = 500;
          reject(e);
        }
      }, 120);
    });
  }

  App.api = mockApi;

  const logged = currentUser();
  if (logged) seed(logged._id);
})();
