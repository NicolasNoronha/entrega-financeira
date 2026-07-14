const Transaction = require('../models/Transaction');

function normalizeTransactionInput(body) {
  const amountIsBlank = body.valor === undefined || body.valor === null || String(body.valor).trim() === '';

  return {
    tipo: body.tipo,
    data: body.data,
    valor: amountIsBlank ? NaN : Number(body.valor),
    descricao: String(body.descricao || body.categoria || body.tipo || 'Lancamento').trim(),
    quantidade_pacotes: body.quantidade_pacotes ? Number(body.quantidade_pacotes) : null,
    pacotes_recebidos: body.pacotes_recebidos ? Number(body.pacotes_recebidos) : null,
    categoria: String(body.categoria || '').trim() || null,
    rota_nome: String(body.rota_nome || '').trim() || null,
    cidade_bairro: String(body.cidade_bairro || '').trim() || null,
    periodo: body.periodo || null,
    horas_rota: body.horas_rota ? Number(body.horas_rota) : null,
    km_inicial: body.km_inicial ? Number(body.km_inicial) : null,
    km_final: body.km_final ? Number(body.km_final) : null,
    km_total: body.km_total ? Number(body.km_total) : null,
    veiculo_id: body.veiculo_id || null
  };
}

function validateTransaction(input) {
  const errors = [];

  if (!['Receita', 'Despesa'].includes(input.tipo)) errors.push('Tipo invalido.');
  if (!input.data) errors.push('Data obrigatoria.');
  if (input.valor < 0 || Number.isNaN(input.valor)) errors.push('Informe o valor do lancamento.');
  if (input.tipo === 'Despesa' && input.valor <= 0) errors.push('Despesa deve ser maior que zero.');
  if (input.quantidade_pacotes !== null && input.quantidade_pacotes < 0) errors.push('Quantidade de pacotes invalida.');
  if (input.pacotes_recebidos !== null && input.pacotes_recebidos < 0) errors.push('Pacotes recebidos invalido.');
  if (input.horas_rota !== null && input.horas_rota < 0) errors.push('Horas da rota invalida.');
  if (input.periodo && !['Manha', 'Tarde', 'Noite'].includes(input.periodo)) errors.push('Periodo invalido.');
  if (input.km_inicial !== null && input.km_final !== null && input.km_final < input.km_inicial) errors.push('Km final deve ser maior que o km inicial.');

  if (input.km_total === null && input.km_inicial !== null && input.km_final !== null) {
    input.km_total = input.km_final - input.km_inicial;
  }

  return errors;
}

async function update(req, res) {
  try {
    const input = normalizeTransactionInput(req.body);
    const errors = validateTransaction(input);

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Dados invalidos.', errors });
    }

    const transaction = await Transaction.updateTransaction(req.user.id, req.params.id, input);
    if (!transaction) {
      return res.status(404).json({ message: 'Lancamento nao encontrado.' });
    }

    return res.json({ transaction });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao editar lancamento.' });
  }
}

async function create(req, res) {
  try {
    const input = normalizeTransactionInput(req.body);
    const errors = validateTransaction(input);

    if (errors.length > 0) {
      return res.status(400).json({ message: 'Dados invalidos.', errors });
    }

    const transaction = await Transaction.createTransaction(req.user.id, input);
    return res.status(201).json({ transaction });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao criar lancamento.' });
  }
}

async function index(req, res) {
  try {
    const transactions = await Transaction.listTransactions(req.user.id, req.query);
    return res.json({ transactions });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao listar lancamentos.' });
  }
}

async function dashboard(req, res) {
  try {
    const summary = await Transaction.getDashboard(req.user.id, req.query);
    return res.json({ summary });
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar dashboard.' });
  }
}

async function report(req, res) {
  try {
    const reportData = await Transaction.getReport(req.user.id, req.query);
    return res.json(reportData);
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao carregar relatorio.' });
  }
}

async function remove(req, res) {
  try {
    const deleted = await Transaction.deleteTransaction(req.user.id, req.params.id);

    if (!deleted) {
      return res.status(404).json({ message: 'Lancamento nao encontrado.' });
    }

    return res.status(204).send();
  } catch (error) {
    return res.status(500).json({ message: 'Erro ao excluir lancamento.' });
  }
}

module.exports = {
  create,
  update,
  index,
  dashboard,
  report,
  remove
};
