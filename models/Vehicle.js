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

async function updateVehicle(userId, id, data) {
  const result = await db.query(
    `UPDATE vehicles
        SET tipo = $3,
            modelo = $4,
            placa = $5,
            consumo_medio = $6,
            tipo_combustivel = $7,
            valor_medio_combustivel = $8,
            updated_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
    [
      id,
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
  updateVehicle,
  deleteVehicle
};
