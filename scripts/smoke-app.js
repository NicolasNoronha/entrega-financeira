const { spawn } = require('child_process');

const child = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: '3101'
  }
});

function stop(code) {
  if (!child.killed) child.kill();
  process.exit(code);
}

async function request(path, token, options = {}) {
  const response = await fetch(`http://localhost:3101${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });

  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) {
    throw new Error(data?.message || `HTTP ${response.status}`);
  }
  return data;
}

child.stdout.on('data', async (chunk) => {
  const text = String(chunk);
  process.stdout.write(text);

  if (!text.includes('Servidor rodando')) return;

  try {
    const email = `app.${Date.now()}@local.test`;
    const auth = await request('/api/auth/register', null, {
      method: 'POST',
      body: JSON.stringify({ nome: 'Teste App', email, senha: '123456' })
    });

    const vehicle = await request('/api/vehicles', auth.token, {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'Moto',
        modelo: 'Honda CG 160',
        placa: 'ABC1D23',
        consumo_medio: 35,
        tipo_combustivel: 'Gasolina',
        valor_medio_combustivel: 5.8
      })
    });

    await request('/api/transactions', auth.token, {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'Receita',
        valor: 180,
        data: new Date().toISOString().slice(0, 10),
        categoria: 'Shopee',
        descricao: 'Rota teste',
        rota_nome: 'SP-01',
        periodo: 'Manha',
        quantidade_pacotes: 45,
        veiculo_id: vehicle.vehicle.id,
        km_inicial: 1000,
        km_final: 1040,
        km_total: 40
      })
    });

    await request('/api/transactions', auth.token, {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'Despesa',
        valor: 35,
        data: new Date().toISOString().slice(0, 10),
        categoria: 'Combustivel',
        descricao: 'Combustivel rota teste',
        rota_nome: 'SP-01',
        veiculo_id: vehicle.vehicle.id
      })
    });

    const report = await request('/api/transactions/reports?period=mes', auth.token);
    console.log({
      vehicle: vehicle.vehicle.modelo,
      receita: report.summary.receita_total,
      despesa: report.summary.despesa_total,
      lucro: report.summary.lucro_liquido,
      rotas: report.lucro_por_rota.length
    });
    stop(0);
  } catch (error) {
    console.error(error.message);
    stop(1);
  }
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

setTimeout(() => {
  console.error('Timeout ao testar app.');
  stop(1);
}, 12000);
