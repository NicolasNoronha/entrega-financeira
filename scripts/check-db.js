require('dotenv').config();

const initDb = require('../config/initDb');
const db = require('../config/db');

async function main() {
  await initDb();

  const result = await db.query(
    'SELECT to_regclass($1) AS users, to_regclass($2) AS transactions, to_regclass($3) AS vehicles',
    ['public.users', 'public.transactions', 'public.vehicles']
  );

  console.log(result.rows[0]);
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
