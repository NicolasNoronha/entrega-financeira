const Subscription = require('../models/Subscription');

async function users(req, res) {
  const users = await Subscription.listUsers(req.query);
  return res.json({ users });
}

async function grant(req, res) {
  const days = Number(req.body.days || 7);
  const user = await Subscription.grantDays(req.params.userId, days, req.body.status || 'active', req.body.notes || null);
  return res.json({ user });
}

async function status(req, res) {
  const user = await Subscription.setStatus(req.params.userId, req.body.status, req.body.notes || null);
  return res.json({ user });
}

module.exports = {
  users,
  grant,
  status
};