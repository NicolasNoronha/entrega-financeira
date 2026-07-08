const db = require('../config/db');

function userSelect() {
  return `id, nome, email, role, subscription_status, trial_ends_at, access_expires_at, subscription_notes, created_at`;
}

function resolveRole(email) {
  return String(email || '').toLowerCase() === String(process.env.ADMIN_EMAIL || '').toLowerCase()
    ? 'admin'
    : 'user';
}

async function createUser({ nome, email, senha }) {
  const role = resolveRole(email);
  const result = await db.query(
    `INSERT INTO users (nome, email, senha, role, subscription_status, trial_ends_at, access_expires_at)
     VALUES ($1, LOWER($2), $3, $4, 'trial', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days')
     RETURNING ${userSelect()}`,
    [nome, email, senha, role]
  );

  return result.rows[0];
}

async function findUserByEmail(email) {
  const result = await db.query(
    'SELECT * FROM users WHERE email = LOWER($1)',
    [email]
  );

  return result.rows[0];
}

async function findUserById(id) {
  const result = await db.query(
    `SELECT ${userSelect()} FROM users WHERE id = $1`,
    [id]
  );

  return result.rows[0];
}

module.exports = {
  createUser,
  findUserByEmail,
  findUserById
};