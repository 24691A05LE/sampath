const db = require('../db/store');
const { monthlyExpenses } = require('./transactionController');

function toPublic(b, spent) {
  return {
    _id: b._id,
    month: b.month,
    year: b.year,
    category: b.category,
    amount: b.amount,
    note: b.note,
    spent: spent || 0,
  };
}

exports.getBudgets = async (req, res, next) => {
  try {
    const month = parseInt(req.query.month) || new Date().getMonth() + 1;
    const year = parseInt(req.query.year) || new Date().getFullYear();

    const budgets = db.find('budgets', { user: req.userId, month, year }, { sort: { category: 1 } });
    const spentMap = monthlyExpenses(req.userId, month, year);
    res.json({ budgets: budgets.map((b) => toPublic(b, spentMap[b.category] || 0)) });
  } catch (error) {
    next(error);
  }
};

exports.createBudget = async (req, res, next) => {
  try {
    const month = parseInt(req.body.month) || new Date().getMonth() + 1;
    const year = parseInt(req.body.year) || new Date().getFullYear();
    const { category, amount, note } = req.body;
    if (!category || !amount) {
      return res.status(400).json({ message: 'category and amount are required' });
    }
    if (month < 1 || month > 12) return res.status(400).json({ message: 'Invalid month' });

    const existing = db.findOne('budgets', { user: req.userId, month, year, category });
    if (existing) {
      return res.status(400).json({ message: `A budget for ${category} already exists for this month` });
    }
    const budget = await db.insert('budgets', { user: req.userId, month, year, category, amount: Number(amount), note: note || '' });
    res.status(201).json({ budget: toPublic(budget, 0) });
  } catch (error) {
    next(error);
  }
};

exports.updateBudget = async (req, res, next) => {
  try {
    const budget = db.findOne('budgets', { _id: req.params.id, user: req.userId });
    if (!budget) return res.status(404).json({ message: 'Budget not found' });

    const { amount, note } = req.body;
    if (amount) budget.amount = Number(amount);
    if (note !== undefined) budget.note = note;
    const saved = await db.save('budgets', budget);

    const spentMap = monthlyExpenses(req.userId, saved.month, saved.year);
    res.json({ budget: toPublic(saved, spentMap[saved.category] || 0) });
  } catch (error) {
    next(error);
  }
};

exports.deleteBudget = async (req, res, next) => {
  try {
    const removed = await db.deleteMany('budgets', { _id: req.params.id, user: req.userId });
    if (!removed) return res.status(404).json({ message: 'Budget not found' });
    res.json({ message: 'Budget deleted' });
  } catch (error) {
    next(error);
  }
};
