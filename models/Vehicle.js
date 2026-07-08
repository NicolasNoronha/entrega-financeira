const db = require('../config/db');

async function createVehicle(userId, data) {
  const result = await db.query(
    `INSERT INTO vehicles (
       user_id, tipo, modelo, placa, consumo_medio, tipo_combustivel, valor_medio_combustivel
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      userId,
      data.tipo,
      data.modelo,
      data.placa || null,
      data.consumo_medio || null,
      data.tipo_combustivel || null,
      data.valor_medio_combustivel || null
    ]
  );

  return result.rows[0];
}

async function listVehicles(userId) {
  const result = await db.query(
    `SELECT *
       FROM vehicles
      WHERE user_id = $1
      ORDER BY created_at DESC`,
    [userId]
  );

  return result.rows;
}

async function deleteVehicle(userId, id) {
  const result = await db.query(
    'DELETE FROM vehicles WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );

  return result.rows[0];
}

module.exports = {
  createVehicle,
  listVehicles,
  deleteVehicle
};
