const db = require('../config/db');

function normalizeUser(row) {
  if (!row) return null;
  const expiresAt = row.access_expires_at ? new Date(row.access_expires_at) : null;
  const now = new Date();
  const daysRemaining = expiresAt ? Math.ceil((expiresAt - now) / 86400000) : 0;

  return {
    ...row,
    is_active: Boolean(expiresAt && expiresAt >= now && row.subscription_status !== 'canceled'),
    days_remaining: Math.max(daysRemaining, 0),
    expires_soon: daysRemaining >= 0 && daysRemaining <= 3
  };
}

async function getSubscription(userId) {
  const result = await db.query(
    `SELECT id, nome, email, role, subscription_status, trial_ends_at, access_expires_at, subscription_notes, created_at
       FROM users
      WHERE id = $1`,
    [userId]
  );

  const payments = await db.query(
    `SELECT id, provider, provider_payment_id, provider_preference_id, payment_url, amount, status, paid_at, days_granted, created_at
       FROM subscription_payments
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 10`,
    [userId]
  );

  return {
    subscription: normalizeUser(result.rows[0]),
    payments: payments.rows
  };
}

async function createPayment({ userId, amount, paymentUrl, preferenceId, provider = 'mercado_pago', daysGranted = 30 }) {
  const result = await db.query(
    `INSERT INTO subscription_payments (user_id, provider, provider_preference_id, payment_url, amount, days_granted)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, provider, preferenceId || null, paymentUrl || null, amount, daysGranted]
  );

  return result.rows[0];
}


async function updatePaymentPreference(paymentId, { provider, preferenceId, paymentUrl }) {
  const result = await db.query(
    `UPDATE subscription_payments
        SET provider = $2,
            provider_preference_id = $3,
            payment_url = $4,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [paymentId, provider, preferenceId || null, paymentUrl || null]
  );

  return result.rows[0];
}
async function markPaymentPaid({ providerPaymentId, providerPreferenceId, localPaymentId, userId, rawPayload }) {
  const params = [
    providerPaymentId || null,
    providerPreferenceId || null,
    localPaymentId || null,
    rawPayload || null
  ];
  const userFilter = userId ? `AND user_id = $${params.push(userId)}` : '';

  const payment = await db.query(
    `UPDATE subscription_payments
        SET provider_payment_id = COALESCE($1, provider_payment_id),
            status = 'paid',
            paid_at = NOW(),
            raw_payload = $4,
            updated_at = NOW()
      WHERE (
            (provider_payment_id = $1 AND $1 IS NOT NULL)
         OR (provider_preference_id = $2 AND $2 IS NOT NULL)
         OR (id::text = $3 AND $3 IS NOT NULL)
      )
        ${userFilter}
      RETURNING *`,
    params
  );

  if (!payment.rows[0]) return null;
  await grantDays(payment.rows[0].user_id, payment.rows[0].days_granted, 'active');
  return payment.rows[0];
}

async function grantDays(userId, days, status = 'active', notes = null) {
  const result = await db.query(
    `UPDATE users
        SET subscription_status = $3,
            access_expires_at = GREATEST(COALESCE(access_expires_at, NOW()), NOW()) + ($2::text || ' days')::interval,
            subscription_notes = COALESCE($4, subscription_notes),
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, nome, email, role, subscription_status, trial_ends_at, access_expires_at, subscription_notes, created_at`,
    [userId, Number(days), status, notes]
  );

  return normalizeUser(result.rows[0]);
}

async function setStatus(userId, status, notes = null) {
  const result = await db.query(
    `UPDATE users
        SET subscription_status = $2,
            subscription_notes = COALESCE($3, subscription_notes),
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, nome, email, role, subscription_status, trial_ends_at, access_expires_at, subscription_notes, created_at`,
    [userId, status, notes]
  );

  return normalizeUser(result.rows[0]);
}

async function listUsers({ status, expiringDays = 5 } = {}) {
  const params = [Number(expiringDays)];
  const filters = [];

  if (status) {
    params.push(status);
    filters.push(`subscription_status = $${params.length}`);
  }

  const where = filters.length ? `WHERE ${filters.join(' AND ')}` : '';
  const result = await db.query(
    `SELECT id, nome, email, role, subscription_status, trial_ends_at, access_expires_at, subscription_notes, created_at,
            CASE WHEN access_expires_at <= NOW() + ($1::text || ' days')::interval THEN TRUE ELSE FALSE END AS expiring_soon
       FROM users
       ${where}
      ORDER BY access_expires_at ASC NULLS FIRST, created_at DESC`,
    params
  );

  return result.rows.map(normalizeUser);
}

module.exports = {
  getSubscription,
  createPayment,
  updatePaymentPreference,
  markPaymentPaid,
  grantDays,
  setStatus,
  listUsers,
  normalizeUser
};
