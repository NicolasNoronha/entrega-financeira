const { spawn } = require('child_process');

const child = spawn(process.execPath, ['server.js'], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: {
    ...process.env,
    PORT: '3100'
  }
});

const email = `teste.${Date.now()}@local.test`;

function stop(code) {
  if (!child.killed) child.kill();
  process.exit(code);
}

child.stdout.on('data', async (chunk) => {
  const text = String(chunk);
  process.stdout.write(text);

  if (!text.includes('Servidor rodando')) return;

  try {
    const response = await fetch('http://localhost:3100/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nome: 'Teste Entregador',
        email,
        senha: '123456'
      })
    });

    const data = await response.json();
    console.log({
      status: response.status,
      email: data.user?.email,
      token: Boolean(data.token)
    });
    stop(response.ok ? 0 : 1);
  } catch (error) {
    console.error(error.message);
    stop(1);
  }
});

child.stderr.on('data', (chunk) => {
  process.stderr.write(chunk);
});

setTimeout(() => {
  console.error('Timeout ao testar autenticacao.');
  stop(1);
}, 10000);
