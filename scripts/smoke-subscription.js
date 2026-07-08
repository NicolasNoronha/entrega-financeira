const { spawn } = require('child_process');
const adminEmail = 'admin.' + Date.now() + '@test.com';

const child = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: '3102',
    ADMIN_EMAIL: adminEmail,
    SUBSCRIPTION_AMOUNT: '1',
    SUBSCRIPTION_DAYS: '30'
  }
});

function stop(code) {
  if (!child.killed) child.kill();
  process.exit(code);
}

async function request(path, token, options = {}) {
  const response = await fetch(`http://localhost:3102${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = response.status === 204 ? null : await response.json();
  if (!response.ok) throw new Error(data?.message || `HTTP ${response.status}`);
  return data;
}

child.stdout.on('data', async (chunk) => {
  const text = String(chunk);
  process.stdout.write(text);
  if (!text.includes('Servidor rodando')) return;

  try {
    const stamp = Date.now();
    const user = await request('/api/auth/register', null, {
      method: 'POST',
      body: JSON.stringify({ nome: 'Usuario Teste', email: `assinante.${stamp}@test.com`, senha: '123456' })
    });
    const status = await request('/api/subscription/status', user.token);
    const payment = await request('/api/subscription/renew', user.token, {
      method: 'POST',
      body: JSON.stringify({ amount: 1, days: 30 })
    });
    const admin = await request('/api/auth/register', null, {
      method: 'POST',
      body: JSON.stringify({ nome: 'Admin Teste', email: adminEmail, senha: '123456' })
    });
    const users = await request('/api/admin/users', admin.token);
    const granted = await request(`/api/admin/users/${user.user.id}/grant`, admin.token, {
      method: 'POST',
      body: JSON.stringify({ days: 7 })
    });

    console.log({
      trial: status.subscription.subscription_status,
      payment: payment.payment.status,
      users: users.users.length,
      grantedDays: granted.user.days_remaining > status.subscription.days_remaining
    });
    stop(0);
  } catch (error) {
    console.error(error.message);
    stop(1);
  }
});

child.stderr.on('data', (chunk) => process.stderr.write(chunk));
setTimeout(() => {
  console.error('Timeout ao testar assinatura/admin.');
  stop(1);
}, 15000);