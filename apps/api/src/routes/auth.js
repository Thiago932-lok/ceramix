import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import { v4 as uuid } from 'uuid'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import db from '../db/connection.js'
import { authenticate } from '../middleware/auth.js'
import { audit } from '../utils/audit.js'
import { PERFIS } from '../utils/permissions.js'
import { config } from '../config.js'
import { AppError } from '../utils/http.js'

const router = Router()

const DUMMY_HASH = '$2a$10$BqoHe.KuP6uAwxh83/ipJu/at1x52PNq9CIvp9KcYQ8jX2iKVy9H6'

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: () => config.isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' }
})

const loginSchema = z.object({
  login: z.string().trim().min(1, 'Informe o usuário').max(60),
  senha: z.string().min(1, 'Informe a senha').max(200),
  dispositivoId: z.string().uuid('Dispositivo inválido').optional(),
  dispositivoNome: z.string().max(80).optional()
})

const registroLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  skip: () => config.isTest,
  standardHeaders: true,
  legacyHeaders: false,
  message: { erro: 'Muitos cadastros a partir deste endereço. Tente novamente mais tarde.' }
})

const registroSchema = z.object({
  nome: z.string().trim().min(2, 'Informe seu nome completo').max(120),
  empresa: z.string().trim().min(2, 'Informe o nome da empresa').max(120),
  cnpj: z
    .string()
    .trim()
    .transform((valor) => valor.replace(/\D/g, ''))
    .refine((valor) => valor.length === 0 || valor.length === 14, 'CNPJ deve ter 14 dígitos')
    .optional(),
  login: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9._-]{3,40}$/,
      'Use de 3 a 40 caracteres: letras, números, ponto, hífen ou sublinhado'
    ),
  senha: z.string().min(8, 'A senha deve ter ao menos 8 caracteres').max(72),
  cargo: z.enum(PERFIS, { errorMap: () => ({ message: 'Selecione um cargo válido' }) }),
  dispositivoId: z.string().uuid('Dispositivo inválido').optional(),
  dispositivoNome: z.string().max(80).optional()
})

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function signAccess(user, dispositivoId) {
  return jwt.sign(
    {
      sub: user.id,
      perfil: user.perfil,
      empresa_id: user.empresa_id,
      dispositivo_id: dispositivoId
    },
    config.jwtSecret,
    { expiresIn: `${config.accessTokenMinutes}m` }
  )
}

function signRefresh(user, dispositivoId) {
  return jwt.sign(
    { sub: user.id, dispositivo_id: dispositivoId, tipo: 'refresh' },
    config.jwtRefreshSecret,
    { expiresIn: `${config.refreshTokenDays}d`, jwtid: uuid() }
  )
}

function cookieOptions(maxAgeMs) {
  return {
    httpOnly: true,
    secure: config.isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeMs
  }
}

function setAuthCookies(res, access, refresh) {
  res.cookie('access_token', access, cookieOptions(config.accessTokenMinutes * 60 * 1000))
  res.cookie('refresh_token', refresh, cookieOptions(config.refreshTokenDays * 24 * 60 * 60 * 1000))
}

function clearAuthCookies(res) {
  for (const nome of ['access_token', 'refresh_token']) {
    res.clearCookie(nome, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/'
    })
  }
}

function persistirRefresh(userId, dispositivoId, refresh) {
  const agora = new Date().toISOString()
  const expira = new Date(Date.now() + config.refreshTokenDays * 24 * 60 * 60 * 1000).toISOString()
  db.prepare(
    `
    INSERT INTO refresh_tokens (id, usuario_id, dispositivo_id, token_hash, expira_em, revogado, criado_em)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `
  ).run(uuid(), userId, dispositivoId, hashToken(refresh), expira, agora)
}

function obterOuCriarDispositivo({ dispositivoId, dispositivoNome, userId, empresaId, req }) {
  if (dispositivoId) {
    const existente = db.prepare('SELECT * FROM dispositivos WHERE id = ?').get(dispositivoId)
    if (existente?.revogado) {
      throw new AppError(401, 'Dispositivo revogado. Contate o administrador.')
    }
    if (existente) {
      db.prepare('UPDATE dispositivos SET ultimo_acesso = ?, usuario_id = ? WHERE id = ?').run(
        new Date().toISOString(),
        userId,
        dispositivoId
      )
      return existente.id
    }
  }

  const id = dispositivoId || uuid()
  db.prepare(
    `
    INSERT INTO dispositivos (id, empresa_id, usuario_id, nome, user_agent, revogado, ultimo_acesso, criado_em)
    VALUES (?, ?, ?, ?, ?, 0, ?, ?)
  `
  ).run(
    id,
    empresaId,
    userId,
    dispositivoNome || 'Web',
    req.headers['user-agent'] || '',
    new Date().toISOString(),
    new Date().toISOString()
  )
  return id
}

function criarCatalogoInicial(empresaId, ts) {
  const hoje = ts.slice(0, 10)

  const insertTurno = db.prepare(`
    INSERT INTO turnos (id, empresa_id, nome, hora_inicio, hora_fim, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `)
  for (const [nome, inicio, fim] of [
    ['Manhã', '06:00', '14:00'],
    ['Tarde', '14:00', '22:00'],
    ['Noite', '22:00', '06:00']
  ]) {
    insertTurno.run(uuid(), empresaId, nome, inicio, fim, ts, ts)
  }

  const insertMotivo = db.prepare(`
    INSERT INTO motivos_refugo (id, empresa_id, nome, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, 1, ?, ?)
  `)
  for (const nome of [
    'Trinca',
    'Quebra no forno',
    'Deformação',
    'Queima irregular',
    'Dimensão fora do padrão'
  ]) {
    insertMotivo.run(uuid(), empresaId, nome, ts, ts)
  }

  const produtoId = uuid()
  db.prepare(
    `
    INSERT INTO produtos (id, empresa_id, nome, codigo, unidade, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, 'un', 1, ?, ?)
  `
  ).run(produtoId, empresaId, 'Tijolo 6 furos', 'TIJ-6F', ts, ts)

  db.prepare(
    `
    INSERT INTO lotes (id, empresa_id, codigo, produto_id, quantidade_produzida, quantidade_expedida, qr_code, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, 0, 0, ?, 1, ?, ?)
  `
  ).run(uuid(), empresaId, 'LOTE-001', produtoId, 'LOTE-001', ts, ts)

  const clienteId = uuid()
  db.prepare(
    `
    INSERT INTO clientes (id, empresa_id, nome, documento, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, NULL, 1, ?, ?)
  `
  ).run(clienteId, empresaId, 'Cliente inicial', ts, ts)

  db.prepare(
    `
    INSERT INTO obras (id, empresa_id, cliente_id, nome, endereco, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  `
  ).run(uuid(), empresaId, clienteId, 'Obra inicial', 'Endereço a definir', ts, ts)

  db.prepare(
    `
    INSERT INTO veiculos (id, empresa_id, placa, descricao, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, ?, 1, ?, ?)
  `
  ).run(uuid(), empresaId, 'ABC1D23', 'Veículo próprio', ts, ts)

  db.prepare(
    `
    INSERT INTO metas_producao (id, empresa_id, produto_id, turno_id, meta_diaria, vigencia_inicio, ativo, criado_em, atualizado_em)
    VALUES (?, ?, ?, NULL, ?, ?, 1, ?, ?)
  `
  ).run(uuid(), empresaId, produtoId, 1200, hoje, ts, ts)
}

function abrirSessao(req, res, user, empresaNome, { dispositivoId, dispositivoNome } = {}) {
  const dispositivoFinal = obterOuCriarDispositivo({
    dispositivoId,
    dispositivoNome,
    userId: user.id,
    empresaId: user.empresa_id,
    req
  })

  const access = signAccess(user, dispositivoFinal)
  const refresh = signRefresh(user, dispositivoFinal)
  persistirRefresh(user.id, dispositivoFinal, refresh)
  setAuthCookies(res, access, refresh)

  return {
    accessToken: access,
    refreshToken: refresh,
    dispositivoId: dispositivoFinal,
    usuario: {
      id: user.id,
      nome: user.nome,
      login: user.login,
      perfil: user.perfil,
      empresaId: user.empresa_id,
      empresaNome
    }
  }
}

router.post('/registrar', registroLimiter, (req, res) => {
  const parsed = registroSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Dados de cadastro inválidos', parsed.error.flatten().fieldErrors)
  }
  const { nome, empresa, cnpj, login, senha, cargo, dispositivoId, dispositivoNome } = parsed.data

  const existente = db.prepare('SELECT id FROM usuarios WHERE login = ?').get(login)
  if (existente) {
    throw new AppError(409, 'Este usuário já está em uso. Escolha outro.')
  }

  const empresaId = uuid()
  const userId = uuid()
  const ts = new Date().toISOString()
  const senhaHash = bcrypt.hashSync(senha, 10)

  const criarConta = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO empresas (id, nome, cnpj, ativo, criado_em, atualizado_em)
      VALUES (?, ?, ?, 1, ?, ?)
    `
    ).run(empresaId, empresa, cnpj || null, ts, ts)

    db.prepare(
      `
      INSERT INTO usuarios (id, empresa_id, nome, login, senha_hash, perfil, ativo, criado_em, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `
    ).run(userId, empresaId, nome, login, senhaHash, cargo, ts, ts)

    criarCatalogoInicial(empresaId, ts)
  })

  try {
    criarConta()
  } catch (erro) {
    if (erro?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      throw new AppError(409, 'Este usuário já está em uso. Escolha outro.')
    }
    throw erro
  }

  const user = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(userId)
  const sessao = abrirSessao(req, res, user, empresa, { dispositivoId, dispositivoNome })

  audit({
    empresaId,
    entidade: 'auth',
    entidadeId: userId,
    acao: 'registro',
    usuarioId: userId,
    dispositivoId: sessao.dispositivoId,
    valorNovo: { empresa, login, cargo },
    ip: req.ip
  })

  res.status(201).json(sessao)
})

router.post('/login', loginLimiter, (req, res) => {
  const parsed = loginSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError(400, 'Dados de login inválidos', parsed.error.flatten().fieldErrors)
  }
  const { login, senha, dispositivoId, dispositivoNome } = parsed.data

  const user = db.prepare('SELECT * FROM usuarios WHERE login = ?').get(login.toLowerCase())

  if (!user) {
    bcrypt.compareSync(senha, DUMMY_HASH)
    audit({
      empresaId: 'sistema',
      entidade: 'auth',
      entidadeId: login,
      acao: 'login_falha',
      ip: req.ip
    })
    return res.status(401).json({ erro: 'Credenciais inválidas' })
  }

  if (!user.ativo) {
    return res.status(401).json({ erro: 'Usuário desativado' })
  }

  if (user.bloqueado_ate && new Date(user.bloqueado_ate) > new Date()) {
    return res
      .status(423)
      .json({ erro: 'Usuário temporariamente bloqueado. Tente em alguns minutos.' })
  }

  const ok = bcrypt.compareSync(senha, user.senha_hash)
  if (!ok) {
    const tentativas = user.tentativas_falhas + 1
    const bloqueadoAte =
      tentativas >= 5 ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null
    db.prepare('UPDATE usuarios SET tentativas_falhas = ?, bloqueado_ate = ? WHERE id = ?').run(
      tentativas,
      bloqueadoAte,
      user.id
    )
    audit({
      empresaId: user.empresa_id,
      entidade: 'auth',
      entidadeId: user.id,
      acao: bloqueadoAte ? 'login_bloqueado' : 'login_falha',
      usuarioId: user.id,
      ip: req.ip
    })
    return res.status(401).json({ erro: 'Credenciais inválidas' })
  }

  db.prepare('UPDATE usuarios SET tentativas_falhas = 0, bloqueado_ate = NULL WHERE id = ?').run(
    user.id
  )

  const empresa = db.prepare('SELECT nome FROM empresas WHERE id = ?').get(user.empresa_id)
  const sessao = abrirSessao(req, res, user, empresa?.nome, { dispositivoId, dispositivoNome })

  audit({
    empresaId: user.empresa_id,
    entidade: 'auth',
    entidadeId: user.id,
    acao: 'login',
    usuarioId: user.id,
    dispositivoId: sessao.dispositivoId,
    ip: req.ip
  })

  res.json(sessao)
})

router.post('/refresh', (req, res) => {
  const token = req.body?.refreshToken || req.cookies?.refresh_token
  if (!token) {
    return res.status(401).json({ erro: 'Refresh token ausente' })
  }

  let payload
  try {
    payload = jwt.verify(token, config.jwtRefreshSecret)
  } catch {
    return res.status(401).json({ erro: 'Refresh token inválido' })
  }

  const stored = db
    .prepare('SELECT * FROM refresh_tokens WHERE token_hash = ? AND revogado = 0')
    .get(hashToken(token))
  if (!stored || new Date(stored.expira_em) < new Date()) {
    return res.status(401).json({ erro: 'Refresh token inválido' })
  }

  const user = db.prepare('SELECT * FROM usuarios WHERE id = ? AND ativo = 1').get(payload.sub)
  if (!user) {
    return res.status(401).json({ erro: 'Usuário inválido' })
  }

  if (payload.dispositivo_id) {
    const dispositivo = db
      .prepare('SELECT revogado FROM dispositivos WHERE id = ?')
      .get(payload.dispositivo_id)
    if (dispositivo?.revogado) {
      return res.status(401).json({ erro: 'Dispositivo revogado' })
    }
  }

  const access = signAccess(user, payload.dispositivo_id)
  const refresh = signRefresh(user, payload.dispositivo_id)

  const rotacionar = db.transaction(() => {
    db.prepare('UPDATE refresh_tokens SET revogado = 1 WHERE id = ?').run(stored.id)
    persistirRefresh(user.id, payload.dispositivo_id || null, refresh)
  })
  rotacionar()

  setAuthCookies(res, access, refresh)
  res.json({ accessToken: access, refreshToken: refresh })
})

router.post('/logout', authenticate, (req, res) => {
  const token = req.body?.refreshToken || req.cookies?.refresh_token
  if (token) {
    db.prepare('UPDATE refresh_tokens SET revogado = 1 WHERE token_hash = ?').run(hashToken(token))
  }
  clearAuthCookies(res)
  audit({
    empresaId: req.user.empresaId,
    entidade: 'auth',
    entidadeId: req.user.id,
    acao: 'logout',
    usuarioId: req.user.id,
    dispositivoId: req.dispositivoId,
    ip: req.ip
  })
  res.json({ ok: true })
})

router.get('/me', authenticate, (req, res) => {
  res.json({ usuario: req.user, dispositivoId: req.dispositivoId })
})

export default router
