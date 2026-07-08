const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

function isAdminEmail(email) {
  return String(email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
}

async function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token nao informado.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findUserById(payload.id);

    if (!user) {
      return res.status(401).json({ message: 'Usuario nao encontrado.' });
    }

    req.user = Subscription.normalizeUser({
      ...user,
      role: isAdminEmail(user.email) ? 'admin' : user.role
    });
    return next();
  } catch (error) {
    return res.status(401).json({ message: 'Token invalido ou expirado.' });
  }
}

module.exports = authMiddleware;
