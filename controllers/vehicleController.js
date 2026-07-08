const Vehicle = require('../models/Vehicle');

function normalizeVehicleInput(body) {
  return {
    tipo: body.tipo,
    modelo: String(body.modelo || '').trim(),
    placa: String(body.placa || '').trim(),
    consumo_medio: body.consumo_medio ? Number(body.consumo_medio) : null,
    tipo_combustivel: String(body.tipo_combustivel || '').trim(),
    valor_medio_combustivel: body.valor_medio_combustivel ? Number(body.valor_medio_combustivel) : null
  };
}

function validateVehicle(input) {
  const errors = [];

  if (!['Moto', 'Carro'].includes(input.tipo)) errors.push('Tipo de veiculo invalido.');
  if (!input.modelo) errors.push('Modelo obrigatorio.');
  if (input.consumo_medio !== null && input.consumo_medio <= 0) errors.push('Consumo medio invalido.');
  if (input.valor_medio_combustivel !== null && input.valor_medio_combustivel <= 0) errors.push('Valor do combustivel invalido.');

  return errors;
}

async function create(req, res) {
  try {
    const input = normalizeVehicleInput(req.body);
    const errors = validateVehicle(input);

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Dados invalidos.', errors });
    }

    const vehicle = await Vehicle.createVehicle(req.user.id, input);
    return res.status(201).json({ vehicle });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao cadastrar veiculo.' });
  }
}

async function index(req, res) {
  try {
    const vehicles = await Vehicle.listVehicles(req.user.id);
    return res.json({ vehicles });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao listar veiculos.' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await Vehicle.deleteVehicle(req.user.id, req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Veiculo nao encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao excluir veiculo.' });
  }
}

module.exports = {
  create,
  index,
  remove
};
