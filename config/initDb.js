const fs = require('fs/promises');
const path = require('path');
const db = require('./db');

async function initDb() {
  if (process.env.AUTO_RUN_MIGRATIONS === 'false') {
    return;
  }

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = await fs.readFile(schemaPath, 'utf8');
  await db.query(schema);
  console.log('Banco verificado: schema aplicado.');
}

module.exports = initDb;
