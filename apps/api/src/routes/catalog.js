import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'
import db from '../db/connection.js'
import { authenticate } from '../middleware/auth.js'
import { requirePerm } from '../utils/permissions.js'
import { audit } from '../utils/audit.js'

const router = Router()
router.use(authenticate)

router.get('/referencia', (req, res) => {
  const empresaId = req.user.empresaId
  const since = req.query.updated_since

  const filter = since ? 'AND atualizado_em > ?' : ''
  const params = since ? [empresaId, since] : [empresaId]

  const produtos = db
    .prepare(`SELECT * FROM produtos WHERE empresa_id = ? AND ativo = 1 ${filter}`)
    .all(...params)
  const turnos = db
    .prepare(`SELECT * FROM turnos WHERE empresa_id = ? AND ativo = 1 ${filter}`)
    .all(...params)
  const motivos = db
    .prepare(`SELECT * FROM motivos_refugo WHERE empresa_id = ? AND ativo = 1 ${filter}`)
    .all(...params)
  const lotes = db
    .prepare(`SELECT * FROM lotes WHERE empresa_id = ? AND ativo = 1 ${filter}`)
    .all(...params)
  const obras = db
    .prepare(`SELECT * FROM obras WHERE empresa_id = ? AND ativo = 1 ${filter}`)
    .all(...params)
  const veiculos = db
    .prepare(`SELECT * FROM veiculos WHERE empresa_id = ? AND ativo = 1 ${filter}`)
    .all(...params)
  const metas = db
    .prepare(`SELECT * FROM metas_producao WHERE empresa_id = ? AND ativo = 1 ${filter}`)
    .all(...params)
  const clientes = db
    .prepare(`SELECT * FROM clientes WHERE empresa_id = ? AND ativo = 1 ${filter}`)
    .all(...params)

  res.json({
    produtos,
    turnos,
    motivos_refugo: motivos,
    lotes,
    obras,
    veiculos,
    metas_producao: metas,
    clientes,
    sincronizado_em: new Date().toISOString()
  })
})

router.get('/produtos', requirePerm('cadastros.gerir'), (req, res) => {
  const rows = db
    .prepare('SELECT * FROM produtos WHERE empresa_id = ? ORDER BY nome')
    .all(req.user.empresaId)
  res.json(rows)
})

router.post('/produtos', requirePerm('cadastros.gerir'), (req, res) => {
  const schema = z.object({
    nome: z.string().min(2).max(120),
    codigo: z.string().min(1).max(40),
    unidade: z.string().default('un')
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() })

  const id = uuid()
  const ts = new Date().toISOString()
  try {
    db.prepare(
      `
      INSERT INTO produtos (id, empresa_id, nome, codigo, unidade, ativo, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `
    ).run(id, req.user.empresaId, parsed.data.nome, parsed.data.codigo, parsed.data.unidade, ts, ts)
  } catch {
    return res.status(409).json({ erro: 'Codigo de produto ja existe' })
  }

  audit({
    empresaId: req.user.empresaId,
    entidade: 'produto',
    entidadeId: id,
    acao: 'criar',
    usuarioId: req.user.id,
    valorNovo: parsed.data,
    ip: req.ip
  })
  res.status(201).json({ id, ...parsed.data })
})

router.get('/turnos', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM turnos WHERE empresa_id = ? AND ativo = 1 ORDER BY nome')
    .all(req.user.empresaId)
  res.json(rows)
})

router.get('/motivos-refugo', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM motivos_refugo WHERE empresa_id = ? AND ativo = 1 ORDER BY nome')
    .all(req.user.empresaId)
  res.json(rows)
})

router.get('/lotes', (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT l.*, p.nome as produto_nome,
      (l.quantidade_produzida - l.quantidade_expedida) as saldo
    FROM lotes l
    JOIN produtos p ON p.id = l.produto_id
    WHERE l.empresa_id = ? AND l.ativo = 1
    ORDER BY l.codigo
  `
    )
    .all(req.user.empresaId)
  res.json(rows)
})

router.post('/lotes', requirePerm('cadastros.gerir'), (req, res) => {
  const schema = z.object({
    codigo: z.string().min(1).max(40),
    produto_id: z.string().uuid(),
    quantidade_produzida: z.number().int().positive().default(0)
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() })

  const produto = db
    .prepare('SELECT id FROM produtos WHERE id = ? AND empresa_id = ?')
    .get(parsed.data.produto_id, req.user.empresaId)
  if (!produto) return res.status(400).json({ erro: 'Produto invalido' })

  const id = uuid()
  const ts = new Date().toISOString()
  try {
    db.prepare(
      `
      INSERT INTO lotes (id, empresa_id, codigo, produto_id, quantidade_produzida, quantidade_expedida, qr_code, ativo, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, 0, ?, 1, ?, ?)
    `
    ).run(
      id,
      req.user.empresaId,
      parsed.data.codigo,
      parsed.data.produto_id,
      parsed.data.quantidade_produzida,
      parsed.data.codigo,
      ts,
      ts
    )
  } catch {
    return res.status(409).json({ erro: 'Codigo de lote ja existe' })
  }

  res.status(201).json({ id, ...parsed.data, qr_code: parsed.data.codigo })
})

router.get('/obras', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM obras WHERE empresa_id = ? AND ativo = 1 ORDER BY nome')
    .all(req.user.empresaId)
  res.json(rows)
})

router.get('/veiculos', (req, res) => {
  const rows = db
    .prepare('SELECT * FROM veiculos WHERE empresa_id = ? AND ativo = 1 ORDER BY placa')
    .all(req.user.empresaId)
  res.json(rows)
})

router.get('/usuarios', requirePerm('usuarios.gerir'), (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT id, nome, login, perfil, ativo, criado_em
    FROM usuarios WHERE empresa_id = ? ORDER BY nome
  `
    )
    .all(req.user.empresaId)
  res.json(rows)
})

router.post('/usuarios', requirePerm('usuarios.gerir'), (req, res) => {
  const schema = z.object({
    nome: z.string().min(2),
    login: z.string().min(3).max(40),
    senha: z.string().min(6),
    perfil: z.enum(['admin', 'gestor', 'supervisor', 'operador', 'conferente', 'motorista'])
  })
  const parsed = schema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ erro: parsed.error.flatten() })

  const id = uuid()
  const ts = new Date().toISOString()
  const hash = bcrypt.hashSync(parsed.data.senha, 10)
  const login = parsed.data.login.toLowerCase()

  const existente = db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login)
  if (existente) {
    return res.status(409).json({ erro: 'Login ja existe' })
  }

  try {
    db.prepare(
      `
      INSERT INTO usuarios (id, empresa_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `
    ).run(id, req.user.empresaId, parsed.data.nome, login, hash, parsed.data.perfil, ts, ts)
  } catch {
    return res.status(409).json({ erro: 'Login ja existe' })
  }

  audit({
    empresaId: req.user.empresaId,
    entidade: 'usuario',
    entidadeId: id,
    acao: 'criar',
    usuarioId: req.user.id,
    valorNovo: { nome: parsed.data.nome, login, perfil: parsed.data.perfil },
    ip: req.ip
  })
  res.status(201).json({ id, nome: parsed.data.nome, login, perfil: parsed.data.perfil })
})

router.get('/dispositivos', requirePerm('dispositivos.revogar'), (req, res) => {
  const rows = db
    .prepare(
      `
    SELECT d.id, d.nome, d.user_agent, d.revogado, d.revogado_em, d.ultimo_acesso, d.criado_em,
           u.nome as usuario_nome, u.login as usuario_login
    FROM dispositivos d
    LEFT JOIN usuarios u ON u.id = d.usuario_id
    WHERE d.empresa_id = ?
    ORDER BY d.ultimo_acesso DESC
    LIMIT 100
  `
    )
    .all(req.user.empresaId)
  res.json(rows)
})

router.post('/dispositivos/:id/revogar', requirePerm('dispositivos.revogar'), (req, res) => {
  const d = db
    .prepare('SELECT * FROM dispositivos WHERE id = ? AND empresa_id = ?')
    .get(req.params.id, req.user.empresaId)
  if (!d) return res.status(404).json({ erro: 'Dispositivo nao encontrado' })

  const ts = new Date().toISOString()
  db.prepare('UPDATE dispositivos SET revogado = 1, revogado_em = ? WHERE id = ?').run(ts, d.id)
  db.prepare('UPDATE refresh_tokens SET revogado = 1 WHERE dispositivo_id = ?').run(d.id)

  audit({
    empresaId: req.user.empresaId,
    entidade: 'dispositivo',
    entidadeId: d.id,
    acao: 'revogar',
    usuarioId: req.user.id,
    ip: req.ip
  })
  res.json({ ok: true })
})

export default router
