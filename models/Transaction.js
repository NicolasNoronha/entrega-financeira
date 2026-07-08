const db = require('../config/db');

async function createTransaction(userId, data) {
  const result = await db.query(
    `INSERT INTO transactions (
       user_id, tipo, data, valor, descricao, quantidade_pacotes,
       categoria, rota_nome, periodo, km_inicial, km_final, km_total, veiculo_id
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
     RETURNING *`,
    [
      userId,
      data.tipo,
      data.data,
      data.valor,
      data.descricao,
      data.quantidade_pacotes || null,
      data.categoria || null,
      data.rota_nome || null,
      data.periodo || null,
      data.km_inicial,
      data.km_final,
      data.km_total,
      data.veiculo_id || null
    ]
  );

  return result.rows[0];
}

function periodWhere(period) {
  const intervalByPeriod = {
    dia: '1 day',
    semana: '7 days',
    mes: '1 month'
  };

  return intervalByPeriod[period] || intervalByPeriod.mes;
}

async function listTransactions(userId, { period = 'mes', startDate, endDate, rota, veiculo_id, categoria }) {
  const params = [userId];
  const filters = ['t.user_id = $1'];

  if (startDate && endDate) {
    params.push(startDate, endDate);
    filters.push(`t.data BETWEEN $${params.length - 1} AND $${params.length}`);
  } else {
    params.push(periodWhere(period));
    filters.push(`t.data >= CURRENT_DATE - $${params.length}::interval`);
  }

  if (rota) {
    params.push(`%${rota}%`);
    filters.push(`t.rota_nome ILIKE $${params.length}`);
  }

  if (veiculo_id) {
    params.push(veiculo_id);
    filters.push(`t.veiculo_id = $${params.length}`);
  }

  if (categoria) {
    params.push(categoria);
    filters.push(`t.categoria = $${params.length}`);
  }

  const result = await db.query(
    `SELECT t.*, v.modelo AS veiculo_modelo
       FROM transactions t
       LEFT JOIN vehicles v ON v.id = t.veiculo_id AND v.user_id = t.user_id
      WHERE ${filters.join(' AND ')}
      ORDER BY t.data DESC, t.created_at DESC`,
    params
  );

  return result.rows;
}

async function deleteTransaction(userId, id) {
  const result = await db.query(
    'DELETE FROM transactions WHERE id = $1 AND user_id = $2 RETURNING id',
    [id, userId]
  );

  return result.rows[0];
}

async function getDashboard(userId, { period = 'mes' }) {
  const result = await db.query(
    `SELECT
        COALESCE(SUM(CASE WHEN tipo = 'Receita' AND data = CURRENT_DATE THEN valor ELSE 0 END), 0) AS receita_hoje,
        COALESCE(SUM(CASE WHEN tipo = 'Despesa' AND data = CURRENT_DATE THEN valor ELSE 0 END), 0) AS despesa_hoje,
        COALESCE(SUM(CASE WHEN tipo = 'Receita' AND DATE_TRUNC('month', data) = DATE_TRUNC('month', CURRENT_DATE) THEN valor ELSE 0 END), 0) AS receita_mes,
        COALESCE(SUM(CASE WHEN tipo = 'Despesa' AND DATE_TRUNC('month', data) = DATE_TRUNC('month', CURRENT_DATE) THEN valor ELSE 0 END), 0) AS despesa_mes,
        COALESCE(SUM(CASE WHEN DATE_TRUNC('month', data) = DATE_TRUNC('month', CURRENT_DATE) THEN km_total ELSE 0 END), 0) AS km_mes,
        COALESCE(SUM(CASE WHEN tipo = 'Receita' THEN quantidade_pacotes ELSE 0 END), 0) AS pacotes_total
       FROM transactions
      WHERE user_id = $1`,
    [userId]
  );

  const row = result.rows[0];
  const receitaHoje = Number(row.receita_hoje);
  const despesaHoje = Number(row.despesa_hoje);
  const receitaMes = Number(row.receita_mes);
  const despesaMes = Number(row.despesa_mes);
  const kmMes = Number(row.km_mes);
  const pacotesTotal = Number(row.pacotes_total);

  const categories = await db.query(
    `SELECT COALESCE(categoria, 'Outros') AS categoria, SUM(valor)::numeric AS total
       FROM transactions
      WHERE user_id = $1
        AND tipo = 'Despesa'
        AND DATE_TRUNC('month', data) = DATE_TRUNC('month', CURRENT_DATE)
      GROUP BY COALESCE(categoria, 'Outros')
      ORDER BY total DESC
      LIMIT 6`,
    [userId]
  );

  return {
    receita_total: period === 'dia' ? receitaHoje : receitaMes,
    despesa_total: period === 'dia' ? despesaHoje : despesaMes,
    saldo_liquido: (period === 'dia' ? receitaHoje - despesaHoje : receitaMes - despesaMes),
    receita_hoje: receitaHoje,
    despesa_hoje: despesaHoje,
    lucro_hoje: receitaHoje - despesaHoje,
    receita_mes: receitaMes,
    despesa_mes: despesaMes,
    lucro_mes: receitaMes - despesaMes,
    km_mes: kmMes,
    lucro_por_km: kmMes > 0 ? (receitaMes - despesaMes) / kmMes : 0,
    receita_por_km: kmMes > 0 ? receitaMes / kmMes : 0,
    gasto_por_km: kmMes > 0 ? despesaMes / kmMes : 0,
    pacotes_total: pacotesTotal,
    media_liquida_por_pacote: pacotesTotal > 0 ? (receitaMes - despesaMes) / pacotesTotal : 0,
    gastos_por_categoria: categories.rows.map((item) => ({
      categoria: item.categoria,
      total: Number(item.total)
    })),
    alerta_despesa: receitaHoje > 0 && despesaHoje / receitaHoje > 0.4
  };
}

async function getReport(userId, filters) {
  const transactions = await listTransactions(userId, filters);
  const receitas = transactions.filter((item) => item.tipo === 'Receita');
  const despesas = transactions.filter((item) => item.tipo === 'Despesa');
  const receitaTotal = receitas.reduce((sum, item) => sum + Number(item.valor), 0);
  const despesaTotal = despesas.reduce((sum, item) => sum + Number(item.valor), 0);
  const kmTotal = transactions.reduce((sum, item) => sum + Number(item.km_total || 0), 0);

  const byCategory = despesas.reduce((acc, item) => {
    const key = item.categoria || 'Outros';
    acc[key] = (acc[key] || 0) + Number(item.valor);
    return acc;
  }, {});

  const byRoute = transactions.reduce((acc, item) => {
    const key = item.rota_nome || 'Sem rota';
    if (!acc[key]) acc[key] = { rota: key, receita: 0, despesa: 0, km: 0, lucro: 0 };
    if (item.tipo === 'Receita') acc[key].receita += Number(item.valor);
    if (item.tipo === 'Despesa') acc[key].despesa += Number(item.valor);
    acc[key].km += Number(item.km_total || 0);
    acc[key].lucro = acc[key].receita - acc[key].despesa;
    return acc;
  }, {});

  const byDay = transactions.reduce((acc, item) => {
    const key = item.data.toISOString ? item.data.toISOString().slice(0, 10) : String(item.data).slice(0, 10);
    if (!acc[key]) acc[key] = { data: key, receita: 0, despesa: 0, lucro: 0 };
    if (item.tipo === 'Receita') acc[key].receita += Number(item.valor);
    if (item.tipo === 'Despesa') acc[key].despesa += Number(item.valor);
    acc[key].lucro = acc[key].receita - acc[key].despesa;
    return acc;
  }, {});

  const days = Object.values(byDay);
  const activeDays = days.filter((day) => day.receita > 0 || day.despesa > 0).length;
  const biggestExpense = despesas.sort((a, b) => Number(b.valor) - Number(a.valor))[0] || null;
  const bestDay = days.sort((a, b) => b.lucro - a.lucro)[0] || null;

  return {
    summary: {
      receita_total: receitaTotal,
      despesa_total: despesaTotal,
      lucro_liquido: receitaTotal - despesaTotal,
      media_lucro_por_dia: activeDays > 0 ? (receitaTotal - despesaTotal) / activeDays : 0,
      maior_despesa: biggestExpense,
      melhor_dia: bestDay,
      km_total: kmTotal,
      lucro_por_km: kmTotal > 0 ? (receitaTotal - despesaTotal) / kmTotal : 0
    },
    despesas_por_categoria: Object.entries(byCategory).map(([categoria, total]) => ({ categoria, total })),
    lucro_por_rota: Object.values(byRoute),
    dias: days,
    transactions
  };
}

module.exports = {
  createTransaction,
  listTransactions,
  deleteTransaction,
  getDashboard,
  getReport
};
