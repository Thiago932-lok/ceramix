import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

const SENHA = '123456'

function id() {
  return crypto.randomUUID()
}

function agora() {
  return new Date().toISOString()
}

export async function criarAmbiente() {
  const dbPath = path.join(os.tmpdir(), `ceramix-test-${crypto.randomUUID()}.db`)

  process.env.NODE_ENV = 'test'
  process.env.DB_PATH = dbPath
  process.env.JWT_SECRET = 'teste-access-secret-com-tamanho-suficiente-123'
  process.env.JWT_REFRESH_SECRET = 'teste-refresh-secret-com-tamanho-suficiente-456'
  process.env.LOG_LEVEL = 'silent'
  process.env.CORS_ORIGIN = 'http://localhost:5173'

  const { default: db } = await import('../src/db/connection.js')
  const { applyMigrations } = await import('../src/db/schema.js')
  applyMigrations(db)

  const ids = semear(db)

  const { createApp } = await import('../src/app.js')
  const request = (await import('supertest')).default
  const app = createApp()

  return {
    app,
    db,
    request,
    ids,
    async limpar() {
      db.close()
      for (const sufixo of ['', '-wal', '-shm']) {
        try {
          fs.unlinkSync(`${dbPath}${sufixo}`)
        } catch {
          // arquivo já removido
        }
      }
    }
  }
}

function semear(db) {
  const ts = agora()
  const empresaId = id()
  const senha = bcrypt.hashSync(SENHA, 10)

  db.prepare(
    `
    INSERT INTO empresas (id, nome, cnpj, ativo, criado_em, atualizado_em)
    VALUES (?, 'Cerâmica Teste', '00.000.000/0001-00', 1, ?, ?)
  `
  ).run(empresaId, ts, ts)

  const perfis = ['admin', 'gestor', 'operador', 'conferente', 'motorista']
  const usuarios = {}
  const insertUsuario = db.prepare(`
    INSERT INTO usuarios (id, empresa_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `)
  for (const perfil of perfis) {
    const usuarioId = id()
    usuarios[perfil] = usuarioId
    insertUsuario.run(usuarioId, empresaId, `Usuário ${perfil}`, perfil, senha, perfil, ts, ts)
  }

  const turnoId = id()
  db.prepare(
    `
    INSERT INTO turnos (id, empresa_id, nome, hora_inicio, hora_fim, ativo, criado_em, atualizado_em)
    VALUES (?, ?, 'Manhã', '06:00', '14:00', 1, ?, ?)
  `
  ).run(turnoId, empresaId, ts, ts)

  const produtoId = id()
  db.prepare(
    `
    INSERT INTO produtos (id, empresa_id, nome, codigo, unidade, ativo, criado_em, atualizado_em)
    VALUES (?, ?, 'Tijolo 6 furos', 'TIJ-6F', 'un', 1, ?, ?)
  `
  ).run(produtoId, empresaId, ts, ts)

  const motivoId = id()
  db.prepare(
    `
    INSERT INTO motivos_refugo (id, empresa_id, nome, ativo, criado_em, atualizado_em)
    VALUES (?, ?, 'Trinca', 1, ?, ?)
  `
  ).run(motivoId, empresaId, ts, ts)

  const loteId = id()
  db.prepare(
    `
    INSERT INTO lotes (id, empresa_id, codigo, produto_id, quantidade_produzida, quantidade_expedida, qr_code, ativo, criado_em, atualizado_em)
    VALUES (?, ?, 'LOTE-1', ?, 1000, 0, 'LOTE-1', 1, ?, ?)
  `
  ).run(loteId, empresaId, produtoId, ts, ts)

  const obraId = id()
  db.prepare(
    `
    INSERT INTO obras (id, empresa_id, nome, endereco, ativo, criado_em, atualizado_em)
    VALUES (?, ?, 'Obra Teste', 'Rua A, 10', 1, ?, ?)
  `
  ).run(obraId, empresaId, ts, ts)

  const veiculoId = id()
  db.prepare(
    `
    INSERT INTO veiculos (id, empresa_id, placa, descricao, ativo, criado_em, atualizado_em)
    VALUES (?, ?, 'ABC1D23', 'Caminhão', 1, ?, ?)
  `
  ).run(veiculoId, empresaId, ts, ts)

  db.prepare(
    `
    INSERT INTO metas_producao (id, empresa_id, produto_id, turno_id, meta_diaria, vigencia_inicio, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, 5000, ?, 1, ?, ?)
  `
  ).run(id(), empresaId, produtoId, turnoId, ts.slice(0, 10), ts, ts)

  return {
    empresaId,
    usuarios,
    turnoId,
    produtoId,
    motivoId,
    loteId,
    obraId,
    veiculoId,
    senha: SENHA
  }
}

export async function entrar(request, app, perfil) {
  const res = await request(app).post('/api/auth/login').send({ login: perfil, senha: SENHA })
  if (res.status !== 200) {
    throw new Error(`Login de ${perfil} falhou: ${res.status} ${JSON.stringify(res.body)}`)
  }
  return res.body
}

export function payloadProducao(ids, opcoes = {}) {
  const producaoId = opcoes.id || id()
  const quantidade = opcoes.quantidade ?? 100
  const refugo = opcoes.refugo ?? 0
  return {
    id: producaoId,
    turno_id: ids.turnoId,
    data_producao: new Date().toISOString().slice(0, 10),
    criado_em_cliente: new Date().toISOString(),
    itens: [
      {
        id: id(),
        produto_id: ids.produtoId,
        lote_id: opcoes.loteId ?? ids.loteId,
        quantidade_produzida: quantidade,
        quantidade_refugo: refugo,
        motivo_refugo_id: refugo > 0 ? (opcoes.motivoId ?? ids.motivoId) : null,
        consumo_argila: 1.5
      }
    ]
  }
}

export function payloadEntrega(ids, opcoes = {}) {
  const entregaId = opcoes.id || id()
  return {
    id: entregaId,
    obra_id: ids.obraId,
    veiculo_id: ids.veiculoId,
    criado_em_cliente: new Date().toISOString(),
    itens: [
      {
        id: id(),
        lote_id: opcoes.loteId ?? ids.loteId,
        produto_id: ids.produtoId,
        quantidade: opcoes.quantidade ?? 100
      }
    ]
  }
}
