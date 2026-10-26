export function applyMigrations(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS empresas (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  cnpj TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  login TEXT NOT NULL,
  senha_hash TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK(perfil IN ('admin','gestor','supervisor','operador','conferente','motorista')),
  ativo INTEGER NOT NULL DEFAULT 1,
  tentativas_falhas INTEGER NOT NULL DEFAULT 0,
  bloqueado_ate TEXT,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS dispositivos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  nome TEXT,
  user_agent TEXT,
  revogado INTEGER NOT NULL DEFAULT 0,
  revogado_em TEXT,
  ultimo_acesso TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  usuario_id TEXT NOT NULL REFERENCES usuarios(id),
  dispositivo_id TEXT REFERENCES dispositivos(id),
  token_hash TEXT NOT NULL,
  expira_em TEXT NOT NULL,
  revogado INTEGER NOT NULL DEFAULT 0,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS produtos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  codigo TEXT,
  unidade TEXT NOT NULL DEFAULT 'un',
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  UNIQUE(empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS turnos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  hora_inicio TEXT,
  hora_fim TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS motivos_refugo (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS metas_producao (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  turno_id TEXT REFERENCES turnos(id),
  meta_diaria INTEGER NOT NULL,
  vigencia_inicio TEXT NOT NULL,
  vigencia_fim TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lotes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  codigo TEXT NOT NULL,
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  quantidade_produzida INTEGER NOT NULL DEFAULT 0,
  quantidade_expedida INTEGER NOT NULL DEFAULT 0,
  qr_code TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  UNIQUE(empresa_id, codigo)
);

CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  nome TEXT NOT NULL,
  documento TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS obras (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  cliente_id TEXT REFERENCES clientes(id),
  nome TEXT NOT NULL,
  endereco TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS veiculos (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  placa TEXT NOT NULL,
  descricao TEXT,
  ativo INTEGER NOT NULL DEFAULT 1,
  criado_em TEXT NOT NULL,
  atualizado_em TEXT NOT NULL,
  UNIQUE(empresa_id, placa)
);

CREATE TABLE IF NOT EXISTS producoes (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  turno_id TEXT NOT NULL REFERENCES turnos(id),
  data_producao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente_validacao'
    CHECK(status IN ('pendente_validacao','validado','rejeitado','cancelado')),
  observacao TEXT,
  criado_por TEXT NOT NULL REFERENCES usuarios(id),
  dispositivo_id TEXT,
  criado_em_cliente TEXT NOT NULL,
  recebido_em_servidor TEXT NOT NULL,
  validado_por TEXT REFERENCES usuarios(id),
  validado_em TEXT,
  versao INTEGER NOT NULL DEFAULT 1,
  cancelado_em TEXT,
  cancelado_por TEXT REFERENCES usuarios(id),
  motivo_cancelamento TEXT,
  UNIQUE(empresa_id, id)
);

CREATE TABLE IF NOT EXISTS itens_producao (
  id TEXT PRIMARY KEY,
  producao_id TEXT NOT NULL REFERENCES producoes(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  lote_id TEXT REFERENCES lotes(id),
  quantidade_produzida INTEGER NOT NULL CHECK(quantidade_produzida > 0),
  quantidade_refugo INTEGER NOT NULL DEFAULT 0 CHECK(quantidade_refugo >= 0),
  motivo_refugo_id TEXT REFERENCES motivos_refugo(id),
  consumo_argila REAL,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entregas (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  obra_id TEXT NOT NULL REFERENCES obras(id),
  veiculo_id TEXT NOT NULL REFERENCES veiculos(id),
  motorista_id TEXT REFERENCES usuarios(id),
  status TEXT NOT NULL DEFAULT 'saida_registrada'
    CHECK(status IN ('saida_registrada','em_transito','entregue','cancelada')),
  saida_em TEXT,
  saida_lat REAL,
  saida_lng REAL,
  chegada_em TEXT,
  chegada_lat REAL,
  chegada_lng REAL,
  confirmado_por TEXT REFERENCES usuarios(id),
  confirmado_em TEXT,
  observacao TEXT,
  criado_por TEXT NOT NULL REFERENCES usuarios(id),
  dispositivo_id TEXT,
  criado_em_cliente TEXT NOT NULL,
  recebido_em_servidor TEXT NOT NULL,
  versao INTEGER NOT NULL DEFAULT 1,
  cancelado_em TEXT,
  cancelado_por TEXT REFERENCES usuarios(id),
  motivo_cancelamento TEXT,
  UNIQUE(empresa_id, id)
);

CREATE TABLE IF NOT EXISTS itens_entrega (
  id TEXT PRIMARY KEY,
  entrega_id TEXT NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  lote_id TEXT NOT NULL REFERENCES lotes(id),
  produto_id TEXT NOT NULL REFERENCES produtos(id),
  quantidade INTEGER NOT NULL CHECK(quantidade > 0),
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS eventos_rastreio (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL REFERENCES empresas(id),
  entrega_id TEXT NOT NULL REFERENCES entregas(id),
  lote_id TEXT REFERENCES lotes(id),
  tipo TEXT NOT NULL CHECK(tipo IN ('qr_saida','qr_chegada','gps_saida','gps_chegada','confirmacao')),
  usuario_id TEXT REFERENCES usuarios(id),
  lat REAL,
  lng REAL,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS auditoria (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  acao TEXT NOT NULL,
  usuario_id TEXT,
  dispositivo_id TEXT,
  valor_antigo TEXT,
  valor_novo TEXT,
  ip TEXT,
  criado_em TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS log_sincronizacao (
  id TEXT PRIMARY KEY,
  empresa_id TEXT NOT NULL,
  dispositivo_id TEXT,
  registro_tipo TEXT NOT NULL,
  registro_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACEITO','JA_RECEBIDO','REJEITADO')),
  tentativas INTEGER NOT NULL DEFAULT 1,
  erro TEXT,
  criado_em TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_producoes_data ON producoes(empresa_id, data_producao);
CREATE INDEX IF NOT EXISTS idx_producoes_status ON producoes(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_itens_prod_produto ON itens_producao(empresa_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_entregas_status ON entregas(empresa_id, status);
CREATE INDEX IF NOT EXISTS idx_entregas_obra ON entregas(empresa_id, obra_id);
CREATE INDEX IF NOT EXISTS idx_lotes_produto ON lotes(empresa_id, produto_id);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade ON auditoria(empresa_id, entidade, entidade_id);
CREATE INDEX IF NOT EXISTS idx_log_sync_registro ON log_sincronizacao(registro_tipo, registro_id);
CREATE INDEX IF NOT EXISTS idx_refresh_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_usuario ON refresh_tokens(usuario_id, revogado);
CREATE INDEX IF NOT EXISTS idx_dispositivos_empresa ON dispositivos(empresa_id, usuario_id);
CREATE INDEX IF NOT EXISTS idx_eventos_entrega ON eventos_rastreio(entrega_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_obras_cliente ON obras(empresa_id, cliente_id);
`)

  const loginDuplicado = db
    .prepare('SELECT login FROM usuarios GROUP BY login HAVING COUNT(*) > 1 LIMIT 1')
    .get()
  if (!loginDuplicado) {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_usuarios_login ON usuarios(login)')
  }
}
