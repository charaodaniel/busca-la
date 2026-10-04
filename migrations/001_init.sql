-- Busca Lá - schema inicial (PostgreSQL)
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  username TEXT UNIQUE,
  email TEXT UNIQUE,
  telefone TEXT UNIQUE,
  cpf TEXT UNIQUE,
  senha_hash TEXT NOT NULL,
  papel TEXT NOT NULL DEFAULT 'solicitante'
    CHECK (papel IN ('entregador','solicitante','operador','admin')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessoes (
  token TEXT PRIMARY KEY,
  usuario_id INT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entregadores (
  id SERIAL PRIMARY KEY,
  usuario_id INT UNIQUE REFERENCES usuarios(id),
  nome TEXT NOT NULL,
  telefone TEXT,
  veiculo TEXT NOT NULL,
  placa TEXT,
  online BOOLEAN NOT NULL DEFAULT FALSE,
  aprovacao TEXT NOT NULL DEFAULT 'pendente'
    CHECK (aprovacao IN ('aprovado','pendente','bloqueado')),
  nota NUMERIC(3,1) NOT NULL DEFAULT 5.0,
  entregas INT NOT NULL DEFAULT 0,
  ganhos_hoje NUMERIC(10,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS pedidos (
  id SERIAL PRIMARY KEY,
  codigo TEXT UNIQUE,
  usuario_id INT REFERENCES usuarios(id),
  solicitante_nome TEXT NOT NULL,
  solicitante_telefone TEXT,
  endereco_origem TEXT NOT NULL,
  endereco_destino TEXT NOT NULL,
  distancia_km NUMERIC(6,2) NOT NULL DEFAULT 3.5,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  descricao TEXT NOT NULL,
  observacoes TEXT DEFAULT '',
  modo_despacho TEXT NOT NULL DEFAULT 'chamar_todos'
    CHECK (modo_despacho IN ('chamar_todos','direcionado')),
  entregador_id INT REFERENCES entregadores(id),
  status TEXT NOT NULL DEFAULT 'aguardando_aceite'
    CHECK (status IN ('aguardando_aceite','aceito','em_coleta','em_entrega','concluido','cancelado')),
  cancelamento_motivo TEXT,
  coleta_lat DOUBLE PRECISION, coleta_lng DOUBLE PRECISION, coleta_label TEXT,
  destino_lat DOUBLE PRECISION, destino_lng DOUBLE PRECISION, destino_label TEXT,
  entregador_lat DOUBLE PRECISION, entregador_lng DOUBLE PRECISION,
  avaliacao_usuario JSONB,
  avaliacao_entregador JSONB,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pedido_eventos (
  id SERIAL PRIMARY KEY,
  pedido_id INT NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
  hora TEXT NOT NULL,
  descricao TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pedidos_status ON pedidos(status);
CREATE INDEX IF NOT EXISTS idx_pedidos_entregador ON pedidos(entregador_id);
CREATE INDEX IF NOT EXISTS idx_eventos_pedido ON pedido_eventos(pedido_id);
CREATE INDEX IF NOT EXISTS idx_sessoes_usuario ON sessoes(usuario_id);
