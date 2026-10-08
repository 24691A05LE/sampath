const db = require('../db/store');
const bcrypt = require('bcryptjs');
const { signToken } = require('../middleware/auth');

function publicUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    currency: user.currency,
    createdAt: user.createdAt,
  };
}

exports.register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const normalized = email.toLowerCase().trim();
    const existing = db.findOne('users', { email: normalized });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }
    const hash = await bcrypt.hash(password, 10);
    const user = await db.insert('users', { name, email: normalized, password: hash, role: 'user', currency: 'USD' });
    const token = signToken(user);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }
    const user = db.findOne('users', { email: email.toLowerCase().trim() });
    if (!user || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    const token = signToken(user);
    res.json({ token, user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.me = async (req, res, next) => {
  try {
    const user = db.findOne('users', { _id: req.userId });
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ user: publicUser(user) });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const user = db.findOne('users', { _id: req.userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { name, currency } = req.body;
    if (name) user.name = name;
    if (currency) user.currency = currency;
    const saved = await db.save('users', user);
    res.json({ user: publicUser(saved) });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const user = db.findOne('users', { _id: req.userId });
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current and new password are required' });
    }
    if (!(await bcrypt.compare(currentPassword, user.password))) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }
    user.password = await bcrypt.hash(newPassword, 10);
    await db.save('users', user);
    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    next(error);
  }
};
