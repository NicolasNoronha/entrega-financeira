CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(120) NOT NULL,
  email VARCHAR(160) UNIQUE NOT NULL,
  senha VARCHAR(255) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  veiculo_id UUID,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Receita', 'Despesa')),
  data DATE NOT NULL,
  valor NUMERIC(12, 2) NOT NULL CHECK (valor >= 0),
  descricao VARCHAR(255) NOT NULL,
  categoria VARCHAR(80),
  rota_nome VARCHAR(120),
  periodo VARCHAR(20) CHECK (periodo IS NULL OR periodo IN ('Manha', 'Tarde', 'Noite')),
  km_inicial NUMERIC(10, 1),
  km_final NUMERIC(10, 1),
  km_total NUMERIC(10, 1),
  quantidade_pacotes INTEGER CHECK (quantidade_pacotes IS NULL OR quantidade_pacotes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vehicles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tipo VARCHAR(20) NOT NULL CHECK (tipo IN ('Moto', 'Carro')),
  modelo VARCHAR(120) NOT NULL,
  placa VARCHAR(20),
  consumo_medio NUMERIC(8, 2),
  tipo_combustivel VARCHAR(40),
  valor_medio_combustivel NUMERIC(10, 2),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS veiculo_id UUID;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS categoria VARCHAR(80);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rota_nome VARCHAR(120);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS periodo VARCHAR(20);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS km_inicial NUMERIC(10, 1);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS km_final NUMERIC(10, 1);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS km_total NUMERIC(10, 1);

CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_type ON transactions(user_id, tipo);
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON transactions(user_id, categoria);
CREATE INDEX IF NOT EXISTS idx_transactions_user_route ON transactions(user_id, rota_nome);
CREATE INDEX IF NOT EXISTS idx_transactions_user_vehicle ON transactions(user_id, veiculo_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_user ON vehicles(user_id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(30) NOT NULL DEFAULT 'trial';
ALTER TABLE users ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS access_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS subscription_notes TEXT;

UPDATE users
   SET trial_ends_at = COALESCE(trial_ends_at, created_at + INTERVAL '7 days'),
       access_expires_at = COALESCE(access_expires_at, created_at + INTERVAL '7 days')
 WHERE trial_ends_at IS NULL OR access_expires_at IS NULL;

CREATE TABLE IF NOT EXISTS subscription_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider VARCHAR(40) NOT NULL DEFAULT 'mercado_pago',
  provider_payment_id VARCHAR(120),
  provider_preference_id VARCHAR(120),
  payment_url TEXT,
  amount NUMERIC(10, 2) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  days_granted INTEGER NOT NULL DEFAULT 30,
  raw_payload JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_status, access_expires_at);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_user ON subscription_payments(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_provider ON subscription_payments(provider, provider_payment_id);