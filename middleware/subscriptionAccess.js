function subscriptionAccess(req, res, next) {
  if (req.user?.role === 'admin' || req.user?.is_active) {
    return next();
  }

  return res.status(402).json({
    code: 'SUBSCRIPTION_EXPIRED',
    message: 'Seu periodo de teste acabou. Renove para continuar usando o app.'
  });
}

module.exports = subscriptionAccess;
