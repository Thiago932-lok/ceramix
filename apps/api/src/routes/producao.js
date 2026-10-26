import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'
import db from '../db/connection.js'
import { authenticate } from '../middleware/auth.js'
import { requirePerm } from '../utils/permissions.js'
import { audit } from '../utils/audit.js'
import { AppError } from '../utils/http.js'

const router = Router()
router.use(authenticate)

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  produto_id: z.string().uuid(),
  lote_id: z.string().uuid().optional().nullable(),
  quantidade_produzida: z.number().int().positive().max(100000),
  quantidade_refugo: z.number().int().min(0).max(100000).default(0),
  motivo_refugo_id: z.string().uuid().optional().nullable(),
  consumo_argila: z.number().nonnegative().optional().nullable()
})

const producaoSchema = z.object({
  id: z.string().uuid(),
  turno_id: z.string().uuid(),
  data_producao: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  observacao: z.string().max(500).optional().nullable(),
  criado_em_cliente: z.string(),
  itens: z.array(itemSchema).min(1)
})

function validarItens(itens) {
  for (const item of itens) {
    if (item.quantidade_refugo > item.quantidade_produzida) {
      return 'Quantidade de refugo nao pode exceder a produzida (RN-07)'
    }
    if (item.quantidade_refugo > 0 && !item.motivo_refugo_id) {
      return 'Motivo de refugo obrigatorio quando houver refugo'
    }
  }
  return null
}

function criarProducao(payload, user, dispositivoId) {
  const existente = db
    .prepare('SELECT id FROM producoes WHERE empresa_id = ? AND id = ?')
    .get(user.empresaId, payload.id)
  if (existente) {
    return { status: 'JA_RECEBIDO', id: payload.id }
  }

  const turno = db
    .prepare('SELECT id FROM turnos WHERE id = ? AND empresa_id = ? AND ativo = 1')
    .get(payload.turno_id, user.empresaId)
  if (!turno) return { status: 'REJEITADO', erro: 'Turno invalido ou inativo' }

  const erroItens = validarItens(payload.itens)
  if (erroItens) return { status: 'REJEITADO', erro: erroItens }

  for (const item of payload.itens) {
    const produto = db
      .prepare('SELECT id FROM produtos WHERE id = ? AND empresa_id = ? AND ativo = 1')
      .get(item.produto_id, user.empresaId)
    if (!produto) return { status: 'REJEITADO', erro: `Produto invalido: ${item.produto_id}` }

    if (item.motivo_refugo_id) {
      const motivo = db
        .prepare('SELECT id FROM motivos_refugo WHERE id = ? AND empresa_id = ? AND ativo = 1')
        .get(item.motivo_refugo_id, user.empresaId)
      if (!motivo) return { status: 'REJEITADO', erro: 'Motivo de refugo invalido' }
    }
  }

  const agora = new Date().toISOString()
  const clienteMs = Date.parse(payload.criado_em_cliente)
  const diffHoras = Number.isFinite(clienteMs) ? Math.abs(Date.now() - clienteMs) / 3600000 : 0
  const observacao =
    diffHoras > 12
      ? `${payload.observacao || ''} [RELOGIO_SUSPEITO]`.trim()
      : payload.observacao || null

  const tx = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO producoes (
        id, empresa_id, turno_id, data_producao, status, observacao,
        criado_por, dispositivo_id, criado_em_cliente, recebido_em_servidor, versao
      ) VALUES (?, ?, ?, ?, 'pendente_validacao', ?, ?, ?, ?, ?, 1)
    `
    ).run(
      payload.id,
      user.empresaId,
      payload.turno_id,
      payload.data_producao,
      observacao,
      user.id,
      dispositivoId || null,
      payload.criado_em_cliente,
      agora
    )

    const insertItem = db.prepare(`
      INSERT INTO itens_producao (
        id, producao_id, empresa_id, produto_id, lote_id,
        quantidade_produzida, quantidade_refugo, motivo_refugo_id, consumo_argila, criado_em
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    const updateLote = db.prepare(`
      UPDATE lotes SET quantidade_produzida = quantidade_produzida + ?, atualizado_em = ?
      WHERE id = ? AND empresa_id = ?
    `)

    for (const item of payload.itens) {
      const itemId = item.id || uuid()
      insertItem.run(
        itemId,
        payload.id,
        user.empresaId,
        item.produto_id,
        item.lote_id || null,
        item.quantidade_produzida,
        item.quantidade_refugo || 0,
        item.motivo_refugo_id || null,
        item.consumo_argila ?? null,
        agora
      )

      if (item.lote_id) {
        const lote = db
          .prepare('SELECT id, ativo FROM lotes WHERE id = ? AND empresa_id = ?')
          .get(item.lote_id, user.empresaId)
        if (!lote || !lote.ativo) {
          throw new Error('Lote invalido ou inativo')
        }
        updateLote.run(
          item.quantidade_produzida - (item.quantidade_refugo || 0),
          agora,
          item.lote_id,
          user.empresaId
        )
      }
    }
  })

  try {
    tx()
  } catch (e) {
    return { status: 'REJEITADO', erro: e.message }
  }

  audit({
    empresaId: user.empresaId,
    entidade: 'producao',
    entidadeId: payload.id,
    acao: 'criar',
    usuarioId: user.id,
    dispositivoId,
    valorNovo: payload
  })

  return { status: 'ACEITO', id: payload.id }
}

router.post('/', requirePerm('producao.criar'), (req, res) => {
  const parsed = producaoSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ erro: 'Dados invalidos', detalhes: parsed.error.flatten() })
  }

  const result = criarProducao(parsed.data, req.user, req.dispositivoId)
  if (result.status === 'REJEITADO') {
    return res.status(400).json({ erro: result.erro })
  }
  if (result.status === 'JA_RECEBIDO') {
    return res.status(200).json({ status: 'JA_RECEBIDO', id: result.id })
  }
  res.status(201).json({ status: 'ACEITO', id: result.id })
})

router.get('/', requirePerm('producao.listar'), (req, res) => {
  const { de, ate, status } = req.query
  let sql = `
    SELECT p.*, t.nome as turno_nome, u.nome as criado_por_nome
    FROM producoes p
    JOIN turnos t ON t.id = p.turno_id
    JOIN usuarios u ON u.id = p.criado_por
    WHERE p.empresa_id = ?
  `
  const params = [req.user.empresaId]

  if (req.user.perfil === 'operador') {
    sql += ' AND p.criado_por = ?'
    params.push(req.user.id)
  }
  if (de) {
    sql += ' AND p.data_producao >= ?'
    params.push(de)
  }
  if (ate) {
    sql += ' AND p.data_producao <= ?'
    params.push(ate)
  }
  if (status) {
    sql += ' AND p.status = ?'
    params.push(status)
  }

  sql += ' ORDER BY p.recebido_em_servidor DESC LIMIT 200'
  const rows = db.prepare(sql).all(...params)

  const itensStmt = db.prepare(`
    SELECT i.*, pr.nome as produto_nome, m.nome as motivo_nome
    FROM itens_producao i
    JOIN produtos pr ON pr.id = i.produto_id
    LEFT JOIN motivos_refugo m ON m.id = i.motivo_refugo_id
    WHERE i.producao_id = ?
  `)

  const resultado = rows.map((r) => ({ ...r, itens: itensStmt.all(r.id) }))
  res.json(resultado)
})

router.post('/:id/validar', requirePerm('producao.validar'), (req, res) => {
  const row = db
    .prepare('SELECT * FROM producoes WHERE id = ? AND empresa_id = ?')
    .get(req.params.id, req.user.empresaId)
  if (!row) return res.status(404).json({ erro: 'Producao nao encontrada' })
  if (row.status === 'cancelado') return res.status(400).json({ erro: 'Producao cancelada' })
  if (row.status === 'validado') return res.json({ ok: true, status: 'validado' })

  const ts = new Date().toISOString()
  db.prepare(
    `
    UPDATE producoes SET status = 'validado', validado_por = ?, validado_em = ?, versao = versao + 1
    WHERE id = ? AND empresa_id = ?
  `
  ).run(req.user.id, ts, row.id, req.user.empresaId)

  audit({
    empresaId: req.user.empresaId,
    entidade: 'producao',
    entidadeId: row.id,
    acao: 'validar',
    usuarioId: req.user.id,
    valorAntigo: { status: row.status },
    valorNovo: { status: 'validado' },
    ip: req.ip
  })
  res.json({ ok: true, status: 'validado' })
})

router.post('/:id/cancelar', requirePerm('producao.cancelar'), (req, res) => {
  const motivo = String(req.body?.motivo || '').trim()
  if (!motivo || motivo.length < 3) {
    return res.status(400).json({ erro: 'Motivo de cancelamento obrigatorio' })
  }

  const row = db
    .prepare('SELECT * FROM producoes WHERE id = ? AND empresa_id = ?')
    .get(req.params.id, req.user.empresaId)
  if (!row) return res.status(404).json({ erro: 'Producao nao encontrada' })
  if (row.status === 'cancelado') return res.json({ ok: true })

  const ts = new Date().toISOString()
  const tx = db.transaction(() => {
    const itens = db.prepare('SELECT * FROM itens_producao WHERE producao_id = ?').all(row.id)
    const reverterEstoque = db.prepare(`
      UPDATE lotes SET quantidade_produzida = quantidade_produzida - ?, atualizado_em = ?
      WHERE id = ? AND empresa_id = ? AND (quantidade_produzida - quantidade_expedida) >= ?
    `)

    for (const item of itens) {
      if (!item.lote_id) continue
      const pecasBoas = item.quantidade_produzida - item.quantidade_refugo
      if (pecasBoas <= 0) continue
      const resultado = reverterEstoque.run(
        pecasBoas,
        ts,
        item.lote_id,
        req.user.empresaId,
        pecasBoas
      )
      if (resultado.changes === 0) {
        throw new AppError(
          409,
          'Cancelamento bloqueado: parte do lote desta produção já foi expedida'
        )
      }
    }

    db.prepare(
      `
      UPDATE producoes
      SET status = 'cancelado', cancelado_em = ?, cancelado_por = ?, motivo_cancelamento = ?, versao = versao + 1
      WHERE id = ? AND empresa_id = ?
    `
    ).run(ts, req.user.id, motivo, row.id, req.user.empresaId)
  })

  try {
    tx()
  } catch (e) {
    if (e instanceof AppError) throw e
    throw new AppError(409, e.message)
  }

  audit({
    empresaId: req.user.empresaId,
    entidade: 'producao',
    entidadeId: row.id,
    acao: 'cancelar',
    usuarioId: req.user.id,
    valorAntigo: { status: row.status },
    valorNovo: { status: 'cancelado', motivo },
    ip: req.ip
  })
  res.json({ ok: true })
})

export { criarProducao, producaoSchema }
export default router
