const db = require('../db/store');

const TRANSACTION_CATEGORIES = [
  'Food',
  'Transport',
  'Housing',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Health',
  'Education',
  'Salary',
  'Business',
  'Investment',
  'Other',
];

function toPublic(t) {
  return {
    _id: t._id,
    type: t.type,
    amount: t.amount,
    category: t.category,
    description: t.description,
    date: t.date,
    createdAt: t.createdAt,
  };
}

exports.getTransactions = async (req, res, next) => {
  try {
    const { type, category, from, to, page = 1, limit = 50 } = req.query;
    const filter = { user: req.userId };

    if (type && ['income', 'expense'].includes(type)) filter.type = type;
    if (category) filter.category = category;

    const dateFilter = {};
    if (from) dateFilter.$gte = new Date(from).toISOString();
    if (to) dateFilter.$lte = new Date(to + 'T23:59:59.999Z').toISOString();
    if (from || to) filter.date = dateFilter;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

    const total = db.count('transactions', filter);
    const docs = db.find('transactions', filter, {
      sort: { date: -1 },
      skip: (pageNum - 1) * limitNum,
      limit: limitNum,
    });

    res.json({ transactions: docs.map(toPublic), total, page: pageNum, pages: Math.ceil(total / limitNum) });
  } catch (error) {
    next(error);
  }
};

exports.createTransaction = async (req, res, next) => {
  try {
    const { type, amount, category, description, date } = req.body;
    if (!type || !amount || !category) {
      return res.status(400).json({ message: 'type, amount and category are required' });
    }
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({ message: 'type must be income or expense' });
    }
    const tx = await db.insert('transactions', {
      user: req.userId,
      type,
      amount: Number(amount),
      category,
      description: description || '',
      date: date ? new Date(date).toISOString() : new Date().toISOString(),
    });
    res.status(201).json({ transaction: toPublic(tx) });
  } catch (error) {
    next(error);
  }
};

exports.getTransaction = async (req, res, next) => {
  try {
    const tx = db.findOne('transactions', { _id: req.params.id, user: req.userId });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ transaction: toPublic(tx) });
  } catch (error) {
    next(error);
  }
};

exports.updateTransaction = async (req, res, next) => {
  try {
    const tx = db.findOne('transactions', { _id: req.params.id, user: req.userId });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });

    const { type, amount, category, description, date } = req.body;
    if (type) tx.type = type;
    if (amount) tx.amount = Number(amount);
    if (category) tx.category = category;
    if (description !== undefined) tx.description = description;
    if (date) tx.date = new Date(date).toISOString();
    const saved = await db.save('transactions', tx);
    res.json({ transaction: toPublic(saved) });
  } catch (error) {
    next(error);
  }
};

exports.deleteTransaction = async (req, res, next) => {
  try {
    const removed = await db.deleteMany('transactions', { _id: req.params.id, user: req.userId });
    if (!removed) return res.status(404).json({ message: 'Transaction not found' });
    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    res.json({ categories: TRANSACTION_CATEGORIES });
  } catch (error) {
    next(error);
  }
};

// ---- Shared helpers (used by budgets, analytics, admin) ----

function monthlyExpenses(userId, month, year) {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  const rows = db.find('transactions', {
    user: userId,
    type: 'expense',
    date: { $gte: start, $lt: end },
  });
  const map = {};
  rows.forEach((r) => (map[r.category] = (map[r.category] || 0) + r.amount));
  return map;
}

function monthlyIncome(userId, month, year) {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  const rows = db.find('transactions', {
    user: userId,
    type: 'income',
    date: { $gte: start, $lt: end },
  });
  return rows.reduce((sum, r) => sum + r.amount, 0);
}

module.exports = { ...exports, toPublic, monthlyExpenses, monthlyIncome, TRANSACTION_CATEGORIES };
