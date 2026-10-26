import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { z } from 'zod'
import db from '../db/connection.js'
import { authenticate } from '../middleware/auth.js'
import { requirePerm } from '../utils/permissions.js'
import { audit } from '../utils/audit.js'

const router = Router()
router.use(authenticate)

const itemSchema = z.object({
  id: z.string().uuid().optional(),
  lote_id: z.string().uuid(),
  produto_id: z.string().uuid(),
  quantidade: z.number().int().positive().max(100000)
})

const entregaSchema = z.object({
  id: z.string().uuid(),
  obra_id: z.string().uuid(),
  veiculo_id: z.string().uuid(),
  motorista_id: z.string().uuid().optional().nullable(),
  observacao: z.string().max(500).optional().nullable(),
  saida_em: z.string().optional().nullable(),
  saida_lat: z.number().optional().nullable(),
  saida_lng: z.number().optional().nullable(),
  criado_em_cliente: z.string(),
  itens: z.array(itemSchema).min(1)
})

function criarEntrega(payload, user, dispositivoId) {
  const existente = db
    .prepare('SELECT id FROM entregas WHERE empresa_id = ? AND id = ?')
    .get(user.empresaId, payload.id)
  if (existente) {
    return { status: 'JA_RECEBIDO', id: payload.id }
  }

  const obra = db
    .prepare('SELECT id FROM obras WHERE id = ? AND empresa_id = ? AND ativo = 1')
    .get(payload.obra_id, user.empresaId)
  if (!obra) return { status: 'REJEITADO', erro: 'Obra invalida ou inativa' }

  const veiculo = db
    .prepare('SELECT id FROM veiculos WHERE id = ? AND empresa_id = ? AND ativo = 1')
    .get(payload.veiculo_id, user.empresaId)
  if (!veiculo) return { status: 'REJEITADO', erro: 'Veiculo invalido ou inativo' }

  for (const item of payload.itens) {
    const lote = db
      .prepare(
        `
      SELECT id, ativo, produto_id, quantidade_produzida, quantidade_expedida
      FROM lotes WHERE id = ? AND empresa_id = ?
    `
      )
      .get(item.lote_id, user.empresaId)

    if (!lote || !lote.ativo) {
      return { status: 'REJEITADO', erro: `Lote invalido ou inativo: ${item.lote_id}` }
    }
    if (lote.produto_id !== item.produto_id) {
      return { status: 'REJEITADO', erro: 'Produto do item nao confere com o lote' }
    }
    const saldo = lote.quantidade_produzida - lote.quantidade_expedida
    if (item.quantidade > saldo) {
      return { status: 'REJEITADO', erro: `Quantidade excede saldo do lote (${saldo})` }
    }
  }

  const agora = new Date().toISOString()
  const saidaEm = payload.saida_em || agora

  const tx = db.transaction(() => {
    db.prepare(
      `
      INSERT INTO entregas (
        id, empresa_id, obra_id, veiculo_id, motorista_id, status,
        saida_em, saida_lat, saida_lng, observacao,
        criado_por, dispositivo_id, criado_em_cliente, recebido_em_servidor, versao
      ) VALUES (?, ?, ?, ?, ?, 'saida_registrada', ?, ?, ?, ?, ?, ?, ?, ?, 1)
    `
    ).run(
      payload.id,
      user.empresaId,
      payload.obra_id,
      payload.veiculo_id,
      payload.motorista_id || user.id,
      saidaEm,
      payload.saida_lat ?? null,
      payload.saida_lng ?? null,
      payload.observacao || null,
      user.id,
      dispositivoId || null,
      payload.criado_em_cliente,
      agora
    )

    const insertItem = db.prepare(`
      INSERT INTO itens_entrega (id, entrega_id, empresa_id, lote_id, produto_id, quantidade, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    const updateLote = db.prepare(`
      UPDATE lotes SET quantidade_expedida = quantidade_expedida + ?, atualizado_em = ?
      WHERE id = ? AND empresa_id = ?
    `)
    const insertEvento = db.prepare(`
      INSERT INTO eventos_rastreio (id, empresa_id, entrega_id, lote_id, tipo, usuario_id, lat, lng, criado_em)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (const item of payload.itens) {
      insertItem.run(
        item.id || uuid(),
        payload.id,
        user.empresaId,
        item.lote_id,
        item.produto_id,
        item.quantidade,
        agora
      )
      updateLote.run(item.quantidade, agora, item.lote_id, user.empresaId)
      insertEvento.run(
        uuid(),
        user.empresaId,
        payload.id,
        item.lote_id,
        'qr_saida',
        user.id,
        payload.saida_lat ?? null,
        payload.saida_lng ?? null,
        saidaEm
      )
    }

    if (payload.saida_lat != null && payload.saida_lng != null) {
      insertEvento.run(
        uuid(),
        user.empresaId,
        payload.id,
        null,
        'gps_saida',
        user.id,
        payload.saida_lat,
        payload.saida_lng,
        saidaEm
      )
    }
  })

  try {
    tx()
  } catch (e) {
    return { status: 'REJEITADO', erro: e.message }
  }

  audit({
    empresaId: user.empresaId,
    entidade: 'entrega',
    entidadeId: payload.id,
    acao: 'criar',
    usuarioId: user.id,
    dispositivoId,
    valorNovo: payload
  })

  return { status: 'ACEITO', id: payload.id }
}

router.post('/', requirePerm('entrega.criar'), (req, res) => {
  const parsed = entregaSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ erro: 'Dados invalidos', detalhes: parsed.error.flatten() })
  }
  const result = criarEntrega(parsed.data, req.user, req.dispositivoId)
  if (result.status === 'REJEITADO') return res.status(400).json({ erro: result.erro })
  if (result.status === 'JA_RECEBIDO')
    return res.status(200).json({ status: 'JA_RECEBIDO', id: result.id })
  res.status(201).json({ status: 'ACEITO', id: result.id })
})

router.get('/', requirePerm('entrega.listar'), (req, res) => {
  let sql = `
    SELECT e.*, o.nome as obra_nome, v.placa as veiculo_placa, u.nome as criado_por_nome
    FROM entregas e
    JOIN obras o ON o.id = e.obra_id
    JOIN veiculos v ON v.id = e.veiculo_id
    JOIN usuarios u ON u.id = e.criado_por
    WHERE e.empresa_id = ?
  `
  const params = [req.user.empresaId]

  if (['conferente', 'motorista'].includes(req.user.perfil)) {
    sql += ' AND (e.criado_por = ? OR e.motorista_id = ?)'
    params.push(req.user.id, req.user.id)
  }
  if (req.query.status) {
    sql += ' AND e.status = ?'
    params.push(req.query.status)
  }

  sql += ' ORDER BY e.recebido_em_servidor DESC LIMIT 200'
  const rows = db.prepare(sql).all(...params)

  const itensStmt = db.prepare(`
    SELECT i.*, l.codigo as lote_codigo, p.nome as produto_nome
    FROM itens_entrega i
    JOIN lotes l ON l.id = i.lote_id
    JOIN produtos p ON p.id = i.produto_id
    WHERE i.entrega_id = ?
  `)

  res.json(rows.map((r) => ({ ...r, itens: itensStmt.all(r.id) })))
})

router.post('/:id/confirmar', requirePerm('entrega.confirmar'), (req, res) => {
  const row = db
    .prepare('SELECT * FROM entregas WHERE id = ? AND empresa_id = ?')
    .get(req.params.id, req.user.empresaId)
  if (!row) return res.status(404).json({ erro: 'Entrega nao encontrada' })
  if (row.status === 'cancelada') return res.status(400).json({ erro: 'Entrega cancelada' })
  if (row.status === 'entregue') return res.json({ ok: true, status: 'entregue' })

  const { lat, lng, chegada_em } = req.body || {}
  const agora = chegada_em || new Date().toISOString()

  const tx = db.transaction(() => {
    db.prepare(
      `
      UPDATE entregas
      SET status = 'entregue', chegada_em = ?, chegada_lat = ?, chegada_lng = ?,
          confirmado_por = ?, confirmado_em = ?, versao = versao + 1
      WHERE id = ? AND empresa_id = ?
    `
    ).run(agora, lat ?? null, lng ?? null, req.user.id, agora, row.id, req.user.empresaId)

    db.prepare(
      `
      INSERT INTO eventos_rastreio (id, empresa_id, entrega_id, lote_id, tipo, usuario_id, lat, lng, criado_em)
      VALUES (?, ?, ?, NULL, 'confirmacao', ?, ?, ?, ?)
    `
    ).run(uuid(), req.user.empresaId, row.id, req.user.id, lat ?? null, lng ?? null, agora)

    if (lat != null && lng != null) {
      db.prepare(
        `
        INSERT INTO eventos_rastreio (id, empresa_id, entrega_id, lote_id, tipo, usuario_id, lat, lng, criado_em)
        VALUES (?, ?, ?, NULL, 'gps_chegada', ?, ?, ?, ?)
      `
      ).run(uuid(), req.user.empresaId, row.id, req.user.id, lat, lng, agora)
    }
  })
  tx()

  audit({
    empresaId: req.user.empresaId,
    entidade: 'entrega',
    entidadeId: row.id,
    acao: 'confirmar',
    usuarioId: req.user.id,
    valorNovo: { status: 'entregue', lat, lng },
    ip: req.ip
  })
  res.json({ ok: true, status: 'entregue' })
})

router.post('/:id/cancelar', requirePerm('entrega.cancelar'), (req, res) => {
  const motivo = String(req.body?.motivo || '').trim()
  if (!motivo || motivo.length < 3) {
    return res.status(400).json({ erro: 'Motivo de cancelamento obrigatorio' })
  }

  const row = db
    .prepare('SELECT * FROM entregas WHERE id = ? AND empresa_id = ?')
    .get(req.params.id, req.user.empresaId)
  if (!row) return res.status(404).json({ erro: 'Entrega nao encontrada' })
  if (row.status === 'cancelada') return res.json({ ok: true })

  const agora = new Date().toISOString()
  const tx = db.transaction(() => {
    const itens = db.prepare('SELECT * FROM itens_entrega WHERE entrega_id = ?').all(row.id)
    const devolver = db.prepare(`
      UPDATE lotes SET quantidade_expedida = quantidade_expedida - ?, atualizado_em = ?
      WHERE id = ? AND empresa_id = ?
    `)
    for (const item of itens) {
      devolver.run(item.quantidade, agora, item.lote_id, req.user.empresaId)
    }
    db.prepare(
      `
      UPDATE entregas
      SET status = 'cancelada', cancelado_em = ?, cancelado_por = ?, motivo_cancelamento = ?, versao = versao + 1
      WHERE id = ? AND empresa_id = ?
    `
    ).run(agora, req.user.id, motivo, row.id, req.user.empresaId)
  })
  tx()

  audit({
    empresaId: req.user.empresaId,
    entidade: 'entrega',
    entidadeId: row.id,
    acao: 'cancelar',
    usuarioId: req.user.id,
    valorNovo: { motivo },
    ip: req.ip
  })
  res.json({ ok: true })
})

router.get('/:id/timeline', requirePerm('entrega.listar'), (req, res) => {
  const entrega = db
    .prepare('SELECT * FROM entregas WHERE id = ? AND empresa_id = ?')
    .get(req.params.id, req.user.empresaId)
  if (!entrega) return res.status(404).json({ erro: 'Entrega nao encontrada' })

  const eventos = db
    .prepare(
      `
    SELECT ev.*, u.nome as usuario_nome, l.codigo as lote_codigo
    FROM eventos_rastreio ev
    LEFT JOIN usuarios u ON u.id = ev.usuario_id
    LEFT JOIN lotes l ON l.id = ev.lote_id
    WHERE ev.entrega_id = ?
    ORDER BY ev.criado_em ASC
  `
    )
    .all(entrega.id)

  res.json({ entrega, eventos })
})

export { criarEntrega, entregaSchema }
export default router
