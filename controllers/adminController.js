const db = require('../db/store');
const bcrypt = require('bcryptjs');
const { monthlyExpenses } = require('./transactionController');

exports.getStats = async (req, res, next) => {
  try {
    const totalUsers = db.count('users', {});
    const totalTransactions = db.count('transactions', {});
    const totalBudgets = db.count('budgets', {});
    const totalGoals = db.count('goals', {});
    const adminCount = db.count('users', { role: 'admin' });

    const today = new Date().toISOString().slice(0, 10);
    const newUsersToday = db.find('users', {}).filter((u) => u.createdAt.slice(0, 10) === today).length;
    const activeToday = db.find('transactions', {}).filter((t) => t.updatedAt.slice(0, 10) === today).length;

    res.json({
      totalUsers,
      totalTransactions,
      totalBudgets,
      totalGoals,
      adminCount,
      newUsersToday,
      activeToday,
    });
  } catch (error) {
    next(error);
  }
};

exports.getUsers = async (req, res, next) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100);
    const search = req.query.search ? req.query.search.trim() : '';

    const filter = search
      ? { $or: [{ name: { $regex: search } }, { email: { $regex: search } }] }
      : {};

    let users = db.find('users', filter, { sort: { createdAt: -1 } });
    const total = users.length;
    users = users.slice((page - 1) * limit, page * limit);

    const withCounts = users.map((u) => {
      const txns = db.find('transactions', { user: u._id });
      return {
        _id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        currency: u.currency,
        createdAt: u.createdAt,
        transactionCount: txns.length,
        transactionTotal: txns.reduce((s, t) => s + t.amount, 0),
      };
    });

    res.json({ users: withCounts, total, page, pages: Math.ceil(total / limit) });
  } catch (error) {
    next(error);
  }
};

exports.getUserDetail = async (req, res, next) => {
  try {
    const user = db.findOne('users', { _id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const spentMap = monthlyExpenses(user._id, month, year);

    const transactions = db.find('transactions', { user: user._id }, { sort: { date: -1 }, limit: 50 });
    const budgets = db.find('budgets', { user: user._id, month, year });
    const goals = db.find('goals', { user: user._id });

    const allTx = db.find('transactions', { user: user._id });
    const totalIncome = allTx.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const totalExpense = allTx.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    res.json({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        currency: user.currency,
        createdAt: user.createdAt,
      },
      summary: {
        totalIncome,
        totalExpense,
        monthSpent: Object.values(spentMap).reduce((a, b) => a + b, 0),
      },
      transactions: transactions.map((t) => ({
        _id: t._id,
        type: t.type,
        amount: t.amount,
        category: t.category,
        description: t.description,
        date: t.date,
      })),
      budgets: budgets.map((b) => ({ _id: b._id, category: b.category, amount: b.amount, spent: spentMap[b.category] || 0 })),
      goals: goals.map((g) => ({
        _id: g._id,
        name: g.name,
        targetAmount: g.targetAmount,
        savedAmount: g.savedAmount,
        status: g.status,
        progress: g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0,
      })),
    });
  } catch (error) {
    next(error);
  }
};

exports.updateUser = async (req, res, next) => {
  try {
    const user = db.findOne('users', { _id: req.params.id });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, email, role, currency, password } = req.body;
    if (name) user.name = name;
    if (email) {
      const normalized = email.toLowerCase().trim();
      const dup = db.findOne('users', { email: normalized, _id: { $ne: req.params.id } });
      if (dup) return res.status(400).json({ message: 'Email already in use' });
      user.email = normalized;
    }
    if (role && ['user', 'admin'].includes(role)) user.role = role;
    if (currency) user.currency = currency;
    if (password) {
      if (password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
      user.password = await bcrypt.hash(password, 10);
    }
    const saved = await db.save('users', user);
    res.json({ message: 'User updated', user: { _id: saved._id, name: saved.name, email: saved.email, role: saved.role, currency: saved.currency } });
  } catch (error) {
    next(error);
  }
};

exports.deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (req.userId === id) {
      return res.status(400).json({ message: 'You cannot delete your own account' });
    }
    const removed = await db.deleteMany('users', { _id: id });
    if (!removed) return res.status(404).json({ message: 'User not found' });

    await Promise.all([
      db.deleteMany('transactions', { user: id }),
      db.deleteMany('budgets', { user: id }),
      db.deleteMany('goals', { user: id }),
    ]);
    res.json({ message: 'User and all related data deleted' });
  } catch (error) {
    next(error);
  }
};

exports.deleteUserTransaction = async (req, res, next) => {
  try {
    const removed = await db.deleteMany('transactions', { _id: req.params.id });
    if (!removed) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    next(error);
  }
};
