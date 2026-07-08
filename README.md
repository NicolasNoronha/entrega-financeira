# Entrega Financeira

MVP responsivo para entregadores autonomos controlarem receitas, despesas, pacotes e saldo liquido. A API isola todos os dados por `user_id` vindo do JWT.

## Stack

- Node.js + Express
- PostgreSQL
- JWT para sessao
- bcrypt para senha
- HTML, Tailwind CDN e JavaScript vanilla

## Como rodar

1. Instale as dependencias:

```bash
npm install
```

2. Crie o banco PostgreSQL e rode o schema:

```bash
createdb entregador_financeiro
psql -d entregador_financeiro -f config/schema.sql
```

3. Copie `.env.example` para `.env` e ajuste `DATABASE_URL` e `JWT_SECRET`.

4. Inicie:

```bash
npm run dev
```

Abra `http://localhost:3000`.

## Versao aplicativo

O projeto agora funciona como PWA. No celular, abra o endereco pelo navegador e use a opcao de instalar/adicionar a tela inicial. A mesma URL continua funcionando normalmente no navegador web.

Arquivos principais:

- `public/manifest.webmanifest`
- `public/sw.js`
- `public/icons/icon.svg`

## Funcionalidades

- Cadastro de receitas por categoria: rota, Shopee, bonus, diaria, reembolso e outros ganhos.
- Cadastro de despesas por categoria: combustivel, manutencao, alimentacao, celular, pedagio, estacionamento, multas, lavagem, equipamentos e outros gastos.
- Registro de rota, periodo, pacotes, veiculo e quilometragem por lancamento.
- Cadastro de veiculo com tipo, modelo, placa, consumo medio e combustivel.
- Dashboard com lucro diario, lucro mensal, km do mes, lucro por km e gastos por categoria.
- Relatorios por periodo, rota, veiculo e categoria.
- Simulador de rota com custo estimado de combustivel, lucro estimado e receita por km.

## Rotas

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/transactions?period=dia|semana|mes`
- `POST /api/transactions`
- `GET /api/transactions/dashboard?period=dia|semana|mes`
- `GET /api/transactions/reports?period=dia|semana|mes`
- `DELETE /api/transactions/:id`
- `GET /api/vehicles`
- `POST /api/vehicles`
- `DELETE /api/vehicles/:id`

## APK Android

O app pode ser empacotado com Capacitor. Enquanto nao houver hospedagem, a interface instalada no celular chama a API em `http://192.168.1.9:3000/api` via `public/config.js`.

Para testar no celular, o computador que roda o servidor precisa estar na mesma rede Wi-Fi e o firewall deve liberar a porta `3000`.

Comandos principais depois de instalar o Capacitor:

```bash
npm.cmd run cap:add:android
npm.cmd run cap:sync
npm.cmd run cap:open
```

No Android Studio, gere o APK em Build > Build Bundle(s) / APK(s) > Build APK(s).

## Deploy Render + Neon

Variaveis principais para configurar no Render:

```env
DATABASE_URL=postgres://usuario:senha@host.neon.tech/neondb?sslmode=require
DATABASE_SSL=true
JWT_SECRET=troque-esta-chave-em-producao
AUTO_RUN_MIGRATIONS=true
PUBLIC_BASE_URL=https://seu-app.onrender.com
MERCADO_PAGO_ACCESS_TOKEN=
MERCADO_PAGO_WEBHOOK_SECRET=
```

Build command:

```bash
npm install
```

Start command:

```bash
npm start
```
