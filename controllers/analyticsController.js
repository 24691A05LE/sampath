const db = require('../db/store');

function monthRange(month, year) {
  const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const end = new Date(Date.UTC(year, month, 1)).toISOString();
  return { start, end };
}

function monthLabel(month) {
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleString('en-US', { month: 'short' });
}

function sum(list) {
  return list.reduce((s, r) => s + r.amount, 0);
}

exports.getSummary = async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    const { start, end } = monthRange(month, year);

    const income = sum(db.find('transactions', { user: req.userId, type: 'income', date: { $gte: start, $lt: end } }));
    const expense = sum(db.find('transactions', { user: req.userId, type: 'expense', date: { $gte: start, $lt: end } }));
    const totalIncome = sum(db.find('transactions', { user: req.userId, type: 'income' }));
    const totalExpense = sum(db.find('transactions', { user: req.userId, type: 'expense' }));

    res.json({
      month,
      year,
      income,
      expense,
      balance: income - expense,
      savingsRate: income > 0 ? Math.round(((income - expense) / income) * 100) : 0,
      totalIncome,
      totalExpense,
    });
  } catch (error) {
    next(error);
  }
};

exports.getCategoryBreakdown = async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    const { start, end } = monthRange(month, year);

    const type = req.query.type;
    const filter = { user: req.userId, date: { $gte: start, $lt: end } };
    if (type === 'income') filter.type = 'income';
    else if (type === 'all') delete filter.type;
    else filter.type = 'expense';
    const rows = db.find('transactions', filter);
    const byCat = {};
    rows.forEach((r) => (byCat[r.category] = (byCat[r.category] || 0) + r.amount));
    const entries = Object.entries(byCat).sort((a, b) => b[1] - a[1]);

    const total = entries.reduce((s, [, v]) => s + v, 0);
    const categories = entries.map(([category, t]) => ({
      category,
      total: t,
      percentage: total > 0 ? Math.round((t / total) * 100) : 0,
    }));
    res.json({ categories, total });
  } catch (error) {
    next(error);
  }
};

exports.getDailyTrend = async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    const days = parseInt(req.query.days) || 30;

    const start = new Date(Date.UTC(year, month - 1, 1)).toISOString();
    const end = new Date(Date.UTC(year, month, 1)).toISOString();
    const effectiveStart = req.query.days ? new Date(new Date(end).getTime() - (days - 1) * 86400000).toISOString() : start;

    const rows = db.find('transactions', { user: req.userId, date: { $gte: effectiveStart, $lt: end } });
    const byDay = {};
    rows.forEach((r) => {
      const day = r.date.slice(0, 10);
      if (!byDay[day]) byDay[day] = { date: day, income: 0, expense: 0 };
      byDay[day][r.type] = (byDay[day][r.type] || 0) + r.amount;
    });

    res.json({ trend: Object.values(byDay).sort((a, b) => (a.date < b.date ? -1 : 1)) });
  } catch (error) {
    next(error);
  }
};

exports.getMonthlyComparison = async (req, res, next) => {
  try {
    const now = new Date();
    const months = parseInt(req.query.months) || 6;
    const thisYear = now.getFullYear();
    const thisMonth = now.getMonth() + 1;

    const points = [];
    for (let i = months - 1; i >= 0; i--) {
      let m = thisMonth - i;
      let y = thisYear;
      while (m <= 0) {
        m += 12;
        y--;
      }
      const { start, end } = monthRange(m, y);
      points.push({
        month: `${monthLabel(m)} ${y}`,
        income: sum(db.find('transactions', { user: req.userId, type: 'income', date: { $gte: start, $lt: end } })),
        expense: sum(db.find('transactions', { user: req.userId, type: 'expense', date: { $gte: start, $lt: end } })),
      });
    }
    res.json({ points });
  } catch (error) {
    next(error);
  }
};

exports.getBudgetStatus = async (req, res, next) => {
  try {
    const now = new Date();
    const month = parseInt(req.query.month) || now.getMonth() + 1;
    const year = parseInt(req.query.year) || now.getFullYear();
    const { start, end } = monthRange(month, year);

    const rows = db.find('transactions', { user: req.userId, type: 'expense', date: { $gte: start, $lt: end } });
    const spent = {};
    rows.forEach((r) => (spent[r.category] = (spent[r.category] || 0) + r.amount));
    res.json({ spent, month, year });
  } catch (error) {
    next(error);
  }
};

exports.getExportData = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const filter = { user: req.userId };
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from).toISOString();
      if (to) filter.date.$lte = new Date(to + 'T23:59:59.999Z').toISOString();
    }
    const docs = db.find('transactions', filter, { sort: { date: 1 } });
    res.json({
      transactions: docs.map((t) => ({
        date: t.date.slice(0, 10),
        type: t.type,
        category: t.category,
        amount: t.amount,
        description: t.description,
      })),
    });
  } catch (error) {
    next(error);
  }
};
