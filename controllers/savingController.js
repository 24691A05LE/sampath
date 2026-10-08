const db = require('../db/store');

function toPublic(g) {
  const progress = g.targetAmount > 0 ? Math.round((g.savedAmount / g.targetAmount) * 100) : 0;
  return {
    _id: g._id,
    name: g.name,
    targetAmount: g.targetAmount,
    savedAmount: g.savedAmount,
    remaining: Math.max(g.targetAmount - g.savedAmount, 0),
    targetDate: g.targetDate,
    status: g.status,
    note: g.note,
    progress,
  };
}

exports.getGoals = async (req, res, next) => {
  try {
    const goals = db.find('goals', { user: req.userId }, { sort: { createdAt: -1 } });
    res.json({ goals: goals.map(toPublic) });
  } catch (error) {
    next(error);
  }
};

exports.createGoal = async (req, res, next) => {
  try {
    const { name, targetAmount, targetDate, note } = req.body;
    if (!name || !targetAmount) {
      return res.status(400).json({ message: 'name and targetAmount are required' });
    }
    const goal = await db.insert('goals', {
      user: req.userId,
      name,
      targetAmount: Number(targetAmount),
      savedAmount: 0,
      targetDate: targetDate ? new Date(targetDate).toISOString() : null,
      status: 'active',
      note: note || '',
    });
    res.status(201).json({ goal: toPublic(goal) });
  } catch (error) {
    next(error);
  }
};

exports.updateGoal = async (req, res, next) => {
  try {
    const goal = db.findOne('goals', { _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });

    const { name, targetAmount, savedAmount, targetDate, status, note } = req.body;
    if (name) goal.name = name;
    if (targetAmount) goal.targetAmount = Number(targetAmount);
    if (savedAmount !== undefined) goal.savedAmount = Math.max(Number(savedAmount), 0);
    if (targetDate !== undefined) goal.targetDate = targetDate ? new Date(targetDate).toISOString() : null;
    if (status) goal.status = status;
    if (note !== undefined) goal.note = note;

    if (goal.savedAmount >= goal.targetAmount) {
      goal.status = 'achieved';
    } else if (goal.status === 'achieved') {
      goal.status = 'active';
    }
    const saved = await db.save('goals', goal);
    res.json({ goal: toPublic(saved) });
  } catch (error) {
    next(error);
  }
};

exports.addContribution = async (req, res, next) => {
  try {
    const goal = db.findOne('goals', { _id: req.params.id, user: req.userId });
    if (!goal) return res.status(404).json({ message: 'Goal not found' });

    const amount = Number(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'A positive amount is required' });
    }
    goal.savedAmount += amount;
    if (goal.savedAmount >= goal.targetAmount) goal.status = 'achieved';
    const saved = await db.save('goals', goal);
    res.json({ goal: toPublic(saved) });
  } catch (error) {
    next(error);
  }
};

exports.deleteGoal = async (req, res, next) => {
  try {
    const removed = await db.deleteMany('goals', { _id: req.params.id, user: req.userId });
    if (!removed) return res.status(404).json({ message: 'Goal not found' });
    res.json({ message: 'Goal deleted' });
  } catch (error) {
    next(error);
  }
};
