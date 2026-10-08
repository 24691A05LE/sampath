const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// No JWT secret configuration needed - a random secret is generated at startup.
// Note: with no JWT_SECRET env var, tokens become invalid on server restart (users re-login).
const SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, SECRET, { expiresIn: '7d' });
}

function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, token missing' });
  }
  try {
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, SECRET);
    req.userId = decoded.id;
    req.userRole = decoded.role;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
}

function adminOnly(req, res, next) {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
}

module.exports = { signToken, protect, adminOnly };
